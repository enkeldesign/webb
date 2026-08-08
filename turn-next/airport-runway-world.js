import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { installAirportWorld as installCanonicalAirportWorld } from '/turn/tracks/airport-world-r52.js?build=20260722-r52';

const INK = 0x08090a;
const ORANGE = 0xff922b;
const CREAM = 0xfff8e8;
const CYAN = 0x38d9ff;
const ASPHALT = 0x4f555c;

const RUNWAY_Z = -221;
const ACCESS_ROADS = Object.freeze([-188, -86, -28, 130]);
const ACCESS_ROAD_CENTER_Z = -169;
const ACCESS_ROAD_LENGTH = 104;

// Kenney-compatible low-poly plane source. Keep a procedural fallback so TURN NEXT stays testable offline.
const AIRCRAFT_ASSET_URL = 'https://raw.githubusercontent.com/crystal-bit/platform-3d/main/assets/airplane.glb';
const loader = new GLTFLoader();
let aircraftPromise = null;

export function installAirportRunwayWorld(options) {
  const world = installCanonicalAirportWorld(options);
  world.name = 'TURN NEXT Airport: Runway';

  installFourthAccessRoad(world);
  installConeChicanes(world);
  const fallback = installAircraftFallback(world);
  installRunwayAircraft(world, fallback).catch((error) => {
    console.info('TURN NEXT: runway aircraft asset unavailable; keeping fallback.', error);
  });
  installOpenHangar(world);

  world.userData.turnAirportRunway = Object.freeze({
    prototype: true,
    accessRoads: ACCESS_ROADS.length,
    runwayDiversions: 2,
    hangarPassThrough: true
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

function installFourthAccessRoad(world) {
  // Canonical Airport already has three taxiway/access roads at -132, 18 and 170.
  // AIRPORT: RUNWAY deliberately uses four evenly spaced access roads.
  for (const x of ACCESS_ROADS) {
    const road = outlinedMesh(
      new THREE.BoxGeometry(32, 0.08, ACCESS_ROAD_LENGTH),
      material(ASPHALT, 0.96),
      1.006
    );
    road.position.set(x, 0.03, ACCESS_ROAD_CENTER_Z);
    world.add(road);

    const line = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.05, ACCESS_ROAD_LENGTH - 10),
      material(0xffd43b, 0.86)
    );
    line.position.set(x, 0.12, ACCESS_ROAD_CENTER_Z);
    world.add(line);
  }
}

function installConeChicanes(world) {
  const coneGroups = [
    // Block original upper road and feed onto access road 1.
    { x: 150, z: 80, rotation: 0.12, count: 8, spacing: 3.2 },
    // Aircraft diversion: leave runway through access road 2.
    { x: -14, z: RUNWAY_Z, rotation: Math.PI / 2, count: 7, spacing: 3.1 },
    // Force back down access road 3.
    { x: -62, z: -119, rotation: 0, count: 8, spacing: 3.2 },
    // Force final runway exit at access road 4.
    { x: -210, z: RUNWAY_Z, rotation: Math.PI / 2, count: 7, spacing: 3.1 }
  ];

  for (const config of coneGroups) {
    for (let index = 0; index < config.count; index += 1) {
      const cone = makeCone();
      const offset = (index - (config.count - 1) / 2) * config.spacing;
      cone.position.set(
        config.x + Math.cos(config.rotation) * offset,
        0.18,
        config.z + Math.sin(config.rotation) * offset
      );
      cone.rotation.y = config.rotation;
      world.add(cone);
    }
  }
}

function makeCone() {
  // Styled to the low-poly Kenney traffic-cone language: bright orange body,
  // white band, black outline/base. Kept procedural in this prototype so it is tiny and offline-safe.
  const group = new THREE.Group();
  group.name = 'Kenney-style traffic cone';

  const base = outlinedMesh(new THREE.BoxGeometry(2.5, 0.28, 2.5), material(INK, 0.9), 1.02);
  base.position.y = 0.14;
  group.add(base);

  const body = outlinedMesh(new THREE.ConeGeometry(0.82, 2.65, 12), material(ORANGE, 0.82), 1.06);
  body.position.y = 1.55;
  group.add(body);

  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.63, 0.77, 0.52, 12), material(CREAM, 0.75));
  band.position.y = 1.53;
  group.add(band);

  return group;
}

function installAircraftFallback(world) {
  const aircraft = new THREE.Group();
  aircraft.name = 'Runway aircraft fallback';

  const fuselage = outlinedMesh(new THREE.CylinderGeometry(1.5, 1.15, 19, 12), material(0xf4f4ef, 0.68), 1.045);
  fuselage.rotation.z = Math.PI / 2;
  aircraft.add(fuselage);

  const wing = outlinedMesh(new THREE.BoxGeometry(4, 0.7, 22), material(0xf4f4ef, 0.68), 1.04);
  aircraft.add(wing);

  const tail = outlinedMesh(new THREE.BoxGeometry(5.5, 0.55, 7.5), material(0xf4f4ef, 0.68), 1.04);
  tail.position.x = -7.5;
  aircraft.add(tail);

  aircraft.position.set(18, 2.2, RUNWAY_Z);
  aircraft.rotation.y = Math.PI / 2;
  world.add(aircraft);
  return aircraft;
}

async function installRunwayAircraft(world, fallback) {
  if (!aircraftPromise) {
    aircraftPromise = new Promise((resolve, reject) => {
      loader.load(AIRCRAFT_ASSET_URL, resolve, undefined, reject);
    });
  }
  const gltf = await aircraftPromise;
  const source = gltf?.scene;
  if (!source) return;

  const plane = source.clone(true);
  plane.name = 'Runway aircraft asset';
  const box = new THREE.Box3().setFromObject(plane);
  const size = new THREE.Vector3();
  box.getSize(size);
  const longest = Math.max(size.x, size.y, size.z, 1);
  plane.scale.setScalar(28 / longest);
  plane.position.set(18, 0.45, RUNWAY_Z);
  plane.rotation.y = Math.PI / 2;
  world.add(plane);
  fallback.visible = false;
}

function installOpenHangar(world) {
  const hangar = new THREE.Group();
  hangar.name = 'Airport Runway open hangar';
  hangar.position.set(-104, 0, -55);
  hangar.rotation.y = -0.78;

  const wallMaterial = material(0x777d84, 0.92);
  const roof = outlinedMesh(new THREE.BoxGeometry(38, 1.6, 34), wallMaterial, 1.02);
  roof.position.y = 13.5;
  hangar.add(roof);

  for (const side of [-1, 1]) {
    const wall = outlinedMesh(new THREE.BoxGeometry(2.2, 13, 34), wallMaterial, 1.025);
    wall.position.set(side * 17.9, 6.7, 0);
    hangar.add(wall);
  }

  const blueGuide = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 42), material(CYAN, 0.78));
  blueGuide.position.set(0, 0.12, 0);
  hangar.add(blueGuide);

  world.add(hangar);
}
