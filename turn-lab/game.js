import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js';

const intro = document.querySelector('#intro');
const hud = document.querySelector('#hud');
const controls = document.querySelector('#controls');
const motionButton = document.querySelector('#motionButton');
const manualButton = document.querySelector('#manualButton');
const calibrateButton = document.querySelector('#calibrateButton');
const resetButton = document.querySelector('#resetButton');
const gasButton = document.querySelector('#gasButton');
const brakeButton = document.querySelector('#brakeButton');
const manualSteer = document.querySelector('#manualSteer');
const status = document.querySelector('#status');
const speedEl = document.querySelector('#speed');
const lapEl = document.querySelector('#lap');
const lapTimeEl = document.querySelector('#lapTime');
const bestTimeEl = document.querySelector('#bestTime');
const messageEl = document.querySelector('#message');
const mapCanvas = document.querySelector('#map');
const mapCtx = mapCanvas.getContext('2d');
const tiltNeedle = document.querySelector('#tiltNeedle');
const tiltValue = document.querySelector('#tiltValue');

const TAU = Math.PI * 2;
const TRACK_WIDTH = 18;
const TRACK_SAMPLES = 720;
const MAX_STEER_ROLL = THREE.MathUtils.degToRad(14);
const FULL_DRIVE_TILT = THREE.MathUtils.degToRad(6.5);
const DRIVE_TILT_DEADZONE = THREE.MathUtils.degToRad(0.8);
const MAX_SPEED = 88;
const GHOST_KEY = 'turn-three-ghost-v4';

const state = {
  running: false,
  sensorMode: false,
  motionSeen: false,
  targetRoll: 0,
  roll: 0,
  neutralRoll: 0,
  horizonRollReference: 0,
  targetPitch: 0,
  pitch: 0,
  neutralPitch: 0,
  steering: 0,
  manualSteering: 0,
  touchGas: false,
  touchBrake: false,
  tiltDrive: 0,
  throttle: 0,
  brake: 0,
  speed: 0,
  position: new THREE.Vector3(),
  velocity: new THREE.Vector3(),
  heading: 0,
  driftAmount: 0,
  offRoad: false,
  trackDistance: 0,
  progress: 0,
  lastProgress: 0,
  nearestTrackIndex: 0,
  lap: 1,
  lapStartedAt: 0,
  lapElapsed: 0,
  bestTime: Infinity,
  ghostFrames: [],
  recording: [],
  ghostVisible: false,
  lastFrame: performance.now(),
  messageTimer: 0
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x38d9ff);
scene.fog = new THREE.Fog(0x74c0fc, 110, 420);

function getViewportSize() {
  const viewport = window.visualViewport;
  const width = Math.max(1, Math.round(viewport?.width || window.innerWidth));
  const height = Math.max(1, Math.round(viewport?.height || window.innerHeight));
  return { width, height };
}

const initialViewport = getViewportSize();
const camera = new THREE.PerspectiveCamera(68, initialViewport.width / initialViewport.height, 0.1, 900);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(initialViewport.width, initialViewport.height);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.querySelector('#game').appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xffffff, 0x5b3a29, 2.7);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff1c1, 4.3);
sun.position.set(-90, 150, 70);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -100;
sun.shadow.camera.right = 100;
sun.shadow.camera.top = 100;
sun.shadow.camera.bottom = -100;
scene.add(sun);

const world = new THREE.Group();
scene.add(world);

const trackPoints = Array.from({ length: 18 }, (_, index) => {
  const angle = (index / 18) * TAU;
  const radiusX = 208 + Math.sin(angle * 2 + 0.35) * 20 + Math.sin(angle * 3 - 0.8) * 9;
  const radiusZ = 146 + Math.cos(angle * 2 - 0.4) * 14 + Math.sin(angle * 3 + 0.6) * 8;
  return new THREE.Vector3(Math.cos(angle) * radiusX, 0, Math.sin(angle) * radiusZ);
});

const trackCurve = new THREE.CatmullRomCurve3(trackPoints, true, 'centripetal');
const samples = [];
let trackLength = 0;

for (let i = 0; i < TRACK_SAMPLES; i += 1) {
  const t = i / TRACK_SAMPLES;
  const point = trackCurve.getPointAt(t);
  const tangent = trackCurve.getTangentAt(t).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  if (i > 0) trackLength += point.distanceTo(samples[i - 1].point);
  samples.push({ point, tangent, normal, distance: trackLength });
}
trackLength += samples[0].point.distanceTo(samples.at(-1).point);

const blackMaterial = new THREE.MeshBasicMaterial({ color: 0x08090a, side: THREE.BackSide });

function outlinedMesh(geometry, material, scale = 1.055) {
  const group = new THREE.Group();
  const outline = new THREE.Mesh(geometry, blackMaterial);
  outline.scale.setScalar(scale);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(outline, mesh);
  return group;
}

function makeRoad() {
  const positions = [];
  const colors = [];
  const roadColorA = new THREE.Color(0x343a40);
  const roadColorB = new THREE.Color(0x495057);

  for (let i = 0; i <= TRACK_SAMPLES; i += 1) {
    const sample = samples[i % TRACK_SAMPLES];
    const left = sample.point.clone().addScaledVector(sample.normal, TRACK_WIDTH / 2);
    const right = sample.point.clone().addScaledVector(sample.normal, -TRACK_WIDTH / 2);
    left.y = 0.13;
    right.y = 0.13;
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
    const color = i % 24 < 12 ? roadColorA : roadColorB;
    colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const indices = [];
  for (let i = 0; i < TRACK_SAMPLES; i += 1) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, c, b, d, c);
  }
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const road = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.04 })
  );
  road.receiveShadow = true;
  world.add(road);

  for (const side of [-1, 1]) {
    const borderPositions = [];
    for (let i = 0; i <= TRACK_SAMPLES; i += 1) {
      const sample = samples[i % TRACK_SAMPLES];
      const outer = sample.point.clone().addScaledVector(sample.normal, side * (TRACK_WIDTH / 2 + 0.9));
      const inner = sample.point.clone().addScaledVector(sample.normal, side * (TRACK_WIDTH / 2 - 0.25));
      outer.y = 0.17;
      inner.y = 0.17;
      borderPositions.push(outer.x, outer.y, outer.z, inner.x, inner.y, inner.z);
    }
    const borderGeometry = new THREE.BufferGeometry();
    borderGeometry.setAttribute('position', new THREE.Float32BufferAttribute(borderPositions, 3));
    borderGeometry.setIndex(indices);
    borderGeometry.computeVertexNormals();
    const border = new THREE.Mesh(
      borderGeometry,
      new THREE.MeshStandardMaterial({ color: 0x08090a, roughness: 1 })
    );
    border.receiveShadow = true;
    world.add(border);
  }

  const stripeGeometry = new THREE.BoxGeometry(4.2, 0.24, 1.3);
  const curbMaterials = [
    new THREE.MeshStandardMaterial({ color: 0xff4fa3, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0xfff8e8, roughness: 0.9 })
  ];

  for (let i = 0; i < TRACK_SAMPLES; i += 22) {
    const sample = samples[i];
    const yaw = Math.atan2(sample.tangent.x, sample.tangent.z);
    for (const side of [-1, 1]) {
      const curb = outlinedMesh(stripeGeometry, curbMaterials[Math.floor(i / 22) % 2], 1.08);
      curb.position.copy(sample.point).addScaledVector(sample.normal, side * (TRACK_WIDTH / 2 + 1.25));
      curb.position.y = 0.22;
      curb.rotation.y = yaw;
      world.add(curb);
    }
  }
}

function makeScenery() {
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(500, 96),
    new THREE.MeshStandardMaterial({ color: 0x8ce99a, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  world.add(ground);

  const colors = [0xffd43b, 0xff4fa3, 0x9775fa, 0x38d9ff, 0xff922b];
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8d5524, roughness: 1 });
  const trunkGeo = new THREE.CylinderGeometry(0.55, 0.8, 5, 6);
  const crownGeo = new THREE.ConeGeometry(3.3, 7.5, 7);

  for (let i = 0; i < 132; i += 1) {
    const sample = samples[(i * 71) % TRACK_SAMPLES];
    const side = i % 2 === 0 ? 1 : -1;
    const distance = TRACK_WIDTH / 2 + 12 + ((i * 23) % 52);
    const position = sample.point.clone().addScaledVector(sample.normal, side * distance);
    const tree = new THREE.Group();
    const trunk = outlinedMesh(trunkGeo, trunkMat, 1.08);
    trunk.position.y = 2.5;
    const crown = outlinedMesh(
      crownGeo,
      new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.88 }),
      1.06
    );
    crown.position.y = 8.2;
    crown.rotation.y = i * 1.7;
    tree.add(trunk, crown);
    tree.position.copy(position);
    const scale = 0.65 + ((i * 31) % 60) / 100;
    tree.scale.setScalar(scale);
    world.add(tree);
  }

  const mountainMat = new THREE.MeshStandardMaterial({ color: 0x845ef7, roughness: 1 });
  for (let i = 0; i < 22; i += 1) {
    const angle = (i / 22) * TAU;
    const distance = 330 + (i % 4) * 22;
    const mountain = outlinedMesh(
      new THREE.ConeGeometry(34 + (i % 3) * 10, 68 + (i % 5) * 9, 5),
      mountainMat,
      1.025
    );
    mountain.position.set(Math.cos(angle) * distance, 22, Math.sin(angle) * distance);
    mountain.rotation.y = angle * 1.7;
    world.add(mountain);
  }

  makeStartArch();
  makeBillboards();
}

function makeStartArch() {
  const start = samples[0];
  const yaw = Math.atan2(start.tangent.x, start.tangent.z);
  const arch = new THREE.Group();
  const postGeo = new THREE.BoxGeometry(1.4, 9, 1.4);
  const beamGeo = new THREE.BoxGeometry(TRACK_WIDTH + 5, 2.2, 1.6);
  const pink = new THREE.MeshStandardMaterial({ color: 0xff4fa3, roughness: 0.7 });
  for (const side of [-1, 1]) {
    const post = outlinedMesh(postGeo, pink, 1.08);
    post.position.set(side * (TRACK_WIDTH / 2 + 1.2), 4.5, 0);
    arch.add(post);
  }
  const beam = outlinedMesh(
    beamGeo,
    new THREE.MeshStandardMaterial({ color: 0xffd43b, roughness: 0.7 }),
    1.05
  );
  beam.position.y = 9;
  arch.add(beam);
  arch.position.copy(start.point);
  arch.rotation.y = yaw;
  world.add(arch);
}

function makeBillboards() {
  const geometry = new THREE.BoxGeometry(8, 4.5, 0.45);
  const palette = [0xffd43b, 0xff4fa3, 0x38d9ff, 0x9775fa];
  for (let i = 0; i < 18; i += 1) {
    const sample = samples[(44 + i * 43) % TRACK_SAMPLES];
    const side = i % 2 ? 1 : -1;
    const sign = outlinedMesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: palette[i % palette.length], roughness: 0.75 }),
      1.045
    );
    sign.position.copy(sample.point).addScaledVector(sample.normal, side * (TRACK_WIDTH / 2 + 9));
    sign.position.y = 4.2;
    sign.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z) + (side > 0 ? 0 : Math.PI);
    world.add(sign);
  }
}

function makeCar(color = 0xffd43b, opacity = 1) {
  const car = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, transparent: opacity < 1, opacity });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x38d9ff, roughness: 0.2, metalness: 0.15, transparent: opacity < 1, opacity: Math.min(opacity, 0.82) });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x16181a, roughness: 0.95, transparent: opacity < 1, opacity });

  const body = outlinedMesh(new THREE.BoxGeometry(3.3, 1.05, 6.2), bodyMat, 1.055);
  body.position.y = 1.15;
  car.add(body);

  const nose = outlinedMesh(new THREE.BoxGeometry(3.0, 0.65, 1.9), bodyMat, 1.06);
  nose.position.set(0, 1.15, -3.55);
  nose.rotation.x = -0.1;
  car.add(nose);

  const cabin = outlinedMesh(new THREE.BoxGeometry(2.45, 1.25, 2.8), glassMat, 1.06);
  cabin.position.set(0, 2.1, -0.15);
  cabin.scale.x = 0.92;
  car.add(cabin);

  const spoiler = outlinedMesh(new THREE.BoxGeometry(3.6, 0.22, 0.7), bodyMat, 1.1);
  spoiler.position.set(0, 2.05, 2.85);
  car.add(spoiler);

  const wheelGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.58, 12);
  const wheelPositions = [
    { x: -1.78, z: -2.0, front: true },
    { x: 1.78, z: -2.0, front: true },
    { x: -1.78, z: 2.0, front: false },
    { x: 1.78, z: 2.0, front: false }
  ];
  const frontWheelPivots = [];
  const wheelSpinners = [];

  for (const wheelPosition of wheelPositions) {
    const steerPivot = new THREE.Group();
    steerPivot.position.set(wheelPosition.x, 0.82, wheelPosition.z);
    const spinPivot = new THREE.Group();
    const wheel = outlinedMesh(wheelGeo, wheelMat, 1.09);
    wheel.rotation.z = Math.PI / 2;
    spinPivot.add(wheel);
    steerPivot.add(spinPivot);
    car.add(steerPivot);
    wheelSpinners.push(spinPivot);
    if (wheelPosition.front) frontWheelPivots.push(steerPivot);
  }

  car.userData.frontWheelPivots = frontWheelPivots;
  car.userData.wheelSpinners = wheelSpinners;
  return car;
}

makeRoad();
makeScenery();

const playerCar = makeCar(0xffd43b, 1);
world.add(playerCar);

const ghostCar = makeCar(0x38d9ff, 0.34);
ghostCar.visible = false;
ghostCar.traverse((node) => {
  if (node.isMesh) node.castShadow = false;
});
world.add(ghostCar);

const skidGeometry = new THREE.BufferGeometry();
const skidPositions = new Float32Array(360 * 3);
skidGeometry.setAttribute('position', new THREE.BufferAttribute(skidPositions, 3));
const skidLine = new THREE.LineSegments(
  skidGeometry,
  new THREE.LineBasicMaterial({ color: 0x08090a, transparent: true, opacity: 0.52 })
);
skidLine.frustumCulled = false;
world.add(skidLine);
const skidHistory = [];

const forwardVector = new THREE.Vector3();
const rightVector = new THREE.Vector3();
const cameraPosition = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();

function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= TAU;
  while (angle < -Math.PI) angle += TAU;
  return angle;
}

function shortestAngle(from, to) {
  return normalizeAngle(to - from);
}

function lerpAngle(a, b, t) {
  return a + shortestAngle(a, b) * t;
}

function getForward(angle = state.heading) {
  return forwardVector.set(Math.sin(angle), 0, Math.cos(angle));
}

function getRight(angle = state.heading) {
  return rightVector.set(Math.cos(angle), 0, -Math.sin(angle));
}

function findNearestTrack(position) {
  let bestIndex = 0;
  let bestDistanceSq = Infinity;
  for (let i = 0; i < samples.length; i += 1) {
    const point = samples[i].point;
    const dx = position.x - point.x;
    const dz = position.z - point.z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      bestIndex = i;
    }
  }
  return { index: bestIndex, sample: samples[bestIndex], distance: Math.sqrt(bestDistanceSq) };
}

function resetCar(showFeedback = true) {
  const start = samples[4];
  state.position.copy(start.point);
  state.position.y = 0.18;
  state.velocity.set(0, 0, 0);
  state.heading = Math.atan2(start.tangent.x, start.tangent.z);
  state.speed = 0;
  state.driftAmount = 0;
  state.progress = 4 / TRACK_SAMPLES;
  state.lastProgress = state.progress;
  state.nearestTrackIndex = 4;
  if (showFeedback) showMessage('CAR RESET');
}

function motionPoseFromGravity(event) {
  const gravity = event.accelerationIncludingGravity;
  if (!gravity || gravity.x == null || gravity.y == null || gravity.z == null) return null;
  const planarGravity = Math.hypot(gravity.x, gravity.y);
  if (Math.hypot(planarGravity, gravity.z) < 1.4 || planarGravity < 0.8) return null;
  return {
    roll: normalizeAngle(Math.atan2(gravity.x, -gravity.y)),
    pitch: Math.atan2(gravity.z, planarGravity)
  };
}

function handleMotion(event) {
  const pose = motionPoseFromGravity(event);
  if (!pose) return;
  state.motionSeen = true;
  state.targetRoll = pose.roll;
  state.targetPitch = pose.pitch;
}

function requestGameFullscreen() {
  const root = document.documentElement;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  if (!request || document.fullscreenElement || document.webkitFullscreenElement) return Promise.resolve(false);
  try {
    return Promise.resolve(request.call(root)).then(() => true).catch(() => false);
  } catch (_) {
    return Promise.resolve(false);
  }
}

async function requestMotion() {
  const fullscreenPromise = requestGameFullscreen();
  try {
    if (typeof DeviceMotionEvent === 'undefined') throw new Error('Motion sensors are not available in this browser.');
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      const permission = await DeviceMotionEvent.requestPermission();
      if (permission !== 'granted') throw new Error('Motion permission was not granted.');
    }
    window.addEventListener('devicemotion', handleMotion, { passive: true });
    state.sensorMode = true;
    await startGame(fullscreenPromise);
  } catch (error) {
    status.textContent = `${error.message} Manual mode still works.`;
  }
}

async function startGame(fullscreenPromise = Promise.resolve(false)) {
  state.running = true;
  state.lastFrame = performance.now();
  state.lapStartedAt = performance.now();
  intro.hidden = true;
  hud.hidden = false;
  controls.hidden = false;
  manualSteer.hidden = state.sensorMode;

  if (state.sensorMode) {
    window.setTimeout(() => {
      state.neutralRoll = state.targetRoll;
      state.horizonRollReference = state.targetRoll;
      state.roll = state.targetRoll;
      state.neutralPitch = state.targetPitch;
      state.pitch = state.targetPitch;
    }, 220);
  }

  await fullscreenPromise;
  try {
    await screen.orientation?.lock?.('landscape');
  } catch (_) {}

  resize();
  window.setTimeout(resize, 300);
  window.setTimeout(resize, 900);
  showMessage('GO!');
}

function useManualMode() {
  const fullscreenPromise = requestGameFullscreen();
  state.sensorMode = false;
  state.roll = 0;
  state.targetRoll = 0;
  state.neutralRoll = 0;
  state.horizonRollReference = 0;
  state.pitch = 0;
  state.targetPitch = 0;
  state.neutralPitch = 0;
  startGame(fullscreenPromise);
}

function calibrate() {
  if (state.sensorMode) {
    state.neutralRoll = state.targetRoll;
    state.roll = state.targetRoll;
    state.neutralPitch = state.targetPitch;
    state.pitch = state.targetPitch;
    state.steering = 0;
    state.tiltDrive = 0;
    showMessage('STEERING + TILT CENTERED');
  } else {
    state.manualSteering = 0;
  }
}

function bindHold(button, key) {
  const down = (event) => {
    event.preventDefault();
    state[key] = true;
    button.classList.add('is-down');
    button.setPointerCapture?.(event.pointerId);
  };
  const up = (event) => {
    event?.preventDefault?.();
    state[key] = false;
    button.classList.remove('is-down');
  };
  button.addEventListener('pointerdown', down);
  button.addEventListener('pointerup', up);
  button.addEventListener('pointercancel', up);
  button.addEventListener('lostpointercapture', up);
  button.addEventListener('contextmenu', (event) => event.preventDefault());
}

bindHold(gasButton, 'touchGas');
bindHold(brakeButton, 'touchBrake');

let pointerSteering = false;
function setManualSteering(event) {
  const rect = manualSteer.getBoundingClientRect();
  const x = THREE.MathUtils.clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
  state.manualSteering = x * 2 - 1;
}

manualSteer.addEventListener('pointerdown', (event) => {
  pointerSteering = true;
  manualSteer.setPointerCapture?.(event.pointerId);
  setManualSteering(event);
});
manualSteer.addEventListener('pointermove', (event) => {
  if (pointerSteering) setManualSteering(event);
});
manualSteer.addEventListener('pointerup', () => {
  pointerSteering = false;
  state.manualSteering = 0;
});
manualSteer.addEventListener('pointercancel', () => {
  pointerSteering = false;
  state.manualSteering = 0;
});

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'arrowleft' || key === 'a') state.manualSteering = -1;
  if (key === 'arrowright' || key === 'd') state.manualSteering = 1;
  if (key === 'arrowup' || key === 'w') state.touchGas = true;
  if (key === 'arrowdown' || key === 's' || key === ' ') state.touchBrake = true;
  if (key === 'r') resetCar();
});

window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  if ((key === 'arrowleft' || key === 'a') && state.manualSteering < 0) state.manualSteering = 0;
  if ((key === 'arrowright' || key === 'd') && state.manualSteering > 0) state.manualSteering = 0;
  if (key === 'arrowup' || key === 'w') state.touchGas = false;
  if (key === 'arrowdown' || key === 's' || key === ' ') state.touchBrake = false;
});

motionButton.addEventListener('click', requestMotion);
manualButton.addEventListener('click', useManualMode);
calibrateButton.addEventListener('click', calibrate);
resetButton.addEventListener('click', () => resetCar());

document.addEventListener('selectstart', (event) => event.preventDefault());
document.addEventListener('contextmenu', (event) => {
  if (event.target.closest('button')) event.preventDefault();
});

function updateMotionInput(dt) {
  if (!state.sensorMode) {
    state.steering = THREE.MathUtils.lerp(state.steering, state.manualSteering, Math.min(1, dt * 10));
    state.tiltDrive = 0;
    return;
  }

  state.roll += shortestAngle(state.roll, state.targetRoll) * Math.min(1, dt * 16);
  state.pitch = THREE.MathUtils.lerp(state.pitch, state.targetPitch, Math.min(1, dt * 12));

  const steeringRoll = normalizeAngle(state.roll - state.neutralRoll);
  const linearSteer = THREE.MathUtils.clamp(steeringRoll / MAX_STEER_ROLL, -1, 1);
  state.steering = Math.sign(linearSteer) * Math.pow(Math.abs(linearSteer), 0.78);

  const pitchDelta = state.neutralPitch - state.pitch;
  const pitchMagnitude = Math.max(0, Math.abs(pitchDelta) - DRIVE_TILT_DEADZONE);
  const availableRange = Math.max(0.001, FULL_DRIVE_TILT - DRIVE_TILT_DEADZONE);
  const driveMagnitude = THREE.MathUtils.clamp(pitchMagnitude / availableRange, 0, 1);
  state.tiltDrive = Math.sign(pitchDelta) * Math.pow(driveMagnitude, 0.72);
}

function updatePhysics(dt, now) {
  updateMotionInput(dt);

  const tiltGas = Math.max(0, state.tiltDrive);
  const tiltBrake = Math.max(0, -state.tiltDrive);
  state.throttle = Math.max(tiltGas, state.touchGas ? 1 : 0);
  state.brake = Math.max(tiltBrake, state.touchBrake ? 1 : 0);

  const nearestBefore = findNearestTrack(state.position);
  state.nearestTrackIndex = nearestBefore.index;
  state.trackDistance = nearestBefore.distance;
  state.offRoad = nearestBefore.distance > TRACK_WIDTH * 0.58;

  const forward = getForward().clone();
  const right = getRight().clone();
  let forwardSpeed = state.velocity.dot(forward);
  let lateralSpeed = state.velocity.dot(right);
  let speed = state.velocity.length();

  const enginePower = state.offRoad ? 29 : 43;
  state.velocity.addScaledVector(forward, state.throttle * enginePower * dt);

  if (state.brake > 0) {
    const brakeStep = 62 * state.brake * dt;
    forwardSpeed = state.velocity.dot(forward);
    if (Math.abs(forwardSpeed) > 0.05) {
      state.velocity.addScaledVector(forward, -Math.sign(forwardSpeed) * Math.min(Math.abs(forwardSpeed), brakeStep));
    }
  }

  speed = state.velocity.length();
  const speedRatio = THREE.MathUtils.clamp(speed / MAX_SPEED, 0, 1);
  const driftIntent = THREE.MathUtils.clamp(
    Math.abs(state.steering) * speedRatio * 0.9 +
    state.brake * Math.abs(state.steering) * 1.35 +
    Math.abs(lateralSpeed) / 22,
    0,
    1
  );
  state.driftAmount = THREE.MathUtils.lerp(
    state.driftAmount,
    driftIntent,
    Math.min(1, dt * (driftIntent > state.driftAmount ? 7 : 3.2))
  );

  const steeringAuthority = THREE.MathUtils.clamp(Math.abs(forwardSpeed) / 7, 0, 1);
  const yawRate =
    state.steering *
    Math.sign(forwardSpeed || 1) *
    (0.18 + Math.abs(forwardSpeed) * 0.012) *
    steeringAuthority *
    (1 + state.driftAmount * 0.65);
  state.heading = normalizeAngle(state.heading + yawRate * dt);

  const newRight = getRight().clone();
  lateralSpeed = state.velocity.dot(newRight);

  const grip = state.offRoad
    ? THREE.MathUtils.lerp(2.6, 1.0, state.driftAmount)
    : THREE.MathUtils.lerp(11.5, 1.45, state.driftAmount);
  const lateralCorrection = 1 - Math.exp(-grip * dt);
  state.velocity.addScaledVector(newRight, -lateralSpeed * lateralCorrection);

  if (state.driftAmount > 0.18 && speed > 18) {
    state.velocity.addScaledVector(newRight, state.steering * speed * state.driftAmount * 0.12 * dt);
  }

  const drag = state.offRoad ? 0.72 : 0.11 + speed * 0.0009;
  state.velocity.multiplyScalar(Math.exp(-drag * dt));

  const speedLimit = state.offRoad ? 46 : MAX_SPEED;
  speed = state.velocity.length();
  if (speed > speedLimit) state.velocity.multiplyScalar(speedLimit / speed);

  state.position.addScaledVector(state.velocity, dt);
  state.position.y = 0.18;
  state.speed = state.velocity.length();

  const nearestAfter = findNearestTrack(state.position);
  state.trackDistance = nearestAfter.distance;
  state.offRoad = nearestAfter.distance > TRACK_WIDTH * 0.58;
  state.lastProgress = state.progress;
  state.progress = nearestAfter.index / TRACK_SAMPLES;
  state.nearestTrackIndex = nearestAfter.index;

  const crossedStart = state.lastProgress > 0.82 && state.progress < 0.18;
  const movingForwardAtStart = state.velocity.dot(samples[0].tangent) > 5;
  if (crossedStart && movingForwardAtStart && state.trackDistance < TRACK_WIDTH * 0.8) completeLap(now);

  state.lapElapsed = (now - state.lapStartedAt) / 1000;
  recordGhostFrame();
}

function recordGhostFrame() {
  if (state.recording.length === 0 || state.lapElapsed - state.recording.at(-1).t >= 0.045) {
    state.recording.push({
      t: state.lapElapsed,
      x: state.position.x,
      z: state.position.z,
      h: state.heading,
      s: state.steering,
      d: state.driftAmount
    });
  }
}

function completeLap(now) {
  const finishedTime = (now - state.lapStartedAt) / 1000;
  const validLap = finishedTime > 5 && state.recording.length > 20;
  if (validLap && finishedTime < state.bestTime) {
    state.bestTime = finishedTime;
    state.ghostFrames = state.recording.slice();
    state.ghostVisible = true;
    saveGhost();
    showMessage(`NEW BEST ${formatTime(finishedTime)}`);
  } else if (validLap) {
    showMessage(`LAP ${formatTime(finishedTime)}`);
  }
  state.lap += 1;
  state.lapStartedAt = now;
  state.lapElapsed = 0;
  state.recording = [];
}

function saveGhost() {
  try {
    localStorage.setItem(GHOST_KEY, JSON.stringify({ bestTime: state.bestTime, frames: state.ghostFrames }));
  } catch (_) {}
}

function loadGhost() {
  try {
    const saved = JSON.parse(localStorage.getItem(GHOST_KEY));
    if (saved && Number.isFinite(saved.bestTime) && Array.isArray(saved.frames) && saved.frames.length > 20) {
      state.bestTime = saved.bestTime;
      state.ghostFrames = saved.frames;
      state.ghostVisible = true;
    }
  } catch (_) {}
}

function ghostFrameAt(time) {
  const frames = state.ghostFrames;
  if (frames.length < 2) return null;
  const wrappedTime = state.bestTime < Infinity ? time % state.bestTime : time;
  let low = 0;
  let high = frames.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (frames[mid].t < wrappedTime) low = mid + 1;
    else high = mid;
  }
  const b = frames[low];
  const a = frames[Math.max(0, low - 1)];
  const span = Math.max(0.001, b.t - a.t);
  const alpha = THREE.MathUtils.clamp((wrappedTime - a.t) / span, 0, 1);
  return {
    x: THREE.MathUtils.lerp(a.x, b.x, alpha),
    z: THREE.MathUtils.lerp(a.z, b.z, alpha),
    h: lerpAngle(a.h, b.h, alpha),
    s: THREE.MathUtils.lerp(a.s, b.s, alpha),
    d: THREE.MathUtils.lerp(a.d, b.d, alpha)
  };
}

function animateWheels(car, steering, speed, dt) {
  const steerAngle = steering * 0.58;
  for (const pivot of car.userData.frontWheelPivots || []) {
    pivot.rotation.y = THREE.MathUtils.lerp(pivot.rotation.y, steerAngle, Math.min(1, dt * 16));
  }
  for (const spinner of car.userData.wheelSpinners || []) {
    spinner.rotation.y -= speed * dt * 1.35;
  }
}

function placePlayerCar(dt) {
  playerCar.position.copy(state.position);
  playerCar.rotation.y = state.heading + Math.PI;
  playerCar.rotation.z = -state.steering * 0.035 - state.velocity.dot(getRight()) * 0.0025;
  animateWheels(playerCar, state.steering, state.speed, dt);
}

function placeGhostCar(dt) {
  if (!state.ghostVisible) {
    ghostCar.visible = false;
    return;
  }
  const ghost = ghostFrameAt(state.lapElapsed);
  if (!ghost) {
    ghostCar.visible = false;
    return;
  }
  ghostCar.visible = true;
  ghostCar.position.set(ghost.x, 0.18, ghost.z);
  ghostCar.rotation.y = ghost.h + Math.PI;
  ghostCar.rotation.z = -ghost.s * 0.03;
  animateWheels(ghostCar, ghost.s, 45, dt);
}

function updateScene(dt) {
  placePlayerCar(dt);
  placeGhostCar(dt);

  const forward = getForward().clone();
  const right = getRight().clone();
  const speedRatio = THREE.MathUtils.clamp(state.speed / MAX_SPEED, 0, 1);
  const lateralVelocity = state.velocity.dot(right);

  const desiredCamera = state.position
    .clone()
    .addScaledVector(forward, -(14 + speedRatio * 7))
    .addScaledVector(right, -lateralVelocity * 0.11);
  desiredCamera.y = 7.7 + speedRatio * 2.5;
  cameraPosition.lerp(desiredCamera, 1 - Math.exp(-dt * 6.2));
  camera.position.copy(cameraPosition);

  const desiredTarget = state.position.clone().addScaledVector(forward, 15 + speedRatio * 12);
  desiredTarget.y = 2.0;
  cameraTarget.lerp(desiredTarget, 1 - Math.exp(-dt * 8.5));
  camera.up.set(0, 1, 0);
  camera.lookAt(cameraTarget);

  if (state.sensorMode) {
    const horizonRoll = normalizeAngle(state.roll - state.horizonRollReference);
    camera.rotateZ(-horizonRoll);
  }

  camera.fov = THREE.MathUtils.lerp(camera.fov, 68 + speedRatio * 14, Math.min(1, dt * 4.5));
  camera.updateProjectionMatrix();
  updateSkids();
}

function updateSkids() {
  if (state.driftAmount > 0.34 && state.speed > 21) {
    const right = getRight().clone();
    const rearCenter = state.position.clone().addScaledVector(getForward().clone(), -2.0);
    skidHistory.unshift([
      rearCenter.clone().addScaledVector(right, -1.25).setY(0.23),
      rearCenter.clone().addScaledVector(right, 1.25).setY(0.23)
    ]);
  } else if (skidHistory.length) {
    skidHistory.unshift(skidHistory[0].map((point) => point.clone()));
  }

  skidHistory.length = Math.min(skidHistory.length, 90);
  let cursor = 0;
  for (let i = 0; i < skidHistory.length - 1 && cursor < 120; i += 1) {
    for (let wheel = 0; wheel < 2; wheel += 1) {
      const a = skidHistory[i][wheel];
      const b = skidHistory[i + 1][wheel];
      skidPositions[cursor * 3] = a.x;
      skidPositions[cursor * 3 + 1] = a.y;
      skidPositions[cursor * 3 + 2] = a.z;
      cursor += 1;
      skidPositions[cursor * 3] = b.x;
      skidPositions[cursor * 3 + 1] = b.y;
      skidPositions[cursor * 3 + 2] = b.z;
      cursor += 1;
    }
  }
  skidGeometry.attributes.position.needsUpdate = true;
  skidGeometry.setDrawRange(0, cursor);
}

const mapBounds = (() => {
  const xs = samples.map((sample) => sample.point.x);
  const zs = samples.map((sample) => sample.point.z);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs)
  };
})();

function mapPoint(point) {
  const pad = 20;
  const width = mapCanvas.width - pad * 2;
  const height = mapCanvas.height - pad * 2;
  const sx = width / (mapBounds.maxX - mapBounds.minX);
  const sz = height / (mapBounds.maxZ - mapBounds.minZ);
  const scale = Math.min(sx, sz);
  const contentW = (mapBounds.maxX - mapBounds.minX) * scale;
  const contentH = (mapBounds.maxZ - mapBounds.minZ) * scale;
  const offsetX = (mapCanvas.width - contentW) / 2;
  const offsetY = (mapCanvas.height - contentH) / 2;
  return {
    x: offsetX + (point.x - mapBounds.minX) * scale,
    y: offsetY + (point.z - mapBounds.minZ) * scale
  };
}

function drawMap() {
  const w = mapCanvas.width;
  const h = mapCanvas.height;
  mapCtx.clearRect(0, 0, w, h);
  mapCtx.lineJoin = 'round';
  mapCtx.lineCap = 'round';

  mapCtx.beginPath();
  samples.forEach((sample, index) => {
    const p = mapPoint(sample.point);
    if (index === 0) mapCtx.moveTo(p.x, p.y);
    else mapCtx.lineTo(p.x, p.y);
  });
  mapCtx.closePath();
  mapCtx.strokeStyle = '#08090a';
  mapCtx.lineWidth = 16;
  mapCtx.stroke();
  mapCtx.strokeStyle = '#ff4fa3';
  mapCtx.lineWidth = 8;
  mapCtx.stroke();

  const playerPoint = mapPoint(state.position);
  mapCtx.beginPath();
  mapCtx.arc(playerPoint.x, playerPoint.y, 8, 0, TAU);
  mapCtx.fillStyle = '#ffd43b';
  mapCtx.fill();
  mapCtx.strokeStyle = '#08090a';
  mapCtx.lineWidth = 4;
  mapCtx.stroke();

  if (state.ghostVisible) {
    const ghost = ghostFrameAt(state.lapElapsed);
    if (ghost) {
      const ghostPoint = mapPoint({ x: ghost.x, z: ghost.z });
      mapCtx.beginPath();
      mapCtx.arc(ghostPoint.x, ghostPoint.y, 6, 0, TAU);
      mapCtx.fillStyle = '#38d9ff';
      mapCtx.fill();
      mapCtx.strokeStyle = '#08090a';
      mapCtx.lineWidth = 3;
      mapCtx.stroke();
    }
  }
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '--:--.---';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
  return `${minutes}:${secs}.${ms}`;
}

function updateHud() {
  speedEl.textContent = Math.round(state.speed * 3.6);
  lapEl.textContent = state.lap;
  lapTimeEl.textContent = formatTime(state.lapElapsed);
  bestTimeEl.textContent = formatTime(state.bestTime);

  const driveDisplay = state.throttle >= state.brake ? state.throttle : -state.brake;
  const drivePercent = Math.round(driveDisplay * 100);
  tiltNeedle.style.left = `${50 + driveDisplay * 46}%`;
  if (drivePercent > 2) tiltValue.textContent = `gas ${drivePercent}%`;
  else if (drivePercent < -2) tiltValue.textContent = `brake ${Math.abs(drivePercent)}%`;
  else tiltValue.textContent = 'neutral';

  drawMap();
}

function showMessage(text, duration = 1600) {
  messageEl.textContent = text;
  messageEl.classList.add('show');
  clearTimeout(state.messageTimer);
  state.messageTimer = window.setTimeout(() => messageEl.classList.remove('show'), duration);
}

let resizeFrame = 0;
function resize() {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    const { width, height } = getViewportSize();
    document.documentElement.style.setProperty('--app-width', `${width}px`);
    document.documentElement.style.setProperty('--app-height', `${height}px`);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(width, height);
  });
}

window.addEventListener('resize', resize, { passive: true });
window.addEventListener('orientationchange', () => window.setTimeout(resize, 180), { passive: true });
window.addEventListener('pageshow', resize, { passive: true });
window.visualViewport?.addEventListener('resize', resize, { passive: true });
window.visualViewport?.addEventListener('scroll', resize, { passive: true });
document.addEventListener('fullscreenchange', resize, { passive: true });
document.addEventListener('webkitfullscreenchange', resize, { passive: true });

resetCar(false);
cameraPosition.copy(state.position).add(new THREE.Vector3(0, 9, 20));
cameraTarget.copy(state.position);
resize();
loadGhost();
updateHud();

renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.035, Math.max(0.001, (now - state.lastFrame) / 1000));
  state.lastFrame = now;

  if (state.running) {
    updatePhysics(dt, now);
    updateScene(dt);
    updateHud();
  } else {
    const preview = samples[Math.floor((now * 0.012) % TRACK_SAMPLES)];
    playerCar.position.copy(preview.point);
    playerCar.position.y = 0.18;
    playerCar.rotation.y = Math.atan2(preview.tangent.x, preview.tangent.z) + Math.PI;
    animateWheels(playerCar, Math.sin(now * 0.001) * 0.3, 28, dt);
    camera.position.set(0, 110, 215);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
  }

  renderer.render(scene, camera);
});