import fs from 'node:fs';

function replaceOnce(path, from, to) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one occurrence of ${JSON.stringify(from)}, found ${count}`);
  fs.writeFileSync(path, source.replace(from, to));
}

function replaceAllRequired(path, from, to, minimum = 1) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(from).length - 1;
  if (count < minimum) throw new Error(`${path}: expected at least ${minimum} occurrences of ${JSON.stringify(from)}, found ${count}`);
  fs.writeFileSync(path, source.split(from).join(to));
}

replaceOnce('turn/main.js', 'const ghostCar = makeCar(0x38d9ff, 0.34);', 'const ghostCar = makeCar(0x38d9ff, 1);');
replaceOnce('turn/main.js', '  const car = makeCar(0x38d9ff, 0.34);', '  const car = makeCar(0x38d9ff, 1);');

replaceAllRequired('turn/index.html', 'v1.1.2', 'v1.1.3', 3);
replaceAllRequired('turn/index.html', '2026.07.19-r11', '2026.07.19-r12', 3);
replaceAllRequired('turn/index.html', '20260719-r11', '20260719-r12', 8);
replaceAllRequired('turn/index.html', 'TURN r11 Back to the Lot', 'TURN r12 Balance and checkpoints');

replaceAllRequired('turn-lab/tests/manual-steering-production.mjs', '20260719-r11', '20260719-r12');
replaceAllRequired('turn-lab/tests/garage-production.mjs', 'TURN v1\\.1\\.2 · Build 2026\\.07\\.19-r11', 'TURN v1\\.1\\.3 · Build 2026\\.07\\.19-r12');
replaceAllRequired('turn-lab/tests/garage-production.mjs', 'build=20260719-r11', 'build=20260719-r12');

const regressionPath = 'turn-lab/tests/regression.mjs';
let regression = fs.readFileSync(regressionPath, 'utf8');
const startMarker = "test('lap progress requires ordered forward checkpoints and routes start crossings correctly', () => {";
const nextMarker = "test('completed laps keep the fastest four rivals and immediately continue racing', () => {";
const start = regression.indexOf(startMarker);
const next = regression.indexOf(nextMarker);
if (start < 0 || next < 0 || next <= start) throw new Error('checkpoint regression block markers not found');

const replacement = `test('lap progress requires ordered physical checkpoint gates and routes start crossings correctly', () => {
  const samples = makeSamples();
  const state = makeState({ lapStartedAt: 1000, trackDistance: 1 });
  state.lapActive = true;
  state.velocity.set(10, 0, 0);

  let began = 0;
  let completed = 0;
  let recorded = 0;
  const run = (now) => updateLapProgressState({
    state,
    nearestAfter: { sample: samples[Math.round(state.progress * samples.length) % samples.length] },
    samples,
    trackWidth: 27,
    now,
    beginTimedLap: () => { began += 1; },
    completeLap: () => { completed += 1; },
    recordGhostFrame: () => { recorded += 1; }
  });

  assert.ok(LAP_CHECKPOINTS.length >= 10, 'checkpoint chain should be dense enough to reject major shortcuts');

  state.lastProgress = 0.07;
  state.progress = 0.09;
  state.position.set(70, 0, 140);
  run(2000);
  assert.equal(state.lapCheckpointIndex, 0, 'progress jumps far away from the checkpoint must not count');

  const firstIndex = Math.round(LAP_CHECKPOINTS[0] * samples.length) % samples.length;
  state.position.set(samples[firstIndex].point.x, 0, samples[firstIndex].point.z);
  run(2100);
  assert.equal(state.lapCheckpointIndex, 1);
  assert.equal(recorded, 2);

  const secondIndex = Math.round(LAP_CHECKPOINTS[1] * samples.length) % samples.length;
  state.position.set(samples[secondIndex].point.x, 0, samples[secondIndex].point.z);
  state.velocity.set(-10, 0, 0);
  run(2200);
  assert.equal(state.lapCheckpointIndex, 1, 'reverse movement must not claim a checkpoint');

  state.velocity.set(10, 0, 0);
  run(2300);
  assert.equal(state.lapCheckpointIndex, 2);

  state.position.set(samples[0].point.x, 0, samples[0].point.z);
  state.lastProgress = 0.9;
  state.progress = 0.1;
  state.lapCheckpointIndex = 2;
  run(3000);
  assert.equal(began, 1, 'incomplete circuit restarts the timed attempt');
  assert.equal(completed, 0);

  state.lastProgress = 0.9;
  state.progress = 0.1;
  state.lapCheckpointIndex = LAP_CHECKPOINTS.length;
  run(4000);
  assert.equal(completed, 1, 'full ordered physical checkpoint chain completes the lap');

  state.lapActive = false;
  state.lastProgress = 0.9;
  state.progress = 0.1;
  run(5000);
  assert.equal(began, 2, 'first forward crossing starts timing');
  assert.equal(state.lapElapsed, 0);
});

`;

regression = regression.slice(0, start) + replacement + regression.slice(next);
fs.writeFileSync(regressionPath, regression);

console.log('TURN r12 balance/checkpoint references applied.');
