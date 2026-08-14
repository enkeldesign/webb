import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { completeLapState } from '../turn/race/lap-system-r86.js?test=r195-unranked-super-sedan';
import { getStoredBestLap, saveRivalsState } from '../turn/race/rival-storage.js?test=r195-unranked-super-sedan';
import { isSportsSedanEasterEgg } from '../turn/vehicle/catalog.js?test=r195-unranked-super-sedan';

const [runtimeSource, chromaticSource, productionIndex, labIndex] = await Promise.all([
  fs.readFile(new URL('../turn/achievements/runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/achievements/chromatic-camouflage-r183.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-lab/index.html', import.meta.url), 'utf8')
]);

assert.equal(isSportsSedanEasterEgg({
  carId: 'sedan-sports',
  secondaryColor: '#666666'
}), true, 'The #666666 Sports Sedan is the unranked Super/Satan’s Sedan');
assert.equal(isSportsSedanEasterEgg({
  carId: 'sedan-sports',
  secondaryColor: '#f8f9fa'
}), false, 'The ordinary Sports Sedan must remain ranked');

function replayFrames() {
  return Array.from({ length: 21 }, (_, index) => ({
    t: index * 0.1,
    x: index,
    z: 0,
    h: 0,
    s: 0,
    d: 0,
    p: index / 20
  }));
}

function existingLap(time = 20) {
  return {
    time,
    hitAt: 1,
    carId: 'sport',
    carColor: '#ff00ff',
    carSecondaryColor: '#f8f9fa',
    frames: replayFrames()
  };
}

function raceState(secondaryColor) {
  const rival = existingLap();
  return {
    lapStartedAt: 0,
    recording: replayFrames(),
    competitorLaps: [rival],
    bestTime: rival.time,
    ghostFrames: rival.frames,
    ghostVisible: true,
    vehicleId: 'sedan-sports',
    vehicleColor: '#ff00ff',
    vehicleSecondaryColor: secondaryColor,
    lapCheckpointIndex: 12,
    lapInvalid: false,
    lapActive: true,
    lap: 1,
    lapElapsed: 10
  };
}

const samples = [{ point: { x: 0, z: 0 }, tangent: { x: 0, z: 1 } }];
const previousCustomEvent = globalThis.CustomEvent;
const previousDispatchEvent = globalThis.dispatchEvent;
const events = [];
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
};
globalThis.dispatchEvent = (event) => {
  events.push(event);
  return true;
};

let saveCalls = 0;
const superState = raceState('#666666');
const originalRivals = superState.competitorLaps;
const originalGhostFrames = superState.ghostFrames;
const superResult = completeLapState({
  state: superState,
  samples,
  now: 10000,
  competitorLimit: 4,
  saveGhost: () => { saveCalls += 1; }
});

assert.equal(superResult.validLap, true);
assert.equal(superResult.ranked, false, 'Super Sedan laps must be explicitly unranked');
assert.equal(superResult.savedLap, false, 'Super Sedan laps must never be saved');
assert.equal(saveCalls, 0, 'Super Sedan must never invoke rival persistence');
assert.equal(superState.competitorLaps, originalRivals,
  'An unranked lap must not temporarily replace the in-memory record list');
assert.equal(superState.bestTime, 20, 'An unranked lap must not change the track best time');
assert.equal(superState.ghostFrames, originalGhostFrames,
  'An unranked lap must not replace the primary rival replay');
assert.equal(events.at(-1)?.type, 'turn:lap-result');
assert.equal(events.at(-1)?.detail?.ranked, false,
  'Achievement listeners must be told that the completed lap is unranked');
assert.equal(events.at(-1)?.detail?.saved, false);
assert.equal(events.at(-1)?.detail?.time, 10);

saveCalls = 0;
const normalState = raceState('#f8f9fa');
const normalResult = completeLapState({
  state: normalState,
  samples,
  now: 10000,
  competitorLimit: 4,
  saveGhost: () => { saveCalls += 1; }
});
assert.equal(normalResult.ranked, true, 'The ordinary Sports Sedan must remain fully ranked');
assert.equal(normalResult.savedLap, true);
assert.equal(saveCalls, 1);
assert.equal(normalState.competitorLaps[0]?.time, 10);
assert.equal(events.at(-1)?.detail?.ranked, true);

const previousLocalStorage = globalThis.localStorage;
const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key)
};

const staleSuperLap = {
  ...existingLap(9),
  carId: 'sedan-sports',
  carSecondaryColor: '#666666'
};
const legitimateLap = {
  ...existingLap(12),
  carId: 'sport',
  carColor: '#ff00ff'
};
assert.equal(saveRivalsState({
  trackId: 'countryside',
  competitorLaps: [staleSuperLap, legitimateLap]
}, { trackId: 'countryside' }), true);
const storedBest = getStoredBestLap('countryside');
assert.equal(storedBest?.time, 12,
  'Legacy Super Sedan records must be ignored so ranked records and Chromatic Camouflage can recover');
assert.notEqual(storedBest?.carId, 'sedan-sports');
const persisted = [...memory.values()].map((value) => JSON.parse(value)).find((value) => Array.isArray(value?.laps));
assert.equal(persisted?.laps?.length, 1, 'Re-saving rivals must scrub stale Super Sedan laps');
assert.equal(persisted?.laps?.[0]?.time, 12);

assert.match(runtimeSource, /detail\?\.ranked === false[\s\S]*?qualifyingTimeTrial/,
  'Time-trial achievements must explicitly reject unranked lap-result events');
assert.match(chromaticSource, /getStoredBestLap/,
  'Chromatic Camouflage must continue to use the centrally filtered ranked best lap');
for (const index of [productionIndex, labIndex]) {
  assert.match(index, /lap-system-r86\.js\?build=20260811-r164&revision=r195-unranked-super-sedan/,
    'Prod and TURN LAB must cache-bust the unranked lap runtime');
  assert.match(index, /rival-storage\.js\?build=20260811-r164&revision=r195-unranked-super-sedan/,
    'Prod and TURN LAB must cache-bust ranked rival storage');
  assert.match(index, /achievements\/runtime\.js\?revision=r195-unranked-super-sedan/,
    'Prod and TURN LAB must cache-bust the time-trial achievement guard');
}

if (previousCustomEvent === undefined) delete globalThis.CustomEvent;
else globalThis.CustomEvent = previousCustomEvent;
if (previousDispatchEvent === undefined) delete globalThis.dispatchEvent;
else globalThis.dispatchEvent = previousDispatchEvent;
if (previousLocalStorage === undefined) delete globalThis.localStorage;
else globalThis.localStorage = previousLocalStorage;

console.log('TURN Super Sedan unranked record and achievement regression passed.');
