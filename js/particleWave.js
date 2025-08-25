// particleWave.js — FULL‑WIDTH side‑view particle sheet (5% margins)
// - Grid of points across X (full width minus margins) and into Z (depth)
// - Camera is centered and auto-positions to fit entire width
// - Sheet is rotated on Y for a nice side glance
// - Cyan <-> Magenta ping‑pong, additive glow, alpha-safe

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

let mount, renderer, scene, camera, points, mat, geo, sheet, raf;

function cssColor(name, fallback) {
  const css = getComputedStyle(document.documentElement);
  const v = (css.getPropertyValue(name) || fallback).trim();
  return new THREE.Color(v);
}

function getStripSize() {
  const css = getComputedStyle(document.documentElement);
  const raw = parseInt(css.getPropertyValue("--strip-height")) || 100;
  const h = Math.max(72, Math.min(raw, 140));
  const w = (mount?.clientWidth || window.innerWidth);
  return { w, h };
}

function makeRenderer(w, h) {
  const r = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    premultipliedAlpha: false, // avoid black under CSS mask
  });
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.setClearColor(0x000000, 0);
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.setSize(w, h, false);
  return r;
}

// compute camera Z so a given half-width fits horizontally in the frustum
function fitWidthZ(fovDeg, aspect, halfWidth, pad = 1.02) {
  const v = THREE.MathUtils.degToRad(fovDeg);
  const hfov2 = Math.atan(Math.tan(v / 2) * aspect); // half horizontal FOV (radians)
  return (halfWidth * pad) / Math.tan(hfov2);
}

function makeCamera(w, h, halfWidth) {
  const fov = 35;
  const cam = new THREE.PerspectiveCamera(fov, w / h, 0.1, 4000);
  cam.position.set(0, h * 0.02, fitWidthZ(fov, w / h, halfWidth));
  cam.lookAt(0, 0, 0);
  return cam;
}

function buildGeometry(width, h) {
  const depth = Math.max(60, Math.min(width * 0.45, 360));
  // density based on pixels of the visible width (not the container width)
  const spacingX = Math.max(6, Math.floor(width / 220));
  const spacingZ = 8;

  const cols = Math.max(220, Math.floor(width / spacingX));
  const rows = Math.max(14, Math.floor(depth / spacingZ));

  const count = cols * rows;
  const positions = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);

  const halfW = width / 2;
  const x0 = -halfW;
  const z0 = -depth * 0.5;

  let i3 = 0, i2 = 0;
  for (let r = 0; r < rows; r++) {
    const z = z0 + (r / (rows - 1)) * depth;
    for (let c = 0; c < cols; c++) {
      const x = x0 + (c / (cols - 1)) * width;
      positions[i3++] = x;
      positions[i3++] = 0;
      positions[i3++] = z;
      uv[i2++] = c / (cols - 1);
      uv[i2++] = r / (rows - 1);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.userData = { cols, rows, halfW, depth };
  return g;
}

function makeMaterial(w, h) {
  const CYAN = cssColor("--cyan", "#48e1ff");
  const MAGENTA = cssColor("--magenta", "#ff3df7");

  const uniforms = {
    uTime: { value: 0 },
    uCyan: { value: new THREE.Vector3(CYAN.r, CYAN.g, CYAN.b) },
    uMagenta: { value: new THREE.Vector3(MAGENTA.r, MAGENTA.g, MAGENTA.b) },
    uAmp: { value: h * 0.16 },
    uFreqX1: { value: 2.2 },
    uFreqX2: { value: 5.4 },
    uFreqZ: { value: 3.4 },
    uSpeed1: { value: 1.25 },
    uSpeed2: { value: 0.85 },
    uSize: { value: 2.2 },
  };

  return new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader: /* glsl */`
      uniform float uTime, uAmp, uFreqX1, uFreqX2, uFreqZ, uSpeed1, uSpeed2, uSize;
      varying float vMix;
      varying float vFade;

      void main(){
        vec3 pos = position;
        float nx = pos.x * 0.01;
        float nz = pos.z * 0.02;

        float yOff =
            sin(nx * uFreqX1 + uTime * uSpeed1 + nz * uFreqZ * 0.6) * uAmp +
            sin(nx * uFreqX2 - uTime * uSpeed2 + nz * uFreqZ) * (uAmp * 0.45);
        pos.y += yOff;

        vMix  = 0.5 + 0.5 * sin(uTime * 0.7 + nx * 0.4 + nz * 0.2);
        vFade = clamp(1.0 - (pos.z + 180.0) / 360.0, 0.0, 1.0);

        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mv;

        float size = uSize * (100.0 / -mv.z);
        gl_PointSize = size;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uCyan, uMagenta;
      varying float vMix;
      varying float vFade;

      void main(){
        vec2 p = gl_PointCoord - 0.5;
        float d = length(p) * 2.0;
        float circle = smoothstep(1.0, 0.72, 1.0 - d);
        vec3 col = mix(uCyan, uMagenta, vMix);
        float alpha = circle * vFade * 0.95;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

function init() {
  mount = document.getElementById("particleWave");
  if (!mount) return;

  if (raf) cancelAnimationFrame(raf);
  if (renderer) renderer.dispose();
  mount.innerHTML = "";

  const { w, h } = getStripSize();

  // 5% margins left/right
  const margin = w * 0.025;
  const visibleWidth = Math.max(10, w - margin * 2);
  const halfVisible = visibleWidth / 2;

  renderer = makeRenderer(w, h);
  mount.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = makeCamera(w, h, halfVisible);

  // Build the sheet and rotate slightly for a side look
  geo = buildGeometry(visibleWidth, h);
  mat = makeMaterial(visibleWidth, h);
  points = new THREE.Points(geo, mat);

  sheet = new THREE.Group();
  sheet.add(points);
  sheet.rotation.y = THREE.MathUtils.degToRad(15); // side angle
  scene.add(sheet);
  
  window.addEventListener("resize", onResize, { passive: true });

  (function loop() {
    raf = requestAnimationFrame(loop);
    mat.uniforms.uTime.value = (performance.now() || 0) * 0.001;
    renderer.render(scene, camera);
  })();
}

function onResize() {
  if (!mount || !renderer || !camera) return;
  const { w, h } = getStripSize();

  const margin = w * 0.05;
  const visibleWidth = Math.max(10, w - margin * 2);
  const halfVisible = visibleWidth / 2;

  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.position.z = fitWidthZ(camera.fov, camera.aspect, halfVisible);
  camera.updateProjectionMatrix();

  if (points) {
    sheet.remove(points);
    geo.dispose();
    mat.dispose();
  }
  geo = buildGeometry(visibleWidth, h);
  mat = makeMaterial(visibleWidth, h);
  points = new THREE.Points(geo, mat);
  sheet.add(points);
}

window.addEventListener("DOMContentLoaded", init);
