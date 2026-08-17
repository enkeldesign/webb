import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const handoff = await fs.readFile(
  path.join(root, 'turn/ui/startup-screen-reader-handoff-r529.js'),
  'utf8'
);
const index = await fs.readFile(path.join(root, 'turn/index.html'), 'utf8');

assert.match(handoff, /document\.addEventListener\('turn:home-ready'/,
  'The ready announcement must use TURN\'s established Home-ready lifecycle event');
assert.match(handoff, /status\.setAttribute\('role', 'status'\)/);
assert.match(handoff, /status\.setAttribute\('aria-live', 'polite'\)/);
assert.match(handoff, /status\.setAttribute\('aria-atomic', 'true'\)/);
assert.match(handoff, /document\.body\.appendChild\(status\)/,
  'The completion live region must persist outside the startup gate that gets hidden');
assert.match(handoff, /TURN is ready\. Rotate your device to landscape\./,
  'Portrait startup must announce both completion and the required orientation action');
assert.match(handoff, /: 'TURN is ready\.';/,
  'Landscape startup should announce completion without an unnecessary rotate instruction');
assert.match(handoff, /height > width/,
  'Orientation guidance should be based on the live viewport rather than assumed from device type');
assert.match(index, /startup-screen-reader-handoff-r529\.js\?revision=r529-ready-orientation/,
  'Production TURN must load the cache-revised startup handoff before app startup');
