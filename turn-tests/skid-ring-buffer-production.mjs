import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [releaseSource, index, labIndex, main, continuity] = await Promise.all([
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-lab/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/render/skid-continuity-r198.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));
assert.match(index, /render\/skid-continuity-r198\.js\?revision=r198-skid-continuity/,
  'Production TURN must load the fresh skid continuity renderer');
assert.match(labIndex, /render\/skid-continuity-r198\.js\?revision=r198-skid-continuity/,
  'TURN LAB must exercise the same skid continuity renderer as production');

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

assert.match(continuity, /legacySkidLine\.visible = false/,
  'The old renderer must be hidden so the corrected geometry is the only visible skid layer');
assert.match(continuity, /new Uint8Array\(SKID_HISTORY_CAPACITY\)/,
  'Continuity must be stored in a fixed allocation alongside the existing ring-buffer model');
assert.match(continuity, /skidHistoryConnections\[skidHistoryStart\] = connectToPrevious \? 1 : 0/,
  'Every new skid sample must explicitly declare whether it connects to the previous sample');
assert.match(continuity, /skidHistoryConnections\[skidHistoryStart\] = 0/,
  'Non-skidding frames must age the history without creating a drawable connection');
assert.match(continuity, /const connectToPrevious = skidStrokeActive/,
  'A new skid stroke must not connect back to an older stroke after grip returns');
assert.match(continuity, /latestSkidDistanceSquared\(0, skidLeftWheel\) <= SKID_MAX_CONTINUOUS_GAP_SQUARED/,
  'Even an active skid must reject an implausibly large position jump');
assert.match(continuity, /if \(!skidHistoryConnections\[sampleIndex\]\) continue/,
  'Rendering must skip breaks instead of drawing across them');
assert.match(continuity, /clearIfCarJumped\(\)/,
  'Track, training-part and restart teleports must clear stale skid history before repainting');
assert.match(continuity, /addEventListener\('turn:track-changed', clearSkids\)/,
  'Changing tracks must clear skid history immediately');
assert.match(continuity, /event\.detail\?\.reason === 'race-reset'/,
  'Restarting a race must clear skid history immediately');
assert.match(continuity, /skidLine\.onBeforeRender = updateSkids/,
  'The corrected renderer must stay inside the existing render loop rather than adding another animation loop');
assert.doesNotMatch(continuity, /requestAnimationFrame|setAnimationLoop|setInterval|setTimeout/,
  'The continuity fix must not add another timer or animation loop');

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

const continuitySimulation = createContinuitySimulation(6);
const a = [1, 1, 1, 2, 2, 2];
const b = [3, 3, 3, 4, 4, 4];
const c = [20, 20, 20, 21, 21, 21];
const d = [22, 22, 22, 23, 23, 23];
continuitySimulation.push(a, false);
continuitySimulation.push(b, true);
continuitySimulation.repeatGap();
continuitySimulation.push(c, false);
continuitySimulation.push(d, true);
assert.deepEqual(continuitySimulation.segments(), [
  [d, c],
  [b, a]
], 'Separate skid bursts must remain visible as separate strokes without a bridge across the gap');

console.log(`TURN ${release.id} fixed skid history and continuity regression passed.`);

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

function createContinuitySimulation(capacity) {
  const values = Array.from({ length: capacity }, () => null);
  const connections = new Uint8Array(capacity);
  let start = 0;
  let count = 0;

  function insert(sample, connected) {
    start = (start - 1 + capacity) % capacity;
    values[start] = sample;
    connections[start] = connected ? 1 : 0;
    count = Math.min(capacity, count + 1);
  }

  return {
    push(sample, connected) {
      insert(sample, connected);
    },
    repeatGap() {
      if (!count) return;
      insert(values[start], false);
    },
    segments() {
      const segments = [];
      for (let offset = 0; offset < count - 1; offset += 1) {
        const current = (start + offset) % capacity;
        const previous = (start + offset + 1) % capacity;
        if (!connections[current]) continue;
        segments.push([values[current], values[previous]]);
      }
      return segments;
    }
  };
}
