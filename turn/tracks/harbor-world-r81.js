import * as THREE from 'three';
import { installHarborWorld as installHarborWorldR80 } from './harbor-world.js?base=20260725-r80';

const LEGACY_POST_WIDTH = 1.15;
const LEGACY_POST_HEIGHT = 9;
const LEGACY_BEAM_HEIGHT = 1.35;
const LEGACY_BEAM_DEPTH = 1.35;
const START_POST_CLEARANCE = 4.8;
const START_BEAM_OVERHANG = 1.1;
const START_BEAM_LIFT = 0.75;
const WEST_CARGO_START = Object.freeze({ x: -168, z: -236 });
const WEST_CARGO_CLEAR = Object.freeze({ x: -84, z: -286, rotation: 0.14 });
const QUAY_WIDTH = 620;
const QUAY_HEIGHT = 2.2;
const QUAY_DEPTH = 34;
const QUAY_Z = -174;
const QUAY_SURFACE_Y = -1.12;

export function installHarborWorld(options) {
  const world = installHarborWorldR80(options);
  moveStartGateOffTheCurbs(world, options.trackWidth || 27);
  separateStartSightline(world);
  lowerQuayBelowRoad(world);

  world.name = 'TURN Harbor r81';
  world.userData.turnHarborArtDirection = Object.freeze({
    ...(world.userData.turnHarborArtDirection || {}),
    version: 'r81',
    startGateCurbClearance: true,
    separatedStartSightline: true,
    cargoShipClearOfStartGate: true,
    quaySurfaceHotfix: 'r82',
    gameplayGeometryUnchanged: true
  });
  return world;
}

function moveStartGateOffTheCurbs(world, trackWidth) {
  const gate = world.children.find((node) => isLegacyStartGate(node, trackWidth));
  if (!gate) {
    console.warn('TURN: Harbor r81 could not find the start gate to clear from the curbs.');
    return;
  }

  const posts = gate.children
    .filter((node) => isBox(node, LEGACY_POST_WIDTH, LEGACY_POST_HEIGHT, LEGACY_POST_WIDTH))
    .sort((a, b) => a.position.x - b.position.x);
  const beam = gate.children.find((node) => isBox(
    node,
    trackWidth + 6,
    LEGACY_BEAM_HEIGHT,
    LEGACY_BEAM_DEPTH
  ));
  if (posts.length !== 2 || !beam) return;

  const postOffset = trackWidth / 2 + START_POST_CLEARANCE;
  posts[0].position.x = -postOffset;
  posts[1].position.x = postOffset;

  beam.geometry.dispose();
  beam.geometry = new THREE.BoxGeometry(
    postOffset * 2 + START_BEAM_OVERHANG * 2,
    LEGACY_BEAM_HEIGHT,
    LEGACY_BEAM_DEPTH
  );
  beam.position.y += START_BEAM_LIFT;
  gate.name = 'Harbor start gate r81';
}

function separateStartSightline(world) {
  const quayCrane = world.children.find((node) => (
    node?.isGroup
    && nearly(node.position.x, -115)
    && nearly(node.position.z, -196)
    && node.children.length === 5
  ));
  if (quayCrane) {
    quayCrane.position.x = -278;
    quayCrane.name = 'Harbor west quay crane r81';
  }

  const cargoShip = world.children.find((node) => (
    node?.isGroup
    && nearly(node.position.x, WEST_CARGO_START.x)
    && nearly(node.position.z, WEST_CARGO_START.z)
    && node.children.length > 10
  ));
  if (!cargoShip) {
    console.warn('TURN: Harbor r81 could not find the west cargo ship to clear from the start gate.');
    return;
  }

  cargoShip.position.x = WEST_CARGO_CLEAR.x;
  cargoShip.position.z = WEST_CARGO_CLEAR.z;
  cargoShip.rotation.y = WEST_CARGO_CLEAR.rotation;
  cargoShip.name = 'Harbor west cargo ship r81';
}

function lowerQuayBelowRoad(world) {
  const quay = world.children.find((node) => (
    isBox(node, QUAY_WIDTH, QUAY_HEIGHT, QUAY_DEPTH)
    && nearly(node.position.z, QUAY_Z)
  ));

  if (!quay) {
    console.warn('TURN: Harbor r82 could not find the quay surface below the start straight.');
    return;
  }

  // The quay top previously sat 0.02 units above the road ribbon and hid the
  // asphalt on one side of the start straight. Keep concrete outside the curbs,
  // but let the authored road remain the visible surface between them.
  quay.position.y = QUAY_SURFACE_Y;
  quay.name = 'Harbor quay below race road r82';
}

function isLegacyStartGate(node, trackWidth) {
  if (!node?.isGroup || node.children.length !== 3) return false;
  const postCount = node.children.filter((child) => (
    isBox(child, LEGACY_POST_WIDTH, LEGACY_POST_HEIGHT, LEGACY_POST_WIDTH)
  )).length;
  const hasBeam = node.children.some((child) => (
    isBox(child, trackWidth + 6, LEGACY_BEAM_HEIGHT, LEGACY_BEAM_DEPTH)
  ));
  return postCount === 2 && hasBeam;
}

function isBox(node, width, height, depth) {
  const parameters = node?.geometry?.parameters;
  return node?.isMesh
    && node.geometry?.type === 'BoxGeometry'
    && nearly(parameters?.width, width)
    && nearly(parameters?.height, height)
    && nearly(parameters?.depth, depth);
}

function nearly(value, expected) {
  return Math.abs(Number(value) - expected) < 0.001;
}
