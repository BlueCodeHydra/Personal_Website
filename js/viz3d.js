// js/viz3d.js
// One Three.js viewer used by the Skills canvases.
// - Drag to rotate (OrbitControls)
// - Wheel/pinch zoom
// - Auto-center + fit so the model fills the canvas
// - Optional auto-rotate resumes after user inactivity
//
// Requires the import map in index.html that maps "three" and "three/addons/*"
// to the same version (already present in your page).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader }   from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader }    from 'three/addons/loaders/OBJLoader.js';

function makeViewer(canvas, modelUrl, opts = {}) {
  const {
    fov = 38,
    autoRotateAfterIdleMs = 3500,   // start gentle orbit if user stops interacting
    autoRotateSpeed = 0.5,
    allowPan = false                // keep camera centered by default
  } = opts;

  // Renderer / Scene / Camera
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  const scene    = new THREE.Scene();
  const camera   = new THREE.PerspectiveCamera(fov, 1, 0.01, 5000);

  // Lights tuned for dark theme
  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(3, 4, 5);
  scene.add(key);

  // Orbit controls: rotate (drag), zoom, optional pan
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableRotate = true;              // drag to orbit
  controls.enableZoom   = true;              // wheel / pinch
  controls.enablePan    = !!allowPan;        // usually nicer off in these slots
  controls.zoomSpeed    = 0.85;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotate = false;               // we’ll enable after idle
  controls.autoRotateSpeed = autoRotateSpeed;

  // Prevent page scroll while zooming on canvas
  renderer.domElement.addEventListener('wheel', e => e.preventDefault(), { passive: false });

  // Responsive + HiDPI
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth | 0;
    const h = canvas.clientHeight | 0;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = (h === 0 ? 1 : w / h);
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);

  // Idle auto-rotate: pause on interaction, resume after N ms
  let idleTimer = null;
  function kickIdleTimer() {
    controls.autoRotate = false;
    if (idleTimer) clearTimeout(idleTimer);
    if (autoRotateAfterIdleMs > 0) {
      idleTimer = setTimeout(() => { controls.autoRotate = true; }, autoRotateAfterIdleMs);
    }
  }
  ['pointerdown','pointermove','wheel','touchstart','touchmove'].forEach(evt =>
    renderer.domElement.addEventListener(evt, kickIdleTimer, { passive:true })
  );
  kickIdleTimer(); // start the timer

  // Load model (GLB/GLTF or OBJ)
  const lower = (modelUrl || '').toLowerCase();
  const isGLB = lower.endsWith('.glb') || lower.endsWith('.gltf');
  const loader = isGLB ? new GLTFLoader() : new OBJLoader();

  loader.load(modelUrl, (asset) => {
    const object = isGLB ? (asset.scene || asset.scenes?.[0]) : asset;
    if (!object) { console.error('[viz3d] Empty model:', modelUrl); return; }

    // Center, fit, and set zoom bounds
    const fitDist = centerAndFit(object, camera, /*frame*/ 0.86);
    controls.minDistance = fitDist * 0.28;  // how close you can zoom
    controls.maxDistance = fitDist * 3.6;   // how far you can zoom out
    controls.update();

    scene.add(object);
  }, undefined, (err) => {
    console.error('[viz3d] Model load error:', err);
  });

  // Double-click to refit and restart idle orbit countdown
  renderer.domElement.addEventListener('dblclick', () => {
    controls.reset();
    kickIdleTimer();
  });

  // Render loop
  (function animate(){
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  })();
}

// Center the object at origin and fit it to the view.
function centerAndFit(object, cam, frame = 0.9) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  object.position.sub(center); // center it

  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const vFov = THREE.MathUtils.degToRad(cam.fov);
  const fitHeightDist = (maxDim / frame) / (2 * Math.tan(vFov / 2));
  const fitWidthDist  = fitHeightDist / cam.aspect;
  const dist = 1.08 * Math.max(fitHeightDist, fitWidthDist); // small padding

  cam.position.set(0, 0, dist);
  cam.near = Math.max(0.01, dist / 1000);
  cam.far  = dist * 2000;
  cam.updateProjectionMatrix();

  return dist;
}

// Public API: pass a map of canvasId -> modelUrl
export function mountVizModels(map) {
  Object.entries(map).forEach(([id, url]) => {
    const canvas = document.getElementById(id);
    if (!canvas) { console.warn('[viz3d] No canvas:', id); return; }
    makeViewer(canvas, url, {});
  });
}
