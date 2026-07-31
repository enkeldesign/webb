// Generated from turn/main.js for TURN 2026.07.29-r118. Do not edit by hand.
// TURN game core.

import * as THREE from 'three';
import { installKenneyWorld } from '/turn/world-assets.js';
import { updateRaceCameraState } from '/turn/render/camera.js?build=20260720-r19';
import { updateHudState } from '/turn/ui/hud.js?build=20260720-r19';
import { motionPoseFromGravity as motionPoseFromGravityState, updateMotionInputState } from '/turn/input/motion.js';
import { updateVehiclePhysicsState } from '/turn/vehicle/physics.js?build=20260720-r19';
import { GAME_MODE, installGameModeState, prepareRaceStartState, resetRaceToStage, setGameModeState } from '/turn/race/game-state.js';
import { createRaceSessionOrchestrator } from '/turn/race/session-orchestrator.js?source=20260729-r118-m8';
import { beginTimedLapState, completeLapState, updateLapProgressState } from '/turn/race/lap-system.js?build=20260720-r19';
import { recordReplayFrame, replayFrameAt } from '/turn/race/replay-system.js';
import { RIVAL_LIMIT, loadRivalsState, saveRivalsState } from '/turn/race/rival-storage.js?build=20260720-r19';
import { createTrackSpatialIndex } from '/turn/race/track-spatial-index.js?build=20260720-r19';
import { trackPitch, trackSampleAtProgress, trackSurfaceY } from '/turn/tracks/elevation.js?build=20260725-r67';
import { showTheLot } from '/turn/garage/lot-r10.js?build=20260720-r19';
import {
  DEFAULT_VEHICLE_SECONDARY_COLOR,
  getCarDefinition,
  loadVehicleSelection,
  saveVehicleSelection
} from '/turn/vehicle/catalog.js?build=20260720-r19';
import { createCarVisual } from '/turn/vehicle/car-models.js?build=20260720-r19';
import { installPerformanceMonitor, recordPerformanceFrame } from '/turn/performance-monitor.js?build=20260720-r19';

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
const installGate = document.querySelector('#installGate');

const TAU = Math.PI * 2;
const TRACK_WIDTH = 27;
const TRACK_SAMPLES = 720;
const MAX_STEER_ROLL = THREE.MathUtils.degToRad(14);
const FULL_DRIVE_TILT = THREE.MathUtils.degToRad(6.5);
const DRIVE_TILT_DEADZONE = THREE.MathUtils.degToRad(0.8);
const MAX_SPEED = 88;
const GHOST_KEY = 'turn-three-ghost-v4';
const COMPETITOR_KEY = 'turn-personal-rivals-v1';
const COMPETITOR_LIMIT = 4;
const COMPETITOR_MIGRATION_KEY = 'turn-rival-timestamp-migration-v1';
const TRACK_SECTION_COLORS = ['#ff8fbd', '#2f855a', '#f6ad55', '#5c7cfa'];
const initialVehicleSelection = loadVehicleSelection();
const initialVehicleDefinition = getCarDefinition(initialVehicleSelection.carId);

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
  competitorLaps: [],
  vehicleId: initialVehicleSelection.carId,
  vehicleColor: initialVehicleSelection.color,
  vehicleSecondaryColor: initialVehicleSelection.secondaryColor,
  vehicleTuning: initialVehicleDefinition.tuning,
  lastFrame: performance.now(),
  messageTimer: 0
};

globalThis.__turnVehicleTuning = state.vehicleTuning;

installGameModeState(state);

function publishUiState(reason) {
  window.dispatchEvent(new CustomEvent('turn:ui-state-change', {
    detail: { reason, mode: state.mode, running: state.running }
  }));
}

function setGameMode(mode) {
  const result = setGameModeState(state, mode);
  publishUiState('game-mode');
  return result;
}

globalThis.__turnGameModes = GAME_MODE;
globalThis.__turnGetGameMode = () => state.mode;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x38d9ff);
scene.fog = new THREE.Fog(0x74c0fc, 180, 700);

function isStandaloneDisplayMode() {
  return document.documentElement.classList.contains('turn-standalone')
    || window.matchMedia?.('(display-mode: standalone)').matches
    || window.matchMedia?.('(display-mode: fullscreen)').matches
    || navigator.standalone === true;
}

function getStandaloneScreenSize(width, height) {
  if (!isStandaloneDisplayMode()) return { width: 0, height: 0 };

  const reportedWidth = Math.max(
    Number(screen.width) || 0,
    Number(screen.availWidth) || 0
  );
  const reportedHeight = Math.max(
    Number(screen.height) || 0,
    Number(screen.availHeight) || 0
  );
  if (!reportedWidth || !reportedHeight) return { width: 0, height: 0 };

  const longSide = Math.max(reportedWidth, reportedHeight);
  const shortSide = Math.min(reportedWidth, reportedHeight);
  return width >= height
    ? { width: longSide, height: shortSide }
    : { width: shortSide, height: longSide };
}

function getViewportSize() {
  const viewport = window.visualViewport;
  const root = document.documentElement;
  const layoutWidth = Math.max(
    Number(viewport?.width) || 0,
    Number(window.innerWidth) || 0,
    Number(root.clientWidth) || 0
  );
  const layoutHeight = Math.max(
    Number(viewport?.height) || 0,
    Number(window.innerHeight) || 0,
    Number(root.clientHeight) || 0
  );
  const standaloneScreen = getStandaloneScreenSize(layoutWidth, layoutHeight);
  const width = Math.max(1, Math.round(Math.max(layoutWidth, standaloneScreen.width)));
  const height = Math.max(1, Math.round(Math.max(layoutHeight, standaloneScreen.height)));
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

const trackSpatialIndex = createTrackSpatialIndex(samples, { cellSize: 32 });
installPerformanceMonitor({
  getMode: () => state.mode,
  getTrackStats: () => trackSpatialIndex.getStats()
});

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
  const roadPositions = [];
  const roadColors = [];
  const roadIndices = [];
  const asphaltDark = new THREE.Color(0x34383d);
  const asphaltLight = new THREE.Color(0x4a4f55);

  for (let i = 0; i <= TRACK_SAMPLES; i += 1) {
    const sample = samples[i % TRACK_SAMPLES];
    const left = sample.point.clone().addScaledVector(sample.normal, TRACK_WIDTH / 2);
    const right = sample.point.clone().addScaledVector(sample.normal, -TRACK_WIDTH / 2);
    left.y = 0.13;
    right.y = 0.13;
    roadPositions.push(left.x, left.y, left.z, right.x, right.y, right.z);

    const variation = THREE.MathUtils.clamp(
      0.42 + Math.sin(i * 0.19) * 0.12 + Math.sin(i * 0.73 + 1.4) * 0.07,
      0,
      1
    );
    const color = asphaltDark.clone().lerp(asphaltLight, variation);
    roadColors.push(color.r, color.g, color.b, color.r, color.g, color.b);
  }

  for (let i = 0; i < TRACK_SAMPLES; i += 1) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    // Reverse the old winding so the road faces upward toward the camera.
    roadIndices.push(a, c, b, b, c, d);
  }

  const roadGeometry = new THREE.BufferGeometry();
  roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
  roadGeometry.setAttribute('color', new THREE.Float32BufferAttribute(roadColors, 3));
  roadGeometry.setIndex(roadIndices);
  roadGeometry.computeVertexNormals();

  const road = new THREE.Mesh(
    roadGeometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.98,
      metalness: 0,
      side: THREE.DoubleSide
    })
  );
  road.receiveShadow = true;
  world.add(road);

  const curbWidth = 1.75;
  const curbSegmentLength = 12;
  const curbColors = [new THREE.Color(0xe63946), new THREE.Color(0xfff8e8)];

  for (const side of [-1, 1]) {
    const positions = [];
    const colors = [];

    for (let i = 0; i < TRACK_SAMPLES; i += 1) {
      const current = samples[i];
      const next = samples[(i + 1) % TRACK_SAMPLES];
      const innerOffset = side * (TRACK_WIDTH / 2 - 0.05);
      const outerOffset = side * (TRACK_WIDTH / 2 + curbWidth);

      const a = current.point.clone().addScaledVector(current.normal, innerOffset).setY(0.165);
      const b = current.point.clone().addScaledVector(current.normal, outerOffset).setY(0.165);
      const c = next.point.clone().addScaledVector(next.normal, innerOffset).setY(0.165);
      const d = next.point.clone().addScaledVector(next.normal, outerOffset).setY(0.165);

      positions.push(
        a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z,
        b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z
      );

      const color = curbColors[Math.floor(i / curbSegmentLength) % 2];
      for (let vertex = 0; vertex < 6; vertex += 1) {
        colors.push(color.r, color.g, color.b);
      }
    }

    const curbGeometry = new THREE.BufferGeometry();
    curbGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    curbGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    curbGeometry.computeVertexNormals();

    const curb = new THREE.Mesh(
      curbGeometry,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.9,
        metalness: 0,
        side: THREE.DoubleSide
      })
    );
    curb.receiveShadow = true;
    world.add(curb);
  }

  const dashStep = 8;
  const dashCount = Math.ceil(TRACK_SAMPLES / dashStep);
  const dashGeometry = new THREE.BoxGeometry(0.34, 0.045, 5.2);
  const dashMaterial = new THREE.MeshStandardMaterial({
    color: 0xfaf8ee,
    roughness: 0.92,
    metalness: 0
  });
  const centreLine = new THREE.InstancedMesh(dashGeometry, dashMaterial, dashCount);
  const marker = new THREE.Object3D();
  let dashIndex = 0;

  for (let i = 0; i < TRACK_SAMPLES; i += dashStep) {
    const sample = samples[i];
    marker.position.copy(sample.point);
    marker.position.y = 0.19;
    marker.rotation.set(0, Math.atan2(sample.tangent.x, sample.tangent.z), 0);
    marker.updateMatrix();
    centreLine.setMatrixAt(dashIndex, marker.matrix);
    dashIndex += 1;
  }

  centreLine.instanceMatrix.needsUpdate = true;
  centreLine.receiveShadow = true;
  world.add(centreLine);
}

function makeScenery() {
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(520, 96),
    new THREE.MeshStandardMaterial({ color: 0x8ce99a, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  world.add(ground);

  installKenneyWorld({ world, samples, trackWidth: TRACK_WIDTH }).catch((error) => {
    console.warn('TURN: world assets failed to install.', error);
  });
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

const ghostCar = makeCar(0x38d9ff, 1);
ghostCar.visible = false;
ghostCar.traverse((node) => {
  if (node.isMesh) node.castShadow = false;
});
world.add(ghostCar);

const proceduralPlayerParts = [...playerCar.children];
const proceduralGhostParts = [...ghostCar.children];
playerCar.userData.turnProceduralParts = proceduralPlayerParts;
ghostCar.userData.turnProceduralParts = proceduralGhostParts;

async function installCarVisual(root, { carId, color, secondaryColor, ghost = false }) {
  const key = `${carId}|${color}|${secondaryColor}|${ghost ? 1 : 0}`;
  if (root.userData.turnVisualKey === key || root.userData.turnVisualPendingKey === key) return;

  const generation = (root.userData.turnVisualGeneration || 0) + 1;
  root.userData.turnVisualGeneration = generation;
  root.userData.turnVisualPendingKey = key;

  const visual = await createCarVisual({
    carId,
    color,
    secondaryColor,
    ghost,
    targetLength: 5.5,
    outline: true
  });
  if (root.userData.turnVisualGeneration !== generation) return;

  for (const child of [...root.children]) {
    if (child.userData?.turnAssetVisual) root.remove(child);
  }
  for (const part of root.userData.turnProceduralParts || []) part.visible = false;

  visual.userData.turnAssetVisual = true;
  root.add(visual);
  root.userData.turnVisualKey = key;
  root.userData.turnVisualPendingKey = null;
}

async function applyVehicleSelection(selection) {
  const saved = saveVehicleSelection(selection);
  const definition = getCarDefinition(saved.carId);
  state.vehicleId = saved.carId;
  state.vehicleColor = saved.color;
  state.vehicleSecondaryColor = saved.secondaryColor;
  state.vehicleTuning = definition.tuning;
  globalThis.__turnVehicleTuning = definition.tuning;

  try {
    await installCarVisual(playerCar, {
      carId: state.vehicleId,
      color: state.vehicleColor,
      secondaryColor: state.vehicleSecondaryColor,
      ghost: false
    });
  } catch (error) {
    console.warn('TURN: selected car model failed to load, using procedural fallback.', error);
    for (const part of playerCar.userData.turnProceduralParts || []) part.visible = true;
  }
}

void installCarVisual(playerCar, {
  carId: state.vehicleId,
  color: state.vehicleColor,
  secondaryColor: state.vehicleSecondaryColor,
  ghost: false
}).catch((error) => console.warn('TURN: initial selected car failed to load.', error));

const COMPETITOR_MAP_COLORS = ['#38d9ff', '#ff4fa3', '#9775fa', '#ff922b'];
const competitorCars = [ghostCar];

function refreshCompetitorLabels() {
  // Ghost identity is owned by the standalone spectator HUD.
}

function createCompetitorCar() {
  const car = makeCar(0x38d9ff, 1);
  car.userData.turnProceduralParts = [...car.children];
  car.visible = false;
  car.traverse((node) => {
    if (node.isMesh) node.castShadow = false;
  });
  world.add(car);
  return car;
}

function ensureCompetitorCars() {
  while (competitorCars.length < COMPETITOR_LIMIT) {
    competitorCars.push(createCompetitorCar());
  }
}

function syncCompetitorVisuals() {
  ensureCompetitorCars();
  for (let i = 0; i < competitorCars.length; i += 1) {
    const car = competitorCars[i];
    const lap = state.competitorLaps[i];
    if (!lap) continue;
    void syncCompetitorVisual(car, lap);
  }
}

async function syncCompetitorVisual(car, lap) {
  const carId = lap.carId || 'sedan';
  const color = lap.carColor || COMPETITOR_MAP_COLORS[competitorCars.indexOf(car)] || '#38d9ff';
  const secondaryColor = lap.carSecondaryColor || DEFAULT_VEHICLE_SECONDARY_COLOR;
  try {
    await installCarVisual(car, { carId, color, secondaryColor, ghost: true });
  } catch (error) {
    const key = `${carId}|${color}|${secondaryColor}|1`;
    if (car.userData.turnVisualFailedKey !== key) {
      car.userData.turnVisualFailedKey = key;
      console.warn('TURN: rival car model failed to load, using procedural fallback.', error);
    }
  }
}

const SKID_HISTORY_CAPACITY = 90;
const SKID_WHEEL_COUNT = 2;
const SKID_COMPONENT_COUNT = 3;
const SKID_SAMPLE_STRIDE = SKID_WHEEL_COUNT * SKID_COMPONENT_COUNT;
const SKID_MAX_DRAW_VERTICES = 120;
const skidGeometry = new THREE.BufferGeometry();
const skidPositions = new Float32Array(360 * 3);
skidGeometry.setAttribute('position', new THREE.BufferAttribute(skidPositions, 3));
const skidLine = new THREE.LineSegments(
  skidGeometry,
  new THREE.LineBasicMaterial({ color: 0x08090a, transparent: true, opacity: 0.52 })
);
skidLine.frustumCulled = false;
world.add(skidLine);
const skidHistory = new Float32Array(SKID_HISTORY_CAPACITY * SKID_SAMPLE_STRIDE);
let skidHistoryStart = 0;
let skidHistoryCount = 0;
const skidLateral = new THREE.Vector3();
const skidRearCenter = new THREE.Vector3();
const skidLeftWheel = new THREE.Vector3();
const skidRightWheel = new THREE.Vector3();

const smokePool = Array.from({ length: 24 }, () => {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 7, 5),
    new THREE.MeshBasicMaterial({ color: 0xb9c0c7, transparent: true, opacity: 0 })
  );
  mesh.visible = false;
  mesh.userData.life = 0;
  mesh.userData.velocity = new THREE.Vector3();
  world.add(mesh);
  return mesh;
});

const flamePool = Array.from({ length: 16 }, (_, index) => {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 7, 5),
    new THREE.MeshBasicMaterial({
      color: index % 2 ? 0xff922b : 0xffd43b,
      transparent: true,
      opacity: 0,
      depthWrite: false
    })
  );
  mesh.visible = false;
  mesh.userData.life = 0;
  mesh.userData.velocity = new THREE.Vector3();
  world.add(mesh);
  return mesh;
});

let smokeCursor = 0;
let flameCursor = 0;
let smokeCooldown = 0;
let flameCooldown = 0;
const effectForward = new THREE.Vector3();
const effectRight = new THREE.Vector3();
const effectRear = new THREE.Vector3();
const effectPosition = new THREE.Vector3();
const effectVelocity = new THREE.Vector3();
const effectScale = new THREE.Vector3();

function launchParticle(pool, cursor, position, velocity, life, scale, opacity) {
  const particle = pool[cursor % pool.length];
  particle.visible = true;
  particle.position.copy(position);
  particle.scale.copy(scale);
  particle.material.opacity = opacity;
  particle.userData.life = life;
  particle.userData.maxLife = life;
  particle.userData.velocity.copy(velocity);
  return cursor + 1;
}

function updateParticlePool(pool, dt, smoke = false) {
  for (const particle of pool) {
    if (!particle.visible) continue;
    particle.userData.life -= dt;
    if (particle.userData.life <= 0) {
      particle.visible = false;
      continue;
    }
    const ratio = particle.userData.life / particle.userData.maxLife;
    particle.position.addScaledVector(particle.userData.velocity, dt);
    particle.material.opacity = ratio * (smoke ? 0.42 : 0.9);
    if (smoke) particle.scale.multiplyScalar(1 + dt * 1.7);
    else particle.scale.multiplyScalar(1 - Math.min(0.65, dt * 3.2));
  }
}

function updateDriveEffects(dt) {
  effectForward.copy(getForward());
  effectRight.copy(getRight());
  effectRear.copy(state.position).addScaledVector(effectForward, -3.2);
  effectRear.y += 0.54;

  flameCooldown -= dt;
  if (globalThis.__turnBoostActive && state.speed > 4 && flameCooldown <= 0) {
    for (const side of [-1, 1]) {
      effectPosition.copy(effectRear).addScaledVector(effectRight, side * 0.78);
      effectVelocity.copy(effectForward).multiplyScalar(-8 - state.speed * 0.08);
      effectVelocity.y += 1.2;
      flameCursor = launchParticle(
        flamePool,
        flameCursor,
        effectPosition,
        effectVelocity,
        0.22,
        effectScale.set(0.5, 0.48, 1.8),
        0.95
      );
    }
    flameCooldown = 0.035;
  }

  smokeCooldown -= dt;
  if (globalThis.__turnDriftHeld && state.speed > 13 && Math.abs(state.steering) > 0.08 && smokeCooldown <= 0) {
    for (const side of [-1, 1]) {
      effectPosition.copy(effectRear).addScaledVector(effectRight, side * 1.28);
      effectPosition.y = state.position.y + 0.27;
      effectVelocity.copy(effectRight).multiplyScalar(-side * state.steering * 2.8);
      effectVelocity.y += 2.1;
      smokeCursor = launchParticle(
        smokePool,
        smokeCursor,
        effectPosition,
        effectVelocity,
        0.72,
        effectScale.set(0.78, 0.52, 0.78),
        0.42
      );
    }
    smokeCooldown = 0.075;
  }

  updateParticlePool(smokePool, dt, true);
  updateParticlePool(flamePool, dt, false);
}

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
  return trackSpatialIndex.find(position);
}

function resetCar(showFeedback = true) {
  resetRaceToStage({
    state,
    samples,
    showFeedback,
    showMessage,
    setRacePosition: globalThis.__turnSetRacePosition
  });
  publishUiState('race-reset');
}

function getScreenOrientationAngle() {
  const degrees = Number.isFinite(screen.orientation?.angle)
    ? screen.orientation.angle
    : Number(window.orientation || 0);
  return THREE.MathUtils.degToRad(degrees);
}

function getScreenSpaceRoll(gravity) {
  const angle = getScreenOrientationAngle();
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const screenX = gravity.x * cos + gravity.y * sin;
  const screenY = -gravity.x * sin + gravity.y * cos;
  let roll = normalizeAngle(Math.atan2(screenX, -screenY));

  if (roll > Math.PI / 2) roll -= Math.PI;
  if (roll < -Math.PI / 2) roll += Math.PI;

  return roll;
}

function motionPoseFromGravity(event) {
  return motionPoseFromGravityState(event);
}

function handleMotion(event) {
  const pose = motionPoseFromGravity(event);
  if (!pose) return;
  state.motionSeen = true;
  state.targetRoll = pose.roll;
  state.targetPitch = pose.pitch;
}

const raceSession = createRaceSessionOrchestrator({
  state,
  elements: { intro, hud, controls, manualSteer, status },
  environment: globalThis,
  showRaceSetup: showTheLot,
  applyVehicleSelection,
  prepareRaceStartState,
  publishUiState,
  handleMotion,
  resize,
  showMessage
});
globalThis.__turnNextRaceSession = raceSession;

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

// Gas is analog and handled by motion-adapter.js.
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

motionButton.addEventListener('click', raceSession.requestMotion);
manualButton.addEventListener('click', raceSession.useManualMode);
calibrateButton.addEventListener('click', calibrate);
resetButton.addEventListener('click', () => resetCar());

document.addEventListener('selectstart', (event) => event.preventDefault());
document.addEventListener('contextmenu', (event) => {
  if (event.target.closest('button')) event.preventDefault();
});

function updateMotionInput(dt) {
  updateMotionInputState({
    state,
    dt,
    maxSteerRoll: MAX_STEER_ROLL
  });
}

function beginTimedLap(now) {
  beginTimedLapState({ state, samples, now, showMessage });
  publishUiState('lap-started');
}

function updatePhysics(dt, now) {
  const nearestAfter = updateVehiclePhysicsState({
    state,
    dt,
    updateMotionInput,
    findNearestTrack,
    getForward,
    getRight,
    trackWidth: TRACK_WIDTH,
    trackSampleCount: TRACK_SAMPLES,
    maxSpeed: MAX_SPEED * state.vehicleTuning.topSpeedMultiplier,
    analogGas: globalThis.__turnAnalogGas || 0,
    boostActive: Boolean(globalThis.__turnBoostActive),
    driftHeld: Boolean(globalThis.__turnDriftHeld),
    vehicleTuning: state.vehicleTuning
  });

  updateLapProgressState({
    state,
    nearestAfter,
    samples,
    trackWidth: TRACK_WIDTH,
    now,
    beginTimedLap,
    completeLap,
    recordGhostFrame
  });
}

function recordGhostFrame() {
  recordReplayFrame(state);
}

function completeLap(now) {
  completeLapState({
    state,
    samples,
    now,
    competitorLimit: RIVAL_LIMIT,
    saveGhost,
    showMessage,
    onError(error) {
      console.error('TURN: completed lap could not be added to rivals, continuing race.', error);
      globalThis.__turnLastLapError = error;
    }
  });
  syncCompetitorVisuals();
  publishUiState('lap-completed');
}

function saveGhost() {
  saveRivalsState(state);
}

function loadGhost() {
  loadRivalsState({ state, samples, findNearestTrack });
  syncCompetitorVisuals();
  publishUiState('rivals-loaded');
}

globalThis.__turnHasGhosts = () => state.competitorLaps.length > 0;

function resetRivals() {
  state.competitorLaps = [];
  state.bestTime = Infinity;
  state.ghostFrames = [];
  state.ghostVisible = false;
  try {
    localStorage.removeItem(COMPETITOR_KEY);
    localStorage.removeItem(GHOST_KEY);
  } catch (_) {}
  for (const car of competitorCars) car.visible = false;
  refreshCompetitorLabels();
  updateHud();
  showMessage('RIVALS RESET', 1800);
  window.dispatchEvent(new CustomEvent('turn:rivals-reset'));
  publishUiState('rivals-reset');
}

globalThis.__turnResetRivals = resetRivals;
globalThis.__turnNukeGhosts = resetRivals;

function lapFrameAt(lap, time) {
  return replayFrameAt(lap, time);
}

function ghostFrameAt(time) {
  const bestLap = state.competitorLaps[0];
  return bestLap ? lapFrameAt(bestLap, time) : null;
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
  const surfaceSample = samples[state.nearestTrackIndex] || findNearestTrack(state.position).sample;
  playerCar.position.copy(state.position);
  playerCar.rotation.x = trackPitch(surfaceSample);
  playerCar.rotation.y = state.heading + Math.PI;
  playerCar.rotation.z = -state.steering * 0.035 - state.velocity.dot(getRight()) * 0.0025;
  animateWheels(playerCar, state.steering, state.speed, dt);
}

function placeCompetitorCars(dt) {
  for (let i = 0; i < competitorCars.length; i += 1) {
    const car = competitorCars[i];
    const lap = state.competitorLaps[i];
    if (!lap || !state.lapActive) {
      car.visible = false;
      continue;
    }

    const frame = lapFrameAt(lap, state.lapElapsed);
    if (!frame) {
      car.visible = false;
      continue;
    }

    const surfaceSample = trackSampleAtProgress(samples, frame.p) || findNearestTrack(frame).sample;
    car.visible = true;
    car.position.set(frame.x, trackSurfaceY(surfaceSample), frame.z);
    car.rotation.x = trackPitch(surfaceSample);
    car.rotation.y = frame.h + Math.PI;
    car.rotation.z = -frame.s * 0.03;
    if (car === ghostCar) animateWheels(car, frame.s, 45, dt);
  }
}

function updateScene(dt) {
  if (globalThis.__turnRuntime?.runSceneOverride?.(dt)) return;

  placePlayerCar(dt);
  placeCompetitorCars(dt);
  updateDriveEffects(dt);
  updateRaceCameraState({
    state,
    camera,
    cameraPosition,
    cameraTarget,
    getForward,
    getRight,
    samples,
    maxSpeed: MAX_SPEED,
    dt
  });
  updateSkids();
}

function pushSkidSample(leftWheel, rightWheel) {
  skidHistoryStart = (skidHistoryStart - 1 + SKID_HISTORY_CAPACITY) % SKID_HISTORY_CAPACITY;
  writeSkidPoint(skidHistoryStart, 0, leftWheel);
  writeSkidPoint(skidHistoryStart, 1, rightWheel);
  skidHistoryCount = Math.min(SKID_HISTORY_CAPACITY, skidHistoryCount + 1);
}

function repeatLatestSkidSample() {
  if (!skidHistoryCount) return;
  const previousStart = skidHistoryStart;
  skidHistoryStart = (skidHistoryStart - 1 + SKID_HISTORY_CAPACITY) % SKID_HISTORY_CAPACITY;
  const previousOffset = previousStart * SKID_SAMPLE_STRIDE;
  const nextOffset = skidHistoryStart * SKID_SAMPLE_STRIDE;
  for (let component = 0; component < SKID_SAMPLE_STRIDE; component += 1) {
    skidHistory[nextOffset + component] = skidHistory[previousOffset + component];
  }
  skidHistoryCount = Math.min(SKID_HISTORY_CAPACITY, skidHistoryCount + 1);
}

function writeSkidPoint(sampleIndex, wheel, point) {
  const offset = (sampleIndex * SKID_WHEEL_COUNT + wheel) * SKID_COMPONENT_COUNT;
  skidHistory[offset] = point.x;
  skidHistory[offset + 1] = point.y;
  skidHistory[offset + 2] = point.z;
}

function copySkidVertex(sampleOffset, wheel, vertexIndex) {
  const sampleIndex = (skidHistoryStart + sampleOffset) % SKID_HISTORY_CAPACITY;
  const sourceOffset = (sampleIndex * SKID_WHEEL_COUNT + wheel) * SKID_COMPONENT_COUNT;
  const targetOffset = vertexIndex * SKID_COMPONENT_COUNT;
  skidPositions[targetOffset] = skidHistory[sourceOffset];
  skidPositions[targetOffset + 1] = skidHistory[sourceOffset + 1];
  skidPositions[targetOffset + 2] = skidHistory[sourceOffset + 2];
}

function updateSkids() {
  if (state.driftAmount > 0.34 && state.speed > 21) {
    skidLateral.copy(getRight());
    skidRearCenter.copy(state.position).addScaledVector(getForward(), -2.0);
    skidLeftWheel.copy(skidRearCenter).addScaledVector(skidLateral, -1.25);
    skidRightWheel.copy(skidRearCenter).addScaledVector(skidLateral, 1.25);
    skidLeftWheel.y = state.position.y + 0.05;
    skidRightWheel.y = state.position.y + 0.05;
    pushSkidSample(skidLeftWheel, skidRightWheel);
  } else {
    repeatLatestSkidSample();
  }

  let cursor = 0;
  for (let sample = 0; sample < skidHistoryCount - 1 && cursor < SKID_MAX_DRAW_VERTICES; sample += 1) {
    for (let wheel = 0; wheel < SKID_WHEEL_COUNT; wheel += 1) {
      copySkidVertex(sample, wheel, cursor);
      cursor += 1;
      copySkidVertex(sample + 1, wheel, cursor);
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

  const startPoint = mapPoint(samples[0].point);
  const beforeStart = mapPoint(samples[samples.length - 4].point);
  const afterStart = mapPoint(samples[4].point);
  const startDx = afterStart.x - beforeStart.x;
  const startDy = afterStart.y - beforeStart.y;
  const startLength = Math.max(0.001, Math.hypot(startDx, startDy));
  const startNx = -startDy / startLength;
  const startNy = startDx / startLength;
  mapCtx.beginPath();
  mapCtx.moveTo(startPoint.x - startNx * 11, startPoint.y - startNy * 11);
  mapCtx.lineTo(startPoint.x + startNx * 11, startPoint.y + startNy * 11);
  mapCtx.strokeStyle = '#08090a';
  mapCtx.lineWidth = 9;
  mapCtx.stroke();
  mapCtx.strokeStyle = '#fff8e8';
  mapCtx.lineWidth = 5;
  mapCtx.stroke();

  const playerPoint = mapPoint(state.position);
  mapCtx.beginPath();
  mapCtx.arc(playerPoint.x, playerPoint.y, 8, 0, TAU);
  mapCtx.fillStyle = '#ffd43b';
  mapCtx.fill();
  mapCtx.strokeStyle = '#08090a';
  mapCtx.lineWidth = 4;
  mapCtx.stroke();

  if (state.lapActive) {
    for (let i = 0; i < state.competitorLaps.length; i += 1) {
      const rival = lapFrameAt(state.competitorLaps[i], state.lapElapsed);
      if (!rival) continue;
      const rivalPoint = mapPoint({ x: rival.x, z: rival.z });
      mapCtx.beginPath();
      mapCtx.arc(rivalPoint.x, rivalPoint.y, 6, 0, TAU);
      mapCtx.fillStyle = COMPETITOR_MAP_COLORS[i] || '#38d9ff';
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

function updateRacePosition() {
  const total = state.competitorLaps.length + 1;
  if (!state.lapActive || !state.competitorLaps.length) {
    globalThis.__turnSetRacePosition?.(state.lapActive ? 1 : null, total);
    return;
  }

  let rivalsAhead = 0;
  const playerDistance = state.progress;

  for (const lap of state.competitorLaps) {
    const frame = lapFrameAt(lap, state.lapElapsed);
    if (!frame) continue;
    const progress = Number.isFinite(frame.p)
      ? frame.p
      : findNearestTrack(frame).index / TRACK_SAMPLES;
    const completedGhostLaps = Number.isFinite(lap.time) && lap.time > 0
      ? Math.floor(state.lapElapsed / lap.time)
      : 0;
    if (completedGhostLaps + progress > playerDistance + 0.002) rivalsAhead += 1;
  }

  globalThis.__turnSetRacePosition?.(rivalsAhead + 1, total);
}

function updateHud() {
  updateHudState({
    state,
    speedEl,
    lapEl,
    lapTimeEl,
    bestTimeEl,
    tiltNeedle,
    tiltValue,
    mapCanvas,
    mapCtx,
    samples,
    trackSampleCount: TRACK_SAMPLES,
    replayFrameAt: lapFrameAt,
    findNearestTrack,
    setRacePosition: globalThis.__turnSetRacePosition
  });
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

let turnSceneOverride = null;
const turnRuntime = {
  state,
  samples,
  scene,
  world,
  renderer,
  sun,
  hemi,
  trackWidth: TRACK_WIDTH,
  maxSpeed: MAX_SPEED,
  trackSampleCount: TRACK_SAMPLES,
  trackSpatialIndex,
  findNearestTrack,
  getForward,
  getRight,
  camera,
  cameraPosition,
  cameraTarget,
  playerCar,
  ghostCar,
  competitorCars,
  ensureCompetitorCars,
  syncCompetitorVisuals,
  animateWheels,
  lapFrameAt,
  GAME_MODE,
  setGameMode,
  openLot: raceSession.openLotFromRace,
  setRacePosition(position, total) {
    globalThis.__turnSetRacePosition?.(position, total);
  },
  setSceneOverride(override) {
    turnSceneOverride = typeof override === 'function' ? override : null;
  },
  runSceneOverride(dt) {
    return turnSceneOverride ? turnSceneOverride(dt) === true : false;
  }
};
globalThis.__turnRuntime = turnRuntime;
window.dispatchEvent(new CustomEvent('turn:runtime-ready', { detail: turnRuntime }));
publishUiState('runtime-ready');

const MAX_PHYSICS_STEP = 1 / 60;
const MAX_FRAME_CATCHUP = 0.12;
const HUD_UPDATE_INTERVAL_MS = 1000 / 30;
let nextHudUpdateAt = 0;

function mainSceneOcclusion() {
  if (document.body.classList.contains('turn-lot-open')) return 'lot';
  if (installGate && !installGate.hidden) return 'install gate';
  return null;
}

renderer.setAnimationLoop((now) => {
  globalThis.__turnUpdateGameplayControls?.(now);

  const occlusion = mainSceneOcclusion();
  if (occlusion) {
    state.lastFrame = now;
    if (occlusion !== 'lot') {
      recordPerformanceFrame(`${occlusion} · paused`, [], now, { rendered: false });
    }
    return;
  }

  const frameDt = Math.min(MAX_FRAME_CATCHUP, Math.max(0.001, (now - state.lastFrame) / 1000));
  const frameStart = now - frameDt * 1000;
  state.lastFrame = now;

  if (state.running) {
    const physicsSteps = Math.max(1, Math.ceil(frameDt / MAX_PHYSICS_STEP));
    const physicsDt = frameDt / physicsSteps;

    for (let step = 1; step <= physicsSteps; step += 1) {
      updatePhysics(physicsDt, frameStart + physicsDt * step * 1000);
    }

    updateScene(frameDt);
    if (now >= nextHudUpdateAt) {
      updateHud();
      nextHudUpdateAt = now + HUD_UPDATE_INTERVAL_MS;
    }
  } else {
    const preview = samples[Math.floor((now * 0.012) % TRACK_SAMPLES)];
    playerCar.position.copy(preview.point);
    playerCar.position.y = trackSurfaceY(preview);
    playerCar.rotation.x = trackPitch(preview);
    playerCar.rotation.y = Math.atan2(preview.tangent.x, preview.tangent.z) + Math.PI;
    animateWheels(playerCar, Math.sin(now * 0.001) * 0.3, 28, frameDt);
    camera.position.set(0, 110, 215);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
  }

  renderer.render(scene, camera);
  recordPerformanceFrame(state.running ? state.mode : 'preview', renderer, now);
});
