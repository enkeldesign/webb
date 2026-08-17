import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const turnDir = path.join(root, 'turn');
const [presentation, airportWorld] = await Promise.all([
  fs.readFile(path.join(turnDir, 'tracks/airport-emergency-presentation-r523.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'tracks/airport-world-r56.js'), 'utf8')
]);

assert.match(
  airportWorld,
  /airport-emergency-presentation-r523\.js\?revision=r523-standard-toast-longer-guidance/,
  'Airport must load the MAYDAY presentation correction under a fresh cache identity'
);

assert.match(
  presentation,
  /turn-achievement-toast\.\$\{MAYDAY_TOAST_CLASS\}/,
  'MAYDAY completion must explicitly normalize the old one-off achievement toast class'
);
assert.match(
  presentation,
  /classList\.remove\(MAYDAY_TOAST_CLASS\)/,
  'MAYDAY completion should fall back to the shared achievement toast appearance and position'
);
assert.match(presentation, /crash: 5200/);
assert.match(presentation, /pickup: 6500/);
assert.match(presentation, /retry: 5200/);
assert.match(presentation, /resolved: 3200/);
assert.match(
  presentation,
  /MutationObserver[\s\S]*attributeFilter: \['hidden'\]/,
  'The existing MAYDAY status plate should remain continuously exposed for the longer reading window'
);
assert.doesNotMatch(
  presentation,
  /background:\s*var\(--turn-action-danger/,
  'The correction must not create a second special achievement-toast style'
);
