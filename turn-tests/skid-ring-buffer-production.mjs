import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [releaseSource, index, main] = await Promise.all([
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));

const declarations = section(main, 'const SKID_HISTORY_CAPACITY', '\nconst smokePool');
assert.match(declarations, /SKID_HISTORY_CAPACITY = 90/, 'Skid history must preserve the previous 90 sample pairs');
assert.match(declarations, /SKID_WHEEL_COUNT = 2/, 'Skid history must preserve left and right wheel tracks');
assert.match(declarations, /SKID_COMPONENT_COUNT = 3/, 'Each stored wheel point must retain x, y and z');
assert.match(declarations, /SKID_MAX_DRAW_VERTICES = 120/, 'The visible skid budget must remain capped at 120 vertices');
assert.match(declarations, /new Float32Array\(SKID_HISTORY_CAPACITY \* SKID_SAMPLE_STRIDE\)/, 'History must use one fixed typed allocation');
assert.match(declarations, /let skidHistoryStart = 0/);
assert.match(declarations, /let skidHistoryCount = 0/);
assert.match(declarations, /const skidLateral = new THREE\.Vector3\(\)/, 'Drift geometry must reuse scratch vectors');
assert.match(declarations, /const skidRearCenter = new THREE\.Vector3\(\)/);
assert.match(declarations, /const skidLeftWheel = new THREE\.Vector3\(\)/);
assert.match(declarations, /const skidRightWheel = new THREE\.Vector3\(\)/);
assert.doesNotMatch(declarations, /const skidHistory = \[\]/, 'The allocating array history must stay retired');

const ringSection = section(main, 'function pushSkidSample', '\nconst mapBounds');
assert.match(ringSection, /skidHistoryStart = \(skidHistoryStart - 1 \+ SKID_HISTORY_CAPACITY\) % SKID_HISTORY_CAPACITY/, 'New samples must wrap through fixed storage');
assert.match(ringSection, /skidHistoryCount = Math\.min\(SKID_HISTORY_CAPACITY, skidHistoryCount \+ 1\)/, 'History count must never exceed its allocation');
assert.match(ringSection, /for \(let component = 0; component < SKID_SAMPLE_STRIDE; component \+= 1\)/, 'Straight sections must duplicate the latest sample without allocating points');
assert.match(ringSection, /const sampleIndex = \(skidHistoryStart \+ sampleOffset\) % SKID_HISTORY_CAPACITY/, 'Rendering must read newest-to-oldest through the ring');
assert.match(ringSection, /state\.driftAmount > 0\.34 && state\.speed > 21/, 'The existing skid activation thresholds must remain unchanged');
assert.match(ringSection, /addScaledVector\(getForward\(\), -2\.0\)/, 'The rear axle position must remain two units behind the car');
assert.match(ringSection, /addScaledVector\(skidLateral, -1\.25\)/, 'The left wheel offset must remain unchanged');
assert.match(ringSection, /addScaledVector\(skidLateral, 1\.25\)/, 'The right wheel offset must remain unchanged');
assert.match(ringSection, /skidLeftWheel\.y = state\.position\.y \+ 0\.05/, 'The left skid must remain five centimetres above the current road surface');
assert.match(ringSection, /skidRightWheel\.y = state\.position\.y \+ 0\.05/, 'The right skid must remain five centimetres above the current road surface');
assert.doesNotMatch(ringSection, /\.setY\(0\.23\)/, 'Skids may no longer be pinned to flat world height');
assert.match(ringSection, /cursor < SKID_MAX_DRAW_VERTICES/, 'Rendering must keep the existing visible vertex ceiling');
assert.match(ringSection, /skidGeometry\.attributes\.position\.needsUpdate = true/);
assert.match(ringSection, /skidGeometry\.setDrawRange\(0, cursor\)/);
assert.doesNotMatch(ringSection, /\.clone\(\)|\.unshift\(|\.map\(/, 'The skid update path must allocate no vectors or small history arrays');
assert.doesNotMatch(ringSection, /requestAnimationFrame|setAnimationLoop|setInterval|setTimeout/, 'The ring buffer must remain inside the existing scene update');

const simulation = createRingSimulation(3);
simulation.push([1, 2, 3, 4, 5, 6]);
simulation.push([7, 8, 9, 10, 11, 12]);
simulation.repeat();
assert.deepEqual(simulation.samples(), [
  [7, 8, 9, 10, 11, 12],
  [7, 8, 9, 10, 11, 12],
  [1, 2, 3, 4, 5, 6]
], 'Straight continuation must repeat the latest pair while preserving chronological order');
simulation.push([13, 14, 15, 16, 17, 18]);
assert.deepEqual(simulation.samples(), [
  [13, 14, 15, 16, 17, 18],
  [7, 8, 9, 10, 11, 12],
  [7, 8, 9, 10, 11, 12]
], 'A full ring must overwrite only the oldest sample');

console.log(`TURN ${release.id} fixed skid history ring buffer passed.`);

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

function createRingSimulation(capacity) {
  const stride = 6;
  const values = new Float32Array(capacity * stride);
  let start = 0;
  let count = 0;

  function insert(sample) {
    start = (start - 1 + capacity) % capacity;
    values.set(sample, start * stride);
    count = Math.min(capacity, count + 1);
  }

  return {
    push(sample) {
      insert(sample);
    },
    repeat() {
      if (!count) return;
      const latest = Array.from(values.slice(start * stride, start * stride + stride));
      insert(latest);
    },
    samples() {
      return Array.from({ length: count }, (_, offset) => {
        const slot = (start + offset) % capacity;
        return Array.from(values.slice(slot * stride, slot * stride + stride));
      });
    }
  };
}
