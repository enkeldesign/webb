import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { installAirportWorld as installCanonicalAirportWorld } from '/turn/tracks/airport-world-r52.js?build=20260722-r52';
import {
  AIRPORT_RUNWAY_ACCESS_ROADS,
  AIRPORT_RUNWAY_AIRCRAFT,
  AIRPORT_RUNWAY_BARRIERS,
  AIRPORT_RUNWAY_HANGAR,
  AIRPORT_RUNWAY_Z,
  AIRPORT_SERVICE_ROAD_Z,
  CANONICAL_AIRPORT_ACCESS_ROADS
} from '/turn-next/airport-runway/spec.js';

const INK = 0x08090a;
const CREAM = 0xfff8e8;
const ORANGE = 0xff922b;
const YELLOW = 0xffd43b;
const CYAN = 0x38d9ff;
const ASPHALT = 0x4f555c;
const HANGAR = 0x59636b;

const loader = new GLTFLoader();
let a380Promise = null;

export function installAirportRunwayWorld(options) {
  const world = installCanonicalAirportWorld(options);
  world.name = 'TURN NEXT Airport: Runway r2';

  removeCanonicalAccessRoads(world);
  removeCanonicalBlueHangar(world);
  installFourAccessRoads(world);
  installConeBarriers(world);
  installOpenBlueHangar(world);

  const fallback = installA380Fallback(world);
  void installA380Asset(world, fallback).catch((error) => {
    console.info('TURN NEXT: A380 asset unavailable; keeping the runway fallback.', error);
  });

  world.userData.turnAirportRunway = Object.freeze({
    prototype: true,
    version: 'r2',
    testOnly: true,
    accessRoadCount: AIRPORT_RUNWAY_ACCESS_ROADS.length,
    a380Obstacle: true,
    physicalBlockers: true,
    openBlueHangar: true,
    a380Source: AIRPORT_RUNWAY_AIRCRAFT.source
  });

  return world;
}

function material(color, roughness = 0.86, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function outlinedMesh(geometry, meshMaterial, scale = 1.035, {
  castShadow = true,
  receiveShadow = true
} = {}) {
  const group = new THREE.Group();
  const outline = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })
  );
  outline.scale.setScalar(scale);
  outline.castShadow = false;
  outline.receiveShadow = false;

  const mesh = new THREE.Mesh(geometry, meshMaterial);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  group.add(outline, mesh);
  return group;
}

function removeCanonicalAccessRoads(world) {
  for (const child of [...world.children]) {
    const x = Number(child.position?.x);
    const z = Number(child.position?.z);
    if (!CANONICAL_AIRPORT_ACCESS_ROADS.some((candidate) => nearly(x, candidate))) continue;
    if (!nearly(z, -169)) continue;

    if (
      containsBox(child, 34, 0.08, 82)
      || isBox(child, 0.7, 0.05, 72)
    ) {
      world.remove(child);
    }
  }
}

function removeCanonicalBlueHangar(world) {
  for (const child of [...world.children]) {
    // The canonical cyan hangar is 54 × 20 × 34. Match its geometry and accent instead
    // of relying on its final position because the Airport scenery safety pass can move it.
    if (!containsBox(child, 54, 20, 34)) continue;
    if (!containsMaterialColor(child, CYAN)) continue;
    world.remove(child);
  }
}

function installFourAccessRoads(world) {
  const length = Math.abs(AIRPORT_SERVICE_ROAD_Z - AIRPORT_RUNWAY_Z);
  const centerZ = (AIRPORT_SERVICE_ROAD_Z + AIRPORT_RUNWAY_Z) / 2;

  for (const x of AIRPORT_RUNWAY_ACCESS_ROADS) {
    const road = outlinedMesh(
      new THREE.BoxGeometry(34, 0.08, length),
      material(ASPHALT, 0.96),
      1.006,
      { castShadow: false }
    );
    road.name = `Airport Runway access road ${x}`;
    road.position.set(x, 0.025, centerZ);
    world.add(road);

    const line = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.05, Math.max(1, length - 10)),
      material(YELLOW, 0.86)
    );
    line.name = `Airport Runway access road ${x} centre line`;
    line.position.set(x, 0.12, centerZ);
    line.receiveShadow = true;
    world.add(line);
  }
}

function installConeBarriers(world) {
  const instances = AIRPORT_RUNWAY_BARRIERS.reduce((sum, barrier) => sum + barrier.count, 0);
  const base = new THREE.InstancedMesh(
    new THREE.BoxGeometry(2.45, 0.24, 2.45),
    material(INK, 0.94),
    instances
  );
  const body = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.78, 2.45, 8),
    material(ORANGE, 0.84),
    instances
  );
  const band = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.47, 0.61, 0.46, 8),
    material(CREAM, 0.78),
    instances
  );

  base.name = 'Airport Runway traffic cone bases';
  body.name = 'Airport Runway traffic cones';
  band.name = 'Airport Runway traffic cone bands';
  base.castShadow = false;
  body.castShadow = false;
  band.castShadow = false;

  const marker = new THREE.Object3D();
  let cursor = 0;
  for (const barrier of AIRPORT_RUNWAY_BARRIERS) {
    for (let index = 0; index < barrier.count; index += 1) {
      const offset = (index - (barrier.count - 1) / 2) * barrier.spacing;
      const x = barrier.x + Math.cos(barrier.rotationY) * offset;
      const z = barrier.z + Math.sin(barrier.rotationY) * offset;

      marker.position.set(x, 0.12, z);
      marker.rotation.set(0, barrier.rotationY, 0);
      marker.scale.set(1, 1, 1);
      marker.updateMatrix();
      base.setMatrixAt(cursor, marker.matrix);

      marker.position.y = 1.46;
      marker.updateMatrix();
      body.setMatrixAt(cursor, marker.matrix);

      marker.position.y = 1.42;
      marker.updateMatrix();
      band.setMatrixAt(cursor, marker.matrix);
      cursor += 1;
    }
  }

  for (const mesh of [base, body, band]) {
    mesh.count = cursor;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.receiveShadow = true;
    world.add(mesh);
  }
}

function installOpenBlueHangar(world) {
  const spec = AIRPORT_RUNWAY_HANGAR;
  const hangar = new THREE.Group();
  hangar.name = 'Airport Runway open blue hangar';
  hangar.position.set(spec.x, 0, spec.z);
  hangar.rotation.y = spec.rotationY;

  const wallMaterial = material(HANGAR, 0.9);
  const roof = outlinedMesh(
    new THREE.BoxGeometry(spec.width, 1.55, spec.depth),
    wallMaterial,
    1.02
  );
  roof.position.y = spec.height;
  hangar.add(roof);

  for (const side of [-1, 1]) {
    const wall = outlinedMesh(
      new THREE.BoxGeometry(spec.wallThickness, spec.height, spec.depth),
      wallMaterial,
      1.024
    );
    wall.position.set(side * spec.wallOffsetX, spec.height / 2, 0);
    hangar.add(wall);
  }

  // Cyan lintels at both mouths make the intended drive-through opening readable from
  // either approach without putting any geometry across the actual passage.
  for (const side of [-1, 1]) {
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width - spec.wallThickness * 2, 1.2, 0.55),
      material(CYAN, 0.78)
    );
    lintel.position.set(0, spec.height * 0.82, side * (spec.depth / 2 + 0.34));
    hangar.add(lintel);
  }

  const guide = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 0.06, spec.depth + 18),
    material(CYAN, 0.78)
  );
  guide.name = 'Airport Runway blue hangar guide line';
  guide.position.y = 0.18;
  guide.receiveShadow = true;
  hangar.add(guide);

  world.add(hangar);
}

function installA380Fallback(world) {
  const plane = new THREE.Group();
  plane.name = 'Airport Runway A380 fallback';

  const bodyMaterial = material(0xf3f2eb, 0.58, 0.04);
  const accentMaterial = material(CYAN, 0.7);
  const darkMaterial = material(0x34383d, 0.86);

  const fuselage = outlinedMesh(
    new THREE.CylinderGeometry(3.1, 2.65, 74, 14),
    bodyMaterial,
    1.025
  );
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.y = 5.5;
  plane.add(fuselage);

  const nose = outlinedMesh(
    new THREE.ConeGeometry(3.1, 8.5, 14),
    bodyMaterial,
    1.025
  );
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 5.5, -41.1);
  plane.add(nose);

  const wings = outlinedMesh(
    new THREE.BoxGeometry(78, 0.75, 11.5),
    bodyMaterial,
    1.022
  );
  wings.position.set(0, 5.1, -3.5);
  plane.add(wings);

  const tailWing = outlinedMesh(
    new THREE.BoxGeometry(28, 0.58, 6),
    accentMaterial,
    1.025
  );
  tailWing.position.set(0, 6.2, 28);
  plane.add(tailWing);

  const fin = outlinedMesh(
    new THREE.BoxGeometry(1.1, 11.5, 7.5),
    accentMaterial,
    1.03
  );
  fin.position.set(0, 11, 30);
  plane.add(fin);

  for (const x of [-18, -8, 8, 18]) {
    const engine = outlinedMesh(
      new THREE.CylinderGeometry(2.0, 2.0, 5.5, 10),
      darkMaterial,
      1.025
    );
    engine.rotation.x = Math.PI / 2;
    engine.position.set(x, 3.2, -4.5);
    plane.add(engine);
  }

  plane.position.set(AIRPORT_RUNWAY_AIRCRAFT.x, 0, AIRPORT_RUNWAY_AIRCRAFT.z);
  world.add(plane);
  return plane;
}

async function installA380Asset(world, fallback) {
  if (!a380Promise) {
    a380Promise = loader.loadAsync(AIRPORT_RUNWAY_AIRCRAFT.source);
  }

  const gltf = await a380Promise;
  if (!gltf?.scene) throw new Error('A380 GLB did not contain a scene.');

  const plane = gltf.scene.clone(true);
  plane.name = 'Airport Runway A380 · amvlab aircraft-models';
  plane.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    if (node.material) {
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      const clones = materials.map((entry) => {
        const clone = entry.clone();
        clone.roughness = Math.max(0.62, clone.roughness ?? 0.8);
        return clone;
      });
      node.material = Array.isArray(node.material) ? clones : clones[0];
    }
  });

  normalizeAircraftToGround(plane, AIRPORT_RUNWAY_AIRCRAFT.targetLength);
  plane.position.set(AIRPORT_RUNWAY_AIRCRAFT.x, 0.18, AIRPORT_RUNWAY_AIRCRAFT.z);

  // The amvlab model's long axis is detected after its authored node transforms have
  // been applied. Rotate only when necessary so the fuselage runs north/south and the
  // wings physically bar the east/west racing line.
  plane.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(plane).getSize(new THREE.Vector3());
  if (size.x > size.z) plane.rotation.y = Math.PI / 2;

  world.add(plane);
  fallback.visible = false;
}

function normalizeAircraftToGround(model, targetLength) {
  model.updateMatrixWorld(true);
  const initial = new THREE.Box3().setFromObject(model);
  const size = initial.getSize(new THREE.Vector3());
  const horizontalLength = Math.max(0.001, size.x, size.z);
  model.scale.multiplyScalar(targetLength / horizontalLength);
  model.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= bounds.min.y;
}

function containsBox(node, width, height, depth) {
  let found = false;
  node.traverse?.((child) => {
    if (found || !child?.isMesh) return;
    if (isBox(child, width, height, depth)) found = true;
  });
  return found;
}

function isBox(node, width, height, depth) {
  if (!node?.isMesh || node.geometry?.type !== 'BoxGeometry') return false;
  const parameters = node.geometry.parameters || {};
  return nearly(parameters.width, width)
    && nearly(parameters.height, height)
    && nearly(parameters.depth, depth);
}

function containsMaterialColor(node, color) {
  let found = false;
  node.traverse?.((child) => {
    if (found || !child?.isMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    if (materials.some((entry) => entry?.color?.getHex?.() === color)) found = true;
  });
  return found;
}

function nearly(value, expected) {
  return Math.abs(Number(value) - Number(expected)) < 0.01;
}
