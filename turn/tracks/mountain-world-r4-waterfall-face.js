import * as THREE from 'three';
import { MOUNTAIN_R3 } from './mountain-world-r3-terrain.js';

const { WATER_LIGHT, WATERFALL, LAKE } = MOUNTAIN_R3;

function nearestTrackSample(samples, x, z) {
  let nearest = samples[0];
  let distanceSq = Infinity;
  for (const sample of samples) {
    const dx = sample.point.x - x;
    const dz = sample.point.z - z;
    const next = dx * dx + dz * dz;
    if (next < distanceSq) {
      nearest = sample;
      distanceSq = next;
    }
  }
  return nearest;
}

function removePreviousTrackFace(world) {
  const removals = [];
  world.traverse((object) => {
    if (object.name === 'Mountain track-visible waterfall curtain r4'
        || object.name === 'Mountain track-visible waterfall whitewater r4') {
      removals.push(object);
    }
  });
  for (const object of removals) object.parent?.remove(object);
  return removals.length;
}

function makeCurtain(topCenter, bottomCenter, across, halfWidth, meshMaterial, name) {
  const topLeft = topCenter.clone().addScaledVector(across, -halfWidth);
  const topRight = topCenter.clone().addScaledVector(across, halfWidth);
  const bottomLeft = bottomCenter.clone().addScaledVector(across, -halfWidth);
  const bottomRight = bottomCenter.clone().addScaledVector(across, halfWidth);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    ...topLeft.toArray(), ...topRight.toArray(), ...bottomLeft.toArray(),
    ...topRight.toArray(), ...bottomRight.toArray(), ...bottomLeft.toArray()
  ], 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, meshMaterial);
  mesh.name = name;
  mesh.renderOrder = 8;
  return mesh;
}

export function installMountainR4DriverFacingWaterfall(world, samples) {
  if (!world || !Array.isArray(samples) || samples.length < 3) return world;

  const removedPreviousFace = removePreviousTrackFace(world);
  const road = nearestTrackSample(samples, WATERFALL.x, WATERFALL.z);
  const towardRoad = new THREE.Vector3(
    road.point.x - WATERFALL.x,
    0,
    road.point.z - WATERFALL.z
  ).normalize();
  const across = new THREE.Vector3(-towardRoad.z, 0, towardRoad.x).normalize();

  // The r3 sheets follow the physical spill toward the lake and look strong
  // from the lakeside, but that geometry is nearly edge-on from the racing
  // line. This additional face lives in the same cleft, drops nearly straight
  // down the cliff, and leans only slightly toward the road. It therefore
  // reads as the same waterfall from the cockpit rather than as a bigger fall.
  const topCenter = new THREE.Vector3(
    WATERFALL.x,
    WATERFALL.top - 0.65,
    WATERFALL.z + 2.2
  ).addScaledVector(towardRoad, 1.2);
  const bottomCenter = topCenter.clone()
    .addScaledVector(towardRoad, 3.0)
    .setY(LAKE.level + 0.75);

  const water = new THREE.MeshStandardMaterial({
    color: WATER_LIGHT,
    roughness: 0.16,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
    emissive: 0x0b5872,
    emissiveIntensity: 0.25,
    depthWrite: false
  });
  const foam = new THREE.MeshBasicMaterial({
    color: 0xf1fdff,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  world.add(
    makeCurtain(
      topCenter,
      bottomCenter,
      across,
      8.8,
      water,
      'Mountain track-visible waterfall curtain r4'
    ),
    makeCurtain(
      topCenter.clone().addScaledVector(across, 1.4),
      bottomCenter.clone().addScaledVector(across, 0.6),
      across,
      2.15,
      foam,
      'Mountain track-visible waterfall whitewater r4'
    )
  );

  world.userData.turnMountainR4DriverFacingWaterfall = Object.freeze({
    removedPreviousFace,
    roadFacing: true,
    width: 17.6,
    drop: topCenter.y - bottomCenter.y,
    physicalR3LakeSheetsPreserved: true
  });
  return world;
}
