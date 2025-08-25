// Smooth hand-off: build (180°→0°) crossfades into ±25° shake while particles fade out.
// Then disintegrate, wait 1s, and repeat forever.

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const MOUNT   = document.getElementById('hero3d');
const IMG_SRC = 'assets/images/Personal_Logo2.png';

const SETTINGS = {
  LOGO_DIAMETER: 6.0,
  IMAGE_FIT: 0.81,

  BUILD: {
    step: 3,
    alphaCutoff: 12,
    startJitter: 1.2,
    minDur: 2.0,
    maxDur: 4.0,
    planeFadeAt: 0.92
  },

  // NEW: smooth crossfade region (in average build progress space)
  HANDOFF: {
    startProg: 0.94,  // begin blending to shake when avg build >= 94%
    endProg:   1.00   // fully in shake by 100%
  },

  SHAKE: {
    secs: 8.0,
    maxYawDeg: 25,
    speed: 0.5
  },

  EXIT: {
    startJitter: 0.5,
    minDur: 1.0,
    maxDur: 1.8,
    pushDistance: 6.0
  },

  LOOP: {
    rebuildDelay: 1.0
  },

  PARTICLES: {
    color: 0x6be3ff,
    size: 0.06
  }
};

const scene = new THREE.Scene();
scene.background = null;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(MOUNT.clientWidth, MOUNT.clientHeight);
MOUNT.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(28, MOUNT.clientWidth / MOUNT.clientHeight, 0.1, 100);
camera.position.set(0, 0, 10);
scene.add(camera);

const ambient = new THREE.AmbientLight(0x66dfff, 0.6);
const rim = new THREE.DirectionalLight(0x33ccff, 0.7);
rim.position.set(0, 0, 5);
scene.add(ambient, rim);

const spinner = new THREE.Group();
scene.add(spinner);

// Helpers
const easeOutExpo = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const easeInCubic = t => t * t * t;
const clamp01 = v => Math.max(0, Math.min(1, v));
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const clock = new THREE.Clock();

// Phases
const PHASES = { BUILD_SPIN:0, SHAKE:1, EXIT:2, WAIT:3 };
let phase = PHASES.BUILD_SPIN;
let tPhaseStart = 0;

// Spin state
const MAX_YAW = THREE.MathUtils.degToRad(SETTINGS.SHAKE.maxYawDeg);
let shakePhase = 0;

// Geometry data
let geo, points, plane, bounds, scale;
let N = 0;
let startPositions, endPositions, exitPositions;
let startTimesBuild, durationsBuild;
let startTimesExit, durationsExit;
let avgBuildProgress = 0;

(async function init() {
  const img = await loadImage(IMG_SRC);
  const samples = sampleImageToPoints(img, {
    step: SETTINGS.BUILD.step, alphaCutoff: SETTINGS.BUILD.alphaCutoff
  });
  bounds = samples.bounds;

  scale = (SETTINGS.LOGO_DIAMETER * SETTINGS.IMAGE_FIT) / Math.max(bounds.w, bounds.h);
  const centeredTargets = samples.targets.map(p => new THREE.Vector3(
    (p.x - bounds.cx) * scale,
    (bounds.cy - p.y) * scale,
    0
  ));

  N = centeredTargets.length;
  endPositions  = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const v = centeredTargets[i];
    endPositions[i*3+0] = v.x;
    endPositions[i*3+1] = v.y;
    endPositions[i*3+2] = v.z;
  }

  // Geometry with large static bounding sphere (prevents flicker)
  geo = new THREE.BufferGeometry();
  const maxR = SETTINGS.LOGO_DIAMETER * 2 + SETTINGS.EXIT.pushDistance + 2.0;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0,0,0), maxR);

  const mat = new THREE.PointsMaterial({
    color: SETTINGS.PARTICLES.color,
    size: SETTINGS.PARTICLES.size,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 1.0
  });

  points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  spinner.add(points);

  const tex = await new THREE.TextureLoader().loadAsync(IMG_SRC);
  tex.colorSpace = THREE.SRGBColorSpace;
  plane = new THREE.Mesh(
    new THREE.PlaneGeometry(bounds.w * scale, bounds.h * scale),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.0, depthWrite: false })
  );
  plane.renderOrder = 1;
  spinner.add(plane);

  prepareBuildCycle();
  renderer.setAnimationLoop(tick);
})();

function prepareBuildCycle(){
  startPositions = new Float32Array(N*3);
  exitPositions  = new Float32Array(N*3);

  const PAD   = SETTINGS.LOGO_DIAMETER * 0.75;
  const halfW = (bounds.w * scale) / 2 + PAD;
  const halfH = (bounds.h * scale) / 2 + PAD;

  for (let i = 0; i < N; i++) {
    const edge = Math.floor(Math.random() * 4);
    let sx = 0, sy = 0, sz = (Math.random() * 2 - 1) * 0.8;
    if      (edge === 0) { sx = -halfW; sy = randBetween(-halfH, halfH); }
    else if (edge === 1) { sx =  halfW; sy = randBetween(-halfH, halfH); }
    else if (edge === 2) { sx = randBetween(-halfW, halfW); sy =  halfH; }
    else                 { sx = randBetween(-halfW, halfW); sy = -halfH; }

    const ix = i*3;
    startPositions[ix+0] = sx;
    startPositions[ix+1] = sy;
    startPositions[ix+2] = sz;

    // exit vector from final position
    const vx = endPositions[ix+0], vy = endPositions[ix+1];
    const len = Math.hypot(vx, vy) || 1;
    const dx = vx / len, dy = vy / len;
    const mag = SETTINGS.EXIT.pushDistance + Math.random() * (SETTINGS.LOGO_DIAMETER * 0.8);
    exitPositions[ix+0] = vx + dx * mag;
    exitPositions[ix+1] = vy + dy * mag;
    exitPositions[ix+2] = (Math.random() * 2 - 1) * 1.2;
  }

  // Fresh attributes (no stale buffers)
  geo.setAttribute('position', new THREE.BufferAttribute(startPositions.slice(), 3));
  geo.setAttribute('target',   new THREE.BufferAttribute(endPositions, 3));

  startTimesBuild = new Float32Array(N);
  durationsBuild  = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    startTimesBuild[i] = Math.random() * SETTINGS.BUILD.startJitter;
    durationsBuild[i]  = SETTINGS.BUILD.minDur + Math.random() *
                        (SETTINGS.BUILD.maxDur - SETTINGS.BUILD.minDur);
  }
  geo.setAttribute('t0', new THREE.BufferAttribute(startTimesBuild, 1));
  geo.setAttribute('td', new THREE.BufferAttribute(durationsBuild, 1));

  startTimesExit = new Float32Array(N);
  durationsExit  = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    startTimesExit[i] = Math.random() * SETTINGS.EXIT.startJitter;
    durationsExit[i]  = SETTINGS.EXIT.minDur + Math.random() *
                        (SETTINGS.EXIT.maxDur - SETTINGS.EXIT.minDur);
  }

  points.visible = true;
  points.material.opacity = 1.0;
  plane.material.opacity  = 0.0;

  // Start at 180° (clockwise toward 0°)
  spinner.rotation.set(0, -Math.PI, 0);
  shakePhase = 0;

  phase = PHASES.BUILD_SPIN;
  tPhaseStart = performance.now() / 1000;
  avgBuildProgress = 0;
}

function tick() {
  const now = performance.now() / 1000;
  const dt  = clock.getDelta();

  const pos = geo.getAttribute('position');
  const tgt = geo.getAttribute('target');
  const t0  = geo.getAttribute('t0');
  const td  = geo.getAttribute('td');

  if (phase === PHASES.BUILD_SPIN) {
    let avg = 0;
    for (let i = 0; i < N; i++) {
      const start = t0.getX(i);
      const dur   = td.getX(i);
      const prog  = clamp01((now - tPhaseStart - start) / dur);
      const e     = easeOutExpo(prog);

      const ix = i*3;
      pos.array[ix+0] = THREE.MathUtils.lerp(startPositions[ix+0], tgt.array[ix+0], e);
      pos.array[ix+1] = THREE.MathUtils.lerp(startPositions[ix+1], tgt.array[ix+1], e);
      pos.array[ix+2] = THREE.MathUtils.lerp(startPositions[ix+2], tgt.array[ix+2], e);

      avg += e;
    }
    avgBuildProgress = avg / N;
    pos.needsUpdate = true;

    // PNG fades in near the end
    if (avgBuildProgress > SETTINGS.BUILD.planeFadeAt) {
      plane.material.opacity = Math.min(1, plane.material.opacity + 0.03);
    }

    // ---------- Smooth hand-off ----------
    const s = smoothstep(SETTINGS.HANDOFF.startProg, SETTINGS.HANDOFF.endProg, avgBuildProgress);
    // base yaw from 180° → 0°
    const yawBuild = THREE.MathUtils.lerp(-Math.PI, 0, avgBuildProgress);
    // shake yaw with ramped amplitude
    shakePhase += SETTINGS.SHAKE.speed * dt * (s > 0 ? 1 : 0); // start ticking only when blending begins
    const yawShake = MAX_YAW * Math.sin(shakePhase) * s;
    // blended yaw (no sudden stop)
    spinner.rotation.y = (1 - s) * yawBuild + yawShake;
    // subtle breathing in X stays
    spinner.rotation.x = Math.sin(now * 0.6) * 0.05;

    // fade particles out during the hand-off, then hide
    const fade = Math.pow(1 - s, 1.5);
    points.material.opacity = fade;
    if (s >= 0.999) points.visible = false;

    // When fully blended AND PNG is visible, we’re officially in SHAKE
    if (s >= 0.999 && plane.material.opacity >= 0.999) {
      phase = PHASES.SHAKE;
      tPhaseStart = now;
    }

  } else if (phase === PHASES.SHAKE) {
    shakePhase += SETTINGS.SHAKE.speed * dt;
    spinner.rotation.y = MAX_YAW * Math.sin(shakePhase);
    spinner.rotation.x = Math.sin(now * 0.6) * 0.05;

    if (now - tPhaseStart >= SETTINGS.SHAKE.secs) {
      points.visible = true;
      points.material.opacity = 1.0;
      phase = PHASES.EXIT;
      tPhaseStart = now;
    }

  } else if (phase === PHASES.EXIT) {
    let done = 0;
    const pAttr = geo.getAttribute('position');
    for (let i = 0; i < N; i++) {
      const start = startTimesExit[i];
      const dur   = durationsExit[i];
      const p     = clamp01((now - tPhaseStart - start) / dur);
      const e     = easeInCubic(p);

      const ix = i*3;
      pAttr.array[ix+0] = THREE.MathUtils.lerp(endPositions[ix+0], exitPositions[ix+0], e);
      pAttr.array[ix+1] = THREE.MathUtils.lerp(endPositions[ix+1], exitPositions[ix+1], e);
      pAttr.array[ix+2] = THREE.MathUtils.lerp(endPositions[ix+2], exitPositions[ix+2], e);

      if (p >= 1) done++;
    }
    pAttr.needsUpdate = true;

    plane.material.opacity = Math.max(0, plane.material.opacity - 0.03);
    if (done >= N) { phase = PHASES.WAIT; tPhaseStart = now; }

  } else if (phase === PHASES.WAIT) {
    if (now - tPhaseStart >= SETTINGS.LOOP.rebuildDelay) {
      prepareBuildCycle();
      return;
    }
  }

  renderer.render(scene, camera);
}


// ------- Utils -------
function randBetween(a,b){ return a + Math.random()*(b-a); }

function loadImage(src){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = ()=> resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function sampleImageToPoints(img, { step=3, alphaCutoff=10 } = {}){
  const c = document.createElement('canvas');
  const maxSide = 512;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  c.width  = Math.floor(img.width  * scale);
  c.height = Math.floor(img.height * scale);

  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;

  const pts = [];
  for (let y = 0; y < c.height; y += step){
    for (let x = 0; x < c.width; x += step){
      const i = (y * c.width + x) * 4;
      const a = data[i+3];
      if (a > alphaCutoff){
        pts.push({ x: x + (Math.random() - .5)*0.6, y: y + (Math.random() - .5)*0.6 });
      }
    }
  }
  return {
    targets: pts,
    bounds: { w: c.width, h: c.height, cx: c.width/2, cy: c.height/2 }
  };
}

// Resize
function onResize(){
  const w = MOUNT.clientWidth;
  const h = MOUNT.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
