import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const path = new URL('./release.mjs', import.meta.url);
let source = await fs.readFile(path, 'utf8');
const from = `  synchronizeAchievementProgressionTargets(importMap, release);\n  synchronizePlatformContextTarget(importMap, release);\n  synchronizePerkFeedbackTargets(importMap, release);`;
const to = `  synchronizeAchievementProgressionTargets(importMap, release);\n  synchronizePlatformContextTarget(importMap, release);\n  synchronizeDriveByEarTrainingTargets(importMap, release);\n  synchronizePerkFeedbackTargets(importMap, release);`;
const first = source.indexOf(from);
assert.notEqual(first, -1, 'Missing production runtime DBE synchronization insertion point');
assert.equal(source.indexOf(from, first + from.length), -1, 'Duplicate production runtime DBE synchronization insertion point');
source = source.slice(0, first) + to + source.slice(first + from.length);
await fs.writeFile(path, source);
console.log('Added release-bound DBE training target to production runtime synchronization.');
