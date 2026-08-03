import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_STORAGE_KEY,
  ONBOARDING_ACHIEVEMENT_IDS,
  loadAchievementState,
  normalizeAchievementState
} from '../../turn/achievements.js';

const [catalog, storeSource, runtime, view, style, fixedLayout, workflow, designTokens] = await Promise.all([
  fs.readFile(new URL('../../turn/achievements/catalog.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/store.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/view.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../.github/workflows/turn-lab-tests.yml', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/design-tokens.css', import.meta.url), 'utf8')
]);

assert.equal(ACHIEVEMENT_STORAGE_KEY, 'turn-achievements-v1');
assert.equal(ACHIEVEMENTS.length, 13, 'The first release should ship a focused thirteen-achievement collection');
assert.equal(ONBOARDING_ACHIEVEMENT_IDS.length, 10, 'Getting Started should contain ten onboarding achievements');
assert.deepEqual(
  ACHIEVEMENTS.map((achievement) => achievement.id),
  [
    'first-turn',
    'take-it-from-the-top',
    'charge-through-it',
    'second-wind',
    'flow-state',
    'watch-and-learn',
    'your-own-rival',
    'level-head',
    'new-wheels',
    'new-ground',
    'trust-your-ears',
    'around-the-turn',
    'ahead-of-yourself'
  ]
);
assert.equal(ACHIEVEMENTS.find((achievement) => achievement.id === 'flow-state')?.points, 50);
assert.match(ACHIEVEMENTS.find((achievement) => achievement.id === 'flow-state')?.description || '', /Drift and Boost/);
assert.match(ACHIEVEMENTS.find((achievement) => achievement.id === 'flow-state')?.recommendation || '', /Training Car · Countryside/);
assert.match(ACHIEVEMENTS.find((achievement) => achievement.id === 'trust-your-ears')?.description || '', /Blank screen mode on from start to finish/);

const empty = normalizeAchievementState(null);
assert.deepEqual(empty.progress.tracks, []);
assert.deepEqual(empty.seen, []);
assert.deepEqual(empty.unlocked, {});

const normalized = normalizeAchievementState({
  version: 999,
  unlocked: {
    'first-turn': { unlockedAt: 123, trackId: 'countryside', vehicleId: 'classic', time: 42.5 },
    invented: { unlockedAt: 456 }
  },
  seen: ['first-turn', 'invented', 'first-turn'],
  progress: { tracks: ['airport', 'airport', 'invented'] }
});
assert.deepEqual(Object.keys(normalized.unlocked), ['first-turn']);
assert.deepEqual(normalized.seen, ['first-turn']);
assert.deepEqual(normalized.progress.tracks, ['airport']);

const memory = new Map();
const storage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value)
};
assert.equal(loadAchievementState(storage).storageAvailable, true);
memory.set(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(normalized));
assert.deepEqual(Object.keys(loadAchievementState(storage).state.unlocked), ['first-turn']);
assert.equal(loadAchievementState({ getItem: () => { throw new Error('blocked'); } }).storageAvailable, false);

assert.match(catalog, /category: CATEGORY\.ONBOARDING/);
assert.match(catalog, /id: 'flow-state'/);
assert.match(catalog, /id: 'trust-your-ears'/);
assert.match(catalog, /id: 'around-the-turn'/);
assert.match(catalog, /id: 'ahead-of-yourself'/);
assert.match(storeSource, /ACHIEVEMENT_STORAGE_KEY = 'turn-achievements-v1'/);
assert.match(storeSource, /state\.progress\.tracks\.push/);
assert.match(storeSource, /markAllSeen/);

assert.match(runtime, /SPECTATE_REQUIRED_MS = 5000/);
assert.match(runtime, /LAP_TOAST_DELAY_MS = 4400/,
  'Achievement feedback must wait until the existing lap result has finished');
assert.match(runtime, /SAMPLE_INTERVAL_MS = 100/,
  'Driving mechanics should be sampled lightly rather than adding another frame loop');
assert.match(runtime, /flowEligible/);
assert.match(runtime, /usedDrift/);
assert.match(runtime, /usedBoost/);
assert.match(runtime, /driftChargeGained >= 0\.25/);
assert.match(runtime, /secondWind\.sawEmpty/);
assert.match(runtime, /secondWind\.sawRecharge/);
assert.match(runtime, /turn-screen-blanked/);
assert.match(runtime, /reason === 'lap-started'/);
assert.match(runtime, /reason === 'race-reset'/);
assert.match(runtime, /reason === 'spectate-started'/);
assert.match(runtime, /reason === 'spectate-stopped'/);
assert.match(runtime, /turn:lap-result/);
assert.match(runtime, /turn:lap-invalid/);
assert.match(runtime, /turn:track-changed/);
assert.match(runtime, /turn:achievements-updated/);
assert.match(runtime, /pendingTrackEntryPulse/);

assert.match(view, /aria-live', 'polite'/);
assert.match(view, /role="progressbar"/);
assert.match(view, /data-achievement-filter="onboarding"/);
assert.match(view, /store\.markAllSeen\(\)/);
assert.match(view, /prefers-reduced-motion: reduce/);
assert.match(view, /is-achievement-pulsing/);
assert.match(view, /createTrigger\('m8-achievements-button'/);
assert.match(view, /createTrigger\('utility turn-race-achievements-button'/);

assert.match(style, /\.m8-achievements-button/);
assert.match(style, /\.turn-race-achievements-button/);
assert.match(style, /\.turn-achievements-dialog/);
assert.match(style, /\.turn-achievement-toast/);
assert.match(style, /@keyframes turn-achievement-pulse/);
assert.match(style, /animation: turn-achievement-pulse 720ms ease-in-out 3/);
assert.match(style, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(style, /var\(--turn-action-success/);

assert.match(designTokens, /--turn-action-success: var\(--turn-green-500\)/);
assert.match(fixedLayout, /installAchievements/);
assert.match(fixedLayout, /achievements\.js/);
assert.ok(fixedLayout.indexOf('installM8HomeCardScrollFixes') < fixedLayout.indexOf('installAchievements'),
  'Achievements should join the completed fixed Home layout after track scrolling is installed');
assert.match(workflow, /Run achievement system regression/);
assert.match(workflow, /node turn-lab\/tests\/achievements-production\.mjs/);

console.log('TURN achievement system regression passed.');
