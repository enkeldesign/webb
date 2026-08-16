import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const main = fs.readFileSync(path.join(root, 'main.mjs'), 'utf8');
const foundation = fs.readFileSync(path.join(root, 'runtime', 'app-foundation.js'), 'utf8');
const skinFix = fs.readFileSync(path.join(root, 'runtime', 'skin-clone-fix.js'), 'utf8');

assert.match(main, /SkeletonUtils\.js/, 'Skinned characters need Three.js SkeletonUtils');
assert.match(main, /globalThis\.cloneSkeleton\s*=\s*cloneSkeleton_NS/);
const foundationIndex = main.indexOf('./runtime/app-foundation.js');
const fixIndex = main.indexOf('./runtime/skin-clone-fix.js');
const depotIndex = main.indexOf('./runtime/scene-depot.js');
assert.ok(foundationIndex >= 0 && fixIndex > foundationIndex && depotIndex > fixIndex,
  'Skin clone fix must load after asset setup and before depot workers are instantiated');

assert.match(skinFix, /obj\.isSkinnedMesh/);
assert.match(skinFix, /cloneSkeleton\(src\)/,
  'Skinned GLTFs must rebind skeletons instead of using Object3D.clone');
assert.match(skinFix, /updateMatrixWorld\(true\)/,
  'Bounding boxes must be measured from the rebound skeleton');

const models = [...foundation.matchAll(/\.\/assets\/kenney\/characters\/(character-(?:female|male)-[a-f]\.glb)/g)]
  .map(match => match[1]);
assert.equal(new Set(models).size, 9, 'All nine depot workers should use distinct Mini Character models');

for (const filename of new Set(models)) {
  const glbPath = path.join(root, 'assets', 'kenney', 'characters', filename);
  const glb = fs.readFileSync(glbPath);
  assert.equal(glb.toString('ascii', 0, 4), 'glTF');
  const jsonLength = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8').replace(/\0+$/g, ''));
  assert.ok((json.skins || []).length > 0, `${filename} should contain a skinned rig`);
}

console.log('POSTAL character rendering contract passed');
