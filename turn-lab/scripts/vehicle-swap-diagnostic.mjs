import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

for (const name of ['hatchback-sports', 'sedan-sports']) {
  const buffer = await fs.readFile(new URL(`../../turn/assets/cars/${name}.glb`, import.meta.url));
  const glb = readGlb(buffer, name);
  console.log(`\n${name}`);
  const cells = triangleCellCounts(glb);
  for (const [nodeName, counts] of cells) {
    console.log(nodeName, [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20));
  }
}

function readGlb(buffer, id) {
  assert.equal(buffer.toString('utf8', 0, 4), 'glTF', `${id} must be GLB`);
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
  assert.ok(json && bin);
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
  assert.ok(accessor);
  const view = glb.json.bufferViews?.[accessor.bufferView];
  assert.ok(view);
  const components = ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 })[accessor.type] || 1;
  const bytes = ({ 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 })[accessor.componentType];
  const stride = view.byteStride || components * bytes;
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const dataView = new DataView(glb.bin.buffer, glb.bin.byteOffset, glb.bin.byteLength);
  return Array.from({ length: accessor.count }, (_, index) => {
    const base = start + index * stride;
    return Array.from({ length: components }, (_, component) => readComponent(dataView, base + component * bytes, accessor.componentType));
  });
}

function readComponent(view, offset, type) {
  switch (type) {
    case 5120: return view.getInt8(offset);
    case 5121: return view.getUint8(offset);
    case 5122: return view.getInt16(offset, true);
    case 5123: return view.getUint16(offset, true);
    case 5125: return view.getUint32(offset, true);
    case 5126: return view.getFloat32(offset, true);
    default: throw new Error(`Unsupported component type ${type}`);
  }
}

function clampCell(value) {
  return Math.max(0, Math.min(7, value));
}
