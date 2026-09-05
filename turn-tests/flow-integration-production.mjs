import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  TRACK_SCORING_ACHIEVEMENTS,
  SCORING_MASTER_ACHIEVEMENT,
  qualifyingScoringAchievement,
  storedScoringAchievementUnlockEntries
} from '../turn/achievements/scoring-achievements.js';

const [main, setting, toast, announcements, achievements, scoringCatalog, achievementRuntime] = await Promise.all([
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/drift-attack-setting.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/lap-result-toast.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/race-announcements.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/achievements/catalog-production.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/achievements/scoring-achievements.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/achievements/runtime.js', import.meta.url), 'utf8')
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
assert.match(scoringCatalog, /trophies: channel === 'drift' \? 75 : 50/);
assert.match(scoringCatalog, /trophies: 300/);
for (const target of [8000, 11000, 20000, 18000, 7000, 12000, 13000, 23000, 25000]) {
  assert.match(scoringCatalog, new RegExp(`\\b${target}\\b`), `Missing calibrated scoring target ${target}`);
}
assert.match(scoringCatalog, /'midnight-city': 20000/);
assert.match(scoringCatalog, /mountain: 20000/);
assert.equal(TRACK_SCORING_ACHIEVEMENTS.length, 12);
assert.ok(TRACK_SCORING_ACHIEVEMENTS
  .filter((achievement) => achievement.scoreChannel === 'drift')
  .every((achievement) => achievement.trophies === 75));
assert.ok(TRACK_SCORING_ACHIEVEMENTS
  .filter((achievement) => achievement.scoreChannel === 'flow')
  .every((achievement) => achievement.trophies === 50));
assert.ok(TRACK_SCORING_ACHIEVEMENTS.every((achievement) => achievement.calibrationPending === false));
assert.ok(TRACK_SCORING_ACHIEVEMENTS.every((achievement) => Number.isFinite(achievement.target) && achievement.target > 0));
assert.equal(SCORING_MASTER_ACHIEVEMENT.calibrationPending, false);
for (const achievement of TRACK_SCORING_ACHIEVEMENTS) {
  assert.equal(
    qualifyingScoringAchievement(achievement.scoreChannel, achievement.trackId, achievement.target)?.id,
    achievement.id,
    `${achievement.id} must qualify at its exact calibrated target`
  );
}
assert.match(scoringCatalog, /value < target/,
  'A score equal to the calibrated target must qualify');

const storedRecords = new Map([
  ['turn-drift-records-v1', JSON.stringify({
    version: 1,
    tracks: {
      countryside: { score: 8000, carId: 'classic', lapTime: 18, hitAt: 1 },
      airport: { score: 10999, carId: 'race', lapTime: 20, hitAt: 2 }
    }
  })],
  ['turn-flow-records-v1', JSON.stringify({
    version: 1,
    tracks: {
      countryside: { score: 7000, carId: 'classic', lapTime: 18, hitAt: 1 }
    }
  })]
]);
const recordStorage = {
  getItem: (key) => storedRecords.get(key) ?? null
};
assert.deepEqual(
  storedScoringAchievementUnlockEntries(recordStorage).map(({ id }) => id),
  ['countryside-drift-score', 'countryside-flow-score'],
  'Existing qualifying personal-best records must backfill calibrated achievements without replaying the lap'
);
assert.match(achievementRuntime, /importStoredScoringAchievements\(\)/);
assert.match(achievementRuntime, /storedScoringAchievementUnlockEntries\(undefined, store\.isUnlocked\)/);

console.log('TURN FLOW integration and calibrated scoring-achievement regressions passed.');
