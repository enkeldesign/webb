import * as THREE from 'three';
import { installHarborWorld as installHarborWorldR80 } from './harbor-world.js?base=20260725-r80';

const LEGACY_POST_WIDTH = 1.15;
const LEGACY_POST_HEIGHT = 9;
const LEGACY_BEAM_HEIGHT = 1.35;
const LEGACY_BEAM_DEPTH = 1.35;
const START_POST_CLEARANCE = 4.8;
const START_BEAM_OVERHANG = 1.1;
const START_BEAM_LIFT = 0.75;
const QUAY_WIDTH = 620;
const QUAY_HEIGHT = 2.2;
const QUAY_DEPTH = 34;
const QUAY_Z = -174;
const QUAY_SURFACE_Y = -1.12;
const HIDDEN_FACE_DATA_URI = 'data:image/png;base64,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';
const HIDDEN_FACE_POSITION = Object.freeze({ x: 210, y: 14.4, z: 233.45 });
const HIDDEN_FACE_SIZE = Object.freeze({ width: 8.8, height: 9.65 });

export function installHarborWorld(options) {
  const world = installHarborWorldR80(options);
  moveStartGateOffTheCurbs(world, options.trackWidth || 27);
  separateStartSightline(world);
  lowerQuayBelowRoad(world);
  installHiddenSiloFace(world);

  world.name = 'TURN Harbor r81';
  world.userData.turnHarborArtDirection = Object.freeze({
    ...(world.userData.turnHarborArtDirection || {}),
    version: 'r87',
    startGateCurbClearance: true,
    separatedStartSightline: true,
    cargoShipDockedAtQuay: true,
    quaySurfaceHotfix: 'r82',
    hiddenSiloFace: true,
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

  // Keep the large west cargo ship at its original dockside position. Its close
  // relationship to the quay gives the start straight the intended dramatic scale.
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

function installHiddenSiloFace(world) {
  const texture = new THREE.TextureLoader().load(HIDDEN_FACE_DATA_URI);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;

  const decal = new THREE.Mesh(
    new THREE.PlaneGeometry(HIDDEN_FACE_SIZE.width, HIDDEN_FACE_SIZE.height),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.08,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  );
  decal.name = 'Harbor hidden silo face';
  decal.position.set(HIDDEN_FACE_POSITION.x, HIDDEN_FACE_POSITION.y, HIDDEN_FACE_POSITION.z);
  decal.rotation.y = Math.PI;
  decal.renderOrder = 2;
  decal.userData.turnEasterEgg = 'hidden-silo-face';
  world.add(decal);
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
