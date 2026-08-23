import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const [
  catalogSource,
  semanticSource,
  carModelsSource,
  emergencyBridgeSource,
  releaseSource,
  kenneyLicense,
  rgsdevLicense
] = await Promise.all([
  fs.readFile(new URL('../../turn/vehicle/catalog.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/semantic-car-finish.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/car-models.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/emergency-livery-models.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/assets/KENNEY-ASSETS.md', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/assets/cars/RGSDEV-MONSTER-TRUCK.md', import.meta.url), 'utf8')
]);

const catalog = await import(`data:text/javascript;base64,${Buffer.from(catalogSource).toString('base64')}`);
const release = JSON.parse(releaseSource);

assert.equal(release.version, '1.10.0');
assert.equal(release.id, '2026.08.23-r179');
assert.equal(catalog.CAR_CATALOG.length, 15);
assert.deepEqual(
  catalog.CAR_CATALOG.filter((car) => !car.fixedLivery && !car.secondaryPaint).map((car) => car.id),
  [],
  'Every non-emergency car must expose its native secondary surface'
);

const paletteContracts = new Map([
  ['car', {
    file: '../../turn/assets/cars/palettes/car-kit.png',
    sha256: 'f3622a03a20c6696065cae9cbe391351be873508af190c2ebd1d420c055787a5'
  }],
  ['prototype', {
    file: '../../turn/assets/cars/palettes/toy-prototype.png',
    sha256: '0d4947d34ff32acf4a359c7f22ca784e057e7e72f622170a9a77b6fc88fdb70e'
  }],
  ['toy', {
    file: '../../turn/assets/cars/palettes/toy-prototype.png',
    sha256: '0d4947d34ff32acf4a359c7f22ca784e057e7e72f622170a9a77b6fc88fdb70e'
  }]
]);

for (const contract of new Map([...paletteContracts.values()].map((value) => [value.file, value])).values()) {
  const png = await fs.readFile(new URL(contract.file, import.meta.url));
  assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a', `${contract.file} must be PNG`);
  assert.equal(png.readUInt32BE(16), 512, `${contract.file} must preserve the authored 8 × 8 cell width`);
  assert.equal(png.readUInt32BE(20), 512, `${contract.file} must preserve the authored 8 × 8 cell height`);
  assert.equal(sha256(png), contract.sha256, `${contract.file} must remain the verified source atlas`);
}

for (const car of catalog.CAR_CATALOG.filter((candidate) => candidate.pack !== 'rgsdev')) {
  assert.ok(paletteContracts.has(car.pack), `${car.name} must resolve to a known Kenney palette family`);
  const glb = await fs.readFile(new URL(`../../turn/${car.asset.replace(/^\.\//, '')}`, import.meta.url));
  const json = readGlbJson(glb, car.id);
  assert.deepEqual(
    (json.images || []).map((image) => image.uri),
    ['Textures/colormap.png'],
    `${car.name} must retain its authored palette reference`
  );
  const primitives = (json.meshes || []).flatMap((mesh) => mesh.primitives || []);
  assert.ok(primitives.length > 0, `${car.name} must contain renderable primitives`);
  assert.ok(primitives.every((primitive) => Number.isInteger(primitive.attributes?.TEXCOORD_0)),
    `${car.name} must expose authored UV semantics on every primitive`);
  assert.ok(primitives.every((primitive) => primitive.attributes?.COLOR_0 === undefined),
    `${car.name} must not depend on fabricated vertex colours`);
}

assert.match(carModelsSource, /new THREE\.LoadingManager\(\)/);
assert.match(carModelsSource, /setURLModifier/);
assert.ok(carModelsSource.includes('Textures\\/colormap\\.png'),
  'The loader must intercept each GLB\'s generic source-atlas URI');
assert.match(carModelsSource, /getKenneyPaletteAsset\(key\)/,
  'Atlas routing must use the catalog pack instead of a global texture guess');
assert.match(semanticSource, /material\.onBeforeCompile/);
assert.match(semanticSource, /ivec2\(floor\(vec2\(vMapUv\.x, 1\.0 - vMapUv\.y\) \* 8\.0\)\)/);
assert.match(semanticSource, /turnPrimaryColor/);
assert.match(semanticSource, /turnSecondaryColor/);
assert.doesNotMatch(semanticSource, /BoxGeometry|PlaneGeometry|CylinderGeometry|SphereGeometry|mergeGeometries|PointLight/,
  'Semantic paint must add no model or presentation geometry');

for (const id of ['police', 'ambulance', 'firetruck']) {
  const car = catalog.getCarDefinition(id);
  assert.equal(car.fixedLivery, true, `${car.name} must remain non-repaintable`);
  assert.equal(car.secondaryPaint, null, `${car.name} must expose no secondary picker`);
}
assert.match(semanticSource, /if \(car\.fixedLivery\) return true/);
assert.match(emergencyBridgeSource, /native-kenney-palette/);
assert.doesNotMatch(emergencyBridgeSource, /BoxGeometry|PlaneGeometry|applyFixedEmergencyLivery|installSecondaryAccent/);

const monster = catalog.getCarDefinition('monster-truck');
assert.equal(monster.pack, 'rgsdev');
assert.equal(monster.asset, './assets/cars/monster-truck-rgsdev.glb');
assert.equal(monster.secondaryPaint?.label, 'Suspension trim');
const monsterGlb = await fs.readFile(new URL('../../turn/assets/cars/monster-truck-rgsdev.glb', import.meta.url));
assert.equal(sha256(monsterGlb), '7119741b9647855ffd050ddbc1618dca2868574271beffdf9c79e4846919c7a3');
const monsterJson = readGlbJson(monsterGlb, monster.id);
assert.deepEqual(
  (monsterJson.materials || []).map((material) => material.name),
  ['body light blue', 'body black', 'windows', 'rear lights', 'body grey', 'headlights', 'tires', 'wheels'],
  'The standalone Monster Truck must preserve the source semantic material split'
);
assert.equal((monsterJson.images || []).length, 0, 'The Monster Truck must have no missing runtime texture dependency');
const monsterPrimitives = (monsterJson.meshes || []).flatMap((mesh) => mesh.primitives || []);
assert.equal(monsterPrimitives.length, 8);
assert.ok(monsterPrimitives.every((primitive) => Number.isInteger(primitive.attributes?.NORMAL)),
  'Every Monster Truck surface must retain explicit flat normals');
assert.equal(
  monsterPrimitives.reduce((count, primitive) => count + monsterJson.accessors[primitive.attributes.POSITION].count / 3, 0),
  3588,
  'The selected RGSDev mesh must retain its verified source triangle count'
);
assert.match(semanticSource, /RGSDEV_PRIMARY_MATERIALS = new Set\(\['body light blue', 'wheels'\]\)/);
assert.match(semanticSource, /RGSDEV_SECONDARY_MATERIALS = new Set\(\['body grey'\]\)/);

await assert.rejects(
  fs.access(new URL('../../turn/vehicle/visual-upgrades.js', import.meta.url)),
  'The retired generated Rally Racer geometry module must stay deleted'
);
assert.match(kenneyLicense, /Creative Commons CC0 1\.0/);
assert.match(kenneyLicense, /Player paint is applied at render time to selected palette cells on the existing surfaces/);
assert.match(rgsdevLicense, /rgsdev\.itch\.io\/free-low-poly-vehicles-pack/);
assert.match(rgsdevLicense, /CC0/);

console.log(`TURN ${release.id} semantic native-surface contract passed for 14 Kenney cars and the RGSDev Monster Truck.`);

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
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
