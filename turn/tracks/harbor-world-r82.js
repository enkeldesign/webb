import { installHarborWorld as installHarborWorldR81 } from './harbor-world-r81.js?base=20260725-r81';

const WEST_CARGO_START = Object.freeze({ x: -168, z: -236 });
const WEST_CARGO_R82 = Object.freeze({ x: -84, z: -286, rotation: 0.14 });

export function installHarborWorld(options) {
  const world = installHarborWorldR81(options);
  moveWestCargoShipOffStartSightline(world);

  world.name = 'TURN Harbor r82';
  world.userData.turnHarborArtDirection = Object.freeze({
    ...(world.userData.turnHarborArtDirection || {}),
    version: 'r82',
    cargoShipClearOfStartGate: true,
    gameplayGeometryUnchanged: true
  });
  return world;
}

function moveWestCargoShipOffStartSightline(world) {
  const ship = world.children.find((node) => (
    node?.isGroup
    && nearly(node.position.x, WEST_CARGO_START.x)
    && nearly(node.position.z, WEST_CARGO_START.z)
    && node.children.length > 10
  ));

  if (!ship) {
    console.warn('TURN: Harbor r82 could not find the west cargo ship.');
    return;
  }

  ship.position.x = WEST_CARGO_R82.x;
  ship.position.z = WEST_CARGO_R82.z;
  ship.rotation.y = WEST_CARGO_R82.rotation;
  ship.name = 'Harbor west cargo ship r82';
}

function nearly(value, expected) {
  return Math.abs(Number(value) - expected) < 0.001;
}
