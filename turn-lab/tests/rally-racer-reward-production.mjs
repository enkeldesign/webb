import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  catalogSource,
  carModelsSource,
  emergencyModelsSource,
  upgradeSource,
  lotSource
] = await Promise.all([
  fs.readFile(new URL('../../turn/vehicle/catalog.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/car-models.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/emergency-livery-models.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/visual-upgrades.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-showroom-experiment.js', import.meta.url), 'utf8')
]);
const catalog = await import(`data:text/javascript;base64,${Buffer.from(catalogSource).toString('base64')}`);
const rally = catalog.getCarDefinition('toy-racer');

assert.equal(rally.name, 'Rally Racer');
assert.equal(rally.defaultColor, '#111111', 'The final reward should retain its black competition body');
assert.equal(rally.defaultSecondaryColor, '#ffcc00', 'The factory rally kit should use TURN trophy gold');
assert.deepEqual(rally.defaultSecondaryColorP3, [1, 0.76, 0], 'Factory gold should retain its Display-P3 definition');
assert.equal(rally.secondaryPaint?.label, 'Rally kit', 'The Lot should expose the body kit as a real second paint choice');
assert.deepEqual(rally.secondaryPaint?.meshNames, [], 'Procedural kit paint must not claim a nonexistent GLB mesh');
assert.equal(rally.visualUpgrade, 'rally-competition', 'The stable Toy Racer asset should opt into the reusable competition kit');

assert.match(carModelsSource, /installVehicleVisualUpgrade\(\{/,
  'Every rendering surface must install catalog-selected visual upgrades through the canonical car factory');
assert.ok(
  carModelsSource.indexOf('normalizeModelToGround(model') < carModelsSource.indexOf('installVehicleVisualUpgrade({'),
  'Upgrade proportions must be derived after the GLB has been normalized for the current rendering surface'
);
assert.match(carModelsSource, /secondaryPaintMaterials/,
  'Procedural secondary paint must participate in the existing live recolor pipeline');
assert.match(emergencyModelsSource, /car-models\.js\?build=20260823-r176-rally-reward/,
  'The release wrapper must bypass cached pre-upgrade car factories in installed apps');

assert.match(upgradeSource, /mergeGeometries/,
  'The richer reward silhouette should batch generated parts rather than add a draw call per part');
assert.match(upgradeSource, /addRallyLampBank/);
assert.match(upgradeSource, /for \(const factor of \[-0\.3, -0\.1, 0\.1, 0\.3\]\)/,
  'Rally Racer should carry a recognisable four-lamp bank');
assert.match(upgradeSource, /addBonnetStripes/);
assert.match(upgradeSource, /addCompetitionWing/);
assert.match(upgradeSource, /addRollHoop/);
assert.match(upgradeSource, /addWheelRimAccents/);
assert.doesNotMatch(upgradeSource, /PointLight/,
  'Decorative reward lamps must not multiply real-time light cost for the player and four ghosts');
assert.match(upgradeSource, /turnVisualUpgrade/,
  'Rendered roots should expose upgrade identity for diagnostics and future kits');

assert.match(lotSource, /black-and-gold competition special/i);
assert.match(lotSource, /four rally lamps/i);
assert.match(lotSource, /high rear wing/i);

console.log('TURN Rally Racer 1000-trophy visual reward and reusable upgrade pipeline passed.');
