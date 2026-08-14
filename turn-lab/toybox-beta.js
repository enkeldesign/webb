import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const TAU = Math.PI * 2;
const TRACK_WIDTH = 18;
const HALF_TRACK = TRACK_WIDTH / 2;
const SAMPLE_COUNT = 1200;
const MAX_SPEED = 68;
const KENNEY_SUPPORT_WIDTH = 2;
const KENNEY_SUPPORT_HEIGHT = 1;
const KENNEY_SUPPORT_DEPTH = 1;

// Closed and deliberately non-self-crossing in X/Z. That is the important constraint if
// this graduates into TURN proper: the current nearest-track logic can already handle Y,
// but true over/under crossings would need a 3D-aware nearest-segment query.
const CONTROL_POINTS = [
  [0, 2, -180],
  [65, 6, -185],
  [132, 22, -165],
  [188, 44, -122],
  [215, 50, -62],
  [220, 34, 5],
  [205, 8, 72],
  [170, 4, 125],
  [118, 18, 162],
  [55, 32, 182],
  [-15, 44, 186],
  [-85, 48, 166],
  [-145, 38, 128],
  [-195, 20, 73],
  [-220, 5, 10],
  [-215, 12, -58],
  [-180, 25, -118],
  [-130, 16, -160],
  [-65, 5, -185]
].map(([x, y, z]) => new THREE.Vector3(x, y, z));

const curve = new THREE.CatmullRomCurve3(CONTROL_POINTS, true, 'centripetal');
const samples = Array.from({ length: SAMPLE_COUNT }, (_, index) => {
  const t = index / SAMPLE_COUNT;
  const point = curve.getPointAt(t);
  const tangent = curve.getTangentAt(t).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  return { point, tangent, normal };
});

const cumulative = [0];
for (let index = 1; index <= samples.length; index += 1) {
  const previous = samples[index - 1].point;
  const next = samples[index % samples.length].point;
  cumulative.push(cumulative[index - 1] + previous.distanceTo(next));
}
const trackLength = cumulative.at(-1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x49d8ff);
scene.fog = new THREE.Fog(0x83e7ff, 220, 760);

const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 1100);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x5d7a55, 2.8));
const sun = new THREE.DirectionalLight(0xfff3c7, 3.7);
sun.position.set(-120, 180, 90);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -180;
sun.shadow.camera.right = 180;
sun.shadow.camera.top = 180;
sun.shadow.camera.bottom = -180;
scene.add(sun);

const world = new THREE.Group();
world.name = 'TOYBOX LAB';
scene.add(world);

function addFloor() {
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(560, 96),
    new THREE.MeshStandardMaterial({ color: 0xa6df8d, roughness: 1, metalness: 0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.4;
  floor.receiveShadow = true;
  world.add(floor);

  const colors = [0xbce8ff, 0xffd8e8, 0xffe792, 0xcbbcff, 0xc0efc7];
  for (let index = 0; index < 18; index += 1) {
    const angle = index / 18 * TAU + 0.2;
    const radius = 270 + (index % 3) * 62;
    const tile = new THREE.Mesh(
      new THREE.BoxGeometry(58, 0.14, 58),
      new THREE.MeshStandardMaterial({ color: colors[index % colors.length], roughness: 1 })
    );
    tile.position.set(Math.cos(angle) * radius, -0.27, Math.sin(angle) * radius);
    tile.rotation.y = angle * 0.71;
    tile.receiveShadow = true;
    world.add(tile);
  }
}

function addRoad() {
  const positions = [];
  const colors = [];
  const indices = [];
  const dark = new THREE.Color(0x313a62);
  const light = new THREE.Color(0x4c5987);

  for (let index = 0; index <= samples.length; index += 1) {
    const sample = samples[index % samples.length];
    const left = sample.point.clone().addScaledVector(sample.normal, HALF_TRACK).setY(sample.point.y + 0.18);
    const right = sample.point.clone().addScaledVector(sample.normal, -HALF_TRACK).setY(sample.point.y + 0.18);
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
    const shade = 0.46 + Math.sin(index * 0.07) * 0.16;
    const color = dark.clone().lerp(light, shade);
    colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
  }

  for (let index = 0; index < samples.length; index += 1) {
    const a = index * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const road = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0, side: THREE.DoubleSide })
  );
  road.receiveShadow = true;
  world.add(road);

  addRoadSkirt(-1);
  addRoadSkirt(1);
  addEdgeRail(-1, 0xff4fa3);
  addEdgeRail(1, 0xffd43b);
  addCentreDashes();
}

function addRoadSkirt(side) {
  const positions = [];
  const indices = [];
  for (let index = 0; index <= samples.length; index += 1) {
    const sample = samples[index % samples.length];
    const edge = sample.point.clone().addScaledVector(sample.normal, side * HALF_TRACK);
    positions.push(
      edge.x, edge.y + 0.16, edge.z,
      edge.x, Math.max(0.08, edge.y - 1.65), edge.z
    );
  }
  for (let index = 0; index < samples.length; index += 1) {
    const a = index * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, c, b, d, c);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const skirt = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0x242947, roughness: 0.9, side: THREE.DoubleSide })
  );
  skirt.receiveShadow = true;
  world.add(skirt);
}

function addEdgeRail(side, color) {
  const railPoints = [];
  for (let index = 0; index < samples.length; index += 4) {
    const sample = samples[index];
    railPoints.push(
      sample.point.clone()
        .addScaledVector(sample.normal, side * (HALF_TRACK + 0.35))
        .setY(sample.point.y + 0.48)
    );
  }
  const railCurve = new THREE.CatmullRomCurve3(railPoints, true, 'centripetal');
  const rail = new THREE.Mesh(
    new THREE.TubeGeometry(railCurve, railPoints.length * 2, 0.38, 6, true),
    new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0 })
  );
  rail.castShadow = false;
  rail.receiveShadow = true;
  world.add(rail);
}

function addCentreDashes() {
  const geometry = new THREE.BoxGeometry(0.42, 0.05, 4.4);
  const material = new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.88 });
  for (let index = 0; index < samples.length; index += 25) {
    const sample = samples[index];
    const dash = new THREE.Mesh(geometry, material);
    dash.position.copy(sample.point);
    dash.position.y += 0.28;
    dash.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
    dash.rotation.x = Math.atan2(sample.tangent.y, Math.hypot(sample.tangent.x, sample.tangent.z));
    dash.receiveShadow = true;
    world.add(dash);
  }
}

// The supplied Kenney supports-wide.glb measures 2 × 1 × 1 units. These lab supports
// deliberately keep that wide toy-kit proportion, plus the visual language of the kit's
// diagonal support pieces, while stretching vertically to reach TURN's elevated road.
function makeKenneyStyleSupport(height, color) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.76, metalness: 0 });
  const width = TRACK_WIDTH + 7;
  const legOffset = width * 0.42;

  const footGeometry = new THREE.BoxGeometry(5.4, 0.5, 5.2);
  const legGeometry = new THREE.BoxGeometry(1.45, 1, 1.75);
  const beamGeometry = new THREE.BoxGeometry(width, 1.2, 2.1);

  for (const side of [-1, 1]) {
    const foot = new THREE.Mesh(footGeometry, material);
    foot.position.set(side * legOffset, 0.25, 0);
    foot.receiveShadow = true;
    group.add(foot);

    const leg = new THREE.Mesh(legGeometry, material);
    leg.scale.y = Math.max(1, height - 0.8);
    leg.position.set(side * legOffset, Math.max(1, height - 0.8) / 2 + 0.35, 0);
    leg.rotation.z = side * -0.045;
    leg.receiveShadow = true;
    group.add(leg);
  }

  const beam = new THREE.Mesh(beamGeometry, material);
  beam.position.y = height - 0.45;
  beam.receiveShadow = true;
  group.add(beam);

  if (height > 15) {
    const braceLength = Math.hypot(width * 0.62, Math.min(height * 0.55, 18));
    const braceGeometry = new THREE.BoxGeometry(0.72, braceLength, 0.8);
    for (const side of [-1, 1]) {
      const brace = new THREE.Mesh(braceGeometry, material);
      brace.position.set(side * width * 0.18, height * 0.48, 0);
      brace.rotation.z = side * 0.64;
      brace.receiveShadow = true;
      group.add(brace);
    }
  }
  return group;
}

function addSupports() {
  const colors = [0xffd43b, 0xff922b, 0xff4fa3, 0x38d9ff];
  for (let index = 0; index < samples.length; index += 48) {
    const sample = samples[index];
    if (sample.point.y < 6.2) continue;
    const support = makeKenneyStyleSupport(sample.point.y + 0.1, colors[Math.floor(index / 48) % colors.length]);
    support.position.set(sample.point.x, 0, sample.point.z);
    support.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
    world.add(support);
  }
}

function addStartGate() {
  const sample = samples[0];
  const group = new THREE.Group();
  const pink = new THREE.MeshStandardMaterial({ color: 0xff4fa3, roughness: 0.78 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffd43b, roughness: 0.78 });
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(1.8, 9.5, 1.8), pink);
    post.position.set(side * (HALF_TRACK + 2.1), 4.75, 0);
    group.add(post);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(TRACK_WIDTH + 7, 1.8, 2.1), yellow);
  top.position.y = 9.2;
  group.add(top);
  group.position.copy(sample.point);
  group.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
  world.add(group);
}

function addToyScenery() {
  const colors = [0xff4fa3, 0xffd43b, 0x38d9ff, 0x7ee787, 0x9775fa];
  const places = [
    [-292, 17, -112, 23], [294, 21, -25, 28], [270, 13, 195, 19],
    [-280, 18, 202, 24], [-310, 12, 55, 17], [310, 15, 82, 21]
  ];
  places.forEach(([x, y, z, size], index) => {
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshStandardMaterial({ color: colors[index % colors.length], roughness: 0.84 })
    );
    block.position.set(x, y, z);
    block.rotation.set(index % 2 ? 0.12 : 0, index * 0.42, index % 2 ? -0.08 : 0.06);
    block.castShadow = true;
    block.receiveShadow = true;
    world.add(block);
  });
}

function createCar() {
  const car = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffd400, roughness: 0.72 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.72 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.15, 6.2), yellow);
  body.position.y = 0.8;
  body.castShadow = true;
  car.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.2, 2.9), yellow);
  cabin.position.set(0, 1.65, -0.25);
  cabin.castShadow = true;
  car.add(cabin);
  const wheelGeometry = new THREE.CylinderGeometry(0.68, 0.68, 0.5, 14);
  for (const x of [-1.85, 1.85]) {
    for (const z of [-1.95, 1.95]) {
      const wheel = new THREE.Mesh(wheelGeometry, dark);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.55, z);
      wheel.castShadow = true;
      car.add(wheel);
    }
  }
  scene.add(car);
  return car;
}

addFloor();
addRoad();
addSupports();
addStartGate();
addToyScenery();
const car = createCar();

const input = { left: false, right: false, gas: false, brake: false };
const state = {
  distance: 0,
  speed: 0,
  lateral: 0,
  lateralVelocity: 0,
  paused: true,
  started: false,
  lastFrame: performance.now()
};

function locateByDistance(distance) {
  const wrapped = ((distance % trackLength) + trackLength) % trackLength;
  let low = 0;
  let high = samples.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (cumulative[middle] <= wrapped && cumulative[middle + 1] > wrapped) {
      const span = Math.max(0.0001, cumulative[middle + 1] - cumulative[middle]);
      const alpha = (wrapped - cumulative[middle]) / span;
      const nextIndex = (middle + 1) % samples.length;
      const point = samples[middle].point.clone().lerp(samples[nextIndex].point, alpha);
      const tangent = samples[middle].tangent.clone().lerp(samples[nextIndex].tangent, alpha).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      return { point, tangent, normal };
    }
    if (cumulative[middle] > wrapped) high = middle - 1;
    else low = middle + 1;
  }
  return { ...samples[0], point: samples[0].point.clone(), tangent: samples[0].tangent.clone(), normal: samples[0].normal.clone() };
}

const up = new THREE.Vector3();
const right = new THREE.Vector3();
const orientation = new THREE.Matrix4();
const targetCamera = new THREE.Vector3();
const targetLook = new THREE.Vector3();
let smoothedLook = new THREE.Vector3();

function updateCarPose(trackState, snapCamera = false) {
  car.position.copy(trackState.point).addScaledVector(trackState.normal, state.lateral);
  car.position.y += 0.62;

  right.set(trackState.tangent.z, 0, -trackState.tangent.x).normalize();
  up.crossVectors(trackState.tangent, right).normalize();
  orientation.makeBasis(right, up, trackState.tangent);
  car.quaternion.setFromRotationMatrix(orientation);

  targetCamera.copy(car.position)
    .addScaledVector(trackState.tangent, -17)
    .addScaledVector(up, 7.8);
  targetLook.copy(car.position)
    .addScaledVector(trackState.tangent, 21)
    .addScaledVector(up, 2.2);

  if (snapCamera) {
    camera.position.copy(targetCamera);
    smoothedLook.copy(targetLook);
  } else {
    camera.position.lerp(targetCamera, 0.085);
    smoothedLook.lerp(targetLook, 0.12);
  }
  camera.lookAt(smoothedLook);
}

function step(dt) {
  const trackState = locateByDistance(state.distance);
  const throttle = input.gas ? 26 : 0;
  const brake = input.brake ? 38 : 0;
  const drag = 1.25 + state.speed * 0.045;
  const slopeGravity = -trackState.tangent.y * 17;
  state.speed += (throttle - brake - drag + slopeGravity) * dt;
  state.speed = THREE.MathUtils.clamp(state.speed, 0, MAX_SPEED);

  const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const steerAuthority = 8 + Math.min(18, state.speed * 0.32);
  state.lateralVelocity += steer * steerAuthority * dt;
  state.lateralVelocity *= Math.exp(-5.5 * dt);
  state.lateral += state.lateralVelocity * dt;
  state.lateral = THREE.MathUtils.clamp(state.lateral, -HALF_TRACK + 2.2, HALF_TRACK - 2.2);

  state.distance += state.speed * dt;
  updateCarPose(locateByDistance(state.distance));
  document.querySelector('#speed').textContent = Math.round(state.speed * 3.6);
  document.querySelector('#height').textContent = Math.round(car.position.y);
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, Math.max(0, (now - state.lastFrame) / 1000));
  state.lastFrame = now;
  if (state.started && !state.paused) step(dt);
  renderer.render(scene, camera);
}

function reset() {
  state.distance = 0;
  state.speed = 0;
  state.lateral = 0;
  state.lateralVelocity = 0;
  updateCarPose(locateByDistance(0), true);
  document.querySelector('#speed').textContent = '0';
  document.querySelector('#height').textContent = Math.round(car.position.y);
}

function bindHoldButton(id, key) {
  const element = document.querySelector(id);
  const press = (event) => {
    event.preventDefault();
    input[key] = true;
    element.setAttribute('aria-pressed', 'true');
    element.setPointerCapture?.(event.pointerId);
  };
  const release = (event) => {
    event.preventDefault();
    input[key] = false;
    element.setAttribute('aria-pressed', 'false');
  };
  element.addEventListener('pointerdown', press);
  element.addEventListener('pointerup', release);
  element.addEventListener('pointercancel', release);
  element.addEventListener('lostpointercapture', release);
}

bindHoldButton('#left', 'left');
bindHoldButton('#right', 'right');
bindHoldButton('#gas', 'gas');
bindHoldButton('#brake', 'brake');

const keyMap = new Map([
  ['ArrowLeft', 'left'], ['KeyA', 'left'],
  ['ArrowRight', 'right'], ['KeyD', 'right'],
  ['ArrowUp', 'gas'], ['KeyW', 'gas'],
  ['ArrowDown', 'brake'], ['KeyS', 'brake'], ['Space', 'brake']
]);
window.addEventListener('keydown', (event) => {
  const key = keyMap.get(event.code);
  if (!key) return;
  event.preventDefault();
  input[key] = true;
});
window.addEventListener('keyup', (event) => {
  const key = keyMap.get(event.code);
  if (!key) return;
  event.preventDefault();
  input[key] = false;
});

const pauseButton = document.querySelector('#pause');
function setPaused(paused) {
  state.paused = paused;
  pauseButton.textContent = paused ? 'RESUME' : 'PAUSE';
  pauseButton.setAttribute('aria-pressed', String(paused));
}
pauseButton.addEventListener('click', () => setPaused(!state.paused));
document.querySelector('#reset').addEventListener('click', reset);
document.querySelector('#start').addEventListener('click', () => {
  document.querySelector('#intro').hidden = true;
  state.started = true;
  setPaused(false);
  state.lastFrame = performance.now();
});

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

reset();
requestAnimationFrame(animate);
