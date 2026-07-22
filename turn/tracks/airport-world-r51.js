import * as THREE from 'three';
import { installAirportWorld as installAirportWorldR50 } from './airport-world-r50.js?build=20260722-r50';

const APRON_SOURCE_WIDTH = 390;
const APRON_SOURCE_DEPTH = 150;
const APRON_SAFE_DEPTH = 116;
const APRON_SAFE_Z = -62;
const APRON_COLOR = 0x89929b;

export function installAirportWorld(options) {
  const world = installAirportWorldR50(options);
  fixAirportTextFacing(world);
  pullApronClearOfHairpin(world);

  world.name = 'TURN Airport r51';
  world.userData.turnAirportArtDirection = Object.freeze({
    ...(world.userData.turnAirportArtDirection || {}),
    version: 'r51',
    readableSigns: true,
    hairpinGroundClearance: true
  });

  return world;
}

function fixAirportTextFacing(world) {
  const textPanels = [];
  world.traverse((node) => {
    if (
      node?.isMesh
      && node.geometry?.type === 'PlaneGeometry'
      && node.material?.map?.isCanvasTexture
    ) {
      textPanels.push(node);
    }
  });

  for (const panel of textPanels) panel.rotation.y += Math.PI;
}

function pullApronClearOfHairpin(world) {
  const apron = world.children.find((node) => {
    if (!node?.isMesh || node.geometry?.type !== 'PlaneGeometry') return false;
    const parameters = node.geometry.parameters || {};
    return nearly(parameters.width, APRON_SOURCE_WIDTH)
      && nearly(parameters.height, APRON_SOURCE_DEPTH)
      && node.material?.color?.getHex?.() === APRON_COLOR;
  });

  if (!apron) {
    console.warn('TURN: Airport r51 could not find the apron ground patch to trim.');
    return;
  }

  // r50's apron reached z=26 while the inner service-road hairpin turns around z=22,
  // so the straight edge of the rectangular ground plane visibly cut through the bend.
  // Keep the apron under the terminal/aircraft district, but end it well before the hairpin.
  apron.scale.y = APRON_SAFE_DEPTH / APRON_SOURCE_DEPTH;
  apron.position.z = APRON_SAFE_Z;
  apron.updateMatrixWorld(true);
}

function nearly(value, expected) {
  return Math.abs(Number(value) - expected) < 0.001;
}
