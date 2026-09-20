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
  if (!runtime?.world || !runtime?.scene || !runtime?.state || !runtime?.playerCar) return null;

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
  skidGeometry.setAttribute('position', new THREE.BufferAttribute(skidPositions, SKID_COMPONENT_COUNT).setUsage(THREE.DynamicDrawUsage));
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

  const skidLeftWheel = new THREE.Vector3();
  const skidRightWheel = new THREE.Vector3();
  const wheelLocal = new THREE.Vector3();
  const surfaceUp = new THREE.Vector3();
  const inverseCar = new THREE.Matrix4();
  let cachedWheels = null, cachedSteering = null;
  let rearLeft = null, rearRight = null;

  function wheelContacts() {
    const car = runtime.playerCar;
    const wheels = car.userData.wheelSpinners;
    const steering = car.userData.frontWheelPivots;
    if (wheels !== cachedWheels || steering !== cachedSteering) {
      cachedWheels = wheels;
      cachedSteering = steering;
      rearLeft = rearRight = null;
      clearSkids();
      // Resolve only when the installed visual changes. Mounts include the
      // model's authored axle positions, orientation and normalized scale.
      inverseCar.copy(car.matrixWorld).invert();
      let leftZ = -Infinity, rightZ = -Infinity;
      for (const wheel of wheels || []) {
        let front = false;
        for (let parent = wheel.parent; parent && parent !== car; parent = parent.parent) {
          if (steering?.includes(parent)) { front = true; break; }
        }
        if (front) continue; // Also handles models with reversed front/back labels.
        wheelLocal.setFromMatrixPosition(wheel.matrixWorld).applyMatrix4(inverseCar);
        if (wheelLocal.x < 0 && wheelLocal.z > leftZ) { rearLeft = wheel; leftZ = wheelLocal.z; }
        if (wheelLocal.x > 0 && wheelLocal.z > rightZ) { rearRight = wheel; rightZ = wheelLocal.z; }
      }
    }
    if (!rearLeft || !rearRight) return false;
    skidLeftWheel.setFromMatrixPosition(rearLeft.matrixWorld);
    skidRightWheel.setFromMatrixPosition(rearRight.matrixWorld);
    const { state, samples } = runtime;
    const sample = samples?.[state.nearestTrackIndex];
    surfaceUp.set(0, 1, 0);
    if (sample?.tangent && sample?.normal) {
      surfaceUp.crossVectors(sample.tangent, sample.normal).normalize();
      if (surfaceUp.y < 0) surfaceUp.negate();
    }
    // Project wheel centres onto the existing vehicle contact plane. Body roll
    // and spinning tires must not lift old marks away from the road.
    placeOnSurface(skidLeftWheel, state.position);
    placeOnSurface(skidRightWheel, state.position);
    return true;
  }

  function placeOnSurface(point, contact) {
    point.y = contact.y + (0.01 - surfaceUp.x * (point.x - contact.x)
      - surfaceUp.z * (point.z - contact.z)) / Math.max(0.1, surfaceUp.y);
  }

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

    if (state.driftAmount > 0.34 && state.speed > 21 && wheelContacts()) {
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

  // Scene callbacks run after world matrices are current, but before Three
  // uploads geometry. A line's onBeforeRender is too late: at speed its GPU
  // buffer would still contain the previous frame's wheel positions.
  const previousBeforeRender = runtime.scene.onBeforeRender;
  runtime.scene.onBeforeRender = function skidFrame(renderer, scene, camera, target) {
    previousBeforeRender?.call(this, renderer, scene, camera, target);
    updateSkids();
  };
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
