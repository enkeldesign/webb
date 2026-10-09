import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { TROPHY_ROAD_STORAGE_VERSION } from '../turn/progression/trophy-road.js';

// TURN TUTORIAL entry (#1132) on the production page: the first-launch card, STOP
// TUTORIAL, and a full teaching lap through graduation. Same server as the
// support-feedback browser smokes. The card opens by itself only for players; a test of
// the first launch opts in with turn-tutorial-launch-under-test (tutorial-entry.js).
const target = process.env.TURN_SUPPORT_FEEDBACK_URL || 'http://127.0.0.1:8000/';
const browser = await chromium.launch({ headless: true });

async function openTurn({ played = false, launch = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(({ played, launch, storageVersion }) => {
    if (globalThis.sessionStorage.getItem('turn-tutorial-smoke-seeded')) return;
    globalThis.sessionStorage.setItem('turn-tutorial-smoke-seeded', '1');
    localStorage.setItem('turn-low-graphics-v1', '1');
    localStorage.setItem('turn-steering-mode-v1', 'manual');
    localStorage.setItem('turn-audio-enabled-v1', 'off');
    localStorage.setItem('turn-racing-music-volume-v1', '0');
    if (launch) localStorage.setItem('turn-tutorial-launch-under-test', '1');
    if (played) {
      localStorage.setItem('turn-achievements-v1', JSON.stringify({
        version: storageVersion,
        unlocked: { 'first-turn': { unlockedAt: Date.now() } }
      }));
    }
  }, { played, launch, storageVersion: TROPHY_ROAD_STORAGE_VERSION });
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.navigator, 'standalone', { configurable: true, value: true });
  });
  await page.goto(new URL('turn/', target).href);
  await page.waitForFunction(() => document.documentElement.classList.contains('turn-home-ready')
    && globalThis.__turnNextHome?.tutorial, null, { timeout: 60000 });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return { context, page, errors };
}

const inspect = (page) => page.evaluate(() => {
  const { progress, session } = globalThis.__turnNextHome.tutorial;
  const { state } = globalThis.__turnRuntime;
  return {
    card: Boolean(document.querySelector('.m8-tutorial-dialog[open]')),
    entry: Boolean(document.querySelector('.m8-how-dialog [data-tutorial-replay]')),
    tutorial: progress.get('turn-tutorial'),
    active: session.active,
    policy: state.sessionPolicy?.id || 'normal',
    running: state.running,
    track: state.trackId,
    car: state.vehicleId,
    ghosts: state.competitorLaps.map((lap) => Boolean(lap.sessionOnly)),
    firstTurn: globalThis.__turnAchievements.store.isUnlocked('first-turn'),
    tutorialAchievement: globalThis.__turnAchievements.store.isUnlocked('turn-tutorial')
  };
});

async function crossFinish(page) {
  const lap = await page.evaluate(() => globalThis.__turnRuntime.state.lap);
  await page.evaluate(async () => {
    const map = JSON.parse(document.querySelector('[type="importmap"]').textContent).imports;
    const { raceNow } = await import(map['/turn/race/race-clock.js']);
    const { LAP_CHECKPOINTS } = await import('/turn/race/lap-system.js?build=20260720-r19');
    const { state, samples } = globalThis.__turnRuntime;
    const start = samples[0];
    state.lapActive = true;
    state.lapStartedAt = raceNow() - 90_000;
    state.lapCheckpointIndex = LAP_CHECKPOINTS.length;
    state.lapInvalid = false;
    state.position.copy(start.point).addScaledVector(start.tangent, -1);
    state.lapPreviousPosition = { x: state.position.x, z: state.position.z };
    state.heading = Math.atan2(start.tangent.x, start.tangent.z);
    state.velocity.copy(start.tangent).multiplyScalar(35);
    state.speed = 35;
    state.recording = Array.from({ length: 25 }, (_, i) => ({
      t: i, x: start.point.x, z: start.point.z, h: state.heading, p: i / 25
    }));
  });
  await page.waitForFunction((previous) => globalThis.__turnRuntime.state.lap > previous, lap);
}

async function run(name, options, scenario) {
  const { context, page, errors } = await openTurn(options);
  try {
    await scenario(page);
    assert.deepEqual(errors, [], `${name}: no page errors`);
    console.log(`Chromium: ${name} passed.`);
  } finally {
    await context.close();
  }
}

try {
  const showLaunchCard = (page) => page.evaluate(() => globalThis.__turnNextHome.tutorial.entry.showLaunchCard());

  await run('first launch card and SKIP TUTORIAL', { launch: true }, async (page) => {
    await page.waitForFunction(() => Boolean(document.querySelector('.m8-tutorial-dialog[open]')));
    let current = await inspect(page);
    assert.equal(current.card, true, 'A new player\'s first launch of TURN opens TURN TUTORIAL');
    const goal = /your best laps become rivals to beat/i;
    assert.match(await page.locator('.m8-tutorial-dialog .m8-tutorial-copy').innerText(), goal,
      'The first launch says what TURN is for');
    assert.match(await page.locator('.m8-how-dialog .m8-tutorial-entry').innerText(), goal,
      'So does HOW TO PLAY, for players who never see the first-launch card');
    assert.equal(current.entry, true, 'HOW TO PLAY offers TURN TUTORIAL');
    // TURN dialogs focus their heading first, so a screen reader starts at the title.
    assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest('.m8-tutorial-dialog'))), true,
      'Focus moves into the TURN TUTORIAL card');
    await page.locator('[data-tutorial-skip]').click();
    current = await inspect(page);
    assert.equal(current.card, false);
    assert.equal(current.tutorial.remindersOff, true, 'SKIP TUTORIAL turns automatic starts off');
    assert.equal(current.tutorial.status, 'not-started', 'Skipping is not completion');
    await page.reload();
    await page.waitForFunction(() => document.documentElement.classList.contains('turn-home-ready')
      && globalThis.__turnNextHome?.tutorial);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal((await inspect(page)).card, false, 'A skipped tutorial does not start on the next launch');
    assert.equal(await showLaunchCard(page), false);
  });

  await run('teaching lap, graduation and the self-ghost', {}, async (page) => {
    await showLaunchCard(page);
    await page.locator('[data-tutorial-start]').click();
    await page.waitForFunction(() => globalThis.__turnRuntime.state.running);
    await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    let current = await inspect(page);
    assert.equal(current.track, 'countryside');
    assert.equal(current.car, 'classic', 'The LEARNER CAR');
    assert.equal(current.policy, 'tutorial-lap');
    assert.deepEqual(current.ghosts, [], 'No rival drives ahead of the teaching lap');
    assert.equal(current.tutorial.status, 'in-progress');
    assert.equal(await page.locator('.turn-tutorial-prompt').count(), 1, 'The lesson prompt runs with the teaching lap');
    assert.equal(await page.locator('.turn-tutorial-prompt').getAttribute('role'), 'status',
      'Lessons are spoken as well as shown');
    // Into the DRIVE stretch, just past the line.
    await page.evaluate(() => {
      const { state, samples } = globalThis.__turnRuntime;
      const sample = samples[Math.round(samples.length * 0.04)];
      state.position.copy(sample.point);
      state.heading = Math.atan2(sample.tangent.x, sample.tangent.z);
      state.velocity.copy(sample.tangent).multiplyScalar(10);
    });
    await page.waitForFunction(() => {
      const prompt = document.querySelector('.turn-tutorial-prompt');
      return prompt?.dataset.lesson === 'drive' && !prompt.hidden;
    });
    // Rotating reflows the HUD stat chips into a taller grid; the prompt follows them.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => {
      const stats = document.querySelector('#hud .topbar .stats');
      const prompt = document.querySelector('.turn-tutorial-prompt');
      return !prompt.hidden && prompt.getBoundingClientRect().top >= stats.getBoundingClientRect().bottom;
    }, null, { timeout: 5000 });
    await page.evaluate(() => globalThis.__turnRacePause?.resume?.());
    await page.setViewportSize({ width: 844, height: 390 });

    await crossFinish(page);
    assert.equal(await page.locator('.turn-tutorial-prompt').getAttribute('data-state'), 'graduated',
      'Crossing the line says the tutorial is complete');
    assert.equal(await page.evaluate(() => globalThis.__turnRuntime.state.sessionSpeedCap ?? null), null,
      'No lesson cap survives the line');
    // The completion message counts race time: a pause (or backgrounding) waits it out.
    await page.evaluate(() => globalThis.__turnRacePause.pause('player'));
    await page.waitForTimeout(4500);
    assert.equal(await page.locator('.turn-tutorial-prompt').count(), 1, 'TUTORIAL COMPLETE is still there after a pause');
    await page.evaluate(() => globalThis.__turnRacePause.resume());
    await page.waitForFunction(() => !document.querySelector('.turn-tutorial-prompt'), null, { timeout: 10000 });
    // The award is shown at this finish, once TUTORIAL COMPLETE has had its moment.
    await page.waitForFunction(() => {
      const toast = globalThis.__turnAchievements.toast;
      return toast && !toast.hidden && /TURN TUTORIAL/.test(toast.textContent);
    }, null, { timeout: 10000 });
    current = await inspect(page);
    assert.equal(current.policy, 'normal', 'The run continues as ordinary TURN');
    assert.equal(current.tutorial.status, 'completed');
    assert.deepEqual(current.ghosts, [true], 'The teaching lap is the ghost to catch, for this run only');
    assert.equal(current.firstTurn, false, 'FIRST TURN never comes from the teaching lap');
    assert.equal(current.tutorialAchievement, true, 'Finishing TURN TUTORIAL earns its own achievement at the line');
    assert.equal(current.running, true, 'No menu between the teaching lap and ordinary racing');

    await crossFinish(page);
    current = await inspect(page);
    assert.equal(current.firstTurn, true, 'The first ordinary lap earns FIRST TURN');

    await page.evaluate(() => globalThis.__turnRuntime.openHome());
    current = await inspect(page);
    assert.equal(await page.locator('.turn-tutorial-prompt').count(), 0, 'Going Home removes the prompt');
    assert.equal(current.active, false);
    assert.equal(current.policy, 'normal');
    assert.equal(current.card, false, 'A completed tutorial does not start again');
  });

  await run('existing player', { played: true, launch: true }, async (page) => {
    assert.equal((await inspect(page)).card, false, 'An existing player\'s launch does not open the tutorial');
    assert.equal(await showLaunchCard(page), false, 'An existing player is not put through the tutorial');
    const current = await inspect(page);
    assert.equal(current.tutorial.status, 'completed');
    assert.equal(current.tutorial.migrated, true);
    assert.equal(current.tutorialAchievement, false, 'Players who already knew TURN are not rewarded for a tutorial they skipped');
    assert.equal(current.entry, true, 'They can still play it from HOW TO PLAY');
  });

  await run('automated runs', {}, async (page) => {
    const current = await inspect(page);
    assert.equal(current.card, false, 'Test runs get the card only when they ask for it');
    assert.equal(current.entry, true, 'Every player has TURN TUTORIAL in HOW TO PLAY');
    assert.equal(current.tutorial.status, 'not-started');
  });
} finally {
  await browser.close();
}
