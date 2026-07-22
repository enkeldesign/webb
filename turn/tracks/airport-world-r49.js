import * as THREE from 'three';
import { installAirportWorld as installBaseAirportWorld } from './airport-world.js?build=20260722-r48';

const APRON_SCENERY_CLEARANCE = 30;
const SERVICE_VEHICLE_CLEARANCE = 38;
const AIRCRAFT_VIEW_CLEARANCE = 60;
const BAGGAGE_CLEARANCE = 44;
const HORIZON_MIN_DISTANCE = 430;
const HORIZON_SCALE = 0.54;

export function installAirportWorld(options) {
  const world = installBaseAirportWorld(options);
  const samples = options.samples;

  world.name = 'TURN Airport r49';
  polishExistingScenery(world, samples);
  installLateAssetClearanceGate(world, samples);

  return world;
}

function polishExistingScenery(world, samples) {
  let mountainsPolished = 0;
  let baggageTrainsPolished = 0;
  let apronObjectsMoved = 0;

  for (const child of [...world.children]) {
    if (isOversizedHorizonMountain(child)) {
      polishHorizonMountain(child);
      mountainsPolished += 1;
      continue;
    }

    if (isBaggageTrain(child)) {
      child.scale.multiplyScalar(0.58);
      child.updateMatrixWorld(true);
      if (moveObjectToTrackClearance(child, samples, BAGGAGE_CLEARANCE)) apronObjectsMoved += 1;
      child.userData.turnAirportFootprintValidated = true;
      baggageTrainsPolished += 1;
      continue;
    }

    if (!isApronScenery(child)) continue;

    const clearance = isAircraftLike(child)
      ? AIRCRAFT_VIEW_CLEARANCE
      : APRON_SCENERY_CLEARANCE;
    if (moveObjectToTrackClearance(child, samples, clearance)) apronObjectsMoved += 1;
    child.userData.turnAirportFootprintValidated = true;
  }

  world.userData.turnAirportArtPass = Object.freeze({
    mountainsPolished,
    baggageTrainsPolished,
    apronObjectsMoved,
    footprintAware: true
  });
}

function installLateAssetClearanceGate(world, samples) {
  const addToWorld = world.add.bind(world);

  world.add = (...objects) => {
    for (const object of objects) {
      if (shouldValidateLateScenery(object)) {
        const footprint = horizontalFootprint(object);
        const clearance = footprint.radius >= 9
          ? AIRCRAFT_VIEW_CLEARANCE
          : SERVICE_VEHICLE_CLEARANCE;
        moveObjectToTrackClearance(object, samples, clearance);
        object.userData.turnAirportFootprintValidated = true;
      }
      addToWorld(object);
    }
    return world;
  };
}

function shouldValidateLateScenery(object) {
  return Boolean(
    object?.isGroup
      && object.children.length
      && !object.userData?.turnAirportFootprintValidated
  );
}

function isApronScenery(object) {
  if (!object?.isGroup || object.position.z < 105) return false;
  const footprint = horizontalFootprint(object);
  return footprint.radius > 1 && footprint.radius < 95;
}

function isAircraftLike(object) {
  let longFuselage = false;
  let wideWing = false;

  object.traverse((node) => {
    const geometry = node.geometry;
    if (!geometry) return;

    if (
      geometry.type === 'CylinderGeometry'
      && Number(geometry.parameters?.height) >= 18
    ) {
      longFuselage = true;
    }

    if (
      geometry.type === 'BoxGeometry'
      && Math.max(
        Number(geometry.parameters?.width) || 0,
        Number(geometry.parameters?.depth) || 0
      ) >= 18
    ) {
      wideWing = true;
    }
  });

  return longFuselage && wideWing;
}

function isBaggageTrain(object) {
  if (!object?.isGroup) return false;
  let cartBoxes = 0;

  object.traverse((node) => {
    if (node.geometry?.type !== 'BoxGeometry') return;
    const { width = 0, height = 0, depth = 0 } = node.geometry.parameters || {};
    if (
      width >= 4 && width <= 5
      && height >= 2 && height <= 3
      && depth >= 5 && depth <= 6
    ) {
      cartBoxes += 1;
    }
  });

  return cartBoxes >= 3;
}

function isOversizedHorizonMountain(object) {
  if (!object?.isGroup) return false;
  let oversizedCone = false;

  object.traverse((node) => {
    if (node.geometry?.type !== 'ConeGeometry') return;
    const radius = Number(node.geometry.parameters?.radius) || 0;
    const height = Number(node.geometry.parameters?.height) || 0;
    if (radius >= 45 && height >= 78) oversizedCone = true;
  });

  return oversizedCone;
}

function polishHorizonMountain(mountain) {
  mountain.scale.multiplyScalar(HORIZON_SCALE);

  const radialDistance = Math.hypot(mountain.position.x, mountain.position.z);
  if (radialDistance < HORIZON_MIN_DISTANCE) {
    const scale = HORIZON_MIN_DISTANCE / Math.max(1, radialDistance);
    mountain.position.x *= scale;
    mountain.position.z *= scale;
  }

  mountain.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(mountain);
  if (!bounds.isEmpty()) {
    mountain.position.y += -7 - bounds.min.y;
  }
  mountain.updateMatrixWorld(true);
}

function moveObjectToTrackClearance(object, samples, baseClearance) {
  let moved = false;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    object.updateMatrixWorld(true);
    const footprint = horizontalFootprint(object);
    const nearest = nearestTrackPoint(samples, footprint.center.x, footprint.center.z);
    const requiredDistance = baseClearance + footprint.radius;

    if (nearest.distance >= requiredDistance) break;

    let dx = footprint.center.x - nearest.point.x;
    let dz = footprint.center.z - nearest.point.z;
    let length = Math.hypot(dx, dz);

    if (length < 0.001) {
      dx = footprint.center.x || object.position.x || 1;
      dz = footprint.center.z || object.position.z || 0;
      length = Math.max(0.001, Math.hypot(dx, dz));
    }

    const pushDistance = requiredDistance - nearest.distance + 3;
    object.position.x += dx / length * pushDistance;
    object.position.z += dz / length * pushDistance;
    moved = true;
  }

  object.updateMatrixWorld(true);
  return moved;
}

function horizontalFootprint(object) {
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);

  if (bounds.isEmpty()) {
    return {
      center: new THREE.Vector3(object.position.x, 0, object.position.z),
      radius: 0
    };
  }

  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  return {
    center,
    radius: Math.hypot(size.x, size.z) * 0.5
  };
}

function nearestTrackPoint(samples, x, z) {
  let bestPoint = samples[0]?.point || { x: 0, z: 0 };
  let bestDistanceSq = Infinity;

  for (let index = 0; index < samples.length; index += 1) {
    const point = samples[index].point;
    const dx = x - point.x;
    const dz = z - point.z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      bestPoint = point;
    }
  }

  return {
    point: bestPoint,
    distance: Math.sqrt(bestDistanceSq)
  };
}