import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { TROPHY_ROAD_STORAGE_VERSION } from '../turn/progression/trophy-road.js';

// Run against the same production server as support-feedback-browser-smoke.mjs.
const target = process.env.TURN_SUPPORT_FEEDBACK_URL || 'http://127.0.0.1:8000/';
const browser = await chromium.launch({ headless: true });
async function runPreview(challenge) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(({ completed, previousChallenge, storageVersion }) => {
    localStorage.setItem('turn-low-graphics-v1', '1');
    localStorage.setItem('turn-steering-mode-v1', 'manual');
    localStorage.setItem('turn-audio-enabled-v1', 'off');
    localStorage.setItem('turn-racing-music-volume-v1', '0');
    // Returning players have resolved earlier challenges, but have no trophies
    // unlocking these rewards. Existing history must survive the upgrade.
    localStorage.setItem('turn-support-challenges-v1', JSON.stringify({
      version: 1, completed: completed.filter((key) => key !== previousChallenge?.key),
      skipped: ['winner:airport'], active: previousChallenge || null, dryValidLaps: 0
    }));
    if (previousChallenge) {
      // The third challenge's underlying achievement was earned outside its
      // recommended setup. Retiring it must still advance the fixed sequence.
      localStorage.setItem('turn-achievements-v1', JSON.stringify({
        version: storageVersion,
        unlocked: { [previousChallenge.sourceAchievementId]: { unlockedAt: Date.now() } }
      }));
    }
    Object.defineProperty(globalThis.navigator, 'standalone', { configurable: true, value: true });
  }, { ...challenge, storageVersion: TROPHY_ROAD_STORAGE_VERSION });

  const inspect = () => page.evaluate(async ({ key, trackId, vehicleId }) => {
    const map = JSON.parse(document.querySelector('[type="importmap"]').textContent).imports;
    const { isTrackUnlocked, isVehicleUnlocked } = await import(map['/turn/progression/trophy-road.js']);
    return {
      trackUnlocked: isTrackUnlocked(trackId),
      carUnlocked: isVehicleUnlocked(vehicleId),
      bonus: globalThis.__turnAchievements.store.state.bonuses[`support:${key}`],
      active: globalThis.__turnSupportChallenges.state.active?.key || null,
      completed: [...globalThis.__turnSupportChallenges.state.completed],
      skipped: [...globalThis.__turnSupportChallenges.state.skipped],
      preview: globalThis.__turnRuntime.state.rewardPreview || null,
      track: globalThis.__turnRuntime.state.trackId,
      car: globalThis.__turnRuntime.state.vehicleId,
      running: globalThis.__turnRuntime.state.running,
      savedCar: localStorage.getItem('turn-vehicle-selection-v1'),
      savedTrack: localStorage.getItem('turn-selected-track-v1'),
      rewards: JSON.stringify(globalThis.__turnAchievements.store.state.rewards),
      home: document.body.classList.contains('turn-home-open')
    };
  }, challenge);

  async function launch() {
    await closeVisitSummary();
    await page.locator('.turn-support-challenge-trigger').click();
    await page.locator('[data-support-start]').click();
    await page.waitForFunction((key) => globalThis.__turnRuntime.state.running
      && globalThis.__turnRuntime.state.rewardPreview?.key === key, challenge.key);
    // Let the start's existing orientation/steering treatment settle.
    await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  }

  async function closeVisitSummary() {
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const close = page.locator('.turn-visit-summary-dialog[open] .turn-visit-summary-close');
    if (await close.isVisible()) await close.click();
  }

  async function crossFinish({ valid = true } = {}) {
    const count = await page.evaluate(() => globalThis.__turnRuntime.state.rewardPreview.completedLaps);
    await page.evaluate(async (valid) => {
      const map = JSON.parse(document.querySelector('[type="importmap"]').textContent).imports;
      const { raceNow } = await import(map['/turn/race/race-clock.js']);
      const { state, samples } = globalThis.__turnRuntime;
      const start = samples[0];
      state.lapActive = true;
      state.lapStartedAt = raceNow() - 90_000;
      state.lapCheckpointIndex = 12;
      state.lapInvalid = false;
      state.position.copy(start.point).addScaledVector(start.tangent, -1);
      state.lapPreviousPosition = { x: state.position.x, z: state.position.z };
      state.heading = Math.atan2(start.tangent.x, start.tangent.z);
      state.velocity.copy(start.tangent).multiplyScalar(35);
      state.speed = 35;
      state.recording = valid ? Array.from({ length: 25 }, (_, i) => ({
        t: i, x: start.point.x, z: start.point.z, h: state.heading, p: i / 25
      })) : [];
    }, valid);
    await page.waitForFunction((previous) => !globalThis.__turnRuntime.state.rewardPreview
      || globalThis.__turnRuntime.state.rewardPreview.completedLaps > previous, count);
  }

  try {
    await page.goto(new URL('turn/', target).href);
    await page.waitForFunction((type) => document.documentElement.classList.contains('turn-home-ready')
      && globalThis.__turnSupportChallenges?.state.active?.type === type, challenge.type, { timeout: 60000 });
    const before = await inspect();
    assert.equal(before.trackUnlocked, false);
    assert.equal(before.carUnlocked, false);
    assert.deepEqual(before.completed, challenge.completed);
    assert.deepEqual(before.skipped, ['winner:airport']);
    await page.locator('.turn-support-challenge-trigger').click();
    assert.equal(await page.locator('[data-support-eyebrow]').textContent(), 'REWARD PREVIEW');
    assert.equal(await page.locator('#turnSupportChallengeTitle').textContent(), challenge.title);
    assert.equal(await page.locator('[data-support-start]').textContent(), `START ${challenge.title}`);
    assert.equal(await page.locator('[data-support-objective]').textContent(), challenge.objective);
    assert.match(await page.locator('[data-support-explanation]').textContent(), /temporary preview.*two completed laps/);
    await page.evaluate(() => {
      globalThis.__turnSupportChallenges.state.lapsSinceChallengeProgress = 100;
      globalThis.__turnSupportChallenges.render();
    });
    assert.equal(await page.locator('[data-support-reroll]').isVisible(), false);
    await page.locator('[data-support-close]').click();

    await launch();
    let current = await inspect();
    assert.equal(current.track, challenge.trackId);
    assert.equal(current.car, challenge.vehicleId);
    for (const key of ['savedCar', 'savedTrack', 'rewards']) assert.equal(current[key], before[key], `${key} must not change to enter ${challenge.title}`);
    await page.evaluate(() => globalThis.__turnRuntime.openHome());
    current = await inspect();
    assert.equal(current.active, challenge.key, 'Early leave keeps the challenge available');
    assert.equal(current.preview, null);
    assert.equal(current.track, before.track);
    assert.equal(current.car, before.car);

    await launch();
    await page.evaluate(() => globalThis.__turnDriveByEarTraining.open());
    current = await inspect();
    assert.equal(current.preview, null, 'Entering training also ends the preview');
    assert.equal(current.track, before.track);
    assert.equal(current.car, before.car);
    await page.locator('[data-training-cancel]').first().click();

    await launch();
    await crossFinish({ valid: false });
    assert.equal((await inspect()).active, challenge.key, 'An invalid lap does not clear the challenge');
    await page.evaluate(() => globalThis.__turnRuntime.openHome());
    await launch();
    await crossFinish();
    current = await inspect();
    assert.ok(current.completed.includes(challenge.key), 'First valid lap completes the challenge');
    assert.equal(current.bonus?.trophies, 25, 'The first valid lap grants the support bonus');
    assert.equal(current.preview.completedLaps, 1);
    assert.equal(current.running, true, 'The optional second lap remains playable');
    await page.evaluate(() => globalThis.__turnRacePause.pause());
    assert.equal((await inspect()).preview.completedLaps, 1, 'Pause preserves the two-lap allowance');
    await page.locator('[data-pause-action="resume"]').click();
    await page.waitForFunction(() => !globalThis.__turnRacePause.paused);
    await crossFinish();
    await page.waitForFunction(() => document.body.classList.contains('turn-home-open')
      && !globalThis.__turnRuntime.state.rewardPreview);
    current = await inspect();
    assert.equal(current.running, false, 'The second finish returns Home without starting lap three');
    assert.equal(current.track, before.track);
    assert.equal(current.car, before.car);
    assert.equal(current.bonus?.trophies, 25, 'The second lap does not double the support bonus');
    for (const key of ['savedCar', 'savedTrack', 'trackUnlocked', 'carUnlocked']) assert.equal(current[key], before[key], `${key} stays authoritative after ${challenge.title}`);

    await closeVisitSummary();
    await page.locator('.m8-track-continue').click();
    await page.waitForSelector('.garage');
    // GARAGE ignores activations during its 600 ms VoiceOver entry-tap guard.
    await page.waitForTimeout(700);
    await page.locator('.garage-race').click();
    await page.waitForFunction(() => globalThis.__turnRuntime.state.running);
    current = await inspect();
    assert.equal(current.preview, null, 'The next normal race has no preview restrictions');
    assert.equal(current.track, before.track);
    assert.equal(current.car, before.car);
    assert.deepEqual(errors, [], `Production ${challenge.title} has no browser runtime errors`);
    console.log(`Chromium: ${challenge.title} locked-content launch, early leave/retry, invalid lap, first-lap completion, two-lap cap, selection restoration and normal re-entry passed.`);
  } catch (error) {
    console.error(challenge.title, await inspect(), await page.locator('dialog[open]').allTextContents());
    throw error;
  } finally {
    await context.close();
  }
}

try {
  await runPreview({
    key: 'patrol:midnight-city', type: 'patrol', trackId: 'midnight-city', vehicleId: 'police', title: 'PATROL',
    objective: 'Complete one valid lap of MIDNIGHT CITY using the POLICE CAR.',
    completed: ['learning:how-to-play', 'safety:countryside']
  });
  await runPreview({
    key: 'excursion:mountain', type: 'excursion', trackId: 'mountain', vehicleId: 'monster-truck', title: 'EXCURSION',
    objective: 'Complete one valid lap of MOUNTAIN using the MONSTER TRUCK.',
    completed: ['learning:how-to-play', 'patrol:midnight-city', 'safety:countryside'],
    previousChallenge: { key: 'safety:countryside', type: 'safety', trackId: 'countryside', vehicleId: 'convertible', sourceAchievementId: 'countryside-safety' }
  });
} finally {
  await browser.close();
}
