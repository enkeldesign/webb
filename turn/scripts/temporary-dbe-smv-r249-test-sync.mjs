import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const path = new URL('../../turn-tests/drive-by-ear-training-production.mjs', import.meta.url);
let source = await fs.readFile(path, 'utf8');
const from = `assert.match(\n  index,\n  /"\\/turn\\/training\\/drive-by-ear-training\\.js\\?build=20260817-r172-r151-dbe-training-device-fixes": "\\/turn\\/training\\/drive-by-ear-training\\.js\\?build=20260905-r201&revision=r241-learning-achievements"/,\n  'Production must map the established training import to the learning-achievement module identity'\n);\n`;
const first = source.indexOf(from);
assert.notEqual(first, -1, 'Missing stale DBE training import assertion');
assert.equal(source.indexOf(from, first + from.length), -1, 'Duplicate stale DBE training import assertion');
source = source.slice(0, first) + source.slice(first + from.length);
await fs.writeFile(path, source);
console.log('Removed the stale fixed DBE training import expectation.');
