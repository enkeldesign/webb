import * as THREE from 'three';

const REVISION = 'r198-skid-continuity';
const SKID_HISTORY_CAPACITY = 90;
const SKID_WHEEL_COUNT = 2;
const SKID_COMPONENT_COUNT = 3;
const SKID_SAMPLE_STRIDE = SKID_WHEEL_COUNT * SKID_COMPONENT_COUNT;
const SKID_MAX_DRAW_VERTICES = 120;
const SKID_POSITION_CAPACITY = 360;
const SKID_MAX_CONTINUOUS_GAP = 18;
const SKID_MAX_CONTINUOUS_GAP_SQUARED = SKID_MAX_CONTINUOUS_GAP * SKID_MAX_CONTINUOUS_GAP;

let installed = false;

export function installSkidContinuity(runtime = globalThis.__turnRuntime) {
  if (installed) return globalThis.__turnSkidContinuity || null;
  if (!runtime?.world || !runtime?.state || !runtime?.getForward || !runtime?.getRight) return null;

  const legacySkidLine = findLegacySkidLine(runtime.world);
  if (!legacySkidLine) {
    console.warn('TURN: skid continuity could not find the legacy skid renderer.');
    return null;
  }

  installed = true;
  legacySkidLine.visible = false;
  legacySkidLine.userData.turnSkidLegacyDisabled = true;

  const skidGeometry = new THREE.BufferGeometry();
  const skidPositions = new Float32Array(SKID_POSITION_CAPACITY * SKID_COMPONENT_COUNT);
  skidGeometry.setAttribute('position', new THREE.BufferAttribute(skidPositions, SKID_COMPONENT_COUNT));
  skidGeometry.setDrawRange(0, 0);

  const skidLine = new THREE.LineSegments(skidGeometry, legacySkidLine.material.clone());
  skidLine.frustumCulled = false;
  skidLine.renderOrder = legacySkidLine.renderOrder;
  skidLine.userData.turnSkidContinuity = REVISION;
  runtime.world.add(skidLine);

  const skidHistory = new Float32Array(SKID_HISTORY_CAPACITY * SKID_SAMPLE_STRIDE);
  const skidHistoryConnections = new Uint8Array(SKID_HISTORY_CAPACITY);
  let skidHistoryStart = 0;
  let skidHistoryCount = 0;
  let skidStrokeActive = false;
  let lastPositionValid = false;
  let lastPositionX = 0;
  let lastPositionY = 0;
  let lastPositionZ = 0;

  const skidLateral = new THREE.Vector3();
  const skidRearCenter = new THREE.Vector3();
  const skidLeftWheel = new THREE.Vector3();
  const skidRightWheel = new THREE.Vector3();

  function clearSkids() {
    skidHistoryStart = 0;
    skidHistoryCount = 0;
    skidStrokeActive = false;
    lastPositionValid = false;
    skidGeometry.setDrawRange(0, 0);
  }

  function writeSkidPoint(sampleIndex, wheel, point) {
    const offset = (sampleIndex * SKID_WHEEL_COUNT + wheel) * SKID_COMPONENT_COUNT;
    skidHistory[offset] = point.x;
    skidHistory[offset + 1] = point.y;
    skidHistory[offset + 2] = point.z;
  }

  function pushSkidSample(leftWheel, rightWheel, connectToPrevious) {
    skidHistoryStart = (skidHistoryStart - 1 + SKID_HISTORY_CAPACITY) % SKID_HISTORY_CAPACITY;
    writeSkidPoint(skidHistoryStart, 0, leftWheel);
    writeSkidPoint(skidHistoryStart, 1, rightWheel);
    skidHistoryConnections[skidHistoryStart] = connectToPrevious ? 1 : 0;
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
    skidHistoryConnections[skidHistoryStart] = 0;
    skidHistoryCount = Math.min(SKID_HISTORY_CAPACITY, skidHistoryCount + 1);
  }

  function latestSkidDistanceSquared(wheel, point) {
    if (!skidHistoryCount) return Infinity;
    const offset = (skidHistoryStart * SKID_WHEEL_COUNT + wheel) * SKID_COMPONENT_COUNT;
    const dx = point.x - skidHistory[offset];
    const dy = point.y - skidHistory[offset + 1];
    const dz = point.z - skidHistory[offset + 2];
    return dx * dx + dy * dy + dz * dz;
  }

  function copySkidVertex(sampleOffset, wheel, vertexIndex) {
    const sampleIndex = (skidHistoryStart + sampleOffset) % SKID_HISTORY_CAPACITY;
    const sourceOffset = (sampleIndex * SKID_WHEEL_COUNT + wheel) * SKID_COMPONENT_COUNT;
    const targetOffset = vertexIndex * SKID_COMPONENT_COUNT;
    skidPositions[targetOffset] = skidHistory[sourceOffset];
    skidPositions[targetOffset + 1] = skidHistory[sourceOffset + 1];
    skidPositions[targetOffset + 2] = skidHistory[sourceOffset + 2];
  }

  function clearIfCarJumped() {
    const position = runtime.state.position;
    if (lastPositionValid) {
      const dx = position.x - lastPositionX;
      const dy = position.y - lastPositionY;
      const dz = position.z - lastPositionZ;
      if (dx * dx + dy * dy + dz * dz > SKID_MAX_CONTINUOUS_GAP_SQUARED) clearSkids();
    }
    lastPositionX = position.x;
    lastPositionY = position.y;
    lastPositionZ = position.z;
    lastPositionValid = true;
  }

  function updateSkids() {
    const state = runtime.state;
    if (!state.running) {
      if (skidHistoryCount || skidStrokeActive || lastPositionValid) clearSkids();
      return;
    }

    clearIfCarJumped();

    if (state.driftAmount > 0.34 && state.speed > 21) {
      skidLateral.copy(runtime.getRight());
      skidRearCenter.copy(state.position).addScaledVector(runtime.getForward(), -2.0);
      skidLeftWheel.copy(skidRearCenter).addScaledVector(skidLateral, -1.25);
      skidRightWheel.copy(skidRearCenter).addScaledVector(skidLateral, 1.25);
      skidLeftWheel.y = state.position.y + 0.05;
      skidRightWheel.y = state.position.y + 0.05;

      const connectToPrevious = skidStrokeActive
        && latestSkidDistanceSquared(0, skidLeftWheel) <= SKID_MAX_CONTINUOUS_GAP_SQUARED
        && latestSkidDistanceSquared(1, skidRightWheel) <= SKID_MAX_CONTINUOUS_GAP_SQUARED;
      pushSkidSample(skidLeftWheel, skidRightWheel, connectToPrevious);
      skidStrokeActive = true;
    } else {
      repeatLatestSkidSample();
      skidStrokeActive = false;
    }

    let cursor = 0;
    for (let sample = 0; sample < skidHistoryCount - 1 && cursor < SKID_MAX_DRAW_VERTICES; sample += 1) {
      const sampleIndex = (skidHistoryStart + sample) % SKID_HISTORY_CAPACITY;
      if (!skidHistoryConnections[sampleIndex]) continue;
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

  skidLine.onBeforeRender = updateSkids;
  globalThis.addEventListener('turn:track-changed', clearSkids);
  globalThis.addEventListener('turn:ui-state-change', (event) => {
    if (event.detail?.reason === 'race-reset' || event.detail?.running === false) clearSkids();
  });

  const api = Object.freeze({ revision: REVISION, clear: clearSkids, line: skidLine });
  globalThis.__turnSkidContinuity = api;
  return api;
}

function findLegacySkidLine(world) {
  return world.children.find((child) => {
    const position = child.geometry?.getAttribute?.('position');
    return child.isLineSegments
      && child.frustumCulled === false
      && child.material?.isLineBasicMaterial === true
      && child.material?.transparent === true
      && Math.abs(Number(child.material.opacity) - 0.52) < 0.0001
      && position?.count === SKID_POSITION_CAPACITY;
  }) || null;
}

function installWhenReady() {
  if (globalThis.__turnRuntime) {
    installSkidContinuity(globalThis.__turnRuntime);
    return;
  }
  globalThis.addEventListener('turn:runtime-ready', (event) => {
    installSkidContinuity(event.detail || globalThis.__turnRuntime);
  }, { once: true });
}

installWhenReady();
