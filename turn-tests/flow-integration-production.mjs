import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [main, setting, toast, announcements, achievements, scoringCatalog] = await Promise.all([
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/drift-attack-setting.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/lap-result-toast.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/race-announcements.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/achievements/catalog-production.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/achievements/scoring-achievements.js', import.meta.url), 'utf8')
]);

const toastCss = await fs.readFile(new URL('../turn/lap-result-toast.css', import.meta.url), 'utf8');

assert.match(main, /createFlowRuntime\(\{[\s\S]*state,[\s\S]*scoreFeedback,[\s\S]*isFeatureUnlocked/);
assert.match(main, /flowAttack\.beginLap\(now\)/);
assert.match(main, /driftAttack\.completeLap\([\s\S]*flowAttack\.completeLap\(/,
  'DRIFT finalizes first so FLOW can consume a finish-line drift bank');
assert.doesNotMatch(main, /flowAttack\.advance|requestAnimationFrame\([^)]*flow/i,
  'FLOW must not add a continuous scoring loop');
assert.match(setting, /Show FLOW scoring/);
assert.match(setting, /Scores, records and achievements continue when hidden\./);
assert.match(toast, /lap-result-flow/);
assert.match(toast, /dataset\.scoreCount/);
assert.match(toastCss, /data-score-count="2"/);
assert.match(toastCss, /--lap-result-topbar-clearance/);
assert.match(announcements, /spokenScoreResult\('Flow', flow\)/);

assert.match(achievements, /TRACK_SCORING_ACHIEVEMENTS/);
assert.equal((scoringCatalog.match(/trophies: 50/g) || []).length, 1,
  'One generated contract supplies 50 trophies to every track/channel placeholder');
assert.match(scoringCatalog, /trophies: 300/);
assert.match(scoringCatalog, /target pending playtest calibration/i);
assert.match(scoringCatalog, /drift:[\s\S]*TRACK_IDS\.map[\s\S]*flow:/);
assert.doesNotMatch(scoringCatalog, /countryside:\s*\d|airport:\s*\d|mountain:\s*\d/,
  'No achievement target is guessed before playtest calibration');

console.log('TURN FLOW integration and placeholder scoring-achievement regressions passed.');
