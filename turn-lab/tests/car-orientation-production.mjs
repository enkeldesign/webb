import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const catalogSource = await fs.readFile(new URL('../../turn/vehicle/catalog.js', import.meta.url), 'utf8');
const catalog = await import(`data:text/javascript;base64,${Buffer.from(catalogSource).toString('base64')}`);

const expectedQuarterTurns = new Map([
  ['convertible', 1],
  ['classic', 1],
  ['vintage-racer', 0],
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

const expectedVisualScales = new Map([
  ['convertible', 0.98],
  ['classic', 1],
  ['vintage-racer', 0.96],
  ['toy-racer', 0.94],
  ['monster-truck', 0.83],
  ['race-future', 0.96],
  ['race', 0.94],
  ['sedan-sports', 0.98],
  ['sedan', 1],
  ['suv', 1.05],
  ['suv-luxury', 1.06],
  ['hatchback-sports', 0.96],
  ['truck-flat', 1.12],
  ['truck', 1.12],
  ['van', 1.08]
]);

const expectedGlobalSizeMultipliers = new Map([
  ['convertible', 0.6],
  ['classic', 0.6]
]);

const expectedFeaturedSizeMultipliers = new Map([
  ['monster-truck', 1.2]
]);

// Vintage Racer's GLB wheel labels describe the axles opposite to the visible body nose.
// Keep the visual orientation verified by gameplay instead of trusting those labels literally.
const reversedWheelLabelAxes = new Set(['vintage-racer']);

assert.equal(catalog.CAR_CATALOG.length, expectedQuarterTurns.size);
assert.equal(catalog.CAR_CATALOG.length, expectedVisualScales.size);

for (const car of catalog.CAR_CATALOG) {
  assert.equal(
    car.modelYawQuarterTurns,
    expectedQuarterTurns.get(car.id),
    `${car.name} must keep its verified GLB orientation correction`
  );
  assert.equal(
    car.visualScale,
    expectedVisualScales.get(car.id),
    `${car.name} must keep its authored model-normalization scale`
  );
  assert.equal(
    car.visualSizeMultiplier,
    expectedGlobalSizeMultipliers.get(car.id) || 1,
    `${car.name} must keep its globally shared size multiplier`
  );
  assert.equal(
    car.featuredVisualSizeMultiplier,
    expectedFeaturedSizeMultipliers.get(car.id) || 1,
    `${car.name} must keep its Lot-and-race featured multiplier`
  );

  const glb = await fs.readFile(new URL(`../../turn/assets/cars/${car.id}.glb`, import.meta.url));
  const json = readGlbJson(glb, car.id);
  const wheelNodes = (json.nodes || []).filter((node) => /wheel/i.test(node.name || '') && node.translation);
  const front = averageWheelPosition(wheelNodes.filter((node) => wheelRole(node.name) === 'front'));
  const back = averageWheelPosition(wheelNodes.filter((node) => wheelRole(node.name) === 'back'));
  const labelAxis = { x: front.x - back.x, z: front.z - back.z };
  const rawFront = reversedWheelLabelAxes.has(car.id)
    ? { x: -labelAxis.x, z: -labelAxis.z }
    : labelAxis;
  const rawLength = Math.hypot(rawFront.x, rawFront.z);
  assert.ok(rawLength > 0.1, `${car.name} must expose a usable front/back wheel axis`);

  const correctedFront = rotateYaw(rawFront, car.modelYawQuarterTurns * Math.PI / 2);
  assert.ok(
    Math.abs(correctedFront.x) < rawLength * 1e-6 && correctedFront.z > 0,
    `${car.name} correction must normalize its authored nose to +Z`
  );

  const factoryFront = rotateYaw(correctedFront, Math.PI);
  const lotFront = rotateYaw(factoryFront, Math.PI);
  const raceFront = rotateYaw(factoryFront, Math.PI);
  const viewerFront = rotateYaw(factoryFront, Math.PI - 0.55);
  assert.ok(lotFront.z > 0, `${car.name} must face the Lot camera`);
  assert.ok(raceFront.z > 0, `${car.name} must face the physics heading in a race`);
  assert.ok(viewerFront.z > 0, `${car.name} must open on a front three-quarter view`);
}

const convertible = catalog.getCarDefinition('convertible');
const trainingCar = catalog.getCarDefinition('classic');
const monsterTruck = catalog.getCarDefinition('monster-truck');
assertClose(convertible.visualScale * convertible.visualSizeMultiplier, 0.588, 'Convertible effective visual scale');
assertClose(trainingCar.visualScale * trainingCar.visualSizeMultiplier, 0.6, 'Training Car effective visual scale');
assertClose(monsterTruck.visualScale * monsterTruck.visualSizeMultiplier, 0.83, 'Monster Truck compact visual scale');
assertClose(
  monsterTruck.visualScale * monsterTruck.visualSizeMultiplier * monsterTruck.featuredVisualSizeMultiplier,
  0.996,
  'Monster Truck Lot-and-race visual scale'
);

const [index, releaseSource, carModels, lot, main, trackBestCar] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/car-models.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-r10.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/track-best-car.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));
assert.match(
  carModels,
  /model\.rotation\.y = Math\.PI \+ car\.modelYawQuarterTurns \* Math\.PI \/ 2/,
  'The shared model factory must apply the catalog correction'
);
assert.match(
  carModels,
  /FEATURED_SURFACE_TARGET_LENGTHS = new Set\(\[5\.15, 5\.5\]\)/,
  'Only the standard Lot lineup and race target lengths may use featured sizing'
);
assert.match(carModels, /featuredSurface = FEATURED_SURFACE_TARGET_LENGTHS\.has\(targetLength\)/);
assert.match(
  carModels,
  /featuredVisualSizeMultiplier = featuredSurface[\s\S]*\? car\.featuredVisualSizeMultiplier[\s\S]*: 1/,
  'Featured sizing must be opt-in by surface'
);
assert.match(
  carModels,
  /effectiveVisualScale = car\.visualScale[\s\S]*\* car\.visualSizeMultiplier[\s\S]*\* featuredVisualSizeMultiplier/,
  'The shared model factory must combine authored, global and featured scaling'
);
assert.match(
  carModels,
  /normalizeModelToGround\(model, targetLength \* effectiveVisualScale\)/,
  'Every model surface must receive its resolved scale through the shared factory'
);
assert.match(carModels, /turnVisualSizeMultiplier = car\.visualSizeMultiplier/);
assert.match(carModels, /turnFeaturedVisualSizeMultiplier = featuredVisualSizeMultiplier/);
assert.match(carModels, /turnFeaturedVisualSurface = featuredSurface/);
assert.match(carModels, /turnEffectiveVisualScale = effectiveVisualScale/);
assert.match(carModels, /side: THREE\.BackSide/, 'Car outlines must remain inverted back-face shells');
assert.match(carModels, /depthTest: true/, 'Car outlines must still respect the body depth buffer');
assert.match(carModels, /depthWrite: false/, 'Car outlines must not write depth and compete with body surfaces');
assert.match(carModels, /polygonOffset: true/, 'Car outlines must use a depth offset for stable close surface intersections');
assert.match(carModels, /polygonOffsetFactor: 1/);
assert.match(carModels, /polygonOffsetUnits: 1/);

assert.match(lot, /targetLength: 5\.15/, 'The standard Lot lineup must use the featured surface size');
assert.match(lot, /targetLength: 6\.4/, 'The expanded 3D viewer must retain its compact-safe size');
assert.equal((lot.match(/targetLength: 5\.15/g) || []).length, 1);
assert.equal((lot.match(/targetLength: 6\.4/g) || []).length, 1);
assert.match(main, /targetLength: 5\.5/, 'Race cars and rivals must use the featured surface size');
assert.match(trackBestCar, /targetLength: 6\.4/, 'Home record thumbnails must retain their compact-safe size');
assert.doesNotMatch(
  carModels,
  /FEATURED_SURFACE_TARGET_LENGTHS = new Set\(\[[^\]]*6\.4/,
  'Expanded 3D and record-preview target lengths must never receive featured sizing'
);

assert.match(lot, /visual\.rotation\.y = Math\.PI/, 'The Lot must map local -Z to the camera-facing direction');
assert.match(lot, /VIEWER_INITIAL_YAW = Math\.PI - 0\.55/, 'The viewer must start on the normalized front');
assert.match(main, /playerCar\.rotation\.y = state\.heading \+ Math\.PI/);
assert.match(main, /car\.rotation\.y = frame\.h \+ Math\.PI/);

console.log(`TURN ${release.id} car orientation and surface-specific visual sizing passed for all 15 models.`);

function assertClose(actual, expected, label) {
  assert.ok(
    Math.abs(actual - expected) < 1e-12,
    `${label} must equal ${expected}; received ${actual}`
  );
}

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
