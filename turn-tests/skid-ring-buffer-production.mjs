import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../postal/vendor/three.module.min.js';
import { installAssetWheelRig } from '../turn/vehicle/wheel-animation-rig.js';

const [releaseSource, index, labIndex, main, continuity] = await Promise.all([
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-lab/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/render/skid-continuity-r198.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));
assert.match(index, new RegExp(`render/skid-continuity-r198\\.js\\?revision=r198-skid-continuity&build=${release.cacheKey}`),
  'Production TURN must load the fresh skid continuity renderer');
assert.match(labIndex, new RegExp(`render/skid-continuity-r198\\.js\\?revision=r198-skid-continuity&build=${release.cacheKey}`),
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

const ringSection = section(main, 'function pushSkidSample', '\nfunction updateHud');
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
assert.match(continuity, /runtime\.scene\.onBeforeRender = function skidFrame/,
  'Skids must update before Three uploads geometry, using the existing render loop');
assert.doesNotMatch(continuity, /requestAnimationFrame|setAnimationLoop|setInterval|setTimeout/,
  'The continuity fix must not add another timer or animation loop');

// Execute the real renderer against the authored wheel rig. Fixed rear offsets
// and a late line callback both fail the current-frame endpoint assertions.
const events = new Map();
const { installSkidContinuity } = vm.runInNewContext(
  continuity.replace(/^import .*;$/m, '').replace('export function', 'function')
    + '\n({ installSkidContinuity })',
  { THREE, console, addEventListener: (type, callback) => events.set(type, callback) }
);
const scene = new THREE.Scene(), world = new THREE.Group(), car = new THREE.Group();
scene.add(world); world.add(car);
const legacy = new THREE.LineSegments(
  new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(1080), 3)),
  new THREE.LineBasicMaterial({ transparent: true, opacity: 0.52 })
);
legacy.frustumCulled = false; world.add(legacy);
const state = { running: true, position: new THREE.Vector3(), speed: 70, driftAmount: 0.8, nearestTrackIndex: 0 };
const sample = { tangent: new THREE.Vector3(0, 0.35, 1).normalize(), normal: new THREE.Vector3(-1, -0.2, 0) };
let chainedFrames = 0;
scene.onBeforeRender = () => { chainedFrames++; };
const skids = installSkidContinuity({ scene, world, playerCar: car, state, samples: [sample] });
assert.equal(installSkidContinuity(), skids, 'Installing twice must reuse the existing renderer');
assert.equal(legacy.visible, false);
const buffer = skids.line.geometry.attributes.position.array;
const center = new THREE.Vector3();
let frames = 0;
function renderFrame() {
  car.position.copy(state.position);
  scene.updateMatrixWorld(true);
  scene.onBeforeRender(null, scene, null, null);
  frames++;
  assert.equal(skids.line.geometry.attributes.position.array, buffer, 'Motion must reuse the fixed GPU buffer');
}

for (const [width, axle, scale, reversed] of [[2.5, 3.2, 0.8, false], [4, 2.6, 1.2, true], [2, 4.5, 1.1, false]]) {
  car.clear();
  const model = new THREE.Group(), rearWheels = [];
  model.scale.setScalar(scale);
  car.add(model);
  for (const side of [-1, 1]) for (const front of [true, false]) {
    const wheel = new THREE.Group();
    const role = front !== reversed ? 'front' : 'back';
    wheel.name = `wheel-${role}-${side < 0 ? 'left' : 'right'}`;
    wheel.position.set(side * width / 2, 0.6, (front ? -1 : 1) * axle / 2);
    model.add(wheel);
    if (!front) rearWheels.push(wheel);
  }
  Object.assign(car.userData, installAssetWheelRig({ model, frontRole: reversed ? 'back' : 'front', createGroup: () => new THREE.Group() }));
  skids.clear();
  for (let frame = 0; frame < 100; frame++) {
    state.position.set(frame * 0.4, 0, frame * 4);
    state.position.y = state.position.z * 0.35 + state.position.x * 0.2 + 0.18;
    car.rotation.set(0.2, Math.PI + frame * 0.03, 0.08);
    renderFrame();
    if (frame === 0) continue;
    assert.ok(skids.line.geometry.drawRange.count >= 4 && skids.line.geometry.drawRange.count <= 120);
    for (let wheel = 0; wheel < 2; wheel++) {
      center.setFromMatrixPosition(rearWheels[wheel].matrixWorld);
      const offset = wheel * 6;
      assert.ok(Math.abs(buffer[offset] - center.x) < 0.0001 && Math.abs(buffer[offset + 2] - center.z) < 0.0001,
        'This frame must start each skid at the actual rear wheel, including model size, drift heading and body roll');
      const clearance = (buffer[offset + 1] - buffer[offset + 2] * 0.35 - buffer[offset] * 0.2 - 0.18) / Math.hypot(1, 0.35, 0.2);
      assert.ok(Math.abs(clearance - 0.01) < 0.0001, 'Wheel marks follow slope and banking at a tiny surface offset');
    }
  }
}
assert.equal(chainedFrames, frames, 'The existing scene callback still runs exactly once per render');
const priorStroke = buffer.slice(0, 12);
state.driftAmount = 0;
renderFrame();
state.driftAmount = 0.8;
state.position.z += 8;
renderFrame();
assert.deepEqual(buffer.slice(0, 12), priorStroke, 'Resuming a drift must preserve old strokes without bridging across the grip interval');
state.position.z += 100;
renderFrame();
assert.equal(skids.line.geometry.drawRange.count, 0, 'A teleport starts a new stroke instead of joining distant wheel positions');
events.get('turn:track-changed')();
assert.equal(skids.line.geometry.drawRange.count, 0);
state.running = false;
renderFrame();
assert.equal(skids.line.geometry.drawRange.count, 0, 'Returning Home clears visible tracks');

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
