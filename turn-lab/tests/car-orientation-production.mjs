import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const catalogSource = await fs.readFile(new URL('../../turn/vehicle/catalog.js', import.meta.url), 'utf8');
const catalog = await import(`data:text/javascript;base64,${Buffer.from(catalogSource).toString('base64')}`);

const expectedQuarterTurns = new Map([
  ['convertible', 1],
  ['classic', 1],
  ['vintage-racer', 2],
  ['toy-racer', 2],
  ['monster-truck', 2],
  ['race-future', 0],
  ['race', 0],
  ['sedan-sports', 0],
  ['sedan', 0],
  ['suv', 0],
  ['suv-luxury', 0],
  ['hatchback-sports', 0],
  ['truck-flat', 0],
  ['truck', 0],
  ['van', 0]
]);

assert.equal(catalog.CAR_CATALOG.length, expectedQuarterTurns.size);

for (const car of catalog.CAR_CATALOG) {
  assert.equal(
    car.modelYawQuarterTurns,
    expectedQuarterTurns.get(car.id),
    `${car.name} must keep its verified GLB orientation correction`
  );

  const glb = await fs.readFile(new URL(`../../turn/assets/cars/${car.id}.glb`, import.meta.url));
  const json = readGlbJson(glb, car.id);
  const wheelNodes = (json.nodes || []).filter((node) => /wheel/i.test(node.name || '') && node.translation);
  const front = averageWheelPosition(wheelNodes.filter((node) => wheelRole(node.name) === 'front'));
  const back = averageWheelPosition(wheelNodes.filter((node) => wheelRole(node.name) === 'back'));
  const rawFront = { x: front.x - back.x, z: front.z - back.z };
  const rawLength = Math.hypot(rawFront.x, rawFront.z);
  assert.ok(rawLength > 0.1, `${car.name} must expose a usable front/back wheel axis`);

  const correctedFront = rotateYaw(rawFront, car.modelYawQuarterTurns * Math.PI / 2);
  assert.ok(
    Math.abs(correctedFront.x) < rawLength * 1e-6 && correctedFront.z > 0,
    `${car.name} correction must normalize its authored nose to +Z`
  );

  // createCarVisual points normalized models down local -Z. The Lot and race roots
  // both add a half-turn, while the viewer adds a three-quarter presentation angle.
  const factoryFront = rotateYaw(correctedFront, Math.PI);
  const lotFront = rotateYaw(factoryFront, Math.PI);
  const raceFront = rotateYaw(factoryFront, Math.PI);
  const viewerFront = rotateYaw(factoryFront, Math.PI - 0.55);
  assert.ok(lotFront.z > 0, `${car.name} must face the Lot camera`);
  assert.ok(raceFront.z > 0, `${car.name} must face the physics heading in a race`);
  assert.ok(viewerFront.z > 0, `${car.name} must open on a front three-quarter view`);
}

const [index, carModels, lot, main] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/car-models.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-r10.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/main.js', import.meta.url), 'utf8')
]);

assert.match(index, /TURN v1\.3\.16 · Build 2026\.07\.21-r32/);
assert.match(
  carModels,
  /model\.rotation\.y = Math\.PI \+ car\.modelYawQuarterTurns \* Math\.PI \/ 2/,
  'The shared model factory must apply the catalog correction'
);
assert.match(carModels, /side: THREE\.BackSide/, 'Car outlines must remain inverted back-face shells');
assert.match(carModels, /depthTest: true/, 'Car outlines must still respect the body depth buffer');
assert.match(carModels, /depthWrite: false/, 'Car outlines must not write depth and compete with body surfaces');
assert.match(carModels, /polygonOffset: true/, 'Car outlines must use a depth offset for stable close surface intersections');
assert.match(carModels, /polygonOffsetFactor: 1/);
assert.match(carModels, /polygonOffsetUnits: 1/);
assert.match(lot, /visual\.rotation\.y = Math\.PI/, 'The Lot must map local -Z to the camera-facing direction');
assert.match(lot, /VIEWER_INITIAL_YAW = Math\.PI - 0\.55/, 'The viewer must start on the normalized front');
assert.match(main, /playerCar\.rotation\.y = state\.heading \+ Math\.PI/);
assert.match(main, /car\.rotation\.y = frame\.h \+ Math\.PI/);

console.log('TURN car orientation regression passed for all 15 models.');

function readGlbJson(buffer, carId) {
  assert.equal(buffer.toString('utf8', 0, 4), 'glTF', `${carId} must remain a binary glTF`);
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.toString('utf8', offset + 4, offset + 8);
    if (type === 'JSON') {
      return JSON.parse(buffer.subarray(offset + 8, offset + 8 + length).toString('utf8').trim());
    }
    offset += 8 + length;
  }
  assert.fail(`${carId} has no GLB JSON chunk`);
}

function wheelRole(name = '') {
  const label = name.toLowerCase();
  if (/^wheel-(?:front|f[lr])(?:-|$)/.test(label)) return 'front';
  if (/^wheel-(?:back|b[lr])(?:-|$)/.test(label)) return 'back';
  return null;
}

function averageWheelPosition(nodes) {
  assert.ok(nodes.length >= 2, 'Each axle must expose at least two named wheels');
  return nodes.reduce((average, node) => ({
    x: average.x + node.translation[0] / nodes.length,
    z: average.z + node.translation[2] / nodes.length
  }), { x: 0, z: 0 });
}

function rotateYaw(vector, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: cosine * vector.x + sine * vector.z,
    z: -sine * vector.x + cosine * vector.z
  };
}
