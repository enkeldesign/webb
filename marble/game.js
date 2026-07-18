import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.178.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.178.0/examples/jsm/controls/OrbitControls.js';

const canvas = document.querySelector('#game');
const playButton = document.querySelector('#playButton');
const playLabel = document.querySelector('#playLabel');
const playIcon = document.querySelector('#playIcon');
const undoButton = document.querySelector('#undoButton');
const clearButton = document.querySelector('#clearButton');
const raiseButton = document.querySelector('#raiseButton');
const lowerButton = document.querySelector('#lowerButton');
const selectionPanel = document.querySelector('#selectionPanel');
const heightValue = document.querySelector('#heightValue');
const hint = document.querySelector('#hint');
const toast = document.querySelector('#toast');
const toolButtons = [...document.querySelectorAll('.tool')];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d121a);
scene.fog = new THREE.Fog(0x0d121a, 28, 60);

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 120);
camera.position.set(12, 15, 18);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.target.set(0, 0.5, 0);
controls.minDistance = 8;
controls.maxDistance = 36;
controls.maxPolarAngle = Math.PI * 0.47;
controls.minPolarAngle = Math.PI * 0.18;
controls.screenSpacePanning = false;
controls.touches.ONE = THREE.TOUCH.ROTATE;
controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;

scene.add(new THREE.HemisphereLight(0xcce8ff, 0x15171e, 2.2));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.1);
keyLight.position.set(9, 18, 10);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.left = -18;
keyLight.shadow.camera.right = 18;
keyLight.shadow.camera.top = 18;
keyLight.shadow.camera.bottom = -18;
scene.add(keyLight);

const rim = new THREE.DirectionalLight(0x5ec8ff, 1.2);
rim.position.set(-14, 8, -8);
scene.add(rim);

const board = new THREE.Group();
const buildLayer = new THREE.Group();
const railLayer = new THREE.Group();
const fxLayer = new THREE.Group();
scene.add(board, buildLayer, railLayer, fxLayer);

const tileRadius = 1.08;
const tileDepth = 0.22;
const gridRadius = 5;
const heightStep = 0.82;
const grid = new Map();
const nodes = new Map();
const history = [];
let currentTool = 'node';
let selectedKey = null;
let isRunning = false;
let marble = null;
let runState = null;
let pointerDown = null;
let toastTimer = null;

const colors = {
  tile: 0x1b2430,
  tileEdge: 0x304052,
  tileHover: 0x41647a,
  node: 0xe7edf4,
  nodeSide: 0x8795a5,
  start: 0x7ee787,
  finish: 0xffd866,
  rail: 0x8897a8,
  railDark: 0x3f4b59,
  marble: 0x66d7ff,
};

const tileGeometry = new THREE.CylinderGeometry(tileRadius, tileRadius, tileDepth, 6);
const tileMaterial = new THREE.MeshStandardMaterial({ color: colors.tile, roughness: 0.68, metalness: 0.08 });
const tileHoverMaterial = new THREE.MeshStandardMaterial({ color: colors.tileHover, roughness: 0.55, metalness: 0.12 });

function axialToWorld(q, r) {
  const x = tileRadius * Math.sqrt(3) * (q + r / 2);
  const z = tileRadius * 1.5 * r;
  return new THREE.Vector3(x, 0, z);
}

function keyOf(q, r) { return `${q},${r}`; }
function parseKey(key) { return key.split(',').map(Number); }

for (let q = -gridRadius; q <= gridRadius; q++) {
  const r1 = Math.max(-gridRadius, -q - gridRadius);
  const r2 = Math.min(gridRadius, -q + gridRadius);
  for (let r = r1; r <= r2; r++) {
    const key = keyOf(q, r);
    const mesh = new THREE.Mesh(tileGeometry, tileMaterial);
    const p = axialToWorld(q, r);
    mesh.position.set(p.x, -tileDepth / 2, p.z);
    mesh.receiveShadow = true;
    mesh.userData.key = key;
    mesh.userData.kind = 'tile';
    board.add(mesh);
    grid.set(key, mesh);
  }
}

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(28, 64),
  new THREE.MeshStandardMaterial({ color: 0x080b10, roughness: 0.95, metalness: 0 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.25;
floor.receiveShadow = true;
scene.add(floor);

const ring = new THREE.Mesh(
  new THREE.RingGeometry(14.3, 14.55, 64),
  new THREE.MeshBasicMaterial({ color: 0x253346, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = -0.235;
scene.add(ring);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hoveredTile = null;

function setPointerFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function pick(event) {
  setPointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects([buildLayer, board], true);
}

function neighborKeys(key) {
  const [q, r] = parseKey(key);
  return [
    keyOf(q + 1, r), keyOf(q - 1, r),
    keyOf(q, r + 1), keyOf(q, r - 1),
    keyOf(q + 1, r - 1), keyOf(q - 1, r + 1),
  ].filter(k => grid.has(k));
}

function nodeY(node) { return node.height * heightStep + 0.18; }

function makeNodeMesh(node) {
  const group = new THREE.Group();
  group.userData.key = node.key;
  group.userData.kind = 'node';

  const columnHeight = Math.max(0.18, node.height * heightStep + 0.18);
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.58, columnHeight, 12),
    new THREE.MeshStandardMaterial({ color: colors.nodeSide, roughness: 0.5, metalness: 0.22 })
  );
  stem.position.y = columnHeight / 2;
  stem.castShadow = true;
  stem.receiveShadow = true;
  group.add(stem);

  let topColor = colors.node;
  if (node.type === 'start') topColor = colors.start;
  if (node.type === 'finish') topColor = colors.finish;

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.72, 0.22, 18),
    new THREE.MeshStandardMaterial({ color: topColor, roughness: 0.3, metalness: 0.25 })
  );
  top.position.y = columnHeight + 0.1;
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);

  const channel = new THREE.Mesh(
    new THREE.TorusGeometry(0.43, 0.075, 8, 24),
    new THREE.MeshStandardMaterial({ color: colors.railDark, roughness: 0.45, metalness: 0.35 })
  );
  channel.rotation.x = Math.PI / 2;
  channel.position.y = columnHeight + 0.22;
  group.add(channel);

  if (node.type === 'start') {
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: colors.start, emissiveIntensity: 2.3 })
    );
    beacon.position.y = columnHeight + 0.45;
    group.add(beacon);
  }

  if (node.type === 'finish') {
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.24),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: colors.finish, emissiveIntensity: 1.6 })
    );
    gem.position.y = columnHeight + 0.5;
    gem.rotation.y = Math.PI / 4;
    group.add(gem);
  }

  const tile = grid.get(node.key);
  group.position.set(tile.position.x, 0, tile.position.z);
  buildLayer.add(group);
  node.mesh = group;
}

function addRailBetween(a, b) {
  const pa = a.mesh.position.clone();
  const pb = b.mesh.position.clone();
  pa.y = nodeY(a) + 0.22;
  pb.y = nodeY(b) + 0.22;

  const delta = pb.clone().sub(pa);
  const length = delta.length();
  const middle = pa.clone().add(pb).multiplyScalar(0.5);
  const railGroup = new THREE.Group();

  const railMat = new THREE.MeshStandardMaterial({ color: colors.rail, roughness: 0.34, metalness: 0.38 });
  const darkMat = new THREE.MeshStandardMaterial({ color: colors.railDark, roughness: 0.45, metalness: 0.28 });

  for (const side of [-1, 1]) {
    const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, length, 8), railMat);
    cylinder.position.copy(middle);
    cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());

    const horizontal = new THREE.Vector3(delta.x, 0, delta.z).normalize();
    const lateral = new THREE.Vector3(-horizontal.z, 0, horizontal.x).multiplyScalar(0.19 * side);
    cylinder.position.add(lateral);
    cylinder.castShadow = true;
    railGroup.add(cylinder);
  }

  const bed = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, length, 6), darkMat);
  bed.position.copy(middle).add(new THREE.Vector3(0, -0.11, 0));
  bed.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
  railGroup.add(bed);
  railLayer.add(railGroup);
}

function rebuild() {
  buildLayer.clear();
  railLayer.clear();

  for (const node of nodes.values()) makeNodeMesh(node);

  const done = new Set();
  for (const [key, node] of nodes) {
    for (const nKey of neighborKeys(key)) {
      if (!nodes.has(nKey)) continue;
      const edgeId = [key, nKey].sort().join('|');
      if (done.has(edgeId)) continue;
      done.add(edgeId);
      addRailBetween(node, nodes.get(nKey));
    }
  }

  refreshSelection();
}

function snapshot() {
  return [...nodes.values()].map(n => ({ key: n.key, type: n.type, height: n.height }));
}

function restore(data) {
  nodes.clear();
  for (const n of data) nodes.set(n.key, { ...n, mesh: null });
  if (selectedKey && !nodes.has(selectedKey)) selectedKey = null;
  rebuild();
}

function pushHistory() {
  history.push(snapshot());
  if (history.length > 40) history.shift();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1600);
}

function refreshSelection() {
  if (!selectedKey || !nodes.has(selectedKey)) {
    selectionPanel.classList.remove('visible');
    return;
  }
  selectionPanel.classList.add('visible');
  heightValue.textContent = `Height ${nodes.get(selectedKey).height}`;
}

function setTool(tool) {
  currentTool = tool;
  for (const button of toolButtons) {
    const active = button.dataset.tool === tool;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  }
}

function findSingleType(type) {
  return [...nodes.values()].find(n => n.type === type);
}

function placeAt(key) {
  if (isRunning) return;

  if (currentTool === 'delete') {
    if (!nodes.has(key)) return;
    pushHistory();
    nodes.delete(key);
    if (selectedKey === key) selectedKey = null;
    rebuild();
    return;
  }

  if (nodes.has(key)) {
    selectedKey = key;
    refreshSelection();
    return;
  }

  if (currentTool === 'start' && findSingleType('start')) {
    showToast('Only one Start for now');
    return;
  }
  if (currentTool === 'finish' && findSingleType('finish')) {
    showToast('Only one Finish for now');
    return;
  }

  pushHistory();
  nodes.set(key, { key, type: currentTool, height: currentTool === 'start' ? 2 : 0, mesh: null });
  selectedKey = key;
  rebuild();
  hint.classList.add('hidden');
}

function changeHeight(delta) {
  if (isRunning || !selectedKey || !nodes.has(selectedKey)) return;
  const node = nodes.get(selectedKey);
  const next = THREE.MathUtils.clamp(node.height + delta, 0, 6);
  if (next === node.height) return;
  pushHistory();
  node.height = next;
  rebuild();
}

function connectedPath(startKey, finishKey) {
  const queue = [startKey];
  const previous = new Map([[startKey, null]]);

  while (queue.length) {
    const key = queue.shift();
    if (key === finishKey) break;
    for (const next of neighborKeys(key)) {
      if (!nodes.has(next) || previous.has(next)) continue;
      previous.set(next, key);
      queue.push(next);
    }
  }

  if (!previous.has(finishKey)) return null;
  const path = [];
  let current = finishKey;
  while (current) {
    path.unshift(current);
    current = previous.get(current);
  }
  return path;
}

function createMarble() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.23, 24, 18),
    new THREE.MeshStandardMaterial({
      color: 0xcaf4ff,
      emissive: colors.marble,
      emissiveIntensity: 0.65,
      roughness: 0.12,
      metalness: 0.62,
    })
  );
  mesh.castShadow = true;
  scene.add(mesh);
  return mesh;
}

function stopRun(message = null) {
  isRunning = false;
  runState = null;
  if (marble) {
    scene.remove(marble);
    marble.geometry.dispose();
    marble.material.dispose();
    marble = null;
  }
  playButton.classList.remove('running');
  playIcon.textContent = '▶';
  playLabel.textContent = 'PLAY';
  controls.enabled = true;
  if (message) showToast(message);
}

function startRun() {
  const start = findSingleType('start');
  const finish = findSingleType('finish');
  if (!start || !finish) {
    showToast('Add a Start and Finish first');
    return;
  }

  const path = connectedPath(start.key, finish.key);
  if (!path || path.length < 2) {
    showToast('The route is not connected');
    return;
  }

  marble = createMarble();
  const startNode = nodes.get(path[0]);
  marble.position.copy(startNode.mesh.position);
  marble.position.y = nodeY(startNode) + 0.48;

  runState = {
    path,
    segment: 0,
    progress: 0,
    speed: 2.1,
    failed: false,
  };
  isRunning = true;
  playButton.classList.add('running');
  playIcon.textContent = '■';
  playLabel.textContent = 'STOP';
}

function updateMarble(dt) {
  if (!isRunning || !runState || !marble) return;

  const { path } = runState;
  const a = nodes.get(path[runState.segment]);
  const b = nodes.get(path[runState.segment + 1]);
  if (!a || !b) return stopRun('Track changed');

  const p1 = a.mesh.position.clone();
  const p2 = b.mesh.position.clone();
  p1.y = nodeY(a) + 0.47;
  p2.y = nodeY(b) + 0.47;

  const distance = p1.distanceTo(p2);
  const slope = (p1.y - p2.y) / Math.max(distance, 0.01);
  runState.speed += slope * 4.6 * dt;
  runState.speed -= 0.34 * dt;
  runState.speed = Math.min(runState.speed, 6.5);

  if (runState.speed < 0.34) {
    stopRun('The marble ran out of speed');
    return;
  }

  runState.progress += (runState.speed * dt) / distance;

  while (runState.progress >= 1) {
    runState.progress -= 1;
    runState.segment++;
    if (runState.segment >= path.length - 1) {
      burstAt(marble.position);
      stopRun('Finish!');
      return;
    }
  }

  const currentA = nodes.get(path[runState.segment]);
  const currentB = nodes.get(path[runState.segment + 1]);
  const ca = currentA.mesh.position.clone();
  const cb = currentB.mesh.position.clone();
  ca.y = nodeY(currentA) + 0.47;
  cb.y = nodeY(currentB) + 0.47;
  marble.position.lerpVectors(ca, cb, smoothstep(runState.progress));

  const direction = cb.clone().sub(ca).normalize();
  marble.rotateOnWorldAxis(new THREE.Vector3(direction.z, 0, -direction.x).normalize(), runState.speed * dt / 0.23);
}

function smoothstep(t) { return t * t * (3 - 2 * t); }

function burstAt(position) {
  for (let i = 0; i < 16; i++) {
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 6, 4),
      new THREE.MeshBasicMaterial({ color: i % 2 ? colors.finish : colors.marble })
    );
    spark.position.copy(position);
    spark.userData.velocity = new THREE.Vector3((Math.random() - .5) * 4, Math.random() * 4 + 1, (Math.random() - .5) * 4);
    spark.userData.life = 1;
    fxLayer.add(spark);
  }
}

function updateFx(dt) {
  for (const child of [...fxLayer.children]) {
    child.userData.velocity.y -= 6 * dt;
    child.position.addScaledVector(child.userData.velocity, dt);
    child.userData.life -= dt * 1.7;
    child.scale.setScalar(Math.max(0, child.userData.life));
    if (child.userData.life <= 0) fxLayer.remove(child);
  }
}

for (const button of toolButtons) {
  button.addEventListener('click', () => setTool(button.dataset.tool));
}

playButton.addEventListener('click', () => isRunning ? stopRun() : startRun());
raiseButton.addEventListener('click', () => changeHeight(1));
lowerButton.addEventListener('click', () => changeHeight(-1));

undoButton.addEventListener('click', () => {
  if (isRunning) stopRun();
  if (!history.length) return showToast('Nothing to undo');
  restore(history.pop());
});

clearButton.addEventListener('click', () => {
  if (!nodes.size) return;
  if (isRunning) stopRun();
  pushHistory();
  nodes.clear();
  selectedKey = null;
  rebuild();
  hint.classList.remove('hidden');
});

canvas.addEventListener('pointerdown', event => {
  pointerDown = { x: event.clientX, y: event.clientY, time: performance.now() };
});

canvas.addEventListener('pointerup', event => {
  if (!pointerDown || event.pointerType === 'touch' && event.isPrimary === false) return;
  const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
  const elapsed = performance.now() - pointerDown.time;
  pointerDown = null;
  if (moved > 8 || elapsed > 650) return;

  const hits = pick(event);
  const nodeHit = hits.find(hit => hit.object.parent?.userData?.kind === 'node' || hit.object.userData?.kind === 'node');
  if (nodeHit) {
    const group = nodeHit.object.userData.kind === 'node' ? nodeHit.object : nodeHit.object.parent;
    selectedKey = group.userData.key;
    refreshSelection();
    if (currentTool === 'delete') placeAt(selectedKey);
    return;
  }

  const tileHit = hits.find(hit => hit.object.userData?.kind === 'tile');
  if (tileHit) placeAt(tileHit.object.userData.key);
});

canvas.addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse') return;
  const hits = pick(event);
  const tileHit = hits.find(hit => hit.object.userData?.kind === 'tile');
  if (hoveredTile && hoveredTile !== tileHit?.object) hoveredTile.material = tileMaterial;
  hoveredTile = tileHit?.object ?? null;
  if (hoveredTile) hoveredTile.material = tileHoverMaterial;
});

canvas.addEventListener('pointerleave', () => {
  if (hoveredTile) hoveredTile.material = tileMaterial;
  hoveredTile = null;
});

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function seedDemo() {
  const demo = [
    { key: '-3,1', type: 'start', height: 3 },
    { key: '-2,1', type: 'node', height: 2 },
    { key: '-1,1', type: 'node', height: 2 },
    { key: '0,1', type: 'node', height: 1 },
    { key: '1,0', type: 'node', height: 1 },
    { key: '2,0', type: 'node', height: 0 },
    { key: '3,-1', type: 'finish', height: 0 },
  ];
  for (const n of demo) nodes.set(n.key, { ...n, mesh: null });
  rebuild();
}

seedDemo();

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.04);
  controls.update();
  updateMarble(dt);
  updateFx(dt);
  renderer.render(scene, camera);
}
animate();
