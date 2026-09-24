import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  TRACK_DEFINITIONS,
  TRACK_IDS,
  TRACK_NAMES,
  assertTrackConfigCoverage,
  completeTrackOrder,
  createTrackCatalogMetadata,
  missingTrackConfigIds
} from '../turn/tracks/definitions.js';
import { TRACK_IDS as ACHIEVEMENT_TRACK_IDS, TRACK_NAMES as ACHIEVEMENT_TRACK_NAMES } from '../turn/achievements/catalog-base.js';
import { TRACK_ICON_ASSETS } from '../turn/ui/track-icons.js';
import { TRACK_COLOR_CUES } from '../turn/accessibility/color-cues.js';
import { TRACK_SONGS } from '../turn/audio/music/songbook.js';
import { TRACK_PACE_NOTE_MAPS } from '../turn/tracks/pace-notes-base.js';
import { TIME_TRIALS } from '../turn/achievements/time-trials.js';
import { SCORING_ACHIEVEMENT_TARGETS } from '../turn/achievements/scoring-achievements.js';

const ROOT = new URL('../', import.meta.url);
const [
  catalogSource,
  registrySource,
  selectorSource,
  statsSource,
  supportSource,
  challengeSource,
  productionAchievementsSource,
  chromaticSource,
  shadowSource,
  workflowSource
] = await Promise.all([
  read('turn/tracks/catalog.js'),
  read('turn/tracks/registry.js'),
  read('turn/ui/track-select.js'),
  read('turn/stats/stats.js'),
  read('turn/achievements/support-challenges.js'),
  read('turn/achievements/challenge-expansion-r166.js'),
  read('turn/achievements/catalog-production.js'),
  read('turn/achievements/chromatic-camouflage-r183.js'),
  read('turn/render/car-shadows.js'),
  read('.github/workflows/turn-lab-tests.yml')
]);

const currentIds = TRACK_DEFINITIONS.map(({ id }) => id);
assert.deepEqual(TRACK_IDS, currentIds,
  'Canonical TRACK_IDS must always derive from production definitions');
assert.deepEqual(
  TRACK_NAMES,
  Object.fromEntries(TRACK_DEFINITIONS.map(({ id, name }) => [id, name])),
  'Canonical TRACK_NAMES must always derive from production definitions'
);
assert.deepEqual(ACHIEVEMENT_TRACK_IDS, TRACK_IDS,
  'Every-track achievements must consume the canonical production track set');
assert.deepEqual(ACHIEVEMENT_TRACK_NAMES, TRACK_NAMES,
  'Achievement names must consume canonical production track names');

// The fixture is deliberately >6 and deliberately not 8. Its size is a regression probe,
// not a product maximum.
const syntheticDefinitions = Object.freeze(
  Array.from({ length: 10 }, (_, index) => Object.freeze({
    id: `fixture-track-${index + 1}`,
    name: `Fixture Track ${index + 1}`
  }))
);
const syntheticMetadata = createTrackCatalogMetadata(syntheticDefinitions);
assert.equal(syntheticMetadata.ids.length, 10);
assert.equal(syntheticMetadata.ids.at(-1), 'fixture-track-10');
assert.equal(syntheticMetadata.names['fixture-track-9'], 'Fixture Track 9');

const preferredOrder = ['fixture-track-4', 'fixture-track-1', 'fixture-track-4', 'not-a-track'];
const completeOrder = completeTrackOrder(preferredOrder, syntheticMetadata.ids);
assert.equal(completeOrder.length, syntheticMetadata.ids.length,
  'A partial preferred order must never hide later catalog tracks');
assert.deepEqual(completeOrder.slice(0, 2), ['fixture-track-4', 'fixture-track-1']);
assert.deepEqual(new Set(completeOrder), new Set(syntheticMetadata.ids));

assert.throws(
  () => createTrackCatalogMetadata([
    { id: 'duplicate', name: 'One' },
    { id: 'duplicate', name: 'Two' }
  ]),
  /duplicate production track id duplicate/
);
assert.throws(
  () => createTrackCatalogMetadata([{ id: '', name: 'Missing id' }]),
  /non-empty id/
);
assert.throws(
  () => createTrackCatalogMetadata([{ id: 'missing-name', name: '' }]),
  /needs a non-empty name/
);

const partialConfig = Object.fromEntries(syntheticMetadata.ids.slice(0, 7).map((id) => [id, true]));
assert.deepEqual(missingTrackConfigIds(partialConfig, syntheticMetadata.ids), [
  'fixture-track-8',
  'fixture-track-9',
  'fixture-track-10'
]);
assert.throws(
  () => assertTrackConfigCoverage(partialConfig, 'fixture config', syntheticMetadata.ids),
  /fixture config is missing: fixture-track-8, fixture-track-9, fixture-track-10/
);

// Mandatory per-track production registries must cover the canonical catalog.
// Track-specific tuning stays explicit; omission must be a clear integration failure.
for (const [label, config] of [
  ['track icon assets', TRACK_ICON_ASSETS],
  ['track color cues', TRACK_COLOR_CUES],
  ['track music', TRACK_SONGS],
  ['track pace-note maps', TRACK_PACE_NOTE_MAPS],
  ['DRIFT score targets', SCORING_ACHIEVEMENT_TARGETS.drift],
  ['FLOW score targets', SCORING_ACHIEVEMENT_TARGETS.flow]
]) {
  assert.deepEqual(missingTrackConfigIds(config), [], `${label} must cover every production track`);
}

const timeTrialTrackIds = TIME_TRIALS.map(({ trackId }) => trackId);
assert.deepEqual(timeTrialTrackIds, TRACK_IDS,
  'Developer time trials must remain one-per-production-track and in catalog order');

for (const source of [challengeSource, productionAchievementsSource, chromaticSource, shadowSource]) {
  assert.match(source, /assertTrackConfigCoverage\(/,
    'Every-track calibrated/runtime maps must explicitly enforce catalog coverage');
}
assert.match(challengeSource, /assertTrackConfigCoverage\(CLEAN_LAP_TARGETS, 'clean-lap targets'\)/);
assert.match(productionAchievementsSource, /assertTrackConfigCoverage\(SAFETY_TARGET_LABELS, 'achievement safety target labels'\)/);
assert.match(chromaticSource, /assertTrackConfigCoverage\(TRACK_COLOR_RULES, 'Chromatic Camouflage track rules'\)/);
assert.match(shadowSource, /assertTrackConfigCoverage\(TRACK_SHADOW_ROAD_HEIGHT, 'projected-shadow road heights'\)/);

assert.match(catalogSource, /TRACK_DEFINITIONS\.map\(\(definition\) =>/,
  'The runtime catalog must be built from canonical production definitions');
assert.match(catalogSource, /has no geometry factory/,
  'A registered track without geometry must fail clearly');
assert.match(registrySource, /TRACK_CATALOG\.map\(\(definition\) =>/,
  'The runtime registry must be built from the canonical track catalog');
assert.match(registrySource, /has an incomplete runtime contract/,
  'A registered track without a world/runtime contract must fail clearly');

assert.match(selectorSource, /TRACK_SELECTION_CATALOG\.map\(renderTrackCard\)\.join\(''\)/,
  'Track chooser DOM must be generated from catalog contents');
assert.doesNotMatch(selectorSource, /TRACK_SELECTION_CATALOG\.slice\(\s*0\s*,\s*\d+/,
  'Track chooser must not cap the number of catalog entries in JavaScript');

assert.match(statsSource, /import \{ TRACK_DEFINITIONS \} from '\.\.\/tracks\/definitions\.js'/);
assert.match(statsSource, /TRACK_DEFINITIONS\.map\(\(\{ id, name \}\)/,
  'Stats track names must follow canonical production definitions');
assert.match(supportSource, /completeTrackOrder\(config\.trackOrder, TRACK_IDS\)/,
  'A stale support-challenge preference order must append newly registered tracks');

assert.match(workflowSource, /node turn-tests\/track-catalog-scalability-production\.mjs/,
  'The full TURN regression suite must protect variable track-count readiness');

console.log(
  `TURN track-catalog scalability passed: ${TRACK_IDS.length} current production tracks; ` +
  '10-track synthetic fixture proves no six/eight-track catalog cap. Responsive card composition remains #905.'
);

async function read(relativePath) {
  return fs.readFile(new URL(relativePath, ROOT), 'utf8');
}
