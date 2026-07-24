import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const mainUrl = new URL('../main.js', import.meta.url);
let source = await fs.readFile(mainUrl, 'utf8');

source = replaceExactlyOnce(
  source,
  `const skidGeometry = new THREE.BufferGeometry();
const skidPositions = new Float32Array(360 * 3);
skidGeometry.setAttribute('position', new THREE.BufferAttribute(skidPositions, 3));
const skidLine = new THREE.LineSegments(
  skidGeometry,
  new THREE.LineBasicMaterial({ color: 0x08090a, transparent: true, opacity: 0.52 })
);
skidLine.frustumCulled = false;
world.add(skidLine);
const skidHistory = [];
`,
  `const SKID_HISTORY_CAPACITY = 90;
const SKID_WHEEL_COUNT = 2;
const SKID_COMPONENT_COUNT = 3;
const SKID_SAMPLE_STRIDE = SKID_WHEEL_COUNT * SKID_COMPONENT_COUNT;
const SKID_MAX_DRAW_VERTICES = 120;
const skidGeometry = new THREE.BufferGeometry();
const skidPositions = new Float32Array(360 * 3);
skidGeometry.setAttribute('position', new THREE.BufferAttribute(skidPositions, 3));
const skidLine = new THREE.LineSegments(
  skidGeometry,
  new THREE.LineBasicMaterial({ color: 0x08090a, transparent: true, opacity: 0.52 })
);
skidLine.frustumCulled = false;
world.add(skidLine);
const skidHistory = new Float32Array(SKID_HISTORY_CAPACITY * SKID_SAMPLE_STRIDE);
let skidHistoryStart = 0;
let skidHistoryCount = 0;
const skidLateral = new THREE.Vector3();
const skidRearCenter = new THREE.Vector3();
const skidLeftWheel = new THREE.Vector3();
const skidRightWheel = new THREE.Vector3();
`
);

source = replaceExactlyOnce(
  source,
  `function updateSkids() {
  if (state.driftAmount > 0.34 && state.speed > 21) {
    const right = getRight().clone();
    const rearCenter = state.position.clone().addScaledVector(getForward().clone(), -2.0);
    skidHistory.unshift([
      rearCenter.clone().addScaledVector(right, -1.25).setY(0.23),
      rearCenter.clone().addScaledVector(right, 1.25).setY(0.23)
    ]);
  } else if (skidHistory.length) {
    skidHistory.unshift(skidHistory[0].map((point) => point.clone()));
  }

  skidHistory.length = Math.min(skidHistory.length, 90);
  let cursor = 0;
  for (let i = 0; i < skidHistory.length - 1 && cursor < 120; i += 1) {
    for (let wheel = 0; wheel < 2; wheel += 1) {
      const a = skidHistory[i][wheel];
      const b = skidHistory[i + 1][wheel];
      skidPositions[cursor * 3] = a.x;
      skidPositions[cursor * 3 + 1] = a.y;
      skidPositions[cursor * 3 + 2] = a.z;
      cursor += 1;
      skidPositions[cursor * 3] = b.x;
      skidPositions[cursor * 3 + 1] = b.y;
      skidPositions[cursor * 3 + 2] = b.z;
      cursor += 1;
    }
  }
  skidGeometry.attributes.position.needsUpdate = true;
  skidGeometry.setDrawRange(0, cursor);
}
`,
  `function pushSkidSample(leftWheel, rightWheel) {
  skidHistoryStart = (skidHistoryStart - 1 + SKID_HISTORY_CAPACITY) % SKID_HISTORY_CAPACITY;
  writeSkidPoint(skidHistoryStart, 0, leftWheel);
  writeSkidPoint(skidHistoryStart, 1, rightWheel);
  skidHistoryCount = Math.min(SKID_HISTORY_CAPACITY, skidHistoryCount + 1);
}

function repeatLatestSkidSample() {
  if (!skidHistoryCount) return;
  const previousStart = skidHistoryStart;
  skidHistoryStart = (skidHistoryStart - 1 + SKID_HISTORY_CAPACITY) % SKID_HISTORY_CAPACITY;
  const previousOffset = previousStart * SKID_SAMPLE_STRIDE;
  const nextOffset = skidHistoryStart * SKID_SAMPLE_STRIDE;
  for (let component = 0; component < SKID_SAMPLE_STRIDE; component += 1) {
    skidHistory[nextOffset + component] = skidHistory[previousOffset + component];
  }
  skidHistoryCount = Math.min(SKID_HISTORY_CAPACITY, skidHistoryCount + 1);
}

function writeSkidPoint(sampleIndex, wheel, point) {
  const offset = (sampleIndex * SKID_WHEEL_COUNT + wheel) * SKID_COMPONENT_COUNT;
  skidHistory[offset] = point.x;
  skidHistory[offset + 1] = point.y;
  skidHistory[offset + 2] = point.z;
}

function copySkidVertex(sampleOffset, wheel, vertexIndex) {
  const sampleIndex = (skidHistoryStart + sampleOffset) % SKID_HISTORY_CAPACITY;
  const sourceOffset = (sampleIndex * SKID_WHEEL_COUNT + wheel) * SKID_COMPONENT_COUNT;
  const targetOffset = vertexIndex * SKID_COMPONENT_COUNT;
  skidPositions[targetOffset] = skidHistory[sourceOffset];
  skidPositions[targetOffset + 1] = skidHistory[sourceOffset + 1];
  skidPositions[targetOffset + 2] = skidHistory[sourceOffset + 2];
}

function updateSkids() {
  if (state.driftAmount > 0.34 && state.speed > 21) {
    skidLateral.copy(getRight());
    skidRearCenter.copy(state.position).addScaledVector(getForward(), -2.0);
    skidLeftWheel.copy(skidRearCenter).addScaledVector(skidLateral, -1.25).setY(0.23);
    skidRightWheel.copy(skidRearCenter).addScaledVector(skidLateral, 1.25).setY(0.23);
    pushSkidSample(skidLeftWheel, skidRightWheel);
  } else {
    repeatLatestSkidSample();
  }

  let cursor = 0;
  for (let sample = 0; sample < skidHistoryCount - 1 && cursor < SKID_MAX_DRAW_VERTICES; sample += 1) {
    for (let wheel = 0; wheel < SKID_WHEEL_COUNT; wheel += 1) {
      copySkidVertex(sample, wheel, cursor);
      cursor += 1;
      copySkidVertex(sample + 1, wheel, cursor);
      cursor += 1;
    }
  }
  skidGeometry.attributes.position.needsUpdate = true;
  skidGeometry.setDrawRange(0, cursor);
}
`
);

assert.doesNotMatch(source, /skidHistory\.unshift|skidHistory\[0\]\.map/);
assert.doesNotMatch(source, /const right = getRight\(\)\.clone\(\)|state\.position\.clone\(\)\.addScaledVector\(getForward\(\)\.clone\(\)/);
assert.match(source, /const skidHistory = new Float32Array\(SKID_HISTORY_CAPACITY \* SKID_SAMPLE_STRIDE\)/);
assert.match(source, /skidHistoryStart = \(skidHistoryStart - 1 \+ SKID_HISTORY_CAPACITY\) % SKID_HISTORY_CAPACITY/);
assert.match(source, /skidGeometry\.setDrawRange\(0, cursor\)/);

await fs.writeFile(mainUrl, source);
console.log('TURN r66 skid history now uses a fixed typed-array ring buffer.');

function replaceExactlyOnce(sourceText, before, after) {
  const first = sourceText.indexOf(before);
  assert.notEqual(first, -1, `Expected source pattern was not found:\n${before.slice(0, 140)}`);
  assert.equal(sourceText.indexOf(before, first + before.length), -1, 'Expected source pattern was not unique');
  return `${sourceText.slice(0, first)}${after}${sourceText.slice(first + before.length)}`;
}
