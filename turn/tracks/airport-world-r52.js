import * as THREE from 'three';
import { installAirportWorld as installAirportWorldR51 } from './airport-world-r51.js?build=20260722-r51';
import { AIRPORT_HAIRPIN_RUNOFF_ZONES } from './airport-runoff.js?build=20260722-r52';

const INK = 0x08090a;
const RUNOFF = 0x89929b;

export function installAirportWorld(options) {
  const world = installAirportWorldR51(options);
  installHairpinRunoff(world);

  world.name = 'TURN Airport r52';
  world.userData.turnAirportArtDirection = Object.freeze({
    ...(world.userData.turnAirportArtDirection || {}),
    version: 'r52',
    hairpinRunoff: true,
    forgivingHairpinSurface: true
  });

  return world;
}

function installHairpinRunoff(world) {
  const runoff = new THREE.Group();
  runoff.name = 'Airport Hairpin Run-off';

  for (const zone of AIRPORT_HAIRPIN_RUNOFF_ZONES) {
    runoff.add(makeCapsule(zone, zone.radius + 1.35, INK, 0.105));
    runoff.add(makeCapsule(zone, zone.radius, RUNOFF, 0.125));
  }

  world.add(runoff);
}

function makeCapsule(zone, radius, color, y) {
  const dx = zone.to.x - zone.from.x;
  const dz = zone.to.z - zone.from.z;
  const length = Math.hypot(dx, dz);
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.96,
    metalness: 0,
    side: THREE.DoubleSide
  });

  const body = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, length), material);
  body.rotation.x = Math.PI / 2;
  body.position.y = y;
  body.receiveShadow = true;
  group.add(body);

  const capGeometry = new THREE.CircleGeometry(radius, 28);
  for (const direction of [-1, 1]) {
    const cap = new THREE.Mesh(capGeometry, material);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(0, y, direction * length / 2);
    cap.receiveShadow = true;
    group.add(cap);
  }

  group.position.set(
    (zone.from.x + zone.to.x) / 2,
    0,
    (zone.from.z + zone.to.z) / 2
  );
  group.rotation.y = Math.atan2(dx, dz);
  return group;
}
