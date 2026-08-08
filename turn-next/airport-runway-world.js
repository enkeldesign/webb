import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { installAirportWorld as installCanonicalAirportWorld } from '/turn/tracks/airport-world-r52.js?build=20260722-r52';
import { AIRPORT_RUNWAY_COLLISION_RULES } from '/turn-next/airport-runway-collision.js';
import {
  AIRPORT_RUNWAY_ACCESS_ROADS,
  AIRPORT_RUNWAY_ACCESS_ROAD_CENTER_Z,
  AIRPORT_RUNWAY_ACCESS_ROAD_LENGTH,
  AIRPORT_RUNWAY_AIRCRAFT,
  AIRPORT_RUNWAY_BLOCKERS,
  AIRPORT_RUNWAY_HANGAR
} from '/turn-next/airport-runway-spec.js';

const INK = 0x08090a;
const ORANGE = 0xff922b;
const CREAM = 0xfff8e8;
const CYAN = 0x38d9ff;
const ASPHALT = 0x4f555c;
const LEGACY_ACCESS_ROAD_XS = Object.freeze([-132, 18, 170]);

const loader = new GLTFLoader();
let aircraftPromise = null;

export function installAirportRunwayWorld(options) {
  // Reuse the mature Airport art direction, but feed it the new route samples so road,
  // curbs and start/finish all describe AIRPORT: RUNWAY rather than the old course.
  const world = installCanonicalAirportWorld(options);
  world.name = 'TURN NEXT Airport: Runway';

  // r50 contains three visual runway access roads. Remove those before adding the four
  // authored here; otherwise the prototype misleadingly shows seven possible entries.
  removeCanonicalAccessRoads(world);
  installAccessRoads(world);
  installConeBarriers(world);
  const fallback = installAircraftFallback(world);
  void installRunwayAircraft(world, fallback).catch((error) => {
    console.info('TURN NEXT: A380 asset unavailable; keeping the local runway-aircraft fallback.', error);
  });
  installOpenHangar(world);

  world.userData.turnAirportRunway = Object.freeze({
    prototype: true,
    accessRoads: AIRPORT_RUNWAY_ACCESS_ROADS.length,
    runwayDiversions: 2,
    hangarPassThrough: true,
    physicalObstacleCount: AIRPORT_RUNWAY_COLLISION_RULES.totalColliderCount,
    aircraft: 'A380_nologo.glb · amvlab/aircraft-models · CC BY 4.0'
  });

  return world;
}

function material(color, roughness = 0.9) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
}

function outlinedMesh(geometry, meshMaterial, outlineScale = 1.035) {
  const group = new THREE.Group();
  const outline = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })
  );
  outline.scale.setScalar(outlineScale);
  const mesh = new THREE.Mesh(geometry, meshMaterial);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(outline, mesh);
  return group;
}

function removeCanonicalAccessRoads(world) {
  for (const node of [...world.children]) {
    if (!nearly(node.position?.z, AIRPORT_RUNWAY_ACCESS_ROAD_CENTER_Z)) continue;
    if (!LEGACY_ACCESS_ROAD_XS.some((x) => nearly(node.position?.x, x))) continue;

    const geometry = node.geometry?.parameters;
    const roadMesh = node.children?.find?.((child) => {
      const params = child.geometry?.parameters;
      return child.geometry?.type === 'BoxGeometry'
        && nearly(params?.width, 34)
        && nearly(params?.depth, 82);
    });
    const isCentreLine = node.geometry?.type === 'BoxGeometry'
      && nearly(geometry?.width, 0.7)
      && nearly(geometry?.depth, 72);

    if (roadMesh || isCentreLine) world.remove(node);
  }
}

function installAccessRoads(world) {
  for (const access of AIRPORT_RUNWAY_ACCESS_ROADS) {
    const road = outlinedMesh(
      new THREE.BoxGeometry(32, 0.08, AIRPORT_RUNWAY_ACCESS_ROAD_LENGTH),
      material(ASPHALT, 0.96),
      1.006
    );
    road.name = `Airport Runway access ${access.id}`;
    road.position.set(access.x, 0.03, AIRPORT_RUNWAY_ACCESS_ROAD_CENTER_Z);
    world.add(road);

    const line = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.05, AIRPORT_RUNWAY_ACCESS_ROAD_LENGTH - 10),
      material(0xffd43b, 0.86)
    );
    line.position.set(access.x, 0.12, AIRPORT_RUNWAY_ACCESS_ROAD_CENTER_Z);
    world.add(line);
  }
}

function installConeBarriers(world) {
  for (const barrier of AIRPORT_RUNWAY_BLOCKERS) {
    for (let index = 0; index < barrier.count; index += 1) {
      const cone = makeCone();
      cone.name = `Airport Runway cone ${barrier.id} ${index + 1}`;
      const offset = (index - (barrier.count - 1) / 2) * barrier.spacing;
      cone.position.set(
        barrier.x + Math.cos(barrier.rotationY) * offset,
        0.18,
        barrier.z + Math.sin(barrier.rotationY) * offset
      );
      cone.rotation.y = barrier.rotationY;
      world.add(cone);
    }
  }
}

function makeCone() {
  // A tiny procedural fallback keeps the prototype lightweight. The shared spec gives every
  // visible cone a matching physical collider, so these are real barriers rather than scenery.
  const group = new THREE.Group();
  const base = outlinedMesh(new THREE.BoxGeometry(2.5, 0.28, 2.5), material(INK, 0.9), 1.02);
  base.position.y = 0.14;
  group.add(base);

  const body = outlinedMesh(new THREE.ConeGeometry(0.82, 2.65, 12), material(ORANGE, 0.82), 1.06);
  body.position.y = 1.55;
  group.add(body);

  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.63, 0.77, 0.52, 12),
    material(CREAM, 0.75)
  );
  band.position.y = 1.53;
  group.add(band);
  return group;
}

function installAircraftFallback(world) {
  // Large, unmistakable wide-body silhouette. It is oriented across the runway, matching the
  // real A380 and the collision volumes, rather than parallel to the runway as in the first pass.
  const aircraft = new THREE.Group();
  aircraft.name = 'Runway A380 fallback';

  const fuselage = outlinedMesh(
    new THREE.CylinderGeometry(3.1, 2.45, 72, 14),
    material(0xf4f4ef, 0.68),
    1.035
  );
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.y = 3.5;
  aircraft.add(fuselage);

  const wing = outlinedMesh(new THREE.BoxGeometry(82, 0.72, 14), material(0xf4f4ef, 0.68), 1.025);
  wing.position.y = 3.4;
  aircraft.add(wing);

  const tailplane = outlinedMesh(new THREE.BoxGeometry(28, 0.56, 7), material(0xf4f4ef, 0.68), 1.025);
  tailplane.position.set(0, 4.1, 27);
  aircraft.add(tailplane);

  aircraft.position.set(
    AIRPORT_RUNWAY_AIRCRAFT.x,
    AIRPORT_RUNWAY_AIRCRAFT.y,
    AIRPORT_RUNWAY_AIRCRAFT.z
  );
  aircraft.rotation.y = AIRPORT_RUNWAY_AIRCRAFT.rotationY;
  world.add(aircraft);
  return aircraft;
}

async function installRunwayAircraft(world, fallback) {
  if (!aircraftPromise) {
    aircraftPromise = new Promise((resolve, reject) => {
      loader.load(AIRPORT_RUNWAY_AIRCRAFT.source, resolve, undefined, reject);
    });
  }

  const gltf = await aircraftPromise;
  const source = gltf?.scene;
  if (!source) return;

  const model = source.clone(true);
  model.name = 'A380 no-logo source model';
  model.traverse((node) => {
    if (!node?.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
  });

  // Normalise an upstream model without assuming its authoring units or origin.
  const initialBox = new THREE.Box3().setFromObject(model);
  const initialSize = new THREE.Vector3();
  initialBox.getSize(initialSize);
  const longest = Math.max(initialSize.x, initialSize.y, initialSize.z, 1);
  model.scale.multiplyScalar(AIRPORT_RUNWAY_AIRCRAFT.targetSpan / longest);
  model.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(model);
  const centre = new THREE.Vector3();
  scaledBox.getCenter(centre);
  model.position.x -= centre.x;
  model.position.z -= centre.z;
  model.position.y -= scaledBox.min.y;
  model.updateMatrixWorld(true);

  const holder = new THREE.Group();
  holder.name = 'Runway A380 · amvlab aircraft-models';
  holder.position.set(
    AIRPORT_RUNWAY_AIRCRAFT.x,
    AIRPORT_RUNWAY_AIRCRAFT.y,
    AIRPORT_RUNWAY_AIRCRAFT.z
  );
  holder.rotation.y = AIRPORT_RUNWAY_AIRCRAFT.rotationY;
  holder.add(model);
  world.add(holder);
  fallback.visible = false;
}

function installOpenHangar(world) {
  const hangar = new THREE.Group();
  hangar.name = 'Airport Runway open hangar';
  hangar.position.set(AIRPORT_RUNWAY_HANGAR.x, 0, AIRPORT_RUNWAY_HANGAR.z);
  hangar.rotation.y = AIRPORT_RUNWAY_HANGAR.rotationY;

  const wallMaterial = material(0x777d84, 0.92);
  const roof = outlinedMesh(
    new THREE.BoxGeometry(AIRPORT_RUNWAY_HANGAR.width, 1.6, AIRPORT_RUNWAY_HANGAR.depth),
    wallMaterial,
    1.02
  );
  roof.position.y = AIRPORT_RUNWAY_HANGAR.wallHeight + 0.5;
  hangar.add(roof);

  for (const side of [-1, 1]) {
    const wall = outlinedMesh(
      new THREE.BoxGeometry(2.2, AIRPORT_RUNWAY_HANGAR.wallHeight, AIRPORT_RUNWAY_HANGAR.wallLength),
      wallMaterial,
      1.025
    );
    wall.position.set(side * AIRPORT_RUNWAY_HANGAR.wallOffsetX, AIRPORT_RUNWAY_HANGAR.wallHeight / 2, 0);
    hangar.add(wall);
  }

  const blueGuide = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.08, AIRPORT_RUNWAY_HANGAR.guideLength),
    material(CYAN, 0.78)
  );
  blueGuide.position.set(0, 0.12, 0);
  hangar.add(blueGuide);
  world.add(hangar);
}

function nearly(value, expected, tolerance = 0.01) {
  return Math.abs(Number(value) - Number(expected)) <= tolerance;
}
