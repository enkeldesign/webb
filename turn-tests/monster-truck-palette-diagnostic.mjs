import fs from 'node:fs/promises';

const buffer = await fs.readFile(new URL('../turn/assets/cars/monster-truck.glb', import.meta.url));
const glb = readGlb(buffer);
const json = glb.json;

console.log('images', JSON.stringify((json.images || []).map((image) => image.uri)));
console.log('materials', JSON.stringify((json.materials || []).map((material) => material.name)));
console.log('nodes');
for (const [index, node] of (json.nodes || []).entries()) {
  console.log(index, JSON.stringify({
    name: node.name || '',
    mesh: node.mesh,
    translation: node.translation || null,
    rotation: node.rotation || null,
    scale: node.scale || null
  }));
}

console.log('palette cells by node');
for (const [nodeName, cells] of triangleCellCounts(glb)) {
  console.log(nodeName, [...cells.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([cell, count]) => `${cell}:${count}`).join(' '));
}

function readGlb(source) {
  if (source.toString('utf8', 0, 4) !== 'glTF') throw new Error('Not a GLB');
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset + 8 <= source.length) {
    const length = source.readUInt32LE(offset);
    const type = source.toString('utf8', offset + 4, offset + 8);
    const data = source.subarray(offset + 8, offset + 8 + length);
    if (type === 'JSON') json = JSON.parse(data.toString('utf8').trim());
    if (type === 'BIN\u0000') bin = data;
    offset += 8 + length;
  }
  if (!json || !bin) throw new Error('Incomplete GLB');
  return { json, bin };
}

function triangleCellCounts(glb) {
  const output = new Map();
  for (const node of glb.json.nodes || []) {
    if (!Number.isInteger(node.mesh)) continue;
    const mesh = glb.json.meshes?.[node.mesh];
    if (!mesh) continue;
    const name = String(node.name || mesh.name || `mesh-${node.mesh}`);
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
        const v = (a[1] + b[1] + c[1]) / 3;
        const x = Math.max(0, Math.min(7, Math.floor(u * 8)));
        const y = Math.max(0, Math.min(7, Math.floor(v * 8)));
        const key = `${x},${y}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    output.set(name, counts);
  }
  return output;
}

function readAccessor(glb, accessorIndex) {
  const accessor = glb.json.accessors?.[accessorIndex];
  if (!accessor) throw new Error(`Missing accessor ${accessorIndex}`);
  const view = glb.json.bufferViews?.[accessor.bufferView];
  if (!view) throw new Error(`Missing bufferView ${accessor.bufferView}`);
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
