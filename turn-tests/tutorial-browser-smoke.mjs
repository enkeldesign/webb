import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { TROPHY_ROAD_STORAGE_VERSION } from '../turn/progression/trophy-road.js';

// TURN TUTORIAL entry (#1132) on the production page: the first-launch card, STOP
// TUTORIAL, and a full teaching lap through graduation. Same server as the
// support-feedback browser smokes. The card opens by itself only for players; a test of
// the first launch opts in with turn-tutorial-launch-under-test (tutorial-entry.js).
const target = process.env.TURN_SUPPORT_FEEDBACK_URL || 'http://127.0.0.1:8000/';
const browser = await chromium.launch({ headless: true });

async function openTurn({
  played = false, launch = false, steeringHelp = false, driftAttack = false, rewards = [], admin = false, introductions = false
} = {}) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(({ played, launch, steeringHelp, driftAttack, rewards, admin, introductions, storageVersion }) => {
    if (globalThis.sessionStorage.getItem('turn-tutorial-smoke-seeded')) return;
    globalThis.sessionStorage.setItem('turn-tutorial-smoke-seeded', '1');
    localStorage.setItem('turn-low-graphics-v1', '1');
    localStorage.setItem('turn-steering-mode-v1', 'manual');
    localStorage.setItem('turn-audio-enabled-v1', 'off');
    localStorage.setItem('turn-racing-music-volume-v1', '0');
    if (launch) localStorage.setItem('turn-tutorial-launch-under-test', '1');
    if (steeringHelp) localStorage.setItem('turn-tutorial-steering-help-v1', 'on');
    if (admin) localStorage.setItem('turn-admin-unlock-v1', JSON.stringify({ version: 2, activatedAt: Date.now() }));
    if (introductions) localStorage.setItem('turn-unlock-introductions-under-test', '1');
    const unlockedRewards = [...(driftAttack ? ['drift-attack'] : []), ...rewards];
    if (played || unlockedRewards.length) {
      localStorage.setItem('turn-achievements-v1', JSON.stringify({
        version: storageVersion,
        unlocked: { 'first-turn': { unlockedAt: Date.now() } },
        ...(unlockedRewards.length ? { rewards: { unlocked: unlockedRewards } } : {})
      }));
    }
  }, { played, launch, steeringHelp, driftAttack, rewards, admin, introductions, storageVersion: TROPHY_ROAD_STORAGE_VERSION });
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

// Puts the car `metres` from the centre line early in the lap, heading straight off the road.
async function leaveRoad(page, metres) {
  await page.evaluate((distance) => {
    const { state, samples } = globalThis.__turnRuntime;
    const sample = samples[Math.round(samples.length * 0.04)];
    state.position.copy(sample.point).addScaledVector(sample.normal, distance);
    state.heading = Math.atan2(sample.normal.x, sample.normal.z);
    state.velocity.copy(sample.normal).multiplyScalar(12);
    state.speed = 12;
  }, metres);
  await page.waitForTimeout(800);
  return page.evaluate(() => {
    const { state, samples } = globalThis.__turnRuntime;
    const sample = samples[state.nearestTrackIndex];
    return Math.abs((state.position.x - sample.point.x) * sample.normal.x
      + (state.position.z - sample.point.z) * sample.normal.z);
  });
}

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
    assert.equal(await page.locator('[data-tutorial-drift-attack]').isVisible(), false,
      'DRIFT ATTACK TUTORIAL waits for DRIFT ATTACK');
    assert.equal(await page.locator('[data-tutorial-flow]').isVisible(), false, 'FLOW TUTORIAL waits for FLOW');
    // TURN dialogs focus their heading first, so a screen reader starts at the title.
    assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest('.m8-tutorial-dialog'))), true,
      'Focus moves into the TURN TUTORIAL card');
    // DRIVE BY EAR TUTORIAL is an optional first route, not a gate (#1133).
    await page.waitForFunction(() => Boolean(globalThis.__turnDbeTrainingMusicSilence));
    await page.locator('[data-tutorial-dbe]').click();
    await page.waitForFunction(() => document.querySelector('#turnDbeTrainingTitle')?.closest('dialog')?.open);
    assert.equal(await page.locator('#turnDbeTrainingTitle').textContent(), 'DRIVE BY EAR TUTORIAL', 'No "101" in the name');
    assert.equal((await inspect(page)).card, false, 'One tutorial at a time');
    assert.equal(await page.evaluate(() => globalThis.__turnDbeTrainingMusicSilence.active), true,
      'The menu music goes quiet for DRIVE BY EAR TUTORIAL, as on every other way in');
    await page.locator('#turnDbeTrainingTitle').locator('xpath=ancestor::dialog').locator('[data-training-cancel]').first().click();
    await page.waitForFunction(() => Boolean(document.querySelector('.m8-tutorial-dialog[open]')));
    assert.equal(await page.evaluate(() => globalThis.__turnDbeTrainingMusicSilence.active), false,
      'And comes back when the player returns to TURN TUTORIAL');
    current = await inspect(page);
    assert.equal(current.tutorial.status, 'not-started', 'Coming back from DRIVE BY EAR TUTORIAL, TURN TUTORIAL is offered again');
    assert.equal(current.tutorial.remindersOff, false);
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

    // The DRIFT stretch names LOCK, on the drive pad; keyboard players, who have no LOCK
    // key, are told only DRIFT once they drive by keys.
    await page.evaluate(() => {
      const { state, samples } = globalThis.__turnRuntime;
      const sample = samples[Math.round(samples.length * 0.5)];
      state.position.copy(sample.point);
      state.heading = Math.atan2(sample.tangent.x, sample.tangent.z);
      state.velocity.copy(sample.tangent).multiplyScalar(10);
    });
    await page.waitForFunction(() => document.querySelector('.turn-tutorial-prompt')?.dataset.lesson === 'drift');
    assert.match(await page.locator('.turn-tutorial-prompt').textContent(), /Slide outward into LOCK/);
    await page.keyboard.press('KeyQ');
    await page.waitForFunction(() => document.querySelector('.turn-tutorial-prompt').textContent === 'DRIFTHold DRIFT through the bend.');

    // Course rescue (#1133): a big mistake on the teaching lap is held at a remote limit,
    // 14 m beyond the off-road line (0.58 x 27 m), instead of ending the lesson.
    const rescueLimit = 27 * 0.58 + 14;
    assert.ok(await leaveRoad(page, 40) <= rescueLimit + 1.5, 'The teaching lap keeps a lost car near the road');

    await crossFinish(page);
    assert.equal(await page.locator('.turn-tutorial-prompt').getAttribute('data-state'), 'graduated',
      'Crossing the line says the tutorial is complete');
    assert.ok(await leaveRoad(page, 40) > rescueLimit + 1.5, 'After the line, ordinary TURN has no rescue');
    // Back onto the road: far off it, slow CI renderers draw too few frames for the
    // race-time checks below.
    await page.evaluate(() => {
      const { state, samples } = globalThis.__turnRuntime;
      const sample = samples[Math.round(samples.length * 0.04)];
      state.position.copy(sample.point);
      state.heading = Math.atan2(sample.tangent.x, sample.tangent.z);
      state.velocity.copy(sample.tangent).multiplyScalar(10);
      state.speed = 10;
    });
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

  // Tutorial steering help (#1133): chosen in SETTINGS, it steers the teaching lap.
  await run('Tutorial steering help', { steeringHelp: true }, async (page) => {
    await showLaunchCard(page);
    await page.locator('[data-tutorial-start]').click();
    await page.waitForFunction(() => globalThis.__turnRuntime.state.running && !document.querySelector('dialog[open]'));
    await page.evaluate(() => {
      const { state, samples } = globalThis.__turnRuntime;
      const sample = samples[Math.round(samples.length * 0.04)];
      state.position.copy(sample.point);
      state.heading = Math.atan2(sample.tangent.x, sample.tangent.z);
      state.velocity.copy(sample.tangent).multiplyScalar(10);
    });
    await page.waitForFunction(() => /Steering help is on/.test(document.querySelector('.turn-tutorial-prompt')?.textContent || ''));
    // Hands off the steering with GAS held, into COUNTRYSIDE's first long bend.
    const drive = await page.evaluate(async () => {
      const { state, samples } = globalThis.__turnRuntime;
      const sample = samples[Math.round(samples.length * 0.12)];
      state.position.copy(sample.point);
      state.heading = Math.atan2(sample.tangent.x, sample.tangent.z);
      state.velocity.copy(sample.tangent).multiplyScalar(15);
      state.manualSteering = 0;
      state.touchGas = true;
      const from = state.progress;
      let offRoad = 0;
      const until = globalThis.performance.now() + 6000;
      while (globalThis.performance.now() < until) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        if (state.offRoad) offRoad += 1;
      }
      state.touchGas = false;
      return { offRoad, travelled: state.progress - from };
    });
    assert.equal(drive.offRoad, 0, 'TURN steers the teaching lap through the bend');
    assert.ok(drive.travelled > 0.08, `The car drove on (${drive.travelled.toFixed(3)} of the lap)`);

    // Mid-lap, from PAUSED: SETTINGS switches it off at once, no restart.
    await page.evaluate(() => globalThis.__turnRacePause.pause('player'));
    await page.locator('[data-pause-action="settings"]').click();
    await page.locator('label.m8-steering-help-setting').click();
    assert.equal(await page.locator('#m8SteeringHelp').isChecked(), false);
    assert.equal(await page.locator('.m8-settings-status').textContent(), 'Tutorial steering help off.');
    await page.evaluate(() => {
      for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
      globalThis.__turnRacePause.resume();
    });
    await page.waitForFunction(() => globalThis.__turnRuntime.state.sessionSteeringTarget === null);

    await crossFinish(page);
    assert.match(await page.locator('.turn-tutorial-prompt').textContent(), /Steering help ends here/,
      'The line says help was used, and that it ends there');
    assert.equal(await page.evaluate(() => globalThis.__turnRuntime.state.sessionSteeringTarget), null);
    assert.equal((await inspect(page)).tutorialAchievement, true, 'Finishing with help still completes TURN TUTORIAL');
  });

  // DRIFT ATTACK TUTORIAL (#1150): in HOW TO PLAY once DRIFT ATTACK is unlocked.
  await run('DRIFT ATTACK TUTORIAL', { driftAttack: true }, async (page) => {
    const entry = page.locator('[data-tutorial-drift-attack]');
    await page.evaluate(() => document.querySelector('.m8-how-button').click());
    await page.waitForFunction(() => document.querySelector('.m8-how-dialog')?.open);
    assert.equal(await entry.isVisible(), true, 'HOW TO PLAY offers DRIFT ATTACK TUTORIAL once DRIFT ATTACK is unlocked');
    await entry.click();
    await page.waitForFunction(() => globalThis.__turnRuntime.state.running && !document.querySelector('dialog[open]'));
    let current = await inspect(page);
    assert.equal(current.track, 'countryside');
    assert.equal(current.car, 'classic');
    assert.equal(current.policy, 'tutorial-lap', 'The teaching lap earns nothing');
    assert.equal(await page.evaluate(() => globalThis.__turnNextHome.tutorial.driftAttackSession.active), true);
    await page.evaluate(() => {
      const { state, samples } = globalThis.__turnRuntime;
      const sample = samples[Math.round(samples.length * 0.04)];
      state.position.copy(sample.point);
      state.heading = Math.atan2(sample.tangent.x, sample.tangent.z);
      state.velocity.copy(sample.tangent).multiplyScalar(10);
    });
    await page.waitForFunction(() => document.querySelector('.turn-tutorial-prompt')?.dataset.lesson === 'score');
    assert.match(await page.locator('.turn-tutorial-prompt').textContent(), /DRIFT SCORING.*BANK/);
    assert.equal(await page.locator('.turn-tutorial-prompt').getAttribute('role'), 'status', 'Spoken as well as shown');
    // A banked slide, as DRIFT ATTACK announces it (scoring/drift-attack-runtime.js).
    await page.evaluate(() => globalThis.dispatchEvent(new CustomEvent('turn:drift-score-event', { detail: { type: 'bank' } })));
    await page.waitForFunction(() => document.querySelector('.turn-tutorial-prompt')?.dataset.state === 'done');
    await page.waitForFunction(() => document.querySelector('.turn-tutorial-prompt')?.dataset.lesson === 'build', null, { timeout: 15000 });
    assert.match(await page.locator('.turn-tutorial-prompt').textContent(), /OVERCHARGE/, 'BUILD names OVERCHARGE');

    await crossFinish(page);
    assert.equal(await page.locator('.turn-tutorial-prompt').getAttribute('data-state'), 'graduated');
    current = await inspect(page);
    assert.equal(current.policy, 'normal', 'Ordinary racing follows, where CATCH THE CHARGE and HEAD START can be earned');
    assert.equal(await page.evaluate(() => globalThis.__turnNextHome.tutorial.progress.status('drift-attack')), 'completed');
    await page.evaluate(() => globalThis.__turnRuntime.openHome());
    assert.equal(await page.evaluate(() => globalThis.__turnNextHome.tutorial.driftAttackSession.active), false,
      'Going Home restores the player\'s own track and car');
    assert.equal(await page.locator('.turn-tutorial-prompt').count(), 0);
  });

  // FLOW TUTORIAL (#1149): started from the FLOW introduction, judged on FLOW's own events.
  await run('FLOW TUTORIAL', { rewards: ['flow'], introductions: true }, async (page) => {
    await page.evaluate(() => globalThis.dispatchEvent(new CustomEvent('turn:trophy-road-updated', { detail: { unlocked: ['flow'] } })));
    await page.waitForFunction(() => document.querySelector('.m8-unlock-sheet')?.open);
    const sheet = page.locator('.m8-unlock-sheet');
    assert.equal(await sheet.locator('h2').textContent(), 'FLOW');
    assert.equal(await sheet.locator('[data-unlock-action]').textContent(), 'START FLOW TUTORIAL');
    await sheet.locator('[data-unlock-action]').click();
    await page.waitForFunction(() => globalThis.__turnRuntime.state.running && !document.querySelector('dialog[open]'));
    let current = await inspect(page);
    assert.equal(current.track, 'countryside');
    assert.equal(current.policy, 'tutorial-lap', 'The teaching lap earns nothing');
    assert.equal(await page.evaluate(() => globalThis.__turnNextHome.tutorial.flowSession.active), true);
    await page.evaluate(() => {
      const { state, samples } = globalThis.__turnRuntime;
      const sample = samples[Math.round(samples.length * 0.04)];
      state.position.copy(sample.point);
      state.heading = Math.atan2(sample.tangent.x, sample.tangent.z);
      state.velocity.copy(sample.tangent).multiplyScalar(10);
    });
    await page.waitForFunction(() => document.querySelector('.turn-tutorial-prompt')?.dataset.lesson === 'slide');
    assert.match(await page.locator('.turn-tutorial-prompt').textContent(), /DRIFT AND EXIT/);
    // Techniques as FLOW announces them (scoring/flow-runtime.js).
    const flow = (detail) => page.evaluate((value) => globalThis.dispatchEvent(new CustomEvent('turn:flow-score-event', { detail: value })), detail);
    await flow({ type: 'technique', technique: 'drift', multiplier: 1 });
    await page.waitForFunction(() => document.querySelector('.turn-tutorial-prompt')?.dataset.lesson === 'combo');
    await flow({ type: 'chain-expired' });
    await page.waitForFunction(() => /chain ran out/.test(document.querySelector('.turn-tutorial-prompt').textContent));
    await flow({ type: 'technique', technique: 'drift', multiplier: 1 });
    await flow({ type: 'technique', technique: 'clean-exit', multiplier: 1.5 });
    await flow({ type: 'technique', technique: 'boost', multiplier: 2 });
    await page.waitForFunction(() => document.querySelector('.turn-tutorial-prompt')?.dataset.state === 'done');
    assert.match(await page.locator('.turn-tutorial-prompt').textContent(), /That is a COMBO/);

    await crossFinish(page);
    assert.equal(await page.locator('.turn-tutorial-prompt').getAttribute('data-state'), 'graduated');
    assert.match(await page.locator('.turn-tutorial-prompt').textContent(), /LOCK, CATCH and SHIFT count too/);
    current = await inspect(page);
    assert.equal(current.policy, 'normal');
    assert.equal(await page.evaluate(() => globalThis.__turnNextHome.tutorial.progress.status('flow')), 'completed');
    await page.evaluate(() => globalThis.__turnRuntime.openHome());
    assert.equal(await page.evaluate(() => globalThis.__turnNextHome.tutorial.flowSession.active), false);
    await page.evaluate(() => document.querySelector('.m8-how-button').click());
    await page.waitForFunction(() => document.querySelector('.m8-how-dialog')?.open);
    assert.equal(await page.locator('[data-tutorial-flow]').isVisible(), true, 'HOW TO PLAY offers it again');
  });

  // Unlock introductions (#1149): explained on Home when DRIFT ATTACK, SHIFT or FLOW unlocks.
  await run('SHIFT introduction and the GARAGE hint', { rewards: ['shift'], introductions: true }, async (page) => {
    const sheet = page.locator('.m8-unlock-sheet');
    await page.evaluate(() => globalThis.dispatchEvent(new CustomEvent('turn:trophy-road-updated', { detail: { unlocked: ['shift'] } })));
    await page.waitForFunction(() => document.querySelector('.m8-unlock-sheet')?.open);
    assert.equal(await sheet.locator('h2').textContent(), 'SHIFT');
    assert.match(await sheet.locator('.m8-unlock-note').textContent(), /GARAGE/);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'turnUnlockTitle', 'Focus starts on the title');
    await sheet.locator('[data-unlock-close]').click();
    assert.equal(await page.evaluate(() => document.querySelector('.m8-unlock-sheet').open), false, 'It stays until closed, then goes');
    assert.deepEqual(await page.evaluate(() => globalThis.__turnNextHome.unlockIntroductions.queue.snapshot()),
      { pending: [], shown: ['shift'], hints: ['garage-shift', 'race-shift'], views: {} });
    await page.evaluate(() => { void globalThis.__turnNextHome.continueToTrack(); });
    await page.waitForFunction(() => Boolean(document.querySelector('.garage-shift.is-introduced')), null, { timeout: 30000 });
    assert.equal(await page.evaluate(() => globalThis.__turnNextHome.unlockIntroductions.queue.hasHint('garage-shift')), false,
      'ACTIVATE SHIFT is pointed out once');
  });

  // The drive pad's SHIFT, pointed out in a regular race once the car has a SHIFT setup.
  await run('SHIFT callout in a regular race', { rewards: ['shift'] }, async (page) => {
    await page.evaluate(async () => {
      const queue = globalThis.__turnNextHome.unlockIntroductions.queue;
      queue.unlocked(['shift']);
      queue.introduced('shift');
      queue.consumeHint('garage-shift');
    });
    await page.evaluate(() => { void globalThis.__turnNextHome.continueToTrack(); });
    await page.waitForSelector('.garage-race', { timeout: 60000 });
    // GARAGE ignores activations during its 600 ms VoiceOver entry-tap guard.
    await page.waitForTimeout(700);
    await page.locator('.garage-race').click();
    await page.waitForFunction(() => globalThis.__turnRuntime.state.running, null, { timeout: 60000 });
    // A SHIFT setup for the car being raced, as GARAGE saves one.
    await page.evaluate(async () => {
      const shift = await import('/turn/vehicle/shift-profile.js?revision=r255-flow-shift-accessibility');
      const { vehicleId, vehicleStats } = globalThis.__turnRuntime.state;
      const keys = shift.VEHICLE_SHIFT_STAT_KEYS;
      for (let a = 0; a < keys.length; a += 1) {
        for (let b = a + 1; b < keys.length; b += 1) {
          for (let c = b + 1; c < keys.length; c += 1) {
            const reducedStats = [keys[a], keys[b], keys[c]];
            if (shift.saveVehicleShiftProfile({ vehicleId, stats: vehicleStats, reducedStats })) {
              globalThis.dispatchEvent(new CustomEvent('turn:shift-profile-change', { detail: { vehicleId } }));
              return;
            }
          }
        }
      }
    });
    await page.waitForFunction(() => document.querySelector('.drive-stack')?.classList.contains('is-shift-available'));
    // Through the start line, so the lap starts.
    await page.evaluate(() => {
      const { state, samples } = globalThis.__turnRuntime;
      const start = samples[0];
      state.position.copy(start.point).addScaledVector(start.tangent, -1);
      state.lapPreviousPosition = { x: state.position.x, z: state.position.z };
      state.heading = Math.atan2(start.tangent.x, start.tangent.z);
      state.velocity.copy(start.tangent).multiplyScalar(20);
      state.speed = 20;
    });
    await page.waitForFunction(() => globalThis.__turnRuntime.state.lapActive);
    await page.waitForFunction(() => document.querySelector('.turn-shift-callout')?.hidden === false);
    const shown = await page.evaluate(() => {
      const callout = document.querySelector('.turn-shift-callout');
      const pad = document.querySelector('.drive-pad').getBoundingClientRect();
      const box = callout.getBoundingClientRect();
      return {
        text: callout.textContent,
        role: callout.getAttribute('role'),
        beside: box.right <= pad.left && box.top < pad.bottom && box.bottom > pad.top,
        views: globalThis.__turnNextHome.unlockIntroductions.queue.snapshot().views
      };
    });
    assert.match(shown.text, /^SHIFTHold GAS, then slide outward into SHIFT/);
    assert.equal(shown.role, 'status', 'Said as well as shown');
    assert.equal(shown.beside, true, 'Beside the drive pad, on the side SHIFT slides out');
    assert.deepEqual(shown.views, { 'race-shift': 1 }, 'Counted as one race');
    // The move, made: the callout has done its job.
    await page.evaluate(() => document.querySelector('.drive-shift-bubble').click());
    await page.waitForFunction(() => document.querySelector('.turn-shift-callout').hidden);
    assert.equal(await page.evaluate(() => globalThis.__turnNextHome.unlockIntroductions.queue.hasHint('race-shift')), false,
      'Once the player has used SHIFT, it is not pointed out again');
  });

  await run('admin UNLOCK replays an introduction', { driftAttack: true, admin: true }, async (page) => {
    const admin = page.locator('.roadbook-admin');
    assert.deepEqual(await admin.locator('button').allTextContents(), ['UNLOCK DRIFT ATTACK', 'UNLOCK SHIFT', 'UNLOCK FLOW']);
    await admin.locator('[data-admin-unlock="drift-attack"]').click();
    await page.waitForFunction(() => document.querySelector('.m8-unlock-sheet')?.open);
    const sheet = page.locator('.m8-unlock-sheet');
    assert.match(await sheet.textContent(), /OVERCHARGE comes with it/);
    assert.equal(await sheet.locator('[data-unlock-action]').textContent(), 'START DRIFT ATTACK TUTORIAL');
    await sheet.locator('[data-unlock-action]').click();
    await page.waitForFunction(() => globalThis.__turnNextHome.tutorial.driftAttackSession.active
      && globalThis.__turnRuntime.state.running);
    assert.equal((await inspect(page)).policy, 'tutorial-lap', 'The introduction starts DRIFT ATTACK TUTORIAL');
  });

  // The same buttons in SETTINGS, on the Admin card with the other admin tools.
  await run('admin UNLOCK SHIFT from SETTINGS', { admin: true }, async (page) => {
    // SETTINGS, from the ☰ menu sheet as a player reaches it.
    await page.locator('.turn-home-menu-button').click();
    await page.locator('.m8-home-settings').click();
    await page.waitForFunction(() => document.querySelector('.m8-settings-dialog')?.open);
    const unlocks = page.locator('[data-turn-route-test-hud-setting] .m8-admin-unlocks');
    assert.deepEqual(await unlocks.locator('button').allTextContents(), ['UNLOCK DRIFT ATTACK', 'UNLOCK SHIFT', 'UNLOCK FLOW']);
    await unlocks.locator('[data-admin-unlock="shift"]').click();
    assert.equal(await page.evaluate(() => document.querySelector('.m8-settings-dialog').open), false,
      'SETTINGS closes so the unlock plays on Home');
    await page.waitForFunction(() => document.querySelector('.m8-unlock-sheet')?.open);
    assert.equal(await page.locator('.m8-unlock-sheet h2').textContent(), 'SHIFT');
    await page.locator('.m8-unlock-sheet [data-unlock-close]').click();
    assert.equal(await page.evaluate(() => globalThis.__turnNextHome.unlockIntroductions.queue.hasHint('garage-shift')), true,
      'Closing it arms the GARAGE hint, as a real unlock does');
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
