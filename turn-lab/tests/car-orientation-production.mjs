import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const catalogSource = await fs.readFile(new URL('../../turn/vehicle/catalog.js', import.meta.url), 'utf8');
const catalog = await import(`data:text/javascript;base64,${Buffer.from(catalogSource).toString('base64')}`);
const frontWheelSteeringSource = await fs.readFile(
  new URL('../../turn/vehicle/front-wheel-steering.js', import.meta.url),
  'utf8'
);
const frontWheelSteering = await import(
  `data:text/javascript;base64,${Buffer.from(frontWheelSteeringSource).toString('base64')}`
);

const expectedQuarterTurns = new Map([
  ['convertible', 0],
  ['classic', 0],
  ['vintage-racer', 0],
  ['toy-racer', 0],
  ['monster-truck', 2],
  ['race-future', 0],
  ['race', 0],
  ['sedan-sports', 0],
  ['sedan', 0],
  ['suv', 0],
  ['firetruck', 0],
  ['police', 0],
  ['ambulance', 0],
  ['truck', 0],
  ['van', 0]
]);

const expectedVisualScales = new Map([
  ['convertible', 0.98],
  ['classic', 1],
  ['vintage-racer', 0.96],
  ['toy-racer', 0.98],
  ['monster-truck', 0.83],
  ['race-future', 0.96],
  ['race', 0.94],
  ['sedan-sports', 0.98],
  ['sedan', 1],
  ['suv', 1.05],
  ['firetruck', 1.10],
  ['police', 0.98],
  ['ambulance', 1.05],
  ['truck', 1.12],
  ['van', 1.08]
]);

const expectedGlobalSizeMultipliers = new Map([
  ['vintage-racer', 0.75],
  ['police', 1.15]
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

  const assetPath = car.asset.replace(/^\.\//, '');
  const glb = await fs.readFile(new URL(`../../turn/${assetPath}`, import.meta.url));
  const json = readGlbJson(glb, car.id);
  const rawFront = getKenneyWheelAxis(json, car);
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

const awd = catalog.getCarDefinition('convertible');
const suv = catalog.getCarDefinition('suv');
const trainingCar = catalog.getCarDefinition('classic');
const vintageRacer = catalog.getCarDefinition('vintage-racer');
const rallyRacer = catalog.getCarDefinition('toy-racer');
const hatchback = catalog.getCarDefinition('sedan-sports');
const policeCar = catalog.getCarDefinition('police');
const monsterTruck = catalog.getCarDefinition('monster-truck');
assert.equal(awd.name, 'AWD');
assert.equal(awd.pack, 'car');
assert.equal(awd.asset, './assets/cars/suv.glb');
assert.equal(awd.surfaceProfileId, 'suv');
assert.equal(awd.defaultColor, '#776655');
assert.equal(awd.defaultSecondaryColor, '#393329');
assert.deepEqual(awd.stats, { speed: 2, acceleration: 3, control: 4, drift: 4, boostPower: 2, boostDuration: 3 });
assert.equal(catalog.getVehicleStatTotal(awd.stats), catalog.VEHICLE_STAT_BUDGET);
assert.equal(suv.name, 'SUV');
assert.equal(suv.asset, './assets/cars/suv-luxury.glb');
assert.equal(suv.surfaceProfileId, 'suv-luxury');
assert.deepEqual(suv.stats, { speed: 3, acceleration: 4, control: 4, drift: 2, boostPower: 3, boostDuration: 2 });
assert.equal(catalog.getVehicleStatTotal(suv.stats), catalog.VEHICLE_STAT_BUDGET);
assert.equal(suv.defaultColor, '#0555aa');
assert.equal(suv.defaultSecondaryColor, '#163f7a');
assert.equal(trainingCar.pack, 'car');
assert.equal(trainingCar.asset, './assets/cars/training-car.glb');
assert.equal(trainingCar.surfaceProfileId, 'training-car');
assert.equal(monsterTruck.pack, 'toy');
assert.equal(monsterTruck.asset, './assets/cars/monster-truck.glb');
assert.equal(hatchback.asset, './assets/cars/hatchback-sports.glb');
assert.equal(rallyRacer.asset, './assets/cars/sedan-sports.glb');
assertClose(awd.visualScale * awd.visualSizeMultiplier, 0.98, 'AWD effective visual scale');
assertClose(suv.visualScale * suv.visualSizeMultiplier, 1.05, 'SUV effective visual scale');
assertClose(trainingCar.visualScale * trainingCar.visualSizeMultiplier, 1, 'Training Car standard-car visual scale');
assertClose(vintageRacer.visualScale * vintageRacer.visualSizeMultiplier, 0.72, 'Vintage Racer effective visual scale');
assertClose(rallyRacer.visualScale * rallyRacer.visualSizeMultiplier, 0.98, 'Rally Racer effective visual scale');
assertClose(hatchback.visualScale * hatchback.visualSizeMultiplier, 0.98, 'Hatchback effective visual scale');
assertClose(policeCar.visualScale * policeCar.visualSizeMultiplier, 1.127, 'Police Car effective visual scale');
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
  /normalizeModelToGround\(\s*model,\s*targetLength \* effectiveVisualScale,\s*`\$\{car\.id\}\|\$\{outline \? 1 : 0\}`\s*\)/,
  'Every model surface must receive its resolved scale and stable geometry cache identity through the shared factory'
);
assert.match(carModels, /turnVisualSizeMultiplier = car\.visualSizeMultiplier/);
assert.match(carModels, /turnFeaturedVisualSizeMultiplier = featuredVisualSizeMultiplier/);
assert.match(carModels, /turnFeaturedVisualSurface = featuredSurface/);
assert.match(carModels, /turnEffectiveVisualScale = effectiveVisualScale/);
assert.match(carModels, /REVERSED_FRONT_WHEEL_LABEL_IDS = new Set\(\['vintage-racer'\]\)/,
  'Vintage Racer must keep its verified authored wheel-label reversal');
assert.match(carModels, /installFrontWheelSteeringRig\(model, car\)/,
  'Every GLB visual must install the shared steering-wheel rig');
assert.match(carModels, /root\.userData\.frontWheelPivots = frontWheelPivots/,
  'Each GLB visual must retain its real front-wheel pivots');
assert.match(carModels, /installWheelAnimationHostBridge\(root\)/,
  'Each GLB visual must bridge its wheel rig to the outer race-car host');
assert.match(carModels, /visual\.addEventListener\('added',[\s\S]*host\.userData\.frontWheelPivots = visual\.userData\.frontWheelPivots \|\| \[\]/,
  'The bridge must publish the visible GLB pivots when main.js adds the visual to playerCar or a rival');
assert.match(main, /for \(const pivot of car\.userData\.frontWheelPivots \|\| \[\]\)/,
  'The runtime wheel animator must consume the host-level pivots populated by the bridge');
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

const degrees = (value) => value * Math.PI / 180;
const trajectoryVelocity = (angle, speed = 30) => ({
  velocityX: Math.sin(angle) * speed,
  velocityZ: Math.cos(angle) * speed
});
const halfInputAngle = frontWheelSteering.FRONT_WHEEL_STEER_ANGLE * 0.5;

assertClose(
  frontWheelSteering.EXTREME_DRIFT_SLIP_THRESHOLD,
  degrees(30),
  'Extreme DRIFT trajectory threshold'
);
assertClose(
  frontWheelSteering.resolveFrontWheelSteeringAngle({
    steering: 0.5,
    heading: 0,
    ...trajectoryVelocity(degrees(70)),
    driftHeld: false
  }),
  halfInputAngle,
  'Normal steering must remain tilt-driven outside DRIFT'
);
assertClose(
  frontWheelSteering.resolveFrontWheelSteeringAngle({
    steering: 0.5,
    heading: 0,
    ...trajectoryVelocity(degrees(29)),
    driftHeld: true
  }),
  halfInputAngle,
  'DRIFT below 30 degrees must remain tilt-driven'
);
assertClose(
  frontWheelSteering.resolveFrontWheelSteeringAngle({
    steering: -1,
    heading: 0,
    ...trajectoryVelocity(degrees(30)),
    driftHeld: true
  }),
  degrees(30),
  'DRIFT at 30 degrees must align the wheels with trajectory'
);
assertClose(
  frontWheelSteering.resolveFrontWheelSteeringAngle({
    steering: 1,
    heading: 0,
    ...trajectoryVelocity(degrees(-70)),
    driftLockAmount: 1
  }),
  degrees(-70),
  'DRIFT LOCK must align the wheels with a negative trajectory angle'
);
assertClose(
  frontWheelSteering.resolveFrontWheelSteeringAngle({
    steering: 0,
    heading: degrees(150),
    ...trajectoryVelocity(degrees(-150)),
    driftLockAmount: 1
  }),
  degrees(60),
  'Trajectory alignment must take the shortest angle across the wrap boundary'
);
assertClose(
  frontWheelSteering.resolveFrontWheelSteeringAngle({
    steering: 0.5,
    heading: 0,
    ...trajectoryVelocity(degrees(70), 0.5),
    driftHeld: true
  }),
  halfInputAngle,
  'Near-zero velocity must retain stable tilt-driven steering'
);
assert.match(
  main,
  /resolveFrontWheelSteeringAngle\(\{[\s\S]*driftHeld: Boolean\(globalThis\.__turnDriftHeld\)[\s\S]*driftLockAmount: state\.driftLockAmount/,
  'The player wheel animator must use both DRIFT and LOCK state'
);
assert.match(
  main,
  /pivot\.rotation\.y = lerpAngle\(pivot\.rotation\.y, steerAngle, Math\.min\(1, dt \* 8\)\)/,
  'Trajectory takeover must retain the quick smooth wheel transition'
);

console.log(`TURN ${release.id} car orientation, trajectory steering, visible wheel integration and surface-specific visual sizing passed for all 15 models.`);

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

function getKenneyWheelAxis(json, car) {
  const wheelNodes = (json.nodes || []).filter((node) => /wheel/i.test(node.name || '') && node.translation);
  const front = averageWheelPosition(wheelNodes.filter((node) => wheelRole(node.name) === 'front'));
  const back = averageWheelPosition(wheelNodes.filter((node) => wheelRole(node.name) === 'back'));
  const labelAxis = { x: front.x - back.x, z: front.z - back.z };
  return reversedWheelLabelAxes.has(car.id)
    ? { x: -labelAxis.x, z: -labelAxis.z }
    : labelAxis;
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
