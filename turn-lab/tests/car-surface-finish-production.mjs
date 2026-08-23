import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [catalogSource, carModelsSource, finishSource, emergencySource] = await Promise.all([
  fs.readFile(new URL('../../turn/vehicle/catalog.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/car-models.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/visual-upgrades.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/emergency-livery-models.js', import.meta.url), 'utf8')
]);
const catalog = await import(`data:text/javascript;base64,${Buffer.from(catalogSource).toString('base64')}`);

assert.equal(catalog.CAR_CATALOG.length, 15);
for (const car of catalog.CAR_CATALOG) {
  assert.match(
    finishSource,
    new RegExp(`(?:^|\\n)  ['"]?${car.id.replaceAll('-', '\\-')}['"]?: finishProfile\\(`),
    `${car.name} needs an explicit, reviewable surface recipe`
  );
}

const configurableRewardCars = ['vintage-racer', 'toy-racer', 'monster-truck', 'race-future'];
for (const id of configurableRewardCars) {
  assert.ok(catalog.getCarDefinition(id).secondaryPaint, `${id} should expose its reward accent colour`);
}
for (const id of ['firetruck', 'police', 'ambulance']) {
  const car = catalog.getCarDefinition(id);
  assert.equal(car.fixedLivery, true);
  assert.equal(car.secondaryPaint, null, `${car.name} must remain completely non-repaintable`);
}

assert.match(carModelsSource, /installVehicleSurfaceFinish\(\{/,
  'Every rendering surface must install the shared finish through the canonical car factory');
assert.ok(
  carModelsSource.indexOf('normalizeModelToGround(model') < carModelsSource.indexOf('installVehicleSurfaceFinish({'),
  'Finish recipes must measure normalized GLB geometry'
);
assert.ok(
  carModelsSource.indexOf('installVehicleSurfaceFinish({') < carModelsSource.indexOf('installVehicleVisualUpgrade({'),
  'The universal finish must be the foundation under special reward kits'
);
assert.match(carModelsSource, /primaryPaintMaterials,/);
assert.match(carModelsSource, /secondaryPaintMaterials/);
assert.match(carModelsSource, /primaryColor: car\.fixedLivery[\s\S]*getVehicleDefaultColorSpec\(car\.id\)/,
  'Emergency rim centres must use factory paint even if stale storage contains a custom colour');

assert.match(finishSource, /const FACTORY_FINISH = 'factory-finish-v1'/);
assert.match(finishSource, /turn-factory-surface-finish/);
assert.match(finishSource, /addCabinGlass/);
assert.match(finishSource, /trapezoidPrismGeometry/,
  'Windows should remain low-poly body surfaces rather than flat rectangular decals');
assert.match(finishSource, /addRoadLamps/);
assert.match(finishSource, /0xffef9a/);
assert.match(finishSource, /0xff4f5e/);
assert.match(finishSource, /addWheelRimCenters/);
assert.match(finishSource, /size\.x > Math\.min\(size\.y, size\.z\) \* 0\.72/,
  'The SUV rear spare must not be mistaken for a road-wheel rim');
assert.match(finishSource, /mergeGeometries/,
  'Finish parts must batch by material rather than add a draw call per window, lamp or wheel');
assert.match(finishSource, /mesh\.userData\.turnOwnedGeometry = true/,
  'Generated finish batches must declare geometry ownership for thumbnail and viewer disposal');
assert.doesNotMatch(finishSource, /PointLight/,
  'Decorative lamps must not multiply real-time lighting cost for the player and rivals');
assert.match(finishSource, /if \(rims && !car\.fixedLivery\) primaryPaintMaterials\.push\(rimMaterial\)/,
  'Body-coloured rims should recolour with normal cars but never expose emergency-service paint');
assert.match(finishSource, /if \(accents && car\.secondaryPaint && !car\.fixedLivery\)/,
  'Only explicitly configurable non-emergency accents may join the secondary paint path');
assert.match(finishSource, /addMonsterSuspension/);
assert.match(finishSource, /raycastTopSurfaceY/,
  'Reward stripes should follow the source model surface instead of floating above it');
assert.match(emergencySource, /car-models\.js\?build=20260823-r178-all-car-surface-finish/,
  'The release wrapper must bypass cached bare-car factories in installed apps');

console.log('TURN all-car glass, lamps, body-coloured rims and reward accent recipes passed.');
