// js/viz3d.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader }  from 'three/addons/loaders/GLTFLoader.js';

function mountGLB(canvasId, glbUrl, { autoRotate=true, rotateSpeed=0.6 } = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(2.4, 1.6, 3.0);

  const key  = new THREE.DirectionalLight(0x9beaff, 1.0); key.position.set(4,6,8);
  const fill = new THREE.DirectionalLight(0x00ffc6, 0.6); fill.position.set(-6,3,-4);
  const rim  = new THREE.DirectionalLight(0x48e1ff, 0.5); rim.position.set(-2,5,6);
  scene.add(key, fill, rim, new THREE.AmbientLight(0x335a6a, 0.6));

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.autoRotate = autoRotate;
  controls.autoRotateSpeed = rotateSpeed;
  controls.minDistance = 5;
  controls.maxDistance = 1.1;

  function resize(){
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width|0), h = Math.max(1, r.height|0);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize(); addEventListener('resize', resize);

  const loader = new GLTFLoader();
  loader.load(glbUrl, (gltf)=>{
    const root = gltf.scene;
    const box  = new THREE.Box3().setFromObject(root);
    const c    = box.getCenter(new THREE.Vector3());
    root.position.sub(c);
    const size = box.getSize(new THREE.Vector3()).length() || 1;
    root.scale.setScalar(2.2 / size);
    // If model looks on its side, uncomment:
    // root.rotation.x = -Math.PI/2;
    scene.add(root);
  }, undefined, (e)=>console.error('GLB load error', glbUrl, e));

  (function tick(){
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  })();
}

export function mountVizModels(map){
  Object.entries(map).forEach(([id, v])=>{
    if (typeof v === 'string') mountGLB(id, v);
    else mountGLB(id, v.url, v.options || {});
  });
}
