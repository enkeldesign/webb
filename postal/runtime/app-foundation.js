'use strict';
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const simulation = new PostalSimulation({ seed: 12 });
let currentLevel = 'depot';
let currentCityId = 'sundsvall';
let selectedPackageId = null;
let visualTime = 0;
let lastFrame = performance.now();
let lastUiUpdate = 0;

const app = {
  canvas: $('#scene'),
  viewport: $('.viewport'),
  levelTitle: $('#level-title'),
  levelSubtitle: $('#level-subtitle'),
  metricOnTime: $('#metric-ontime'),
  metricFlow: $('#metric-flow'),
  metricIssues: $('#metric-issues'),
  issueBadge: $('#issue-badge'),
  live: $('#live-region'),
  pause: $('#pause-btn'),
  eventRibbon: $('#event-ribbon'),
  eventText: $('#event-text'),
  sheet: $('#sheet'),
  sheetTitle: $('#sheet-title'),
  sheetBody: $('#sheet-body'),
  sheetClose: $('#sheet-close'),
  loader: $('#loader'),
  loaderCopy: $('#loader-copy'),
  fallback: $('#scene-fallback')
};

let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas: app.canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
} catch (error) {
  console.warn('POSTAL is running without WebGL.', error);
  app.canvas.hidden = true;
  app.fallback.hidden = false;
  document.body.classList.add('no-webgl');
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdde9ea);
const camera = new THREE.OrthographicCamera(-8, 8, 8, -8, 0.1, 100);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let world = new THREE.Group();
scene.add(world);

const hemi = new THREE.HemisphereLight(0xf8fcff, 0x527463, 2.35);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff5dc, 3.45);
sun.position.set(9, 15, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -14;
sun.shadow.camera.right = 14;
sun.shadow.camera.top = 14;
sun.shadow.camera.bottom = -14;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xb9e5df, 1.15);
fill.position.set(-8, 7, -6);
scene.add(fill);

const loader = new GLTFLoader();
const assets = new Map();
const manifest = {
  workerA: './assets/kenney/characters/character-female-c.glb',
  workerB: './assets/kenney/characters/character-male-e.glb',
  workerC: './assets/kenney/characters/character-male-c.glb',
  suburbanA: './assets/kenney/city-suburban/building-type-a.glb',
  suburbanH: './assets/kenney/city-suburban/building-type-h.glb',
  suburbanL: './assets/kenney/city-suburban/building-type-l.glb',
  treeLarge: './assets/kenney/suburban/tree-large.glb',
  treeSmall: './assets/kenney/suburban/tree-small.glb',
  commercialA: './assets/kenney/city-commercial/building-a.glb',
  commercialH: './assets/kenney/city-commercial/building-h.glb',
  skyscraper: './assets/kenney/city-commercial/building-skyscraper-a.glb',
  industrialB: './assets/kenney/city-industrial/building-b.glb',
  industrialS: './assets/kenney/city-industrial/building-s.glb',
  industrialT: './assets/kenney/city-industrial/building-t.glb',
  depotDoor: './assets/factory/structure-doorway-wide.glb',
  depotWindow: './assets/factory/structure-window-wide.glb',
  handoffArrow: './assets/factory/indicator-special-arrow.glb',
  truck: './assets/vehicles/post-truck.glb',
  conveyor: './assets/factory/conveyor-long-stripe-sides.glb',
  conveyorJunction: './assets/factory/conveyor-stripe-sides-junction-t.glb',
  scanner: './assets/factory/scanner-high.glb',
  screen: './assets/factory/screen-panel-wide.glb',
  lever: './assets/factory/lever-double.glb',
  boxSmall: './assets/factory/box-small.glb',
  boxLarge: './assets/factory/box-large.glb',
  roadCross: './assets/kenney/roads/road-crossroad.glb',
  roadStraight: './assets/kenney/roads/road-straight.glb',
  roadEnd: './assets/kenney/roads/road-end-round.glb',
  roadCrossing: './assets/kenney/roads/road-crossing.glb',
  roadLight: './assets/kenney/roads/light-square-double.glb',
  roadCone: './assets/kenney/roads/construction-cone.glb',
  roadBarrier: './assets/kenney/roads/construction-barrier.glb'
};

async function preloadAssets() {
  const entries = Object.entries(manifest);
  let loaded = 0;
  await Promise.all(entries.map(async ([key, url]) => {
    try {
      const gltf = await loader.loadAsync(url);
      assets.set(key, gltf.scene);
    } catch (err) {
      console.warn(`Asset failed: ${url}`, err);
    } finally {
      loaded += 1;
      const p = Math.round((loaded / entries.length) * 100);
      const progress = $('#load-progress');
      if (progress) progress.style.setProperty('--progress', `${p}%`);
      if (app.loaderCopy) {
        if (p > 78) app.loaderCopy.textContent = 'Connecting the national routes…';
        else if (p > 38) app.loaderCopy.textContent = 'Rolling out roads and equipment…';
      }
    }
  }));
}

function cloneAsset(key, { target = 1, position = [0, 0, 0], rotation = [0, 0, 0], shadow = true } = {}) {
  const src = assets.get(key);
  if (!src) return null;
  const clone = src.clone(true);
  clone.traverse(obj => {
    if (obj.isMesh) {
      obj.castShadow = shadow;
      obj.receiveShadow = shadow;
      // Cached GLB clones share geometry/material resources with the source.
      // Keep those alive when switching views; procedural meshes are still disposed.
      obj.userData.keepGeometry = true;
      obj.userData.keepMaterial = true;
    }
  });
  const box = new THREE.Box3().setFromObject(clone);
  const size = new THREE.Vector3();
  box.getSize(size);
  const max = Math.max(size.x, size.y, size.z) || 1;
  const scale = target / max;
  clone.scale.setScalar(scale);
  const box2 = new THREE.Box3().setFromObject(clone);
  const center = new THREE.Vector3();
  box2.getCenter(center);
  clone.position.set(-center.x, -box2.min.y, -center.z);
  const root = new THREE.Group();
  root.position.set(...position);
  root.rotation.set(...rotation);
  root.add(clone);
  return root;
}

function material(color, roughness = 0.78, metalness = 0.02) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function boxMesh(size, color, pos) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material(color));
  mesh.position.set(...pos);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeLabel(text, { fg = '#102423', bg = 'rgba(255,255,255,.92)', scale = 1, bold = true } = {}) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const dpr = 2;
  const font = `${bold ? 700 : 600} ${24 * dpr}px system-ui, -apple-system, sans-serif`;
  ctx.font = font;
  const width = Math.ceil(ctx.measureText(text).width + 28 * dpr);
  c.width = width;
  c.height = 46 * dpr;
  ctx.scale(dpr, dpr);
  ctx.font = `${bold ? 700 : 600} 24px system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, width / dpr, 46, 13);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.fillText(text, 14, 23);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set((width / dpr) * 0.018 * scale, 0.83 * scale, 1);
  sprite.renderOrder = 50;
  return sprite;
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function addUserData(obj, data) {
  obj.userData = { ...obj.userData, ...data };
  return obj;
}

function addGround(size = 20, color = 0xbfd7c0) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material(color));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.position.y = -0.04;
  world.add(ground);
  return ground;
}

function tubeBetween(a, b, { color = 0xffffff, width = 0.12, y = 0.04, dashed = false } = {}) {
  const points = [new THREE.Vector3(a[0], y, a[1]), new THREE.Vector3(b[0], y, b[1])];
  const curve = new THREE.LineCurve3(...points);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, width, 8, false), material(color));
  mesh.receiveShadow = true;
  world.add(mesh);
  if (dashed) mesh.material.transparent = true, mesh.material.opacity = 0.6;
  return { mesh, curve };
}

function arcCurve(a, b, lift = 1.2) {
  const start = new THREE.Vector3(a[0], a[1] ?? 0.4, a[2]);
  const end = new THREE.Vector3(b[0], b[1] ?? 0.4, b[2]);
  const mid = start.clone().lerp(end, 0.5);
  mid.y += lift;
  return new THREE.QuadraticBezierCurve3(start, mid, end);
}

function routeTube(curve, color = 0x4d6f70, width = 0.055) {
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, width, 8, false), material(color, 0.6, 0.05));
  mesh.receiveShadow = false;
  world.add(mesh);
  return mesh;
}

const viewState = {
  workers: new Map(), packages: new Map(), regionalTrucks: new Map(), nationalTrucks: new Map(), international: new Map(), routeCurves: new Map(),
  cityMarkers: new Map(), workerBadges: new Map(), conveyorParcels: [], roadLights: [], decorative: []
};

function clearWorld() {
  scene.remove(world);
  world.traverse(obj => {
    if (obj.geometry && !obj.userData.keepGeometry) obj.geometry.dispose?.();
    if (obj.material && !obj.userData.keepMaterial) {
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach(item => {
        for (const value of Object.values(item)) {
          if (value?.isTexture) value.dispose?.();
        }
        item.dispose?.();
      });
    }
  });
  world = new THREE.Group();
  scene.add(world);
  for (const map of Object.values(viewState)) {
    if (map instanceof Map) map.clear();
    else if (Array.isArray(map)) map.length = 0;
  }
}

function setCamera(level) {
  if (level === 'depot') {
    camera.position.set(9.6, 11.4, 10.8);
    camera.lookAt(0, 0.7, 0);
  } else if (level === 'region') {
    camera.position.set(9, 13.8, 10.6);
    camera.lookAt(0, 0.3, 0);
  } else {
    camera.position.set(10, 17, 15);
    camera.lookAt(0, 0.3, 0);
  }
  resizeRenderer();
}

function buildScene() {
  clearWorld();
  if (!renderer) {
    updateContextHeader();
    return;
  }
  setCamera(currentLevel);
  if (currentLevel === 'depot') buildDepotScene(currentCityId);
  if (currentLevel === 'region') buildRegionScene(currentCityId);
  if (currentLevel === 'sweden') buildSwedenScene();
  updateContextHeader();
}
