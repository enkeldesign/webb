import fs from 'node:fs/promises';

const GRID_SIZES = [8, 16];
const TARGETS = Object.freeze({
  classic: Object.freeze({
    primary: [[4, 4], [4, 5]],
    secondary: [[1, 6], [1, 7]],
    rims: [[4, 6], [4, 7]]
  })
});

for (const carId of process.argv.slice(2).length ? process.argv.slice(2) : ['classic']) {
  const file = new URL(`../../turn/assets/cars/${carId}.glb`, import.meta.url);
  const glb = await fs.readFile(file);
  const { json, bin } = readGlb(glb);
  const target = TARGETS[carId] || null;

  console.log(`SEMANTIC UV DIAGNOSTIC ${carId}`);
  for (const grid of GRID_SIZES) {
    console.log(`GRID ${grid}x${grid}`);
    for (const node of json.nodes || []) {
      if (!Number.isInteger(node.mesh)) continue;
      const mesh = json.meshes?.[node.mesh];
      if (!mesh) continue;
      const counts = new Map();
      let triangles = 0;
      for (const primitive of mesh.primitives || []) {
        const uvAccessor = primitive.attributes?.TEXCOORD_0;
        if (!Number.isInteger(uvAccessor)) continue;
        const uvs = readAccessor(json, bin, uvAccessor);
        const indices = Number.isInteger(primitive.indices)
          ? readAccessor(json, bin, primitive.indices).map((value) => value[0])
          : Array.from({ length: uvs.length }, (_, index) => index);
        for (let index = 0; index + 2 < indices.length; index += 3) {
          const a = uvs[indices[index]];
          const b = uvs[indices[index + 1]];
          const c = uvs[indices[index + 2]];
          if (!a || !b || !c) continue;
          const u = (a[0] + b[0] + c[0]) / 3;
          const v = (a[1] + b[1] + c[1]) / 3;
          const x = clampCell(Math.floor(u * grid), grid);
          const y = clampCell(Math.floor((1 - v) * grid), grid);
          const key = `${x},${y}`;
          counts.set(key, (counts.get(key) || 0) + 1);
          triangles += 1;
        }
      }
      const top = [...counts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 16)
        .map(([cell, count]) => `${cell}:${count}`)
        .join(' ');
      console.log(`  ${node.name || mesh.name || `mesh-${node.mesh}`} triangles=${triangles} cells=${top}`);

      if (grid === 8 && target) {
        const wheel = /wheel/i.test(node.name || mesh.name || '');
        const roles = wheel
          ? [['rims', target.rims]]
          : [['primary', target.primary], ['secondary', target.secondary]];
        for (const [role, cells] of roles) {
          const hits = cells.reduce((sum, [x, y]) => sum + (counts.get(`${x},${y}`) || 0), 0);
          console.log(`    CURRENT ${role} ${cells.map(([x, y]) => `${x},${y}`).join('|')} hits=${hits}`);
        }
      }
    }
  }
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
  const components = componentCount(accessor.type);
  const componentBytes = bytesPerComponent(accessor.componentType);
  const stride = view.byteStride || components * componentBytes;
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const dataView = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  return Array.from({ length: accessor.count }, (_, index) => {
    const base = start + index * stride;
    return Array.from({ length: components }, (_, component) => (
      readComponent(dataView, base + component * componentBytes, accessor.componentType)
    ));
  });
}

function componentCount(type) {
  return ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 })[type] || 1;
}

function bytesPerComponent(componentType) {
  return ({ 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 })[componentType];
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
