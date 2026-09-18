import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testRoots = Object.freeze(['turn-tests', 'turn-lab/tests']);
const explicitExclusions = new Map([
  ['turn-lab/tests/portrait-centered-pad-lab.mjs',
    'TURN LAB portrait steering experiment; not a production contract and superseded by the responsive-design work.'],
  ['turn-lab/tests/portrait-play-lab.mjs',
    'TURN LAB portrait play experiment; not a production contract and superseded by the responsive-design work.'],
  ['turn-lab/tests/regression.mjs',
    'Legacy isolated TURN LAB race harness; current production race coverage lives in turn-tests/race-production.mjs.'],
  ['turn-tests/turn-next-world-production.mjs',
    'TURN NEXT WORLD is an isolated real-world map experiment, not part of the canonical TURN production contract.']
]);

async function collectMjs(relativeDirectory) {
  const absoluteDirectory = path.join(root, relativeDirectory);
  const entries = await fs.readdir(absoluteDirectory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const relative = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      result.push(...await collectMjs(relative));
    } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
      result.push(relative);
    }
  }
  return result;
}

const workflowDirectory = path.join(root, '.github/workflows');
const workflowNames = (await fs.readdir(workflowDirectory))
  .filter((name) => /^turn.*\.ya?ml$/.test(name))
  .sort();

const references = new Map();
for (const workflowName of workflowNames) {
  const source = await fs.readFile(path.join(workflowDirectory, workflowName), 'utf8');
  for (const match of source.matchAll(/(?:turn-tests|turn-lab\/tests)\/[A-Za-z0-9._/-]+\.mjs/g)) {
    const testPath = match[0];
    const owners = references.get(testPath) || [];
    owners.push(workflowName);
    references.set(testPath, owners);
  }
}

const tests = (await Promise.all(testRoots.map(collectMjs))).flat().sort();
const testSet = new Set(tests);

for (const [excludedPath, reason] of explicitExclusions) {
  assert.ok(reason.trim().length >= 20, `Excluded test needs a useful reviewed reason: ${excludedPath}`);
  assert.ok(testSet.has(excludedPath), `Explicitly excluded test no longer exists: ${excludedPath}`);
  assert.ok(!references.has(excludedPath),
    `Excluded test is now assigned to CI and should be removed from explicit exclusions: ${excludedPath}`);
}

const unclassified = tests.filter((testPath) =>
  !references.has(testPath) && !explicitExclusions.has(testPath)
);
assert.deepEqual(
  unclassified,
  [],
  `Every TURN production test must be assigned to a TURN workflow or explicitly excluded. Unclassified: ${unclassified.join(', ')}`
);

const missingReferences = [...references.keys()].filter((testPath) => !testSet.has(testPath));
assert.deepEqual(
  missingReferences,
  [],
  `TURN workflows reference missing test files: ${missingReferences.join(', ')}`
);

console.log(
  `TURN test inventory passed: ${tests.length - explicitExclusions.size} classified tests across ${workflowNames.length} workflows; ${explicitExclusions.size} reviewed TURN LAB exclusions.`
);
