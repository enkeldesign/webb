import * as THREE from 'three';
import { MOUNTAIN_R3 } from './mountain-world-r3-terrain.js';

const { GRANITE_DARK, WATER_LIGHT, WATERFALL, LAKE } = MOUNTAIN_R3;

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
        || object.name === 'Mountain track-visible waterfall whitewater r4'
        || object.name === 'Mountain driver-visible waterfall connector bed r4'
        || object.name === 'Mountain driver-visible waterfall connector water r4'
        || object.name === 'Mountain driver-visible waterfall plunge foam r4') {
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

function makeRibbon(points, width, meshMaterial, name, yOffset = 0) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const positions = [];
  const segments = 20;
  const up = new THREE.Vector3(0, 1, 0);
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3().crossVectors(up, tangent).normalize();
    point.y += yOffset;
    positions.push(
      point.x + normal.x * width * 0.5, point.y, point.z + normal.z * width * 0.5,
      point.x - normal.x * width * 0.5, point.y, point.z - normal.z * width * 0.5
    );
  }

  const indices = [];
  for (let index = 0; index < segments; index += 1) {
    const a = index * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, c, d, b);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, meshMaterial);
  mesh.name = name;
  mesh.renderOrder = 7;
  return mesh;
}

export function installMountainR4DriverFacingWaterfall(world, samples) {
  if (!world || !Array.isArray(samples) || samples.length < 3) return world;

  const removedPreviousFace = removePreviousTrackFace(world);

  // The original r3 fall sits at x=246, which is over 100 metres from the
  // nearest road on this part of the lap. Keep that physical river/lake system,
  // but let the river continue along the cliff top to the lake's north-west
  // edge. The visible cascade then lands inside the same lake at a point that
  // naturally enters the driver's view through the bend.
  const cascadeTop = new THREE.Vector3(205, 19.5, -151);
  const cascadeBottom = new THREE.Vector3(208, LAKE.level + 0.72, -166);
  const connectorPoints = [
    new THREE.Vector3(WATERFALL.x, WATERFALL.top + 0.12, WATERFALL.z + 2.5),
    new THREE.Vector3(232, 24.0, -134),
    new THREE.Vector3(219, 21.8, -142),
    cascadeTop.clone()
  ];

  const bedMaterial = new THREE.MeshStandardMaterial({ color: GRANITE_DARK, roughness: 1 });
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: WATER_LIGHT,
    roughness: 0.18,
    transparent: true,
    opacity: 0.95,
    emissive: 0x0b5872,
    emissiveIntensity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const foamMaterial = new THREE.MeshBasicMaterial({
    color: 0xf1fdff,
    transparent: true,
    opacity: 0.76,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  world.add(
    makeRibbon(
      connectorPoints.map((point) => point.clone().add(new THREE.Vector3(0, -0.22, 0))),
      10.5,
      bedMaterial,
      'Mountain driver-visible waterfall connector bed r4'
    ),
    makeRibbon(
      connectorPoints,
      7.6,
      waterMaterial,
      'Mountain driver-visible waterfall connector water r4',
      0.05
    )
  );

  const road = nearestTrackSample(samples, cascadeTop.x, cascadeTop.z);
  const towardRoad = new THREE.Vector3(
    road.point.x - cascadeTop.x,
    0,
    road.point.z - cascadeTop.z
  ).normalize();
  const across = new THREE.Vector3(-towardRoad.z, 0, towardRoad.x).normalize();
  const topCenter = cascadeTop.clone().addScaledVector(towardRoad, 1.6);
  const bottomCenter = cascadeBottom.clone().addScaledVector(towardRoad, 1.2);

  world.add(
    makeCurtain(
      topCenter,
      bottomCenter,
      across,
      9.6,
      waterMaterial,
      'Mountain track-visible waterfall curtain r4'
    ),
    makeCurtain(
      topCenter.clone().addScaledVector(across, 1.6),
      bottomCenter.clone().addScaledVector(across, 0.8),
      across,
      2.35,
      foamMaterial,
      'Mountain track-visible waterfall whitewater r4'
    )
  );

  const plungeFoam = new THREE.Mesh(
    new THREE.CircleGeometry(13.5, 24),
    new THREE.MeshBasicMaterial({ color: 0xeefdff, transparent: true, opacity: 0.78, depthWrite: false })
  );
  plungeFoam.rotation.x = -Math.PI / 2;
  plungeFoam.scale.set(1.45, 0.7, 1);
  plungeFoam.position.set(cascadeBottom.x, LAKE.level + 0.13, cascadeBottom.z);
  plungeFoam.name = 'Mountain driver-visible waterfall plunge foam r4';
  plungeFoam.renderOrder = 7;
  world.add(plungeFoam);

  world.userData.turnMountainR4DriverFacingWaterfall = Object.freeze({
    removedPreviousFace,
    roadFacing: true,
    visualCascadeTop: Object.freeze(cascadeTop.toArray()),
    visualCascadeBottom: Object.freeze(cascadeBottom.toArray()),
    connectorLength: connectorPoints[0].distanceTo(cascadeTop),
    width: 19.2,
    landsInsideMainLake: true,
    physicalR3LakeSheetsPreserved: true
  });
  return world;
}
