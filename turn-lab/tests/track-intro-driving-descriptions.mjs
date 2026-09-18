import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { TRACK_DEFINITIONS } from '../../turn/tracks/definitions.js';

const intro = await fs.readFile(new URL('../../turn/ui/track-intro.js', import.meta.url), 'utf8');

assert.match(intro, /track-intro-description/);
assert.match(intro, /`Driving: \${track\.description}`/,
  'Track loading status should announce the active track description');
assert.match(intro, /setAttribute\('role', 'status'\)/);
assert.match(intro, /setAttribute\('aria-live', 'polite'\)/);
assert.match(intro, /setAttribute\('aria-atomic', 'true'\)/);
assert.match(intro, /clip:rect\(0 0 0 0\)/,
  'Driving description should remain available to assistive technology without visual loading-screen clutter');

const expectedDescriptions = new Map([
  ['countryside', 'Fast, flowing and forgiving.'],
  ['airport', 'Runway speed. Apron precision.'],
  ['cliffside', 'Linked curves. Mountain rhythm. Ocean flow.'],
  ['harbor', 'Switchbacks. Container canyons. Quayside speed.'],
  ['midnight-city', 'District avenues. Neon corners. A full-city endurance lap.'],
  ['mountain', 'Summit climb. Waterfall descent. Lake bridge. Valley lights.']
]);

assert.equal(TRACK_DEFINITIONS.length, expectedDescriptions.size,
  'Every production track must participate in the driving-description contract');
for (const track of TRACK_DEFINITIONS) {
  assert.equal(
    track.description,
    expectedDescriptions.get(track.id),
    `Unexpected or missing production driving description for ${track.id}`
  );
}

console.log('TURN track intro announces every exported production driving description.');
