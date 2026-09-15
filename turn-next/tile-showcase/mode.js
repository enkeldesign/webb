import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { updateRaceCameraState } from '/turn/render/camera.js?build=20260720-r19&revision=r270-camera-hotpath';
import { activateTrack } from '/turn/tracks/track-manager.js?source=20260729-r118-m8';
import {
  BEIGE_TILE_IDS,
  GREEN_TILE_IDS,
  KENNEY_ROAD_TILE_URLS,
  WATER_TILE_IDS
} from './kenney-road-pack.js';

const TRACK_ID = 'turn-next-tile-showcase';
const TRACK_WIDTH = 11.4;
const TILE_SCALE = 4;
const TILE_FOOTPRINT = 3 * TILE_SCALE;
const SAMPLE_COUNT = 920;
const CAR_CLEARANCE = 0.18;
const PITCH_RESPONSE = 10.5;
const TILE_STEP = 20;
const loader = new GLTFLoader();
const tileCache = new Map();
let installed = false;

const CONTROL_POINTS = Object.freeze([
  [0, 0, 1], [92, -18, 4], [168, -74, 13], [226, -158, 26],
  [196, -250, 40], [105, -326, 51], [8, -308, 54], [-82, -238, 45],
  [-132, -132, 28], [-104, -28, 10], [-42, 72, 3], [-116, 154, 6],
  [-218, 178, 8], [-308, 112, 10], [-300, 10, 14], [-232, -102, 21],
  [-302, -220, 31], [-248, -338, 24], [-116, -400, 16], [44, -408, 11],
  [194, -354, 7], [302, -254, 4], [334, -118, 2], [282, 4, 1], [142, 66, 1]
]);

export async function installTileShowcaseMode() {
  if (installed) return globalThis.__turnNextTileShowcase;
  const runtime = globalThis.__turnRuntime;
  const raceSession = globalThis.__turnNextRaceSession;
  const home = globalThis.__turnNextHome || globalThis.__turnHome;
  const menu = globalThis.__turnHomeLayout?.menu || document.querySelector('.m8-home-menu');
  if (!runtime || !raceSession || !home || !menu) return null;

  installed = true;
  installStylesheet();
  const hud = createHud();
  const session = {
    active: false,
    loading: false,
    data: null,
    snapshot: null,
    frame: 0,
    smoothedPitch: 0,
    returnFocus: null
  };
  const launcher = createLauncher(menu, () => void startShowcase(session, { runtime, raceSession, home }, hud));
  session.returnFocus = launcher;
  hud.querySelector('[data-tile-leave]').addEventListener('click', () => void leaveShowcase(session, { runtime, raceSession, home }, hud));

  const api = Object.freeze({
    start: () => startShowcase(session, { runtime, raceSession, home }, hud),
    leave: () => leaveShowcase(session, { runtime, raceSession, home }, hud),
    getState: () => Object.freeze({ active: session.active, loading: session.loading })
  });
  globalThis.__turnNextTileShowcase = api;
  return api;
}

function installStylesheet() {
  if (document.querySelector('link[data-turn-next-tile-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/turn-next/tile-showcase/mode.css';
  link.dataset.turnNextTileStyle = '';
  document.head.appendChild(link);
}

function createLauncher(menu, onStart) {
  const existing = menu.querySelector('[data-turn-next-tile-launcher]');
  if (existing) return existing;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'turn-next-tile-launcher';
  button.dataset.turnNextTileLauncher = '';
  button.textContent = 'TILE TRACK';
  button.setAttribute('aria-label', 'Drive the TURN NEXT Kenney tile track showcase');
  const status = menu.querySelector('.m8-home-status');
  menu.insertBefore(button, status || menu.querySelector('.m8-race-button'));
  button.addEventListener('click', onStart);
  return button;
}

function createHud() {
  const hud = document.createElement('section');
  hud.className = 'turn-next-tile-hud';
  hud.hidden = true;
  hud.setAttribute('aria-label', 'Tile track experiment');
  hud.innerHTML = '<strong>TILE TRACK</strong><span>Kenney · elevation showcase</span><button type="button" data-tile-leave>LEAVE</button>';
  document.body.appendChild(hud);
  return hud;
}

async function startShowcase(session, context, hud) {
  if (session.active || session.loading) return false;
  session.loading = true;
  session.returnFocus?.setAttribute('aria-busy', 'true');
  try {
    const steeringMode = context.home.getSteeringMode?.() || 'manual';
    const access = steeringMode === 'motion'
      ? await context.raceSession.prepareMotionAccess()
      : await context.raceSession.prepareManualAccess();

    session.snapshot = captureSnapshot(context.runtime, context.home);
    showMessage('BUILDING TILE TRACK…', 2400);
    session.data = await buildShowcaseWorld();
    await enterShowcase(session, context, hud, access);
    return true;
  } catch (error) {
    console.warn('TURN NEXT TILE TRACK could not start.', error);
    showMessage('TILE TRACK COULD NOT LOAD', 2600);
    if (session.snapshot) await leaveShowcase(session, context, hud);
    return false;
  } finally {
    session.loading = false;
    session.returnFocus?.removeAttribute('aria-busy');
  }
}

function captureSnapshot(runtime, home) {
  return Object.freeze({
    trackId: home.getSelectedTrackId?.() || runtime.state.trackId || 'countryside',
    openLot: runtime.openLot,
    trackWidth: runtime.trackWidth,
    getTrackId: globalThis.__turnGetTrackId,
    getCollisionProfile: globalThis.__turnGetCollisionProfile,
    isForgivingSurface: globalThis.__turnIsForgivingSurface
  });
}

async function enterShowcase(session, { runtime, raceSession, home }, hud, access) {
  const data = session.data;
  if (!data) throw new Error('Tile showcase was not built.');
  if (runtime.activeWorld) runtime.activeWorld.visible = false;
  runtime.samples.splice(0, runtime.samples.length, ...data.samples);
  runtime.trackSpatialIndex.replaceSamples(runtime.samples);
  runtime.trackWidth = TRACK_WIDTH;
  runtime.trackId = TRACK_ID;
  runtime.activeTrack = Object.freeze({
    id: TRACK_ID,
    name: 'TILE TRACK',
    freeRoamDistance: 850,
    collisionProfile: data.collisionProfile
  });
  runtime.state.trackId = TRACK_ID;
  runtime.state.trackSampleCount = runtime.samples.length;
  runtime.scene.add(data.world);
  runtime.activeWorld = data.world;
  runtime.scene.background?.setHex?.(0x9cc8de);
  if (runtime.scene.fog?.color) {
    runtime.scene.fog.color.setHex(0xb8cfcb);
    runtime.scene.fog.near = 260;
    runtime.scene.fog.far = 760;
  }

  globalThis.__turnGetTrackId = () => TRACK_ID;
  globalThis.__turnGetCollisionProfile = () => data.collisionProfile;
  globalThis.__turnIsForgivingSurface = () => false;
  runtime.openLot = () => leaveShowcase(session, { runtime, raceSession, home }, hud);

  home.hideHome();
  document.body.classList.add('turn-next-tile-active');
  hud.hidden = false;
  session.active = true;
  await raceSession.startGame(access?.fullscreenPromise || Promise.resolve(false), { announceStart: false });
  positionAtStart(runtime, data);
  runtime.setSceneOverride((dt) => renderShowcaseFrame(runtime, data, session, dt));
  session.frame = requestAnimationFrame(() => showcaseFrame(session, runtime));
  showMessage('TILE TRACK · GREEN → WATER → BEIGE', 2300);
}

function positionAtStart(runtime, data) {
  const sample = data.samples[0];
  runtime.setGameMode(runtime.GAME_MODE.STAGED);
  runtime.state.freeRoam = true;
  runtime.state.position.copy(sample.point);
  runtime.state.position.y += CAR_CLEARANCE;
  runtime.state.velocity.set(0, 0, 0);
  runtime.state.heading = Math.atan2(sample.tangent.x, sample.tangent.z);
  runtime.state.speed = 0;
  runtime.state.driftAmount = 0;
  runtime.state.driftSlipAngle = 0;
  runtime.state.offRoad = false;
  runtime.state.trackDistance = 0;
  runtime.state.progress = 0;
  runtime.state.lastProgress = 0;
  runtime.state.nearestTrackIndex = 0;
  runtime.state.lapActive = false;
  runtime.state.lapElapsed = 0;
  runtime.state.lapCheckpointIndex = 0;
  runtime.state.recording = [];
  runtime.playerCar.position.copy(runtime.state.position);
  runtime.playerCar.rotation.set(sample.pitch, runtime.state.heading + Math.PI, 0);
  for (const car of runtime.competitorCars || []) car.visible = false;
  runtime.setRacePosition?.(null, 1);
}

function renderShowcaseFrame(runtime, data, session, dt) {
  const state = runtime.state;
  const index = normalizeIndex(state.nearestTrackIndex, data.samples.length);
  const surfaceY = heightAtRoad(data.samples, state.position.x, state.position.z, index);
  state.position.y = surfaceY + CAR_CLEARANCE;

  const forward = runtime.getForward();
  const probe = 4.2;
  const frontY = heightAtRoad(data.samples, state.position.x + forward.x * probe, state.position.z + forward.z * probe, index);
  const backY = heightAtRoad(data.samples, state.position.x - forward.x * probe, state.position.z - forward.z * probe, index);
  const targetPitch = Math.atan2(frontY - backY, probe * 2);
  const alpha = 1 - Math.exp(-Math.max(0, dt || 0.016) * PITCH_RESPONSE);
  session.smoothedPitch = THREE.MathUtils.lerp(session.smoothedPitch, targetPitch, alpha);
  state.surfacePitch = session.smoothedPitch;

  runtime.playerCar.position.copy(state.position);
  runtime.playerCar.rotation.x = session.smoothedPitch;
  runtime.playerCar.rotation.y = state.heading + Math.PI;
  runtime.playerCar.rotation.z = -state.steering * 0.035 - state.velocity.dot(runtime.getRight()) * 0.0025;
  runtime.animateWheels?.(runtime.playerCar, state.steering, state.speed, dt);

  updateRaceCameraState({
    state,
    camera: runtime.camera,
    cameraPosition: runtime.cameraPosition,
    cameraTarget: runtime.cameraTarget,
    getForward: runtime.getForward,
    getRight: runtime.getRight,
    samples: data.samples,
    maxSpeed: runtime.maxSpeed,
    dt
  });
  return true;
}

function heightAtRoad(samples, x, z, hintIndex) {
  let bestDistance = Infinity;
  let bestY = samples[hintIndex]?.point.y || 0;
  for (let offset = -12; offset <= 12; offset += 1) {
    const a = samples[normalizeIndex(hintIndex + offset, samples.length)];
    const b = samples[normalizeIndex(hintIndex + offset + 1, samples.length)];
    const abx = b.point.x - a.point.x;
    const abz = b.point.z - a.point.z;
    const lengthSq = abx * abx + abz * abz || 1;
    const t = THREE.MathUtils.clamp(((x - a.point.x) * abx + (z - a.point.z) * abz) / lengthSq, 0, 1);
    const px = a.point.x + abx * t;
    const pz = a.point.z + abz * t;
    const distance = (x - px) ** 2 + (z - pz) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestY = THREE.MathUtils.lerp(a.point.y, b.point.y, t);
    }
  }
  return bestY;
}

function showcaseFrame(session, runtime) {
  if (!session.active) {
    session.frame = 0;
    return;
  }
  const state = runtime.state;
  state.freeRoam = true;
  state.lapActive = false;
  state.lapInvalid = false;
  state.lapElapsed = 0;
  state.lapCheckpointIndex = 0;
  state.recording = [];
  state.suppressNextLapStartMessage = true;
  session.frame = requestAnimationFrame(() => showcaseFrame(session, runtime));
}

async function leaveShowcase(session, { runtime, raceSession, home }, hud) {
  if (!session.active && !session.snapshot) return false;
  if (session.frame) cancelAnimationFrame(session.frame);
  session.frame = 0;
  runtime.setSceneOverride(null);
  raceSession.leaveRace();
  runtime.state.freeRoam = false;
  document.body.classList.remove('turn-next-tile-active');
  hud.hidden = true;

  const snapshot = session.snapshot;
  disposeWorld(session.data?.world);
  if (snapshot) {
    globalThis.__turnGetTrackId = snapshot.getTrackId;
    globalThis.__turnGetCollisionProfile = snapshot.getCollisionProfile;
    globalThis.__turnIsForgivingSurface = snapshot.isForgivingSurface;
    runtime.openLot = snapshot.openLot;
    runtime.trackWidth = snapshot.trackWidth;
    await activateTrack(snapshot.trackId, runtime);
  }
  session.active = false;
  session.data = null;
  session.snapshot = null;
  session.smoothedPitch = 0;
  home.showHome({ focus: true });
  session.returnFocus?.focus?.();
  return true;
}

async function buildShowcaseWorld() {
  const samples = makeTrackSamples();
  const world = new THREE.Group();
  world.name = 'TURN NEXT Kenney tile showcase';
  world.userData.turnNextTileShowcase = true;
  installTerrain(world);
  installRoad(world, samples);
  installWater(world);
  installScenery(world, samples);
  await installKenneyTiles(world, samples);
  return Object.freeze({
    world,
    samples,
    collisionProfile: Object.freeze({ freeRoamDistance: 850, colliders: Object.freeze([]) })
  });
}

function makeTrackSamples() {
  const points = CONTROL_POINTS.map(([x, z, y]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.45);
  const samples = [];
  let distance = 0;
  let previous = null;
  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    const t = index / SAMPLE_COUNT;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const horizontal = new THREE.Vector3(tangent.x, 0, tangent.z).normalize();
    const normal = new THREE.Vector3(-horizontal.z, 0, horizontal.x);
    if (previous) distance += point.distanceTo(previous);
    samples.push({ point, tangent, normal, distance, pitch: Math.atan2(tangent.y, Math.hypot(tangent.x, tangent.z)) });
    previous = point;
  }
  return samples;
}

function installRoad(world, samples) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const indices = [];
  const asphalt = new THREE.Color(0x474b4c);
  const highAsphalt = new THREE.Color(0x525453);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const half = TRACK_WIDTH / 2;
    const left = sample.point.clone().addScaledVector(sample.normal, half);
    const right = sample.point.clone().addScaledVector(sample.normal, -half);
    left.y += 0.08;
    right.y += 0.08;
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
    const color = sample.point.y > 30 ? highAsphalt : asphalt;
    colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    const next = (index + 1) % samples.length;
    indices.push(index * 2, index * 2 + 1, next * 2, index * 2 + 1, next * 2 + 1, next * 2);
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const road = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, side: THREE.DoubleSide }));
  road.receiveShadow = true;
  road.name = 'Continuous drive surface';
  world.add(road);

  const edgeGeometry = new THREE.BoxGeometry(0.24, 0.16, 3.5);
  const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0xfff8e8, roughness: 0.9 });
  for (let index = 0; index < samples.length; index += 8) {
    const sample = samples[index];
    const next = samples[(index + 4) % samples.length];
    const yaw = Math.atan2(next.point.x - sample.point.x, next.point.z - sample.point.z);
    for (const side of [-1, 1]) {
      const marker = new THREE.Mesh(edgeGeometry, edgeMaterial);
      marker.position.copy(sample.point).addScaledVector(sample.normal, side * (TRACK_WIDTH / 2 + 0.22));
      marker.position.y += 0.2;
      marker.rotation.y = yaw;
      marker.castShadow = false;
      marker.receiveShadow = true;
      world.add(marker);
    }
  }
}

function installTerrain(world) {
  const green = new THREE.Mesh(
    new THREE.BoxGeometry(760, 5, 510),
    new THREE.MeshStandardMaterial({ color: 0x91bd38, roughness: 1, flatShading: true })
  );
  green.position.set(70, -4, -125);
  green.receiveShadow = true;
  world.add(green);

  const beige = new THREE.Mesh(
    new THREE.BoxGeometry(610, 5, 430),
    new THREE.MeshStandardMaterial({ color: 0xd6c38b, roughness: 1, flatShading: true })
  );
  beige.position.set(-60, -3.5, -300);
  beige.receiveShadow = true;
  world.add(beige);

  const upland = new THREE.Mesh(
    new THREE.ConeGeometry(150, 75, 7),
    new THREE.MeshStandardMaterial({ color: 0x7ba632, roughness: 1, flatShading: true })
  );
  upland.position.set(40, 10, -275);
  upland.rotation.y = 0.34;
  upland.receiveShadow = true;
  world.add(upland);
}

function installWater(world) {
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(290, 210),
    new THREE.MeshStandardMaterial({ color: 0x79c9d7, roughness: 0.65, metalness: 0.04, transparent: true, opacity: 0.9 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(-205, 1.2, 135);
  world.add(water);
}

function installScenery(world, samples) {
  const treeCount = 150;
  const trunkGeometry = new THREE.CylinderGeometry(0.65, 0.8, 4.2, 5);
  const crownGeometry = new THREE.ConeGeometry(2.4, 7.6, 5);
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x76533b, roughness: 1 });
  const crownMaterial = new THREE.MeshStandardMaterial({ color: 0x4d802e, roughness: 1, flatShading: true });
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, treeCount);
  const crowns = new THREE.InstancedMesh(crownGeometry, crownMaterial, treeCount);
  const dummy = new THREE.Object3D();
  const random = seededRandom(910);
  for (let index = 0; index < treeCount; index += 1) {
    const sample = samples[Math.floor(random() * samples.length * 0.56) % samples.length];
    const side = random() < 0.5 ? -1 : 1;
    const offset = 18 + random() * 62;
    dummy.position.copy(sample.point).addScaledVector(sample.normal, side * offset);
    dummy.position.y = Math.max(2.1, sample.point.y * 0.55) + 2;
    dummy.rotation.y = random() * Math.PI * 2;
    dummy.scale.setScalar(0.7 + random() * 0.8);
    dummy.updateMatrix();
    trunks.setMatrixAt(index, dummy.matrix);
    dummy.position.y += 5.3 * dummy.scale.x;
    dummy.updateMatrix();
    crowns.setMatrixAt(index, dummy.matrix);
  }
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  trunks.castShadow = true;
  crowns.castShadow = true;
  world.add(trunks, crowns);
}

async function installKenneyTiles(world, samples) {
  const placements = buildTilePlacements(samples);
  const uniqueIds = [...new Set(placements.map((placement) => placement.id))];
  await Promise.allSettled(uniqueIds.map((id) => loadTile(id)));
  for (const placement of placements) {
    const template = tileCache.get(placement.id);
    if (!template) continue;
    const instance = makeTileInstance(template, placement);
    world.add(instance);
  }
}

function buildTilePlacements(samples) {
  const placements = [];
  const regions = [
    { from: 0, to: 0.43, ids: GREEN_TILE_IDS },
    { from: 0.43, to: 0.63, ids: WATER_TILE_IDS },
    { from: 0.63, to: 1, ids: BEIGE_TILE_IDS }
  ];
  let serial = 0;
  for (let index = 0; index < samples.length; index += TILE_STEP) {
    const progress = index / samples.length;
    const region = regions.find((candidate) => progress >= candidate.from && progress < candidate.to) || regions.at(-1);
    const id = region.ids[serial % region.ids.length];
    const sample = samples[index];
    const ahead = samples[(index + Math.floor(TILE_STEP / 2)) % samples.length];
    placements.push({ id, point: sample.point.clone(), yaw: Math.atan2(ahead.point.x - sample.point.x, ahead.point.z - sample.point.z), road: true, side: 0 });
    if (serial % 2 === 0) {
      const side = serial % 4 === 0 ? 1 : -1;
      const sideId = region.ids[(serial * 3 + 5) % region.ids.length];
      placements.push({
        id: sideId,
        point: sample.point.clone().addScaledVector(sample.normal, side * (TILE_FOOTPRINT * 1.15)),
        yaw: Math.atan2(ahead.point.x - sample.point.x, ahead.point.z - sample.point.z) + (side > 0 ? Math.PI / 2 : -Math.PI / 2),
        road: false,
        side
      });
    }
    serial += 1;
  }
  return placements;
}

async function loadTile(id) {
  if (tileCache.has(id)) return tileCache.get(id);
  const url = KENNEY_ROAD_TILE_URLS[id];
  if (!url) return null;
  const promise = loader.loadAsync(url).then((gltf) => {
    const root = gltf.scene;
    root.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = false;
      node.receiveShadow = true;
      if (node.material) node.material = node.material.clone();
    });
    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    return Object.freeze({ root, center, minY: box.min.y });
  }).catch((error) => {
    console.warn(`TURN NEXT TILE TRACK: Kenney tile ${id} failed to load.`, error);
    return null;
  });
  tileCache.set(id, promise);
  const loaded = await promise;
  if (loaded) tileCache.set(id, loaded);
  else tileCache.delete(id);
  return loaded;
}

function makeTileInstance(template, placement) {
  const wrapper = new THREE.Group();
  wrapper.name = `Kenney roadTile ${placement.id}`;
  const clone = template.root.clone(true);
  clone.position.set(-template.center.x, -template.minY, -template.center.z);
  wrapper.add(clone);
  wrapper.scale.setScalar(TILE_SCALE);
  wrapper.position.copy(placement.point);
  wrapper.position.y += placement.road ? -0.02 : -0.18;
  wrapper.rotation.y = placement.yaw + Math.PI / 2;
  return wrapper;
}

function disposeWorld(world) {
  if (!world) return;
  world.traverse((node) => {
    node.geometry?.dispose?.();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) material?.dispose?.();
  });
  world.removeFromParent?.();
}

function normalizeIndex(index, length) {
  const value = Number.isFinite(index) ? Math.round(index) : 0;
  return ((value % length) + length) % length;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function showMessage(text, duration = 1600) {
  const message = document.querySelector('#message');
  if (!message) return;
  message.textContent = text;
  message.classList.add('show');
  window.setTimeout(() => message.classList.remove('show'), duration);
}
