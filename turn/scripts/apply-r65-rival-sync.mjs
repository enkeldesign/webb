import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const mainUrl = new URL('../main.js', import.meta.url);
let source = await fs.readFile(mainUrl, 'utf8');

source = replaceExactlyOnce(
  source,
  `function ensureCompetitorCars() {
  while (competitorCars.length < COMPETITOR_LIMIT) {
    competitorCars.push(createCompetitorCar());
  }

  for (let i = 0; i < competitorCars.length; i += 1) {
    const car = competitorCars[i];
    const lap = state.competitorLaps[i];
    if (!lap) continue;
    void syncCompetitorVisual(car, lap);
  }
}
`,
  `function ensureCompetitorCars() {
  while (competitorCars.length < COMPETITOR_LIMIT) {
    competitorCars.push(createCompetitorCar());
  }
}

function syncCompetitorVisuals() {
  ensureCompetitorCars();
  for (let i = 0; i < competitorCars.length; i += 1) {
    const car = competitorCars[i];
    const lap = state.competitorLaps[i];
    if (!lap) continue;
    void syncCompetitorVisual(car, lap);
  }
}
`
);

source = replaceExactlyOnce(
  source,
  `  });
  publishUiState('lap-completed');
}

function saveGhost()`,
  `  });
  syncCompetitorVisuals();
  publishUiState('lap-completed');
}

function saveGhost()`
);

source = replaceExactlyOnce(
  source,
  `function loadGhost() {
  loadRivalsState({ state, samples, findNearestTrack });
  publishUiState('rivals-loaded');
}`,
  `function loadGhost() {
  loadRivalsState({ state, samples, findNearestTrack });
  syncCompetitorVisuals();
  publishUiState('rivals-loaded');
}`
);

source = replaceExactlyOnce(
  source,
  `function placeCompetitorCars(dt) {
  ensureCompetitorCars();

  for (let i = 0; i < competitorCars.length; i += 1) {`,
  `function placeCompetitorCars(dt) {
  for (let i = 0; i < competitorCars.length; i += 1) {`
);

source = replaceExactlyOnce(
  source,
  `  competitorCars,
  ensureCompetitorCars,
  animateWheels,`,
  `  competitorCars,
  ensureCompetitorCars,
  syncCompetitorVisuals,
  animateWheels,`
);

assert.doesNotMatch(
  source,
  /function placeCompetitorCars\(dt\) \{\s*ensureCompetitorCars\(\)/,
  'The frame loop must not trigger rival model synchronisation'
);
assert.match(source, /function completeLap\([\s\S]*syncCompetitorVisuals\(\);[\s\S]*publishUiState\('lap-completed'\)/);
assert.match(source, /function loadGhost\([\s\S]*syncCompetitorVisuals\(\);[\s\S]*publishUiState\('rivals-loaded'\)/);

await fs.writeFile(mainUrl, source);
console.log('TURN r65 rival visuals now synchronise only when rival identity can change.');

function replaceExactlyOnce(sourceText, before, after) {
  const first = sourceText.indexOf(before);
  assert.notEqual(first, -1, `Expected source pattern was not found:\n${before.slice(0, 120)}`);
  assert.equal(sourceText.indexOf(before, first + before.length), -1, 'Expected source pattern was not unique');
  return `${sourceText.slice(0, first)}${after}${sourceText.slice(first + before.length)}`;
}
