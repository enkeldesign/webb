import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const catalogSource = await fs.readFile(new URL('../../turn/vehicle/catalog.js', import.meta.url), 'utf8');
const catalog = await import(`data:text/javascript;base64,${Buffer.from(catalogSource).toString('base64')}`);

const hatchback = catalog.getCarDefinition('sedan-sports');
const rally = catalog.getCarDefinition('toy-racer');
assert.equal(hatchback.name, 'Hatchback');
assert.equal(hatchback.asset, './assets/cars/hatchback-sports.glb');
assert.equal(hatchback.surfaceProfileId, 'hatchback-sports');
assert.equal(rally.name, 'Rally Racer');
assert.equal(rally.asset, './assets/cars/sedan-sports.glb');
assert.equal(rally.surfaceProfileId, 'sedan-sports-rally');

const hatchbackGlb = readGlb(
  await fs.readFile(new URL('../../turn/assets/cars/hatchback-sports.glb', import.meta.url)),
  'Hatchback'
);
const hatchbackCells = triangleCellCounts(hatchbackGlb);
assert.ok(cellHits(mergeNodeCells(hatchbackCells, (name) => !/wheel/i.test(name)), [[3, 2], [3, 3]]) > 0,
  'Hatchback body paint must intersect real body triangles');
assert.ok(cellHits(mergeNodeCells(hatchbackCells, (name) => !/wheel/i.test(name)), [[3, 4], [3, 5]]) > 0,
  'Hatchback sport trim must intersect real body triangles');
assert.ok(cellHits(mergeNodeCells(hatchbackCells, (name) => /wheel/i.test(name)), [[5, 4], [5, 5]]) > 0,
  'Hatchback primary rim paint must intersect real wheel triangles');

const rallyGlb = readGlb(
  await fs.readFile(new URL('../../turn/assets/cars/sedan-sports.glb', import.meta.url)),
  'Rally Racer'
);
const rallyCells = triangleCellCounts(rallyGlb);
const rallyBody = mergeNodeCells(rallyCells, (name) => name.toLowerCase() === 'body');
const rallySpoiler = mergeNodeCells(rallyCells, (name) => name.toLowerCase() === 'spoiler');
const rallyWheels = mergeNodeCells(rallyCells, (name) => /wheel/i.test(name));
assert.ok(cellHits(rallyBody, [[6, 2], [6, 3]]) > 0,
  'Rally Racer black body paint must intersect the former Sport Sedan body triangles');
assert.ok(cellHits(rallyBody, [[3, 4], [3, 5]]) > 0,
  'Rally Racer gold trim must intersect the former Sport Sedan trim triangles');
assert.ok(cellHits(rallySpoiler, [[6, 2], [6, 3]]) > 0,
  'Rally Racer gold spoiler override must intersect the authored spoiler triangles');
assert.ok(cellHits(rallyWheels, [[5, 4], [5, 5]]) > 0,
  'Rally Racer gold rim paint must intersect the authored wheel triangles');

console.log('TURN Hatchback and Rally Racer GLB-backed semantic surface contract passed.');

function readGlb(buffer, label) {
  assert.equal(buffer.toString('utf8', 0, 4), 'glTF', `${label} must remain a binary glTF`);
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
  assert.ok(json && bin, `${label} must contain JSON and BIN GLB chunks`);
  return { json, bin };
}

function triangleCellCounts(glb) {
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
        const x = clampCell(Math.floor(((a[0] + b[0] + c[0]) / 3) * 8));
        const y = clampCell(Math.floor(((a[1] + b[1] + c[1]) / 3) * 8));
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

function clampCell(value) {
  return Math.max(0, Math.min(7, value));
}
