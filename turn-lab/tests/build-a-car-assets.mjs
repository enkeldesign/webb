import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PART_CATEGORIES,
  PARTS_BY_CATEGORY,
  isPartCombinationCompatible
} from '../build-a-car/parts-manifest.js';
import { createDefaultCustomCarBuild } from '../build-a-car/schema.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePaths = new Set();

for (const { id: category } of PART_CATEGORIES) {
  const choices = PARTS_BY_CATEGORY[category];
  assert.ok(choices.length >= 2, `${category} must expose meaningful prototype choice`);
  assert.equal(new Set(choices.map(({ id }) => id)).size, choices.length, `${category} IDs must be unique`);
  for (const part of choices) {
    assert.equal(part.family, 'kenney-compact', `${part.id} must use the one-family prototype envelope`);
    if (part.source) sourcePaths.add(part.source);
  }
}

const defaultBuild = createDefaultCustomCarBuild('2026-08-26T19:30:00.000Z');
assert.equal(isPartCombinationCompatible(defaultBuild.parts), true);
assert.equal(PARTS_BY_CATEGORY.wheels.length, 3);
assert.equal(PARTS_BY_CATEGORY.spoiler.length, 3, 'Spoilers must include NONE plus two extracted choices');
assert.equal(PARTS_BY_CATEGORY.roofAccessory.length, 3, 'Rare roof accessories must be part of the test library');

for (const source of sourcePaths) {
  const filePath = repositoryPath(source);
  const stat = await fs.stat(filePath);
  assert.ok(stat.size > 1000, `${source} must be a non-empty asset`);
  if (!source.endsWith('.glb')) continue;
  const json = readGlbJson(await fs.readFile(filePath));
  const nodeNames = new Set((json.nodes || []).map(({ name }) => name).filter(Boolean));
  const referenced = Object.values(PARTS_BY_CATEGORY)
    .flat()
    .filter((part) => part.source === source && part.node)
    .map((part) => part.node);
  for (const node of referenced) {
    assert.ok(nodeNames.has(node), `${source} must expose the declared ${node} node`);
  }
}

const assetReadme = await fs.readFile(path.join(repoRoot, 'turn-lab/assets/build-a-car/README.md'), 'utf8');
assert.match(assetReadme, /Kenney Car Kit 3\.1/);
assert.match(assetReadme, /Creative Commons CC0 1\.0 Universal/);
assert.match(assetReadme, /virtual geometry slices/);

console.log('TURN LAB BUILD-A-CAR manifest, compatibility, GLB node and CC0 source contracts passed.');

function repositoryPath(urlPath) {
  if (urlPath.startsWith('/turn-lab/')) return path.join(repoRoot, urlPath.slice(1));
  if (urlPath.startsWith('/turn/')) return path.join(repoRoot, urlPath.slice(1));
  throw new Error(`Unexpected BUILD-A-CAR asset URL: ${urlPath}`);
}

function readGlbJson(buffer) {
  assert.equal(buffer.toString('utf8', 0, 4), 'glTF', 'Asset must use the GLB container');
  let offset = 12;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    if (type === 0x4e4f534a) {
      return JSON.parse(buffer.subarray(offset + 8, offset + 8 + length).toString('utf8'));
    }
    offset += 8 + length;
  }
  throw new Error('GLB contains no JSON chunk.');
}
