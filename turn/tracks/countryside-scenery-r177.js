import * as THREE from 'three';
import { createCarVisual } from '../vehicle/car-models.js?build=20260720-r19';

const INK = 0x08090a;
const TAU = Math.PI * 2;
const BUILDING_RETRY_COUNT = 8;
const BUILDING_RETRY_DELAY_MS = 250;

const VEHICLE_SLOTS = Object.freeze([
  Object.freeze({ carId: 'suv', color: '#ff922b', index: 74, distance: 25, targetLength: 6.8, rotationOffset: 0.12 }),
  Object.freeze({ carId: 'truck', color: '#38d9ff', index: 188, distance: 31, targetLength: 8.4, rotationOffset: -0.18 }),
  Object.freeze({ carId: 'suv', color: '#ff4fa3', index: 322, distance: 27, targetLength: 6.8, rotationOffset: -0.1 }),
  Object.freeze({ carId: 'truck', color: '#ffd43b', index: 451, distance: 34, targetLength: 8.4, rotationOffset: 0.2 }),
  Object.freeze({ carId: 'suv', color: '#6c757d', index: 563, distance: 24, targetLength: 6.8, rotationOffset: 0.08 }),
  Object.freeze({ carId: 'truck', color: '#ff922b', index: 664, distance: 29, targetLength: 8.4, rotationOffset: -0.14 })
]);

function seeded01(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function getTrackCenter(samples) {
  const center = new THREE.Vector3();
  for (const sample of samples) center.add(sample.point);
  return center.multiplyScalar(1 / Math.max(1, samples.length));
}

function trackInsetContour(samples, center, inset, step = 7) {
  const points = [];
  for (let index = 0; index < samples.length; index += step) {
    const sample = samples[index];
    const towardCenter = center.clone().sub(sample.point).setY(0);
    const distance = towardCenter.length();
    if (distance < 0.001) continue;
    towardCenter.multiplyScalar(1 / distance);
    const wobble = (seeded01(32000 + index) - 0.5) * 5;
    points.push(sample.point.clone().addScaledVector(towardCenter, inset + wobble).setY(0));
  }
  return points;
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = ((a.z > point.z) !== (b.z > point.z))
      && point.x < ((b.x - a.x) * (point.z - a.z)) / ((b.z - a.z) || 0.000001) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function materialList(material) {
  return Array.isArray(material) ? material : [material];
}

function isInkMaterial(material) {
  return materialList(material).some((entry) => entry?.color?.getHex?.() === INK);
}

function hasInkOutline(root) {
  let outlined = false;
  root.traverse((node) => {
    if (outlined || !node?.isMesh || !node.material) return;
    const materials = materialList(node.material);
    outlined = materials.some((entry) => (
      entry?.side === THREE.BackSide && entry?.color?.getHex?.() === INK
    ));
  });
  return outlined;
}

function removeBeachContours(world) {
  const removals = [];
  const bounds = new THREE.Box3();

  for (const child of world.children) {
    if (!child?.isMesh || !child.userData?.turnNoAutoOutline || !isInkMaterial(child.material)) continue;
    bounds.setFromObject(child);
    // Lake shore ribbons and the island outline sit almost flush with the ground.
    // The intentional road-edge contour is higher (around y=.158), so leave it alone.
    if (bounds.max.y < 0.11) removals.push(child);
  }

  for (const child of removals) world.remove(child);
  if (removals.length) console.info(`TURN: removed ${removals.length} Countryside beach contour meshes.`);
}

function expectedTownPlacements(samples, trackWidth) {
  const placements = [];
  for (let index = 0; index < 14; index += 1) {
    const sampleIndex = 48 + index * 49;
    const sample = samples[((sampleIndex % samples.length) + samples.length) % samples.length];
    const side = index % 2 === 0 ? 1 : -1;
    const distance = 42 + seeded01(200 + index) * 30;
    const position = sample.point.clone().addScaledVector(
      sample.normal,
      side * (trackWidth / 2 + distance)
    );
    placements.push({ sample, side, distance, position });
  }
  return placements;
}

function findBuildingNear(world, expectedPosition) {
  const bounds = new THREE.Box3();
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  let best = null;
  let bestDistance = Infinity;

  for (const child of world.children) {
    if (!child?.isGroup || child.userData?.turnLakeRelocated || !hasInkOutline(child)) continue;
    bounds.setFromObject(child);
    bounds.getCenter(center);
    bounds.getSize(size);
    if (size.y < 8 || size.y > 20 || Math.max(size.x, size.z) < 4) continue;

    const distance = Math.hypot(center.x - expectedPosition.x, center.z - expectedPosition.z);
    if (distance < bestDistance && distance <= 9) {
      best = child;
      bestDistance = distance;
    }
  }
  return best;
}

function relocateLakeBuildings(world, samples, trackWidth) {
  const center = getTrackCenter(samples);
  const shoreOuter = trackInsetContour(samples, center, 72, 7);
  const placements = expectedTownPlacements(samples, trackWidth)
    .filter((placement) => pointInPolygon(placement.position, shoreOuter));

  const bounds = new THREE.Box3();
  const currentCenter = new THREE.Vector3();
  let moved = 0;
  let unresolved = 0;

  for (const placement of placements) {
    const building = findBuildingNear(world, placement.position);
    if (!building) {
      unresolved += 1;
      continue;
    }

    bounds.setFromObject(building);
    bounds.getCenter(currentCenter);
    const safePosition = placement.sample.point.clone().addScaledVector(
      placement.sample.normal,
      -placement.side * (trackWidth / 2 + placement.distance)
    );
    building.position.x += safePosition.x - currentCenter.x;
    building.position.z += safePosition.z - currentCenter.z;
    building.userData.turnLakeRelocated = true;
    moved += 1;
  }

  if (moved) console.info(`TURN: moved ${moved} Countryside building(s) clear of the lake.`);
  return unresolved;
}

function outwardSide(sample, center) {
  const towardCenter = center.clone().sub(sample.point).setY(0);
  return sample.normal.dot(towardCenter) > 0 ? -1 : 1;
}

async function addRoadsideVehicles(world, samples, trackWidth) {
  if (world.userData.turnCountrysideRoadsideVehicles) return;
  world.userData.turnCountrysideRoadsideVehicles = true;
  const center = getTrackCenter(samples);

  await Promise.all(VEHICLE_SLOTS.map(async (slot) => {
    const sample = samples[((slot.index % samples.length) + samples.length) % samples.length];
    const side = outwardSide(sample, center);
    const visual = await createCarVisual({
      carId: slot.carId,
      color: slot.color,
      targetLength: slot.targetLength,
      outline: true
    });

    visual.name = `Countryside scenery ${slot.carId}`;
    visual.position.copy(sample.point).addScaledVector(
      sample.normal,
      side * (trackWidth / 2 + slot.distance)
    );
    visual.position.y = 0.18;
    visual.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z) + slot.rotationOffset;
    visual.traverse((node) => {
      if (node.isMesh) node.castShadow = false;
    });
    world.add(visual);
  }));
}

async function settleLakeBuildings(world, samples, trackWidth) {
  for (let attempt = 0; attempt < BUILDING_RETRY_COUNT; attempt += 1) {
    const unresolved = relocateLakeBuildings(world, samples, trackWidth);
    if (!unresolved) return;
    await new Promise((resolve) => setTimeout(resolve, BUILDING_RETRY_DELAY_MS));
  }
}

export async function installCountrysideSceneryCleanup({ world, samples, trackWidth }) {
  if (!world || !samples?.length || !Number.isFinite(trackWidth)) return;

  removeBeachContours(world);
  await Promise.allSettled([
    settleLakeBuildings(world, samples, trackWidth),
    addRoadsideVehicles(world, samples, trackWidth)
  ]);

  // A late art-pass completion cannot recreate the beach contours after this point in the
  // normal bootstrap, but one final sweep makes the cleanup resilient to slower devices.
  removeBeachContours(world);
}
