import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const turnDir = path.join(root, 'turn');
const [mayday, wrapper] = await Promise.all([
  fs.readFile(path.join(turnDir, 'tracks/airport-emergency-r493.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'tracks/airport-emergency-r494.js'), 'utf8')
]);

assert.doesNotMatch(
  mayday,
  /if \(!wreckAircraft\) prepareWreckAircraft\(0\)/,
  'MAYDAY must never clone/measure the B787 synchronously in the crash reveal transition'
);
assert.match(
  mayday,
  /function revealCrashVisuals\(\)[\s\S]*else \{[\s\S]*startWreckPrewarm\(\)/,
  'If the B787 is still loading, crash reveal should keep prewarming instead of doing heavy finish-line work'
);
assert.match(
  mayday,
  /if \(runtime\.state\.vehicleId === AMBULANCE_ID\) \{\s*wreckPrepareTimer = globalThis\.setTimeout\(attempt, 250\)/,
  'Cold-install B787 polling must continue after MAYDAY has started'
);
assert.doesNotMatch(
  mayday,
  /if \(!session\.crashActive\) wreckPrepareTimer = globalThis\.setTimeout\(attempt, 250\)/,
  'Prewarm must not stop merely because the crash state became active'
);
assert.match(
  wrapper,
  /airport-emergency-r493\.js\?revision=r527-no-finish-sync-wreck/,
  'Production MAYDAY wrapper must request the finish-line performance fix under a fresh cache identity'
);
