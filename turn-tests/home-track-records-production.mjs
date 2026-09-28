import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

// Home track records live in ROADBOOK's Track sheet (and, on large screens, its
// overview): TIME, DRIFT and FLOW for the chosen track, locked modes shown as locked,
// empty records as empty, each record with its car. The former SHOW RECORDS toggle
// and in-card record rows are retired.
const [
  home,
  roadbook,
  preRaceCss,
  app,
  rivalReset,
  productionEntry,
  labEntry
] = await Promise.all([
  fs.readFile(new URL('../turn/m8-home.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/roadbook/roadbook.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/pre-race.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/home-rival-reset.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-lab/index.html', import.meta.url), 'utf8')
]);

// One source for each record, as before.
assert.match(roadbook, /import \{ getStoredBestLap \} from '\/turn\/race\/rival-storage\.js\?source=20260729-r118-m8';/);
assert.match(roadbook, /import \{ getBestDriftRecord \} from '\/turn\/scoring\/drift-records\.js\?revision=r206-home-track-records';/);
assert.match(roadbook, /import \{ getBestFlowRecord \} from '\/turn\/scoring\/flow-records\.js\?revision=r206-home-track-records';/);
assert.match(roadbook, /kind: 'time', label: 'TIME', featureId: null, read: getStoredBestLap/);
assert.match(roadbook, /kind: 'drift', label: 'DRIFT', featureId: 'drift-attack', read: getBestDriftRecord/);
assert.match(roadbook, /kind: 'flow', label: 'FLOW', featureId: 'flow', read: getBestFlowRecord/);

// Locked scoring modes read as locked with their threshold, never as zero.
assert.match(roadbook, /const locked = featureId && !isFeatureUnlocked\(featureId\);/);
assert.match(roadbook, /const record = locked \? null : read\(track\.id\);/,
  'A locked mode never shows a stored score');
assert.match(roadbook, /Unlocks at \$\{reward\?\.threshold \?\? ''\} trophies/);
assert.match(roadbook, /kind === 'time' \? 'No time yet' : 'No score yet'/);
assert.match(roadbook, /formatRecordTime\(record\.time\)/);
assert.match(roadbook, /`\$\{minutes\}:\$\{secs\}\.\$\{ms\}`/, 'Times keep the m:ss.mmm format');

// Record rows are static text inside a dialog or panel, not controls.
const detail = roadbook.slice(roadbook.indexOf('function renderDetail'), roadbook.indexOf('let thumbnailGeneration'));
assert.ok(detail.length > 0);
assert.doesNotMatch(detail.slice(0, detail.indexOf('turn-pr-detail-actions')), /<(?:button|input|details|summary|select|textarea)\b/i,
  'Record rows remain static and non-interactive');
assert.match(detail, /<h3 class="turn-pr-section-title" id="\$\{idPrefix\}RecordsTitle">Personal bests<\/h3>/);
assert.doesNotMatch(roadbook, /Show all records|All track records/i, 'There is no all-records feature');

// Records refresh when rivals are reset, when a race changes them and when Home shows.
assert.match(roadbook, /windowRef\.addEventListener\('turn:rivals-reset', refreshRecords\)/);
assert.match(home, /function showHome\(\{ focus = false \} = \{\}\) \{[\s\S]*roadbook\.refreshRecords\(\);/);
assert.match(home, /async onRivalsReset\(\) \{[\s\S]*roadbook\.refreshRecords\(\);/);
assert.doesNotMatch(rivalReset, /data-track-best|track-card-record/, 'Rival reset no longer edits Home record markup');

// The retired toggle and its remembered state are gone everywhere.
for (const [label, source] of [['m8-home.js', home], ['roadbook.js', roadbook], ['app.js', app]]) {
  assert.doesNotMatch(source, /m8-track-bests-toggle|turn-track-records-expanded-v1|is-showing-track-bests/,
    `${label} must not bring back the SHOW RECORDS toggle`);
}
assert.doesNotMatch(app, /m8-record-car-scale|m8-midnight-city-postcard/, 'The retired Home card layers are not loaded');
for (const entrypoint of [productionEntry, labEntry]) {
  assert.doesNotMatch(entrypoint, /home-track-row-gap-r200\.css|m8-menu-font-fix\.css/,
    'The retired Home card stylesheets are not linked');
}

// Each record accent is paired with its text label.
assert.match(preRaceCss, /\.turn-pr-record\.is-time \{ --turn-pr-record-accent/);
assert.match(preRaceCss, /\.turn-pr-record\.is-drift \{ --turn-pr-record-accent/);
assert.match(preRaceCss, /\.turn-pr-record\.is-flow \{ --turn-pr-record-accent/);

console.log('TURN Home records: TIME, DRIFT and FLOW per track in the Track sheet, locked and empty states explicit.');
