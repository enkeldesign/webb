import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

async function replaceIn(relativePath, search, replacement) {
  const filePath = path.join(root, relativePath);
  const source = await fs.readFile(filePath, 'utf8');
  const matches = source.split(search).length - 1;
  assert.equal(matches, 1, `${relativePath} must contain exactly one M8 badge assertion to update.`);
  await fs.writeFile(filePath, source.replace(search, replacement));
}

await replaceIn(
  'turn-tests/platform-production.mjs',
  'Platform M5–M8 · Motion \\+ Display \\+ Session Lifecycle',
  'Platform M5–M8 · Motion \\+ Display \\+ Session \\+ Home'
);
await replaceIn(
  'turn-tests/motion-safe-zone-production.mjs',
  'Platform M5–M8 · Motion \\+ Display \\+ Session Lifecycle',
  'Platform M5–M8 · Motion \\+ Display \\+ Session \\+ Home'
);
await replaceIn(
  'turn-tests/session-orchestrator-production.mjs',
  "console.log('TURN NEXT Platform M7 race-session orchestration passed.');",
  "console.log('TURN NEXT Platform M7–M8 race-session orchestration passed.');"
);

console.log('Finished TURN NEXT M8 test vocabulary.');
