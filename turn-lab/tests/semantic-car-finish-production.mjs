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

const [releaseMajor, releaseMinor, releasePatch] = release.version.split('.').map(Number);
assert.ok(
  releaseMajor > 1
    || (releaseMajor === 1 && (releaseMinor > 10 || (releaseMinor === 10 && releasePatch >= 4))),
  'Semantic native car finishes must remain part of TURN 1.10.4 or later'
);
assert.match(release.id, /^\d{4}\.\d{2}\.\d{2}-r\d+$/);
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
  assert.equal(png.readUInt32BE(16), 512, `${contract.file} must preserve the authored atlas width`);
  assert.equal(png.readUInt32BE(20), 512, `${contract.file} must preserve the authored atlas height`);
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
assert.match(semanticSource, /ivec2\(floor\(vMapUv \* 8\.0\)\)/,
  'Semantic masks must use the same vMapUv orientation Three.js uses to sample the glTF texture');
assert.doesNotMatch(semanticSource, /1\.0 - vMapUv\.y/,
  'glTF UVs must not be vertically flipped a second time inside the semantic mask');
assert.match(semanticSource, /turnPrimaryColor/);
assert.match(semanticSource, /turnSecondaryColor/);
assert.doesNotMatch(semanticSource, /BoxGeometry|PlaneGeometry|CylinderGeometry|SphereGeometry|mergeGeometries|PointLight/,
  'Semantic paint must add no model or presentation geometry');

// Read the actual sign-free Taxi-derived Training Car binary so this regression proves
// both that its semantic masks intersect real triangles and that the removed roof sign
// cannot return through outlines, ghosts or thumbnails.
const classicGlb = await fs.readFile(new URL('../../turn/assets/cars/training-car.glb', import.meta.url));
const classic = readGlb(classicGlb, 'classic');
assert.equal(catalog.getCarDefinition('classic').pack, 'car');
assert.equal(catalog.getCarDefinition('classic').surfaceProfileId, 'training-car');
assert.equal(classic.json.scenes?.[0]?.name, 'training-car');
assert.deepEqual(
  (classic.json.nodes || []).map((node) => node.name),
  ['body', 'wheel-front-right', 'wheel-front-left', 'wheel-back-left', 'wheel-back-right'],
  'Training Car must preserve the Taxi body and four independently addressable wheel nodes'
);
const classicBodyNode = classic.json.nodes.find((node) => node.name === 'body');
const classicBodyPrimitive = classic.json.meshes?.[classicBodyNode?.mesh]?.primitives?.[0];
const classicBodyPositions = classic.json.accessors?.[classicBodyPrimitive?.attributes?.POSITION];
const classicBodyIndices = classic.json.accessors?.[classicBodyPrimitive?.indices];
assert.ok(classicBodyPositions?.max?.[1] <= 1.15,
  'Training Car body bounds must end at the roof instead of the removed Taxi sign');
assert.equal(classicBodyPositions?.count, 1118,
  'Training Car must omit the Taxi sign\'s 20 authored vertices');
assert.equal(classicBodyIndices?.count, 2202,
  'Training Car must omit the Taxi sign\'s 10 authored triangles');
const classicAuthoredCells = triangleCellCounts(classic, { flipV: false });
const classicDoubleFlippedCells = triangleCellCounts(classic, { flipV: true });
const classicBody = mergeNodeCells(classicAuthoredCells, (name) => !/wheel/i.test(name));
const classicWheels = mergeNodeCells(classicAuthoredCells, (name) => /wheel/i.test(name));
const classicBodyDoubleFlipped = mergeNodeCells(classicDoubleFlippedCells, (name) => !/wheel/i.test(name));
const classicWheelsDoubleFlipped = mergeNodeCells(classicDoubleFlippedCells, (name) => /wheel/i.test(name));
const classicPrimary = [[4, 2], [4, 3]];
const classicSecondary = [[3, 4], [3, 5]];
const classicRims = [[3, 4], [3, 5]];
assert.ok(cellHits(classicBody, classicPrimary) > 0,
  'Training Car primary paint cells must intersect authored body triangles');
assert.ok(cellHits(classicBody, classicSecondary) > 0,
  'Training Car secondary trim cells must intersect authored body triangles');
assert.ok(cellHits(classicWheels, classicRims) > 0,
  'Training Car rim paint cells must intersect authored wheel triangles');
assert.equal(cellHits(classicBodyDoubleFlipped, classicPrimary), 0,
  'The retired double-V-flip must not accidentally become the semantic coordinate contract again');
assert.equal(cellHits(classicBodyDoubleFlipped, classicSecondary), 0,
  'The retired double-V-flip must miss the Training Car secondary cells');
assert.equal(cellHits(classicWheelsDoubleFlipped, classicRims), 0,
  'The retired double-V-flip must miss the Training Car rim cells');
assert.match(semanticSource, /'training-car': profile\(\{ primary: \[\[4, 2\], \[4, 3\]\], secondary: \[\[3, 4\], \[3, 5\]\], rims: \[\[3, 4\], \[3, 5\]\] \}\)/,
  'Training Car must use the verified Taxi-derived Car Kit palette cells');

const luxurySuvCar = catalog.getCarDefinition('suv');
assert.equal(luxurySuvCar.surfaceProfileId, 'suv-luxury',
  'The stable SUV ID must select the mounted Luxury SUV surface profile');
const luxurySuvGlb = await fs.readFile(new URL('../../turn/assets/cars/suv-luxury.glb', import.meta.url));
const luxurySuv = readGlb(luxurySuvGlb, 'suv-luxury');
const luxurySuvCells = triangleCellCounts(luxurySuv, { flipV: false });
const luxurySuvBody = mergeNodeCells(luxurySuvCells, (name) => !/wheel/i.test(name));
const luxurySuvWheels = mergeNodeCells(luxurySuvCells, (name) => /wheel/i.test(name));
assert.ok(cellHits(luxurySuvBody, [[4, 2], [4, 3]]) > 0,
  'Luxury SUV primary paint cells must intersect its authored body triangles');
assert.ok(cellHits(luxurySuvBody, [[3, 4], [3, 5]]) > 0,
  'Luxury SUV secondary trim cells must intersect its authored body triangles');
assert.ok(cellHits(luxurySuvWheels, [[5, 4], [5, 5]]) > 0,
  'Luxury SUV rim paint cells must intersect its authored wheel triangles');
assert.match(semanticSource, /'suv-luxury': profile\(\{ primary: \[\[4, 2\], \[4, 3\]\]/,
  'Luxury SUV must use its verified native palette cells instead of the old SUV mask');

for (const id of ['police', 'ambulance', 'firetruck']) {
  const car = catalog.getCarDefinition(id);
  assert.equal(car.fixedLivery, true, `${car.name} must remain non-repaintable`);
  assert.equal(car.secondaryPaint, null, `${car.name} must expose no secondary picker`);
}
assert.match(semanticSource, /if \(car\.fixedLivery\) return true/);
assert.match(emergencyBridgeSource, /native-kenney-palette/);
assert.doesNotMatch(emergencyBridgeSource, /BoxGeometry|PlaneGeometry|applyFixedEmergencyLivery|installSecondaryAccent/);

const monster = catalog.getCarDefinition('monster-truck');
assert.equal(monster.pack, 'toy');
assert.equal(monster.asset, './assets/cars/monster-truck.glb');
assert.equal(monster.secondaryPaint?.label, 'Suspension trim');
const monsterGlb = await fs.readFile(new URL('../../turn/assets/cars/monster-truck.glb', import.meta.url));
const monsterNative = readGlb(monsterGlb, monster.id);
const monsterJson = monsterNative.json;
assert.deepEqual(
  (monsterJson.images || []).map((image) => image.uri),
  ['Textures/colormap.png'],
  'Monster Truck must use the authored Kenney Toy/Prototype palette URI'
);
assert.deepEqual(
  (monsterJson.nodes || []).map((node) => node.name).filter(Boolean),
  ['wheel-bl', 'wheel-fr', 'wheel-fl', 'wheel-br', 'body'],
  'Monster Truck must preserve four independently addressable authored wheel nodes'
);
const monsterCells = triangleCellCounts(monsterNative, { flipV: false });
const monsterBody = mergeNodeCells(monsterCells, (name) => !/wheel/i.test(name));
const monsterWheels = mergeNodeCells(monsterCells, (name) => /wheel/i.test(name));
assert.ok(cellHits(monsterBody, [[7, 4], [7, 5]]) > 0,
  'Monster Truck primary body paint must intersect authored body triangles');
assert.ok(cellHits(monsterBody, [[1, 6], [1, 7]]) > 0,
  'Monster Truck secondary trim must intersect authored body triangles');
assert.ok(cellHits(monsterWheels, [[4, 7]]) > 0,
  'Monster Truck rim paint must intersect authored wheel triangles');
assert.match(semanticSource, /'monster-truck': profile\(\{[\s\S]*primary: \[\[7, 4\], \[7, 5\]\][\s\S]*secondary: \[\[1, 6\], \[1, 7\]\][\s\S]*rims: \[\[4, 7\]\]/,
  'Monster Truck semantic paint profile must follow its verified native palette cells');

await assert.rejects(
  fs.access(new URL('../../turn/vehicle/visual-upgrades.js', import.meta.url)),
  'The retired generated Rally Racer geometry module must stay deleted'
);
assert.match(kenneyLicense, /Creative Commons CC0 1\.0/);
assert.match(kenneyLicense, /Player paint is applied at render time to selected palette cells on the existing surfaces/);
assert.match(rgsdevLicense, /rgsdev\.itch\.io\/free-low-poly-vehicles-pack/);
assert.match(rgsdevLicense, /CC0/);

console.log(`TURN ${release.id} semantic native-surface contract passed with authored UV orientation and live paint-cell coverage.`);

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function readGlbJson(buffer, carId) {
  return readGlb(buffer, carId).json;
}

function readGlb(buffer, carId) {
  assert.equal(buffer.toString('utf8', 0, 4), 'glTF', `${carId} must remain a binary glTF`);
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.toString('utf8', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'JSON') json = JSON.parse(data.toString('utf8').trim());
    if (type === 'BIN\u0000') bin = data;
    offset += 8 + length;
  }
  assert.ok(json, `${carId} must contain a GLB JSON chunk`);
  assert.ok(bin, `${carId} must contain a GLB BIN chunk`);
  return { json, bin };
}

function triangleCellCounts(glb, { flipV }) {
  const output = new Map();
  for (const node of glb.json.nodes || []) {
    if (!Number.isInteger(node.mesh)) continue;
    const mesh = glb.json.meshes?.[node.mesh];
    if (!mesh) continue;
    const nodeName = String(node.name || mesh.name || `mesh-${node.mesh}`);
    const counts = new Map();
    for (const primitive of mesh.primitives || []) {
      const uvAccessor = primitive.attributes?.TEXCOORD_0;
      if (!Number.isInteger(uvAccessor)) continue;
      const uvs = readAccessor(glb, uvAccessor);
      const indices = Number.isInteger(primitive.indices)
        ? readAccessor(glb, primitive.indices).map((value) => value[0])
        : Array.from({ length: uvs.length }, (_, index) => index);
      for (let index = 0; index + 2 < indices.length; index += 3) {
        const a = uvs[indices[index]];
        const b = uvs[indices[index + 1]];
        const c = uvs[indices[index + 2]];
        if (!a || !b || !c) continue;
        const u = (a[0] + b[0] + c[0]) / 3;
        const rawV = (a[1] + b[1] + c[1]) / 3;
        const v = flipV ? 1 - rawV : rawV;
        const x = clampCell(Math.floor(u * 8), 8);
        const y = clampCell(Math.floor(v * 8), 8);
        const key = `${x},${y}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    output.set(nodeName, counts);
  }
  return output;
}

function readAccessor(glb, accessorIndex) {
  const accessor = glb.json.accessors?.[accessorIndex];
  assert.ok(accessor, `Missing accessor ${accessorIndex}`);
  const view = glb.json.bufferViews?.[accessor.bufferView];
  assert.ok(view, `Missing bufferView ${accessor.bufferView}`);
  const components = ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 })[accessor.type] || 1;
  const bytes = ({ 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 })[accessor.componentType];
  const stride = view.byteStride || components * bytes;
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const dataView = new DataView(glb.bin.buffer, glb.bin.byteOffset, glb.bin.byteLength);
  return Array.from({ length: accessor.count }, (_, index) => {
    const base = start + index * stride;
    return Array.from({ length: components }, (_, component) => (
      readComponent(dataView, base + component * bytes, accessor.componentType)
    ));
  });
}

function readComponent(view, offset, componentType) {
  switch (componentType) {
    case 5120: return view.getInt8(offset);
    case 5121: return view.getUint8(offset);
    case 5122: return view.getInt16(offset, true);
    case 5123: return view.getUint16(offset, true);
    case 5125: return view.getUint32(offset, true);
    case 5126: return view.getFloat32(offset, true);
    default: throw new Error(`Unsupported component type ${componentType}`);
  }
}

function mergeNodeCells(nodes, predicate) {
  const output = new Map();
  for (const [name, counts] of nodes) {
    if (!predicate(name)) continue;
    for (const [cell, count] of counts) output.set(cell, (output.get(cell) || 0) + count);
  }
  return output;
}

function cellHits(counts, cells) {
  return cells.reduce((sum, [x, y]) => sum + (counts.get(`${x},${y}`) || 0), 0);
}

function clampCell(value, grid) {
  return Math.max(0, Math.min(grid - 1, value));
}
