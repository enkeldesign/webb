import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createAchievementStore, normalizeAchievementState } from '../../turn/achievements/store.js';
import {
  TROPHY_ROAD_MAX_THRESHOLD,
  TROPHY_ROAD_REWARDS,
  TROPHY_ROAD_STORAGE_KEY,
  TROPHY_ROAD_STORAGE_VERSION,
  TROPHY_ROAD_VIEWPORT_THRESHOLD,
  getTrophyRoadReward,
  grandfatheredRewardIdsForVersion,
  isPaintUnlocked,
  isTrackUnlocked,
  isVehicleUnlocked,
  prepareTrophyRoadProfile,
  readTrophyRoadSnapshot,
  rewardForFeature,
  rewardForTrack,
  rewardForVehicle,
  rewardIdsForTrophies
} from '../../turn/progression/trophy-road.js';

const [
  roadSource,
  roadCss,
  roadExtensionCss,
  homeGate,
  lotGate,
  paintGate,
  view,
  feedback,
  showcase,
  runtime,
  app,
  fixedLayout,
  lotEnhancement,
  vehicleCatalog,
  wideGamut,
  emergencyLiveries,
  workflow
] = await Promise.all([
  fs.readFile(new URL('../../turn/progression/trophy-road.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/progression/trophy-road.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/progression/trophy-road-r157.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/progression/m8-trophy-gate.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/progression/lot-trophy-gate.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/progression/lot-paint-reward.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/view.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/trophy-road-feedback.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/trophy-road-showcase.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-enhancement-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/catalog.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/wide-gamut.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/emergency-livery-models.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../.github/workflows/turn-lab-tests.yml', import.meta.url), 'utf8')
]);

function createMemoryStorage(initial = {}) {
  const memory = new Map(Object.entries(initial));
  return {
    get length() {
      return memory.size;
    },
    key(index) {
      return [...memory.keys()][index] ?? null;
    },
    getItem(key) {
      return memory.get(key) ?? null;
    },
    setItem(key, value) {
      memory.set(key, String(value));
    },
    removeItem(key) {
      memory.delete(key);
    }
  };
}

assert.equal(TROPHY_ROAD_STORAGE_KEY, 'turn-achievements-v1');
assert.equal(TROPHY_ROAD_STORAGE_VERSION, 4);
assert.equal(TROPHY_ROAD_MAX_THRESHOLD, 1375,
  'The road must retain room for the complete current trophy collection');
assert.equal(TROPHY_ROAD_VIEWPORT_THRESHOLD, 600,
  'The first 600 trophies should fit in the initial road viewport');
assert.deepEqual(
  TROPHY_ROAD_REWARDS.map(({ id, threshold }) => [id, threshold]),
  [
    ['midnight-city', 300],
    ['future-racer', 400],
    ['paintjob', 500],
    ['emergency-pack', 600],
    ['monster', 700]
  ]
);
assert.deepEqual(rewardIdsForTrophies(299), []);
assert.deepEqual(rewardIdsForTrophies(300), ['midnight-city']);
assert.deepEqual(rewardIdsForTrophies(399), ['midnight-city']);
assert.deepEqual(rewardIdsForTrophies(400), ['midnight-city', 'future-racer']);
assert.deepEqual(rewardIdsForTrophies(499), ['midnight-city', 'future-racer']);
assert.deepEqual(rewardIdsForTrophies(500), ['midnight-city', 'future-racer', 'paintjob']);
assert.deepEqual(rewardIdsForTrophies(599), ['midnight-city', 'future-racer', 'paintjob']);
assert.deepEqual(rewardIdsForTrophies(600), ['midnight-city', 'future-racer', 'paintjob', 'emergency-pack']);
assert.deepEqual(rewardIdsForTrophies(699), ['midnight-city', 'future-racer', 'paintjob', 'emergency-pack']);
assert.deepEqual(rewardIdsForTrophies(700), ['midnight-city', 'future-racer', 'paintjob', 'emergency-pack', 'monster']);
assert.equal(rewardForTrack('midnight-city')?.id, 'midnight-city');
assert.equal(rewardForVehicle('police')?.id, 'emergency-pack');
assert.equal(rewardForVehicle('ambulance')?.id, 'emergency-pack');
assert.equal(rewardForVehicle('firetruck')?.id, 'emergency-pack');
assert.equal(rewardForVehicle('race-future')?.id, 'future-racer');
assert.equal(rewardForVehicle('monster-truck')?.id, 'monster');
assert.equal(rewardForFeature('vehicle-paint')?.id, 'paintjob');
assert.equal(getTrophyRoadReward('invented'), null);
assert.deepEqual(grandfatheredRewardIdsForVersion(3), ['paintjob', 'monster']);
assert.deepEqual(
  grandfatheredRewardIdsForVersion(2),
  ['midnight-city', 'future-racer', 'paintjob', 'emergency-pack', 'monster']
);
assert.deepEqual(grandfatheredRewardIdsForVersion(4), []);

const freshStorage = createMemoryStorage();
assert.equal(prepareTrophyRoadProfile(freshStorage), null,
  'A genuinely new player must not be mistaken for an existing profile');
assert.deepEqual(readTrophyRoadSnapshot(freshStorage).unlockedRewardIds, []);
assert.equal(isTrackUnlocked('countryside', freshStorage), true);
assert.equal(isTrackUnlocked('midnight-city', freshStorage), false);
assert.equal(isVehicleUnlocked('classic', freshStorage), true);
assert.equal(isVehicleUnlocked('police', freshStorage), false);
assert.equal(isVehicleUnlocked('race-future', freshStorage), false);
assert.equal(isVehicleUnlocked('monster-truck', freshStorage), false);
assert.equal(isPaintUnlocked(freshStorage), false);
freshStorage.setItem('turn-drive-by-ear-v1', 'false');
assert.equal(prepareTrophyRoadProfile(freshStorage), null,
  'A setting created later in a fresh session must not retroactively grandfather the player');
assert.deepEqual(readTrophyRoadSnapshot(freshStorage).unlockedRewardIds, []);

const legacyWithoutAchievements = createMemoryStorage({
  'turn-vehicle-selection-v1': JSON.stringify({ carId: 'police' })
});
const preparedLegacy = prepareTrophyRoadProfile(legacyWithoutAchievements);
assert.equal(preparedLegacy?.version, 2,
  'Existing TURN profiles without achievement storage need a grandfathering shell');
assert.equal(readTrophyRoadSnapshot(legacyWithoutAchievements).isLegacyProfile, true);
assert.deepEqual(
  readTrophyRoadSnapshot(legacyWithoutAchievements).unlockedRewardIds,
  ['midnight-city', 'future-racer', 'paintjob', 'emergency-pack', 'monster']
);
assert.equal(isPaintUnlocked(legacyWithoutAchievements), true);
assert.equal(isVehicleUnlocked('monster-truck', legacyWithoutAchievements), true);

const migratedLegacy = normalizeAchievementState({
  version: 2,
  unlocked: {
    'first-turn': { unlockedAt: 1, trackId: 'countryside', vehicleId: 'classic', time: 20 }
  },
  seen: ['first-turn'],
  progress: { tracks: ['countryside'], blankTracks: [] }
});
assert.equal(migratedLegacy.version, 4);
assert.deepEqual(
  migratedLegacy.rewards.unlocked,
  ['midnight-city', 'future-racer', 'paintjob', 'emergency-pack', 'monster']
);
assert.deepEqual(migratedLegacy.rewards.seen, migratedLegacy.rewards.unlocked,
  'Grandfathered content must not create a misleading reward notification');

const migratedVersionThree = normalizeAchievementState({
  version: 3,
  unlocked: {},
  seen: [],
  progress: { tracks: [], blankTracks: [] },
  rewards: { unlocked: ['midnight-city'], seen: ['midnight-city'] }
});
assert.equal(migratedVersionThree.version, 4);
assert.deepEqual(migratedVersionThree.rewards.unlocked, ['midnight-city', 'paintjob', 'monster']);
assert.deepEqual(migratedVersionThree.rewards.seen, ['midnight-city', 'paintjob', 'monster'],
  'Existing Trophy Road players must retain paint and Monster Truck access silently');

const progressionStorage = createMemoryStorage();
const store = createAchievementStore(progressionStorage);
assert.equal(store.trophyTotal(), 0);
assert.deepEqual(store.syncRewards(), []);
assert.equal(store.unlock('trust-your-ears', { trackId: 'countryside' })?.trophies, 200);
assert.equal(store.trophyTotal(), 200);
assert.deepEqual(store.syncRewards(), [],
  'One introductory 200-trophy lap must not immediately unlock Midnight City');

assert.equal(store.unlock('beyond-sight', { trackId: 'countryside' })?.trophies, 300);
assert.equal(store.trophyTotal(), 500);
assert.deepEqual(
  store.syncRewards().map((reward) => reward.id),
  ['midnight-city', 'future-racer', 'paintjob']
);
assert.equal(isTrackUnlocked('midnight-city', progressionStorage), true);
assert.equal(isVehicleUnlocked('race-future', progressionStorage), true);
assert.equal(isPaintUnlocked(progressionStorage), true);
assert.equal(isVehicleUnlocked('police', progressionStorage), false);
assert.equal(isVehicleUnlocked('monster-truck', progressionStorage), false);

assert.equal(store.unlock('around-the-turn', { trackId: 'harbor' })?.trophies, 100);
assert.equal(store.trophyTotal(), 600);
assert.deepEqual(store.syncRewards().map((reward) => reward.id), ['emergency-pack']);
assert.equal(isVehicleUnlocked('police', progressionStorage), true);

assert.equal(store.unlock('faster-than-the-dev', { trackId: 'midnight-city' })?.trophies, 100);
assert.equal(store.trophyTotal(), 700);
assert.deepEqual(store.syncRewards().map((reward) => reward.id), ['monster']);
assert.equal(isVehicleUnlocked('monster-truck', progressionStorage), true);
assert.deepEqual(
  store.unseenRewardIds(),
  ['midnight-city', 'future-racer', 'paintjob', 'emergency-pack', 'monster']
);
store.markAllSeen();
assert.deepEqual(store.unseenRewardIds(), []);

const previousAchievements = globalThis.__turnAchievements;
const blockedStorage = {
  getItem() { throw new Error('blocked'); },
  setItem() { throw new Error('blocked'); }
};
globalThis.__turnAchievements = { store };
assert.equal(isVehicleUnlocked('police', blockedStorage), true,
  'Session-only rewards must open content even when persistent browser storage is blocked');
assert.equal(isVehicleUnlocked('monster-truck', blockedStorage), true);
assert.equal(isPaintUnlocked(blockedStorage), true);
if (previousAchievements === undefined) delete globalThis.__turnAchievements;
else globalThis.__turnAchievements = previousAchievements;

const permanentReward = normalizeAchievementState({
  version: 4,
  unlocked: {},
  seen: [],
  progress: { tracks: [], blankTracks: [] },
  rewards: { unlocked: ['emergency-pack'], seen: ['emergency-pack'] }
});
assert.deepEqual(permanentReward.rewards.unlocked, ['emergency-pack'],
  'Once awarded, a reward must remain owned even if thresholds change later');

assert.match(roadSource, /TROPHY_ROAD_STORAGE_VERSION = 4/);
assert.match(roadSource, /TROPHY_ROAD_MAX_THRESHOLD = 1375/);
assert.match(roadSource, /TROPHY_ROAD_VIEWPORT_THRESHOLD = 600/);
for (const threshold of [300, 400, 500, 600, 700]) {
  assert.match(roadSource, new RegExp(`threshold: ${threshold}`));
}
assert.match(roadSource, /id: 'paintjob'/);
assert.match(roadSource, /featureId: 'vehicle-paint'/);
assert.match(roadSource, /id: 'monster'/);
assert.match(roadSource, /vehicleIds: Object\.freeze\(\['monster-truck'\]\)/);
assert.match(roadSource, /grandfatheredRewardIdsForVersion/);
assert.match(roadSource, /VERSION_THREE_GRANDFATHERED_REWARDS/);
assert.match(roadSource, /LOCK_ICON/);
assert.match(roadSource, /showTrophyUnlockNotice/);
assert.match(roadSource, /PREPARED_STORAGE = new WeakSet/);
assert.match(roadSource, /globalThis\.__turnAchievements\?\.store/);
assert.doesNotMatch(roadSource, /clearRivals|resetRivals|rival-storage/);

assert.match(homeGate, /showTrophyUnlockNotice/);
assert.match(homeGate, /continueButton\.setAttribute\('aria-disabled', 'true'\)/);
assert.match(homeGate, /continueButton\.removeAttribute\('aria-disabled'\)/);
assert.match(homeGate, /event\.stopImmediatePropagation\(\)/,
  'The locked Race action must explain the lock without starting the race');
assert.match(homeGate, /turn-track-lock-icon/);
assert.match(homeGate, /LOCK_ICON/);
assert.doesNotMatch(homeGate, /continueButton\.disabled = true/,
  'A natively disabled Race button cannot provide the required lock explanation');
assert.match(homeGate, /card\.addEventListener\('click'/);
assert.doesNotMatch(homeGate, /fallbackCard\?\.click/,
  'Locked tracks should remain selected and inspectable instead of silently moving selection');

assert.match(lotGate, /raceButton\.disabled = locked/);
assert.match(lotGate, /lot-selected-car-lock/);
assert.match(lotGate, /showTrophyUnlockNotice/);
assert.match(lotGate, /rewardForVehicle/);
assert.doesNotMatch(lotGate, /colors\.hidden|carPicker\.hidden/,
  'Locked vehicles must retain their normal information and paint presentation');

assert.match(paintGate, /isPaintUnlocked/);
assert.match(paintGate, /PAINT_REWARD_ID = 'paintjob'/);
assert.match(paintGate, /forceFactoryPaint/);
assert.match(paintGate, /getVehicleDefaultColor/);
assert.match(paintGate, /getVehicleDefaultSecondaryColor/);
assert.match(paintGate, /control\.hidden = locked/);
assert.match(paintGate, /input\.disabled = locked/);
assert.match(paintGate, /lot-paint-lock/);
assert.match(paintGate, /showTrophyUnlockNotice/);
assert.match(paintGate, /turn:paint-controls-unlocked/);

assert.match(view, /turn-trophy-road-progress" role="progressbar"/);
assert.match(view, /turn-trophy-road-markers" aria-label="Trophy Road rewards"/);
assert.ok(
  view.indexOf('turn-trophy-road-progress" role="progressbar"')
    < view.indexOf('turn-trophy-road-markers" aria-label="Trophy Road rewards"'),
  'Reward buttons should be siblings of the progressbar rather than descendants hidden by progressbar semantics'
);
assert.match(feedback, /r157-hidden-achievements/);
assert.match(feedback, /r157-paint-monster/);
assert.match(feedback, /trophy-road-r157\.css/);
assert.match(feedback, /TROPHY_ROAD_VIEWPORT_THRESHOLD/);
assert.match(feedback, /turn-trophy-road-scroll/);
assert.match(feedback, /turn-trophy-road-scroll-button/);
assert.match(feedback, /Scroll Trophy Road/);
assert.match(feedback, /scrollBy\(\{/);
assert.match(feedback, /previousButton\.disabled = atStart/,
  'The left scroll button must be truly inactive at the start of the road');
assert.match(feedback, /syncScrollButtons: updateScrollButtons/);
assert.doesNotMatch(feedback, /pointerdown|pointermove|setPointerCapture/,
  'Custom Trophy Road drag scrolling should remain disabled until it is reliable');
assert.match(feedback, /createTrophyRoadShowcase/);
assert.match(feedback, /TROPHY_ROAD_REWARD_ICONS/);
assert.match(feedback, /selectedByPlayer = ''/);
assert.match(feedback, /selectedByPlayer = marker\.dataset\.trophyReward;[\s\S]*queueSelectionSync\(\);/,
  'Reward details must synchronize after the base view finishes the same click');
assert.match(feedback, /queueMicrotask\(\(\) => \{[\s\S]*preserveUserSelection\(\{ adoptRendered \}\)/,
  'Reward selection must wait until the canonical detail renderer has replaced the card DOM');
assert.match(feedback, /reward\.type === 'feature'/,
  'Paintjob should retain its static reward artwork rather than requesting a vehicle showcase');
assert.match(feedback, /clearSelection\(\)/);
assert.match(feedback, /resetView\(\)/);
assert.match(feedback, /CATEGORY\.WAYS_TO_PLAY/);
assert.match(feedback, /CATEGORY\.EXPLORATION/);
assert.match(feedback, /CATEGORY\.RACING/);
assert.match(feedback, /dataset\.achievementFilter/);
assert.match(feedback, /activeCategories/);
assert.match(feedback, /activeStatuses/);
assert.match(feedback, /categoryMatch && statusMatch/);
assert.match(feedback, /id: 'locked'/);
assert.match(feedback, /LOCK_ICON/);

assert.match(showcase, /createCarVisual/);
assert.match(showcase, /'race-future'/);
assert.match(showcase, /'firetruck'/);
assert.match(showcase, /'ambulance'/);
assert.match(showcase, /'police'/);
assert.match(showcase, /monster:[\s\S]*'monster-truck'/);
assert.match(showcase, /getVehicleDefaultColor/);
assert.match(showcase, /configureRendererWideGamut/);
assert.match(showcase, /groupPromises = new Map/,
  'Repeated renders should share one in-flight model load per reward');
assert.ok(
  showcase.indexOf('const group = await buildRewardGroup(reward.id)')
    < showcase.lastIndexOf('attachRenderer(host);'),
  'Static reward artwork must remain visible until the 3D model is ready'
);
assert.match(showcase, /renderer\.setAnimationLoop\(render\)/);
assert.match(showcase, /visual\.rotation\.y/);
assert.match(showcase, /aria-hidden/);
assert.match(showcase, /ResizeObserver/);

assert.match(runtime, /turn:trophy-road-updated/);
assert.match(runtime, /showRewardToastBatch/);
assert.match(runtime, /store\.syncRewards\(\)/);

assert.ok(
  app.indexOf('prepareTrophyRoadProfile();') < app.indexOf("await import(withBuild('./main.js'))"),
  'Grandfathering must be prepared before the runtime loads the saved vehicle selection'
);
assert.match(app, /trophy-road\.js\?revision=r157-paint-monster/);
assert.match(app, /trophy-road-r157\.css\?revision=r157-paint-monster/);
assert.match(app, /wide-gamut\.js\?revision=r157-display-p3/);
assert.match(app, /m8-home-fixed-layout\.js\?revision=m8\.9-track-title-alignment&trophy-road=r157/);
assert.match(app, /lot-enhancement-runtime\.js\?revision=r121&trophy-road=r157/);
assert.match(fixedLayout, /installM8TrophyGate/);
assert.match(fixedLayout, /installTrophyRoadFeedback/);
assert.match(fixedLayout, /installSecretAchievements/);
assert.match(fixedLayout, /r157-paint-monster/);
assert.ok(
  fixedLayout.indexOf('installM8TrophyGate') < fixedLayout.indexOf('installAchievements'),
  'Track access should be gated before achievement UI is installed'
);
assert.match(lotEnhancement, /gateLotNow/);
assert.match(lotEnhancement, /gateLotPaintNow/);
assert.ok(
  lotEnhancement.indexOf('gateLotNow(scope)') < lotEnhancement.indexOf('installLotAccessibility(scope)'),
  'The accessibility layer should capture the complete locked vehicle names'
);
assert.ok(
  lotEnhancement.indexOf('gateLotPaintNow(scope)') < lotEnhancement.indexOf('installLotAccessibility(scope)'),
  'The accessibility layer should capture the paint lock presentation'
);

assert.match(roadCss, /overflow-x: auto/);
assert.match(roadCss, /touch-action: pan-y/);
assert.match(roadCss, /cursor: default/);
assert.doesNotMatch(roadCss, /turn-trophy-road-scroll\.is-dragging/);
assert.match(roadCss, /turn-trophy-road-scroll-button/);
assert.match(roadCss, /pointer-events: none/,
  'Inactive Trophy Road scroll buttons must not remain clickable');
assert.match(roadCss, /Formula car[\s\S]*data-trophy-reward="future-racer"/,
  'The Future Racer milestone should use a simple Formula-style line icon');
assert.match(roadCss, /translate\(-50%, -50%\)/);
assert.match(roadCss, /turn-trophy-road-marker-lock/);
assert.match(roadCss, /turn-track-lock-icon/);
assert.match(roadCss, /color-mix\(in srgb, var\(--turn-action-success/,
  'The filled Trophy Road segment needs stronger contrast from the unfilled rail');
assert.match(roadCss, /turn-trophy-road-detail-model-host/);
assert.match(roadCss, /turn-trophy-road-detail p[\s\S]*font-size: \.82rem/);
assert.match(roadCss, /text-align: left/);
assert.match(roadCss, /turn-unlock-notice/);
assert.match(roadCss, /aria-disabled="true"/);
assert.doesNotMatch(roadCss, /content: '🔒'/,
  'Trophy Road track locks should use the shared vector lock rather than an emoji');
assert.match(roadCss, /@media \(prefers-reduced-motion: reduce\)/);

assert.match(roadExtensionCss, /@supports \(color: color\(display-p3 1 0 0\)\)/);
assert.match(roadExtensionCss, /data-trophy-reward="paintjob"/);
assert.match(roadExtensionCss, /data-trophy-reward="monster"/);
assert.match(roadExtensionCss, /lot-paint-lock/);
assert.match(roadExtensionCss, /is-hidden-achievement/);

assert.match(vehicleCatalog, /DEFAULT_VEHICLE_COLOR = '#ffcc00'/);
assert.match(vehicleCatalog, /'race-future': Object\.freeze\(\{ fallback: '#00aabb'/);
assert.match(vehicleCatalog, /'monster-truck': Object\.freeze\(\{ fallback: '#3f5a3c'/);
assert.match(vehicleCatalog, /defaultColorP3/);
assert.match(vehicleCatalog, /getVehicleDefaultColorSpec/);
assert.match(vehicleCatalog, /\['vintage-racer',[\s\S]*speed: 4, acceleration: 4, control: 3, drift: 2, boostPower: 3, boostDuration: 2/);
assert.match(vehicleCatalog, /\['race', 'Race Car',[\s\S]*speed: 5, acceleration: 4, control: 4, drift: 2, boostPower: 2, boostDuration: 1/);

assert.match(wideGamut, /THREE\.DisplayP3ColorSpace/);
assert.match(wideGamut, /CSS\?\.supports/);
assert.match(wideGamut, /THREE\.SRGBColorSpace/);
assert.match(wideGamut, /configureRendererWideGamut/);
assert.match(wideGamut, /enhanceWideGamutScene/);
assert.match(wideGamut, /installWideGamutRendererPatch/);
assert.match(wideGamut, /turnColorGamut/);
assert.match(emergencyLiveries, /LOT_TINT_MIX = 0\.23/);
assert.match(emergencyLiveries, /installLotUnselectedTint/);
assert.match(emergencyLiveries, /makeWideGamutSpec/);

assert.match(workflow, /Run Trophy Road progression regression/);

console.log('TURN Trophy Road paint, Monster, wide-gamut and progression regression passed.');
