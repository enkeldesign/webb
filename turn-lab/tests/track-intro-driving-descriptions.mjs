import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const turnDir = path.join(root, 'turn');
const [intro, definitions] = await Promise.all([
  fs.readFile(path.join(turnDir, 'ui/track-intro.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'tracks/definitions.js'), 'utf8')
]);

assert.match(intro, /track-intro-description/);
assert.match(intro, /`Driving: \$\{track\.description\}`/,
  'Track loading status should announce the driving-character description');
assert.match(intro, /role', 'status'/);
assert.match(intro, /aria-live', 'polite'/);
assert.match(intro, /aria-atomic', 'true'/);
assert.match(intro, /clip:rect\(0 0 0 0\)/,
  'Driving description should be available to assistive technology without adding visual loading-screen clutter');

for (const expected of [
  'Fast, flowing and forgiving.',
  'Runway speed. Apron precision.',
  'Linked curves. Mountain rhythm. Ocean flow.',
  'Switchbacks. Container canyons. Quayside speed.',
  'District avenues. Neon corners. A full-city endurance lap.'
]) {
  assert.ok(definitions.includes(expected), `Missing driving description: ${expected}`);
}
