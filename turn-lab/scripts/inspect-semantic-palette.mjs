import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const PROFILES = Object.freeze({
  classic: profile({ primary: [[4, 4], [4, 5]], secondary: [[1, 6], [1, 7]], rims: [[4, 6], [4, 7]] }),
  truck: profile({ primary: [[3, 2], [3, 3]], secondary: [[3, 4], [3, 5]], rims: [[5, 4], [5, 5]] }),
  sedan: profile({ primary: [[6, 2], [6, 3]], secondary: [[3, 4], [3, 5]], rims: [[5, 4], [5, 5]] }),
  van: profile({ primary: [[7, 2], [7, 3]], secondary: [[3, 4], [3, 5]], rims: [[5, 4], [5, 5]] }),
  suv: profile({ primary: [[3, 2], [3, 3]], secondary: [[3, 4], [3, 5]], rims: [[5, 4], [5, 5]] }),
  convertible: profile({ primary: [[2, 4], [2, 5]], secondary: [[1, 6], [1, 7]], rims: [[4, 6], [4, 7]] }),
  'sedan-sports': profile({
    primary: [[6, 2], [6, 3]], secondary: [[3, 4], [3, 5]], rims: [[5, 4], [5, 5]], secondaryPrimaryNodes: ['spoiler']
  }),
  race: profile({ primary: [[6, 2], [6, 3]], secondary: [[3, 4], [3, 5]], rims: [[4, 2], [4, 3]] }),
  'vintage-racer': profile({
    primary: [[7, 4], [7, 5]], secondary: [[1, 6], [1, 7]], rims: [[4, 6], [4, 7]], secondaryNodes: ['vehicle-vintage-racer']
  }),
  'race-future': profile({
    primary: [[7, 2], [7, 3]], secondary: [[3, 4], [3, 5]], rims: [[4, 2], [4, 3]], secondaryNodes: ['body']
  }),
  'toy-racer': profile({
    primary: [[1, 4], [1, 5]], secondary: [[1, 6], [1, 7]], rims: [[4, 6], [4, 7]], secondaryNodes: ['vehicle-racer'], rimRole: 'secondary'
  })
});

const carIds = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(PROFILES);
for (const carId of carIds) {
  const profileData = PROFILES[carId];
  if (!profileData) throw new Error(`No semantic profile for ${carId}`);
  const glb = readGlb(await fs.readFile(new URL(`../../turn/assets/cars/${carId}.glb`, import.meta.url)));
  const authored = semanticHits(glb, profileData, false);
  const doubleFlipped = semanticHits(glb, profileData, true);

  console.log(
    `${carId}: authored primary=${authored.primary} secondary=${authored.secondary} rims=${authored.rims}`
    + ` | double-flipped primary=${doubleFlipped.primary} secondary=${doubleFlipped.secondary} rims=${doubleFlipped.rims}`
  );

  assert.ok(authored.primary > 0, `${carId} primary masks must hit authored GLB triangles`);
  assert.ok(authored.secondary > 0, `${carId} secondary masks must hit authored GLB triangles`);
  assert.ok(authored.rims > 0, `${carId} rim masks must hit authored wheel triangles`);
}

function semanticHits(glb, semanticProfile, flipV) {
  const totals = { primary: 0, secondary: 0, rims: 0 };
  for (const node of glb.json.nodes || []) {
    if (!Number.isInteger(node.mesh)) continue;
    const mesh = glb.json.meshes?.[node.mesh];
    if (!mesh) continue;
    const name = String(node.name || mesh.name || '').toLowerCase();
    const counts = triangleCellCounts(glb, mesh, flipV);
    const wheel = /wheel/.test(name);
    if (wheel) {
      totals.rims += cellHits(counts, semanticProfile.rims);
      continue;
    }
    if (semanticProfile.secondaryPrimaryNodes.includes(name)) {
      totals.secondary += cellHits(counts, semanticProfile.primary);
      continue;
    }
    totals.primary += cellHits(counts, semanticProfile.primary);
    if (semanticProfile.secondaryNodes.length === 0 || semanticProfile.secondaryNodes.includes(name)) {
      totals.secondary += cellHits(counts, semanticProfile.secondary);
    }
  }
  return totals;
}

function triangleCellCounts(glb, mesh, flipV) {
  const counts = new Map();
  for (const primitive of mesh.primitives || []) {
    const uvAccessor = primitive.attributes?.TEXCOORD_0;
    if (!Number.isInteger(uvAccessor)) continue;
    const uvs = readAccessor(glb.json, glb.bin, uvAccessor);
    const indices = Number.isInteger(primitive.indices)
      ? readAccessor(glb.json, glb.bin, primitive.indices).map((value) => value[0])
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
  return counts;
}

function cellHits(counts, cells) {
  return cells.reduce((sum, [x, y]) => sum + (counts.get(`${x},${y}`) || 0), 0);
}

function profile({ primary, secondary, rims, secondaryNodes = [], secondaryPrimaryNodes = [], rimRole = 'primary' }) {
  return Object.freeze({
    primary,
    secondary,
    rims,
    secondaryNodes: secondaryNodes.map((name) => name.toLowerCase()),
    secondaryPrimaryNodes: secondaryPrimaryNodes.map((name) => name.toLowerCase()),
    rimRole
  });
}

function clampCell(value, grid) {
  return Math.max(0, Math.min(grid - 1, value));
}

function readGlb(buffer) {
  if (buffer.toString('utf8', 0, 4) !== 'glTF') throw new Error('Not a GLB');
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
  if (!json || !bin) throw new Error('GLB is missing JSON or BIN chunk');
  return { json, bin };
}

function readAccessor(json, bin, accessorIndex) {
  const accessor = json.accessors?.[accessorIndex];
  if (!accessor) throw new Error(`Missing accessor ${accessorIndex}`);
  const view = json.bufferViews?.[accessor.bufferView];
  if (!view) throw new Error(`Missing bufferView ${accessor.bufferView}`);
  const components = ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 })[accessor.type] || 1;
  const componentBytes = ({ 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 })[accessor.componentType];
  const stride = view.byteStride || components * componentBytes;
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const dataView = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  return Array.from({ length: accessor.count }, (_, index) => {
    const base = start + index * stride;
    return Array.from({ length: components }, (_, component) => {
      const offset = base + component * componentBytes;
      switch (accessor.componentType) {
        case 5120: return dataView.getInt8(offset);
        case 5121: return dataView.getUint8(offset);
        case 5122: return dataView.getInt16(offset, true);
        case 5123: return dataView.getUint16(offset, true);
        case 5125: return dataView.getUint32(offset, true);
        case 5126: return dataView.getFloat32(offset, true);
        default: throw new Error(`Unsupported component type ${accessor.componentType}`);
      }
    });
  });
}
