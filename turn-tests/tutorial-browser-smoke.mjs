import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { TROPHY_ROAD_STORAGE_VERSION } from '../turn/progression/trophy-road.js';
import { DRIFT_ATTACK_LESSONS } from '../turn/tutorial/drift-attack-lessons.js';
import { FLOW_LESSONS } from '../turn/tutorial/flow-tutorial.js';
import { TURN_TUTORIAL_LESSONS } from '../turn/tutorial/turn-tutorial-lessons.js';

// TURN TUTORIAL entry (#1132) on the production page: the first-launch card, STOP
// TUTORIAL, and a full teaching lap through graduation. Same server as the
// support-feedback browser smokes. The card opens by itself only for players; a test of
// the first launch opts in with turn-tutorial-launch-under-test (tutorial-entry.js).
const target = process.env.TURN_SUPPORT_FEEDBACK_URL || 'http://127.0.0.1:8000/';
const browser = await chromium.launch({ headless: true });

async function openTurn({
  played = false, launch = false, steeringHelp = false, driftAttack = false, rewards = [], admin = false, introductions = false,
  howToPlayRead = [], viewport = { width: 844, height: 390 }, handedness = null, textSize = 0
} = {}) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  // The browser's own text size (Chromium), as the GARAGE smoke sets it.
  if (textSize) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Page.setFontSizes', { fontSizes: { standard: textSize, fixed: Math.round(textSize * 0.8) } });
  }
  if (handedness) await page.addInitScript((hand) => localStorage.setItem('turn-control-handedness-v1', hand), handedness);
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(({ played, launch, steeringHelp, driftAttack, rewards, admin, introductions, howToPlayRead, storageVersion }) => {
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
        ...(unlockedRewards.length ? { rewards: { unlocked: unlockedRewards } } : {}),
        ...(howToPlayRead.length ? { progress: { howToPlayDisclosures: howToPlayRead } } : {})
      }));
    }
  }, { played, launch, steeringHelp, driftAttack, rewards, admin, introductions, howToPlayRead, storageVersion: TROPHY_ROAD_STORAGE_VERSION });
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
    // Teleport the whole race position together: stale progress near a lesson
    // boundary could otherwise open a new teaching hold before this finish tick.
    state.nearestTrackIndex = samples.length - 1;
    state.progress = state.nearestTrackIndex / samples.length;
    state.position.copy(start.point).addScaledVector(start.tangent, -1);
    state.lapPreviousPosition = { x: state.position.x, z: state.position.z };
    state.heading = Math.atan2(start.tangent.x, start.tangent.z);
    state.velocity.copy(start.tangent).multiplyScalar(35);
    state.speed = 35;
    state.recording = Array.from({ length: 120 }, (_, i) => {
      const sample = samples[Math.floor(samples.length * i / 120)];
      return { t: 90 * i / 120, x: sample.point.x, z: sample.point.z,
        h: Math.atan2(sample.tangent.x, sample.tangent.z), p: i / 120 };
    });
  });
  if (await page.evaluate(() => globalThis.__turnRacePause.reason === 'lesson')) await acceptLesson(page);
  await page.waitForFunction((previous) => globalThis.__turnRuntime.state.lap > previous, lap);
}

async function acceptLesson(page, id = null) {
  const card = page.locator('.turn-tutorial-card[data-ready="true"]');
  await card.waitFor();
  if (id) assert.equal(await card.getAttribute('data-lesson'), id);
  assert.equal(await card.getAttribute('aria-labelledby'), 'turnTutorialCardTitle');
  const action = await card.getAttribute('data-resume-action');
  if (action) {
    assert.equal(await card.locator('button').count(), 0, 'Control lessons have no continuation button');
    assert.equal(await page.locator('dialog.turn-tutorial-card').count(), 0, 'The lesson does not make the live controls modal/inert');
    const secondary = page.locator(`#controls .is-tutorial-target:not(.drive-${action}-zone)`);
    if (await secondary.count()) {
      await secondary.first().click();
      assert.equal(await card.count(), 1, 'A later action in the sequence cannot dismiss the lesson');
    }
    const control = page.locator(`.drive-${action}-zone`);
    assert.match(await control.getAttribute('aria-describedby'), /turnTutorialResumeText/, 'The live control describes how to resume');
    // #1212: a quiet line in the card's bottom-right corner says which control continues.
    const hint = await card.locator('.turn-tutorial-card-hint').evaluate((el) => ({
      text: el.textContent, align: globalThis.getComputedStyle(el).textAlign, last: el === el.parentElement.lastElementChild
    }));
    assert.deepEqual(hint, { text: `Hold ${action.toUpperCase()} to continue`, align: 'end', last: true });
    assert.deepEqual(await padOverlaps(page), [], 'The lesson card leaves the pads clear');
    assert.equal(await control.evaluate((el) => Boolean(el.closest('[inert]'))), false);
    const box = await control.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForFunction((zone) => !globalThis.__turnRacePause.paused
      && document.querySelector('.drive-pad').dataset.driveZone === zone
      && (zone !== 'boost' || (globalThis.__turnBoostActive && globalThis.__turnBoostCharge < 1)), action);
    await page.mouse.up();
  } else await card.locator('button').click();
  await page.waitForFunction(() => !document.querySelector('.turn-tutorial-card[data-ready="true"]'));
  assert.equal(await page.locator('.turn-tutorial-voice').textContent(), '', 'Resuming adds no duplicate announcement');
}

const LONGEST_LESSON_PROMPT = [...TURN_TUTORIAL_LESSONS, ...DRIFT_ATTACK_LESSONS, ...FLOW_LESSONS]
  .map((lesson) => lesson.prompt).sort((a, b) => b.length - a.length)[0];

// Where the lesson card overlaps the drive pad, its bubbles or the steering pad (#1212).
const padOverlaps = (page) => page.evaluate(() => {
  const card = document.querySelector('.turn-tutorial-card[data-ready="true"]')?.getBoundingClientRect();
  if (!card) return ['no card'];
  return [...document.querySelectorAll('#controls .drive-stack, #controls .drive-pad, .drive-lock-bubble, .drive-shift-bubble, .drive-reverse-bubble, #manualSteer')]
    .filter((pad) => !pad.closest('[hidden]'))
    .map((pad) => ({ name: pad.className || pad.id, rect: pad.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width > 0 && rect.height > 0
      && card.left < rect.right && card.right > rect.left && card.top < rect.bottom && card.bottom > rect.top)
    .map(({ name }) => name);
});

async function restartTutorial(page, first, paused = true) {
  if (paused) {
    await page.evaluate(() => globalThis.__turnRacePause.pause('player'));
    await page.locator('[data-pause-action="restart"]').click();
  } else await page.locator('#resetButton').click();
  await page.locator('.turn-tutorial-card[data-ready="true"]').waitFor();
  assert.deepEqual(await page.evaluate(() => ({
    mode: globalThis.__turnRuntime.state.mode,
    paused: globalThis.__turnRacePause.paused,
    prompts: document.querySelectorAll('.turn-tutorial-prompt').length,
    cards: document.querySelectorAll('.turn-tutorial-card').length
  })), { mode: 'staged', paused: false, prompts: 1, cards: 1 }, 'Restart returns to the line with one fresh tutorial and no old pause');
  await acceptLesson(page, first);
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
    // #1170: before the buttons, the card says DRIVE BY EAR can come first, when it can.
    assert.equal(await page.evaluate(() => {
      const note = document.querySelector('.m8-tutorial-dialog [data-tutorial-dbe-note]');
      const button = document.querySelector('.m8-tutorial-dialog [data-tutorial-dbe]');
      return note.hidden === button.hidden && /learn them first/.test(note.textContent)
        && document.querySelector('#turnTutorialCopy').contains(note);
    }), true, 'Part of the card copy, heard before START TUTORIAL');
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
    await page.locator('.turn-tutorial-card[data-ready="true"]').waitFor();
    assert.equal(await page.evaluate(() => globalThis.__turnRuntime.state.mode), 'staged', 'DRIVE teaches before the first action');
    await page.keyboard.press('KeyE');
    assert.equal(await page.evaluate(() => globalThis.__turnRuntime.state.mode), 'staged', 'The wrong control cannot bypass the lesson');
    assert.equal(await page.locator('.turn-tutorial-card[data-ready="true"]').count(), 1);
    await acceptLesson(page, 'drive');
    await page.dispatchEvent('#controls', 'pointerdown');
    let current = await inspect(page);
    assert.equal(current.track, 'countryside');
    assert.equal(current.car, 'classic', 'The LEARNER CAR');
    assert.equal(current.policy, 'tutorial-lap');
    assert.deepEqual(current.ghosts, [], 'No rival drives ahead of the teaching lap');
    assert.equal(current.tutorial.status, 'in-progress');
    assert.equal(await page.locator('.turn-tutorial-prompt').count(), 1, 'The lesson prompt runs with the teaching lap');
    // Shown in the box, said by the voice (#1133): the box itself is not a live region,
    // so a lesson is said once, when the race has nothing else to say.
    assert.equal(await page.locator('.turn-tutorial-prompt').getAttribute('aria-live'), null);
    assert.equal(await page.locator('.turn-tutorial-voice').getAttribute('aria-live'), 'polite',
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
    assert.equal(await page.locator('.turn-tutorial-voice').textContent(), '', 'Acknowledged DRIVE remains a silent reminder');
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
      // The DRIFT stretch, where the long curve begins (#1166).
      const sample = samples[Math.round(samples.length * 0.25)];
      state.position.copy(sample.point);
      state.heading = Math.atan2(sample.tangent.x, sample.tangent.z);
      state.velocity.copy(sample.tangent).multiplyScalar(10);
    });
    await page.waitForFunction(() => document.querySelector('.turn-tutorial-prompt')?.dataset.lesson === 'drift');
    assert.match(await page.locator('.turn-tutorial-prompt').textContent(), /Slide outward into LOCK/);
    await page.locator('.turn-tutorial-card[data-ready="true"]').waitFor();
    await page.keyboard.down('KeyQ');
    assert.equal(await page.evaluate(() => globalThis.__turnRacePause.paused), false, 'The first Q releases the hold');
    assert.equal(await page.evaluate(() => globalThis.__turnDriftHeld), true, 'That same Q is already drifting');
    await page.keyboard.up('KeyQ');
    await page.waitForFunction(() => document.querySelector('.turn-tutorial-prompt').textContent === 'DRIFTHold DRIFT through the turn.');

    // RESTART LAP from PAUSED over a lesson discards its old progress and card.
    await restartTutorial(page, 'drive');
    await page.evaluate(() => {
      const { state, samples } = globalThis.__turnRuntime;
      const sample = samples[Math.round(samples.length * 0.25)];
      state.position.copy(sample.point);
      state.heading = Math.atan2(sample.tangent.x, sample.tangent.z);
      state.velocity.copy(sample.tangent).multiplyScalar(10);
    });
    await acceptLesson(page, 'drift');

    // Course rescue (#1133): a big mistake on the teaching lap is held at a remote limit,
    // 14 m beyond the off-road line (0.58 x 27 m), instead of ending the lesson.
    const rescueLimit = 27 * 0.58 + 14;
    assert.ok(await leaveRoad(page, 40) <= rescueLimit + 1.5, 'The teaching lap keeps a lost car near the road');

    await crossFinish(page);
    assert.equal(await page.locator('.turn-tutorial-prompt').getAttribute('data-state'), 'graduated',
      'Crossing the line says the tutorial is complete');
    assert.match(await page.locator('.turn-tutorial-prompt').textContent(),
      /^TUTORIAL COMPLETE!The ghost of your last lap is now your rival\. Can you beat it\?$/);
    assert.doesNotMatch(await page.locator('.turn-tutorial-voice').textContent(), /Tutorial complete/i,
      'The lap result is said first: the line waits for it');
    await page.waitForFunction(() => {
      const { state, competitorCars, camera } = globalThis.__turnRuntime;
      const rival = competitorCars[0];
      const screen = rival.position.clone().project(camera);
      const delta = rival.position.clone().sub(state.position);
      return rival.visible && delta.x * Math.sin(state.heading) + delta.z * Math.cos(state.heading) > 15
        && Math.abs(screen.x) < 0.9 && Math.abs(screen.y) < 0.95 && screen.z > -1 && screen.z < 1;
    }, null, { timeout: 5000 });
    await page.evaluate(() => globalThis.__turnRacePause.pause('player'));
    for (const viewport of [{ width: 1024, height: 768 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      const visible = await page.evaluate(() => {
        const { state, competitorCars, camera, lapFrameAt } = globalThis.__turnRuntime;
        const rival = competitorCars[0];
        const screen = rival.position.clone().project(camera);
        const official = lapFrameAt(state.competitorLaps[0], state.lapElapsed);
        return rival.visible && Math.abs(screen.x) < 1 && Math.abs(screen.y) < 1
          && Math.hypot(rival.position.x - official.x, rival.position.z - official.z) > 15;
      });
      assert.equal(visible, true, `Tutorial rival is visibly advanced at ${viewport.width}×${viewport.height}`);
    }
    await page.evaluate(() => globalThis.__turnRacePause.resume());
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
    await page.waitForFunction(() => /^Tutorial complete! /.test(document.querySelector('.turn-tutorial-voice')?.textContent || ''),
      null, { timeout: 10000 });
    // The run ends once its last words have been said: the award is not said over them.
    await page.waitForFunction(() => !document.querySelector('.turn-tutorial-prompt'), null, { timeout: 15000 });
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

  // #1212: a lesson card never covers the drive pad or the steering pad: either hand,
  // landscape and portrait, phone and tablet, and with the browser's text at 200%.
  const sizes = [[844, 390], [667, 375], [932, 430], [390, 844], [1180, 820], [820, 1180]];
  for (const [label, options, screens] of [
    ['right hand', { handedness: 'right' }, sizes],
    ['left hand', { handedness: 'left' }, sizes],
    ['200% text', { textSize: 32 }, [[844, 390], [390, 844], [1180, 820]]]
  ]) {
    await run(`lesson cards leave the pads clear (${label})`, { launch: true, ...options }, async (page) => {
      await showLaunchCard(page);
      await page.locator('[data-tutorial-start]').click();
      await page.locator('.turn-tutorial-card[data-ready="true"]').waitFor();
      // The tallest card any lesson shows: DRIFT SCORING's prompt, with its hint.
      await page.evaluate((prompt) => {
        document.querySelector('.turn-tutorial-card[data-ready="true"] p').textContent = prompt;
        globalThis.dispatchEvent(new globalThis.Event('resize'));
      }, LONGEST_LESSON_PROMPT);
      for (const [width, height] of screens) {
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(250);
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.deepEqual(await padOverlaps(page), [], `${width}×${height}: the card leaves the pads clear`);
        const card = await page.locator('.turn-tutorial-card[data-ready="true"]').boundingBox();
        assert.ok(card.x >= 0 && card.x + card.width <= width && card.height > 40, `${width}×${height}: the card stays on screen and readable`);
      }
    });
  }

  await run('real BOOST input from a teaching hold', { steeringHelp: true }, async (page) => {
    await showLaunchCard(page);
    await page.locator('[data-tutorial-start]').click();
    await acceptLesson(page, 'drive');
    // #1212: BOOST is already held as its lesson appears.
    await page.keyboard.down('KeyE');
    await page.evaluate(() => {
      const { state, samples } = globalThis.__turnRuntime;
      const sample = samples[Math.round(samples.length * 0.55)];
      state.position.copy(sample.point);
      state.heading = Math.atan2(sample.tangent.x, sample.tangent.z);
      state.velocity.copy(sample.tangent).multiplyScalar(60);
      state.speed = 60;
      state.lapActive = true;
    });
    const card = page.locator('.turn-tutorial-card[data-ready="true"][data-lesson="boost"]');
    await card.waitFor();
    // That hold cannot dismiss it, nor can another BOOST press while it lasts; letting
    // go re-arms it, with no wait (#1212).
    const boostBox = await page.locator('.drive-boost-zone').boundingBox();
    await page.mouse.move(boostBox.x + boostBox.width / 2, boostBox.y + boostBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => globalThis.__turnRacePause.reason), 'lesson',
      'A control already held as its lesson appears cannot dismiss it');
    await page.mouse.up();
    await page.keyboard.up('KeyE');
    const frozen = () => page.evaluate(() => {
      const { state } = globalThis.__turnRuntime;
      return [state.position.x, state.position.z, state.speed, state.lapElapsed, globalThis.__turnBoostCharge];
    });
    const before = await frozen();
    await page.waitForTimeout(200);
    assert.deepEqual(await frozen(), before, 'The world, clock and resource freeze immediately');
    assert.equal(await card.locator('button').count(), 0);
    assert.equal(await page.locator('.drive-boost-zone').evaluate((el) => globalThis.getComputedStyle(el).animationName), 'none', 'Reduce Motion keeps a static target');
    assert.equal(await page.locator('.turn-tutorial-dim').evaluate((el) => globalThis.getComputedStyle(el).opacity), '0.13');
    await page.locator('.drive-reverse-bubble').focus();
    await page.keyboard.down('Enter');
    assert.equal(await page.evaluate(() => globalThis.__turnRuntime.state.touchReverse), false, 'Native REVERSE cannot queue an action behind the lesson');
    await page.keyboard.up('Enter');
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press('KeyQ');
    assert.equal(await page.evaluate(() => globalThis.__turnRacePause.reason), 'lesson', 'DRIFT cannot release BOOST');
    await page.keyboard.down('KeyE');
    await page.waitForFunction(() => globalThis.__turnBoostActive && globalThis.__turnBoostCharge < 1);
    assert.equal(await page.evaluate(() => globalThis.__turnRacePause.paused), false);
    assert.equal(await page.evaluate(() => globalThis.__turnRuntime.state.sessionSpeedCap ?? null), null, 'No capped teaching frame after release');
    await page.waitForFunction((speed) => globalThis.__turnRuntime.state.speed > speed, before[2]);
    await page.keyboard.up('KeyE');
    assert.equal(await page.locator('.turn-tutorial-voice').textContent(), '');
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.turn-tutorial-dim').evaluate((el) => globalThis.getComputedStyle(el).opacity), '0');
  });

  // Tutorial steering help (#1133): chosen in SETTINGS, it steers the teaching lap.
  await run('Tutorial steering help', { steeringHelp: true }, async (page) => {
    await showLaunchCard(page);
    await page.locator('[data-tutorial-start]').click();
    await page.waitForFunction(() => globalThis.__turnRuntime.state.running);
    await acceptLesson(page);
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
      const sample = samples[Math.round(samples.length * 0.04)];
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
    assert.equal(await page.evaluate(() => globalThis.__turnRuntime.state.sessionSteeringTarget), null,
      'Switching help off clears the steering target while still paused');
    await page.evaluate(() => {
      for (const dialog of document.querySelectorAll('dialog[open]:not(.turn-tutorial-card)')) dialog.close();
      globalThis.__turnRacePause.resume();
    });
    if (await page.evaluate(() => globalThis.__turnRacePause.reason === 'lesson')) await acceptLesson(page);
    await page.waitForFunction(() => globalThis.__turnRuntime.state.sessionSteeringTarget === null);

    await crossFinish(page);
    assert.match(await page.locator('.turn-tutorial-prompt').textContent(), /Steering help ends here/,
      'The line says help was used, and that it ends there');
    assert.equal(await page.evaluate(() => globalThis.__turnRuntime.state.sessionSteeringTarget), null);
    assert.equal((await inspect(page)).tutorialAchievement, true, 'Finishing with help still completes TURN TUTORIAL');
  });

  // DRIFT ATTACK TUTORIAL (#1150): in HOW TO PLAY once DRIFT ATTACK is unlocked.
  await run('DRIFT ATTACK TUTORIAL', { driftAttack: true }, async (page) => {
    await page.evaluate(() => document.querySelector('.m8-how-button').click());
    await page.waitForFunction(() => document.querySelector('.m8-how-dialog')?.open);
    // #1169: two or more tutorials sit behind one TUTORIALS button.
    assert.equal(await page.locator('.m8-how-dialog [data-tutorials-open]').isVisible(), true, 'One TUTORIALS button');
    assert.equal(await page.locator('.m8-how-dialog [data-tutorial-replay]').isVisible(), false, 'Not a stack of tutorial buttons');
    assert.equal(await page.locator('.m8-how-dialog [data-tutorial-drift-attack]').isVisible(), false);
    await page.locator('.m8-how-dialog [data-tutorials-open]').click();
    await page.waitForFunction(() => document.querySelector('.m8-tutorials-sheet')?.open);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'turnTutorialsTitle', 'Focus starts on the title');
    assert.equal(await page.evaluate(() => document.querySelectorAll('dialog[open]').length), 1,
      'One modal at a time: the sheet stands in for HOW TO PLAY');
    const listed = await page.locator('.m8-tutorials-sheet [data-tutorial-pick]').evaluateAll((buttons) => buttons.map((b) => b.dataset.tutorialPick));
    assert.deepEqual(listed.filter((id) => id !== 'drive-by-ear'), ['turn-tutorial', 'drift-attack'],
      'In the order a player meets them; FLOW is not listed before it unlocks');
    const entry = page.locator('.m8-tutorials-sheet [data-tutorial-pick="drift-attack"]');
    assert.equal(await entry.isVisible(), true, 'TUTORIALS offers DRIFT ATTACK TUTORIAL once DRIFT ATTACK is unlocked');
    await entry.click();
    await page.waitForFunction(() => globalThis.__turnRuntime.state.running);
    await acceptLesson(page);
    let current = await inspect(page);
    assert.equal(current.track, 'cliffside', 'A track to drift on');
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
    assert.match(await page.locator('.turn-tutorial-prompt').textContent(), /DRIFT SCORING.*LOCK.*BANK/, 'LOCK first: it may start the slide');
    assert.equal(await page.locator('.turn-tutorial-voice').getAttribute('aria-live'), 'polite', 'Spoken as well as shown');
    // A banked slide, as DRIFT ATTACK announces it (scoring/drift-attack-runtime.js).
    await page.evaluate(() => globalThis.dispatchEvent(new CustomEvent('turn:drift-score-event', { detail: { type: 'bank' } })));
    await page.waitForFunction(() => document.querySelector('.turn-tutorial-prompt')?.dataset.state === 'done');
    await page.waitForFunction(() => document.querySelector('.turn-tutorial-prompt')?.dataset.lesson === 'link', null, { timeout: 15000 });
    await acceptLesson(page, 'link');
    // A drift linked to the last bank, as DRIFT ATTACK announces its higher COMBO.
    await page.evaluate(() => globalThis.dispatchEvent(new CustomEvent('turn:drift-score-event', { detail: { type: 'milestone', multiplier: 2 } })));
    await page.waitForFunction(() => document.querySelector('.turn-tutorial-prompt')?.dataset.state === 'done');
    await page.waitForFunction(() => document.querySelector('.turn-tutorial-prompt')?.dataset.lesson === 'build', null, { timeout: 15000 });
    assert.match(await page.locator('.turn-tutorial-prompt').textContent(), /OVERCHARGE/, 'BUILD names OVERCHARGE');
    await acceptLesson(page, 'build');
    await restartTutorial(page, 'score', false);
    assert.equal(await page.locator('.turn-tutorial-prompt').getAttribute('data-state'), 'lesson', 'Old banks and links do not complete the restarted lesson');

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
    await page.waitForFunction(() => globalThis.__turnRuntime.state.running);
    await acceptLesson(page);
    let current = await inspect(page);
    assert.equal(current.track, 'cliffside');
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
    assert.equal(await page.evaluate(() => globalThis.__turnRacePause.reason), 'lesson');
    assert.equal(await page.locator('.drive-stack .is-flow-pulse').count(), 0, 'The new lesson clears race pulses while paused');
    await restartTutorial(page, 'slide');
    await flow({ type: 'technique', technique: 'boost', multiplier: 2 });
    assert.equal(await page.locator('.turn-tutorial-prompt').getAttribute('data-lesson'), 'slide', 'The old DRIFT no longer counts after restart');
    // Stage the new lap before scoring its next technique.
    await page.evaluate(() => {
      const { state, samples } = globalThis.__turnRuntime;
      const sample = samples[Math.round(samples.length * 0.04)];
      state.position.copy(sample.point);
      state.heading = Math.atan2(sample.tangent.x, sample.tangent.z);
      state.velocity.copy(sample.tangent).multiplyScalar(10);
    });
    await page.waitForFunction(() => globalThis.__turnRuntime.state.mode === 'racing');
    await flow({ type: 'technique', technique: 'drift', multiplier: 1 });
    await acceptLesson(page, 'combo');
    await flow({ type: 'chain-expired' });
    await page.waitForFunction(() => /chain ran out/.test(document.querySelector('.turn-tutorial-prompt').textContent));
    await flow({ type: 'technique', technique: 'drift', multiplier: 1 });
    await flow({ type: 'technique', technique: 'clean-exit', multiplier: 1.5 });
    await flow({ type: 'technique', technique: 'boost', multiplier: 2 });
    assert.equal(await page.locator('.drive-boost-zone').evaluate((element) => element.classList.contains('is-flow-pulse')), true, 'BOOST pulses BOOST');
    await page.waitForFunction(() => document.querySelector('.turn-tutorial-prompt')?.dataset.state === 'done');
    assert.match(await page.locator('.turn-tutorial-prompt').textContent(), /That is a COMBO/);
    // LOCK banks after the drift ends, when its bubble is tucked away: it slides out to pulse.
    await flow({ type: 'technique', technique: 'lock', multiplier: 2 });
    // The bubble fades in over the race's 80 ms (drive-pad.css): wait for it, within the pulse.
    await page.waitForFunction(() => {
      const lock = document.querySelector('.drive-lock-bubble');
      return !lock.closest('.is-drift-ready') && lock.classList.contains('is-flow-pulse')
        && globalThis.getComputedStyle(lock).opacity === '1';
    }, null, { timeout: 500 }).catch(() => assert.fail('LOCK shows for its pulse'));
    // Forced colours drop box-shadow: the pulse is an outline there.
    await page.emulateMedia({ forcedColors: 'active' });
    await flow({ type: 'technique', technique: 'boost', multiplier: 2 });
    assert.equal(await page.locator('.drive-boost-zone').evaluate((element) => element.classList.contains('is-flow-pulse')
      && globalThis.getComputedStyle(element).outlineStyle), 'solid', 'Seen in forced colours');
    await page.emulateMedia({ forcedColors: 'none' });

    await crossFinish(page);
    assert.equal(await page.locator('.turn-tutorial-prompt').getAttribute('data-state'), 'graduated');
    assert.match(await page.locator('.turn-tutorial-prompt').textContent(), /LOCK, CATCH and SHIFT count too/);
    current = await inspect(page);
    assert.equal(current.policy, 'normal');
    assert.equal(await page.evaluate(() => globalThis.__turnNextHome.tutorial.progress.status('flow')), 'completed');
    await page.evaluate(() => globalThis.__turnRuntime.openHome());
    assert.equal(await page.evaluate(() => globalThis.__turnNextHome.tutorial.flowSession.active), false);
    // The lap was finished, so Home first shows THIS VISIT (race/visit-summary.js).
    await page.locator('.turn-visit-summary-dialog[open] .turn-visit-summary-close').click();
    await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    await page.evaluate(() => document.querySelector('.m8-how-button').click());
    await page.waitForFunction(() => document.querySelector('.m8-how-dialog')?.open);
    await page.locator('.m8-how-dialog [data-tutorials-open]').click();
    await page.waitForFunction(() => document.querySelector('.m8-tutorials-sheet')?.open);
    assert.equal(await page.locator('.m8-tutorials-sheet [data-tutorial-pick="flow"]').isVisible(), true, 'TUTORIALS offers it again');
    assert.match(await page.locator('#turnTutorialsCopy-flow').textContent(), /DONE$/, 'Marked done');
    // Closing the sheet brings HOW TO PLAY back, on TUTORIALS, still returning to its own
    // trigger when it closes.
    await page.locator('.m8-tutorials-sheet [data-tutorials-close]').click();
    await page.waitForFunction(() => document.querySelector('.m8-how-dialog')?.open
      && !document.querySelector('.m8-tutorials-sheet')?.open
      && document.activeElement?.matches('[data-tutorials-open]'));
    assert.equal(await page.evaluate(() => document.querySelector('.m8-how-dialog').__turnReturnFocus
      === document.querySelector('.m8-how-button')), true);
  });

  // Unlock introductions (#1149): explained on Home when DRIFT ATTACK, SHIFT or FLOW unlocks.
  await run('SHIFT introduction and the GARAGE hint', { rewards: ['shift'], introductions: true }, async (page) => {
    const sheet = page.locator('.m8-unlock-sheet');
    await page.evaluate(() => globalThis.dispatchEvent(new CustomEvent('turn:trophy-road-updated', { detail: { unlocked: ['shift'] } })));
    await page.waitForFunction(() => document.querySelector('.m8-unlock-sheet')?.open);
    assert.equal(await sheet.locator('h2').textContent(), 'SHIFT');
    assert.match(await sheet.locator('.m8-unlock-note').textContent(), /GARAGE/);
    // #1230: SHIFT's Trophy Road icon in the corner below the title, hidden from assistive
    // technology, the copy wrapping around it.
    assert.deepEqual(await page.evaluate(() => {
      const copy = document.querySelector('.m8-unlock-sheet .m8-unlock-copy');
      const mark = copy.querySelector(':scope > .turn-corner-mark');
      const box = mark.getBoundingClientRect();
      const frame = copy.getBoundingClientRect();
      const lines = [...copy.querySelectorAll('p')].flatMap((paragraph) => {
        const range = document.createRange();
        range.selectNodeContents(paragraph);
        return [...range.getClientRects()];
      });
      return {
        hidden: mark.getAttribute('aria-hidden'),
        shift: Boolean(mark.querySelector('.turn-trophy-road-authored-icon.is-shift')),
        corner: Math.abs(box.right - frame.right) <= 1 && Math.abs(box.top - frame.top) <= 1,
        belowTitle: box.top >= document.querySelector('#turnUnlockTitle').getBoundingClientRect().bottom,
        overlaps: lines.filter((line) => line.left < box.right && line.right > box.left && line.top < box.bottom && line.bottom > box.top).length
      };
    }), { hidden: 'true', shift: true, corner: true, belowTitle: true, overlaps: 0 }, 'SHIFT\'s corner mark sits below the title, clear of the copy');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'turnUnlockTitle', 'Focus starts on the title');
    assert.match(await sheet.textContent(), /SEDAN has 3 in every attribute/);
    // No preset: the SEDAN (any trade is legal) is where the player builds a setup.
    assert.equal(await sheet.locator('[data-unlock-action]').textContent(), 'TRY SHIFT IN THE SEDAN');
    await sheet.locator('[data-unlock-action]').click();
    assert.equal(await page.evaluate(() => document.querySelector('.m8-unlock-sheet').open), false, 'It stays until closed, then goes');
    await page.waitForFunction(() => Boolean(document.querySelector('.garage-shift.is-introduced')), null, { timeout: 30000 });
    assert.equal(await page.evaluate(() => globalThis.__turnGarage.getViewedCarId()), 'sedan', 'GARAGE opens on the SEDAN');
    assert.deepEqual(await page.evaluate(() => globalThis.__turnNextHome.unlockIntroductions.queue.snapshot()),
      { pending: [], shown: ['shift'], hints: ['garage-all-cars', 'race-shift'], views: {}, once: ['garage-all-cars-until-used'] },
      'ALL CARS waits: this GARAGE was opened for the player, and points at ACTIVATE SHIFT');
    assert.equal(await page.evaluate(() => globalThis.__turnNextHome.unlockIntroductions.queue.hasHint('garage-shift')), false,
      'ACTIVATE SHIFT is pointed out once');
    assert.deepEqual(await page.evaluate(() => ['is-introduced', 'is-suggested']
      .map((name) => document.querySelector('.garage-all-cars-button').classList.contains(name))), [false, false],
    'ALL CARS neither pulses nor waits with a calm pulse before its own introduction');
  });

  // PERKULATOR (#1219) came with a release: a player who already has it is introduced
  // once as Home opens, and OPEN GARAGE points out PERK.
  await run('PERKULATOR introduction for a player who has it, and the GARAGE PERK hint', { rewards: ['perkulator'], introductions: true }, async (page) => {
    const sheet = page.locator('.m8-unlock-sheet');
    await page.waitForFunction(() => document.querySelector('.m8-unlock-sheet')?.open, null, { timeout: 30000 });
    assert.equal(await sheet.locator('h2').textContent(), 'PERKULATOR');
    assert.match(await sheet.textContent(), /In GARAGE, under PERK, install any perk you have unlocked/);
    assert.match(await sheet.locator('.m8-unlock-note').textContent(), /GARAGE highlights PERK/);
    assert.equal(await sheet.locator('[data-unlock-action]').textContent(), 'OPEN GARAGE');
    await sheet.locator('[data-unlock-action]').click();
    await page.waitForFunction(() => Boolean(document.querySelector('.garage-perk .garage-disclosure-toggle.is-introduced')), null, { timeout: 30000 });
    const queue = await page.evaluate(() => globalThis.__turnNextHome.unlockIntroductions.queue.snapshot());
    assert.deepEqual([queue.pending, queue.shown], [[], ['perkulator']], 'Introduced, and only once');
    assert.equal(queue.hints.includes('garage-perk'), false, 'PERK is pointed out once');
  });

  // #1168 and #1167: the first GARAGE the player opens points at ALL CARS; after SHIFT
  // unlocks, the first RACE on a car with no SHIFT setup points at ACTIVATE SHIFT.
  await run('GARAGE points at ALL CARS, then RACE at ACTIVATE SHIFT', { rewards: ['shift'], introductions: true }, async (page) => {
    // With motion, as most players see it: the pulse itself has to be drawn, not only
    // its class set (#1168).
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => { void globalThis.__turnNextHome.continueToTrack(); });
    await page.waitForFunction(() => document.querySelector('.garage-all-cars-button')?.classList.contains('is-introduced'), null, { timeout: 60000 });
    // The ring around ALL CARS at its widest over `ms`, as the cascade resolves it:
    // a declaration that outranks the animation leaves nothing drawn. ALL CARS is a
    // coloured control whose box-shadow is !important (controls.css), which hid both
    // pulses on phones until r458.
    const ringPeak = (ms) => page.locator('.garage-all-cars-button').evaluate(async (button, ms) => {
      let peak = 0;
      const end = globalThis.performance.now() + ms;
      while (globalThis.performance.now() < end) {
        const style = globalThis.getComputedStyle(button);
        if (style.outlineStyle !== 'none') peak = Math.max(peak, parseFloat(style.outlineWidth) || 0);
        await new Promise((resolve) => globalThis.requestAnimationFrame(resolve));
      }
      return peak;
    }, ms);
    const pointing = await ringPeak(2400);
    assert.ok(pointing >= 5, `The first pointing-out draws a ring around ALL CARS (${pointing}px)`);
    await page.waitForFunction(() => document.querySelector('#turnGarage .m8-unlock-hint-status')?.textContent
      === 'New in GARAGE: ALL CARS, every car and what unlocks it.', null, { timeout: 5000 });
    // #1189: said once, then a calm pulse until ALL CARS is used.
    const queueState = () => page.evaluate(() => {
      const queue = globalThis.__turnNextHome.unlockIntroductions.queue;
      return { armed: queue.hasHint('garage-all-cars'), pointedOut: queue.pointedOut('garage-all-cars'),
        suggested: document.querySelector('.garage-all-cars-button').classList.contains('is-suggested') };
    });
    assert.deepEqual(await queueState(), { armed: true, pointedOut: true, suggested: true }, 'ALL CARS keeps a calm pulse until it is used');
    await page.waitForFunction(() => !document.querySelector('.garage-all-cars-button').classList.contains('is-introduced'));
    const calm = await ringPeak(3000);
    assert.ok(calm >= 2 && calm < pointing, `Then a calmer ring, still drawn (${calm}px)`);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.garage-all-cars-button').evaluate((button) => globalThis.getComputedStyle(button).animationName),
      'none', 'Reduce Motion stays static after the first introduction ends');
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'no-preference' });
    assert.deepEqual(await page.locator('.garage-all-cars-button').evaluate((button) => {
      const style = globalThis.getComputedStyle(button);
      return { animation: style.animationName, outline: style.outlineStyle, visible: parseFloat(style.outlineWidth) > 0 };
    }), { animation: 'none', outline: 'solid', visible: true }, 'Forced colours retain a visible static hint without Reduce Motion');
    await page.emulateMedia({ forcedColors: 'none', reducedMotion: 'reduce' });
    // A real second tab shares storage but already has its own rendered GARAGE.
    // Using ALL CARS here must stop that tab's pulse without reopening GARAGE.
    const otherTab = await page.context().newPage();
    const otherErrors = [];
    otherTab.on('pageerror', (error) => otherErrors.push(error.message));
    await otherTab.addInitScript(() => {
      Object.defineProperty(globalThis.navigator, 'standalone', { configurable: true, value: true });
    });
    await otherTab.goto(new URL('turn/', target).href);
    await otherTab.waitForFunction(() => document.documentElement.classList.contains('turn-home-ready')
      && globalThis.__turnNextHome?.tutorial, null, { timeout: 60000 });
    await otherTab.evaluate(() => { void globalThis.__turnNextHome.continueToTrack(); });
    await otherTab.waitForFunction(() => document.querySelector('.garage-all-cars-button')?.classList.contains('is-suggested'));
    // GARAGE ignores activations during its 600 ms VoiceOver entry-tap guard.
    await page.waitForTimeout(700);
    await page.locator('.garage-all-cars-button').click();
    await page.waitForFunction(() => document.querySelector('.garage-all-cars')?.open);
    assert.deepEqual(await queueState(), { armed: false, pointedOut: false, suggested: false }, 'Opened once, it stops for good');
    await otherTab.waitForFunction(() => !globalThis.__turnNextHome.unlockIntroductions.queue.hasHint('garage-all-cars'));
    assert.equal(await otherTab.locator('.garage-all-cars-button').evaluate((button) =>
      button.classList.contains('is-suggested') || button.classList.contains('is-introduced')), false,
    'The already-open GARAGE in the other tab stops pulsing as soon as the saved hint is consumed');
    assert.deepEqual(otherErrors, [], 'The other tab has no page errors');
    await otherTab.close();
    await page.locator('.garage-all-cars .turn-pr-close').click();
    await page.waitForFunction(() => !document.querySelector('.garage-all-cars')?.open);
    await page.locator('.garage-race').click();
    await page.waitForFunction(() => document.querySelector('.garage-shift')?.classList.contains('is-introduced'));
    await page.waitForFunction(() => /^No SHIFT setup on the .+ yet\. ACTIVATE SHIFT is below the car’s name\. Press RACE again to race\.$/
      .test([...document.querySelectorAll('#turnGarage .m8-unlock-hint-status')].at(-1)?.textContent || ''), null, { timeout: 5000 });
    assert.equal(await page.evaluate(() => globalThis.__turnRuntime.state.running), false, 'The first RACE points instead of racing');
    await page.locator('.garage-race').click();
    await page.waitForFunction(() => globalThis.__turnRuntime.state.running, null, { timeout: 60000 });
    const reminded = await page.evaluate(() => JSON.parse(localStorage.getItem('turn-shift-race-reminder-v1')));
    assert.equal(reminded.length, 1, 'That car is never reminded again');
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
    assert.deepEqual(await admin.locator('button').allTextContents(), ['UNLOCK DRIFT ATTACK', 'UNLOCK SHIFT', 'UNLOCK FLOW', 'UNLOCK PERKULATOR', 'UNLOCK PAINTJOB', 'SHOW ALL CARS HINT']);
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

  // PAINTJOB: the reward toast, no sheet, then GARAGE scrolls to PAINT and pulses it.
  await run('admin UNLOCK PAINTJOB points GARAGE at PAINT', { rewards: ['paintjob'], admin: true }, async (page) => {
    await page.locator('.roadbook-admin [data-admin-unlock="paintjob"]').click();
    await page.waitForFunction(() => Boolean(document.querySelector('.turn-achievement-toast')), null, { timeout: 15000 });
    await page.waitForTimeout(1200);
    assert.equal(await page.evaluate(() => Boolean(document.querySelector('.m8-unlock-sheet')?.open)), false, 'The toast is enough');
    assert.equal(await page.evaluate(() => globalThis.__turnNextHome.unlockIntroductions.queue.hasHint('garage-paint')), true);
    await page.evaluate(() => { void globalThis.__turnNextHome.continueToTrack(); });
    await page.waitForFunction(() => Boolean(document.querySelector('.garage-paint-toggle.is-introduced')), null, { timeout: 30000 });
    assert.equal(await page.evaluate(() => globalThis.__turnNextHome.unlockIntroductions.queue.hasHint('garage-paint')), false,
      'PAINT is pointed out once');
    // And said, for players who cannot see the pulse, in GARAGE after its own opening speech.
    await page.waitForFunction(() => document.querySelector('#turnGarage .m8-unlock-hint-status')?.textContent
      === 'New in GARAGE: PAINT, below the car’s name.', null, { timeout: 5000 });
  });

  // An admin profile has long since used ALL CARS: SHOW ALL CARS HINT arms its hint again,
  // pointed out on the next GARAGE the player opens and then pulsing until used (#1168).
  await run('admin SHOW ALL CARS HINT points it out again', { admin: true }, async (page) => {
    const queueState = () => page.evaluate(() => {
      const queue = globalThis.__turnNextHome.unlockIntroductions.queue;
      return { armed: queue.hasHint('garage-all-cars'), pointedOut: queue.pointedOut('garage-all-cars') };
    });
    assert.deepEqual(await queueState(), { armed: false, pointedOut: false }, 'Not armed in automated runs by itself');
    await page.locator('.roadbook-admin [data-admin-hint="garage-all-cars"]').click();
    assert.deepEqual(await queueState(), { armed: true, pointedOut: false });
    await page.evaluate(() => { void globalThis.__turnNextHome.continueToTrack(); });
    await page.waitForFunction(() => document.querySelector('.garage-all-cars-button')?.classList.contains('is-introduced'), null, { timeout: 60000 });
    assert.deepEqual(await queueState(), { armed: true, pointedOut: true }, 'Pointed out, then the calm pulse until used');
  });

  // The same buttons in SETTINGS, on the Admin card with the other admin tools.
  await run('admin UNLOCK SHIFT from SETTINGS', { admin: true }, async (page) => {
    // SETTINGS, from the ☰ menu sheet as a player reaches it.
    await page.locator('.turn-home-menu-button').click();
    await page.locator('.m8-home-settings').click();
    await page.waitForFunction(() => document.querySelector('.m8-settings-dialog')?.open);
    const unlocks = page.locator('[data-turn-route-test-hud-setting] .m8-admin-unlocks');
    assert.deepEqual(await unlocks.locator('button').allTextContents(), ['UNLOCK DRIFT ATTACK', 'UNLOCK SHIFT', 'UNLOCK FLOW', 'UNLOCK PERKULATOR', 'UNLOCK PAINTJOB', 'SHOW ALL CARS HINT']);
    await unlocks.locator('[data-admin-unlock="shift"]').click();
    assert.equal(await page.evaluate(() => document.querySelector('.m8-settings-dialog').open), false,
      'SETTINGS closes so the unlock plays on Home');
    await page.waitForFunction(() => document.querySelector('.m8-unlock-sheet')?.open);
    assert.equal(await page.locator('.m8-unlock-sheet h2').textContent(), 'SHIFT');
    await page.locator('.m8-unlock-sheet [data-unlock-close]').click();
    assert.equal(await page.evaluate(() => globalThis.__turnNextHome.unlockIntroductions.queue.hasHint('garage-shift')), true,
      'Closing it arms the GARAGE hint, as a real unlock does');
    // SETTINGS away from Home (a race's start screen): the introduction could not show there.
    const hiddenAwayFromHome = await page.evaluate(async () => {
      globalThis.__turnNextHome.hideHome();
      const settings = document.querySelector('.m8-settings-dialog');
      settings.showModal();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const hidden = document.querySelector('.m8-admin-unlocks').hidden;
      settings.close();
      return hidden;
    });
    assert.equal(hiddenAwayFromHome, true, 'Home only');
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

  // HOW TO PLAY (#748): QUICK REFERENCE for every player, each card a real control acted
  // out; SHIFT, DRIFT ATTACK and FLOW named with where they unlock, taught once unlocked.
  const openHowToPlay = async (page) => {
    await page.evaluate(() => document.querySelector('.m8-how-button').click());
    await page.waitForFunction(() => document.querySelector('.m8-how-dialog')?.open);
  };
  const shownDemos = (page) => page.evaluate(() => [...document.querySelectorAll('.m8-how-dialog .turn-demo')]
    .filter((demo) => !demo.closest('[hidden]'))
    .map((demo) => ({
      card: demo.closest('details').dataset.howToPlayDisclosure,
      hidden: demo.getAttribute('aria-hidden'),
      moving: demo.getAnimations({ subtree: true }).length
    })));
  const openCard = (page, id, open) => page.evaluate(({ id, open }) => {
    document.querySelector(`.m8-how-dialog details[data-how-to-play-disclosure="${id}"]`).open = open;
  }, { id, open });

  await run('HOW TO PLAY demos', { played: true }, async (page) => {
    await openHowToPlay(page);
    assert.deepEqual(await shownDemos(page), [
      { card: 'turn-device-to-steer', hidden: 'true', moving: 0 },
      { card: 'drive-with-one-thumb', hidden: 'true', moving: 0 },
      { card: 'build-and-use-overcharge', hidden: 'true', moving: 0 },
      { card: 'choose-track-and-car', hidden: 'true', moving: 0 }
    ], 'QUICK REFERENCE: pictures for sighted players, still while their cards are closed');
    assert.deepEqual(await page.locator('.m8-how-dialog [data-steer-guide]').evaluateAll((parts) => parts.map((part) => [part.dataset.steerGuide, part.hidden])),
      [['motion', true], ['manual', false]], 'STEER teaches the on-screen steering this player has chosen');
    assert.deepEqual(await page.locator('.m8-how-dialog [data-guide-locked]:not([hidden]) [role="heading"]').allTextContents(),
      ['DRIFT ATTACK', 'SHIFT', 'FLOW'], 'Named, with where they unlock, not yet taught');
    assert.equal(await page.locator('.m8-how-dialog [data-guide-topic="shift"]').evaluate((card) => card.hidden), true);
    const raceControls = '.drive-stack, .drive-pad, .drive-zone, .drive-gas-zone, .drive-brake-zone, .drive-lock-bubble, .drive-shift-bubble, .drive-reverse-bubble, .boost-hud, .manual-steer, .score-feedback, .race-position-hud';
    assert.equal(await page.locator(`.m8-how-dialog :is(${raceControls})`).count(), 0,
      'Nothing that looks for the real controls finds a demo');

    await openCard(page, 'drive-with-one-thumb', true);
    assert.equal((await shownDemos(page))[1].moving, 0, 'Reduced Motion: a still frame');
    const lock = page.locator('.m8-how-dialog [data-how-to-play-disclosure="drive-with-one-thumb"] .turn-demo-bubble.is-lock');
    assert.equal(await lock.evaluate((bubble) => globalThis.getComputedStyle(bubble).opacity), '1',
      'The still frame shows DRIFT out into LOCK');

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    let moving = await shownDemos(page);
    assert.ok(moving[1].moving > 0, 'An open card acts out its controls');
    assert.equal(moving[2].moving, 0, 'A closed card does not');
    await openCard(page, 'drive-with-one-thumb', false);
    moving = await shownDemos(page);
    assert.equal(moving[1].moving, 0, 'Closing the card stops it');

    // Chosen in SETTINGS, the other steering method is what HOW TO PLAY teaches next time.
    const steerGuides = () => page.locator('.m8-how-dialog [data-steer-guide]')
      .evaluateAll((parts) => parts.map((part) => [part.dataset.steerGuide, part.hidden]));
    await page.locator('.m8-how-dialog [data-dialog-close]').click();
    await page.waitForFunction(() => !document.querySelector('.m8-how-dialog')?.open);
    await page.evaluate(() => document.querySelector('.m8-home-settings').click());
    await page.waitForFunction(() => document.querySelector('.m8-settings-dialog')?.open);
    await page.locator('.m8-settings-dialog input[name="m8Steering"][value="motion"]').check();
    await page.locator('.m8-settings-dialog [data-dialog-close]').click();
    await page.waitForFunction(() => !document.querySelector('.m8-settings-dialog')?.open);
    await openHowToPlay(page);
    assert.deepEqual(await steerGuides(), [['motion', false], ['manual', true]], 'Device rotation: the rotate symbol and RECALIBRATE');
  });

  await run('HOW TO PLAY once the Trophy Road unlocks them', { played: true, rewards: ['drift-attack', 'shift', 'flow'] }, async (page) => {
    await openHowToPlay(page);
    assert.deepEqual((await shownDemos(page)).map(({ card }) => card), [
      'turn-device-to-steer', 'drive-with-one-thumb', 'build-and-use-overcharge', 'choose-track-and-car',
      'drift-points', 'shift', 'flow-points'
    ], 'DRIFT ATTACK, SHIFT and FLOW are taught, each with its control');
    assert.equal(await page.locator('.m8-how-dialog [data-guide-locked]:not([hidden])').count(), 0);
    assert.equal(await page.locator('.m8-how-dialog [data-guide-topic="build-and-use-overcharge"] [role="heading"]').textContent(),
      'BOOST AND OVERCHARGE');

    // LEARN TO PLAY: the five QUICK REFERENCE parts.
    for (const id of ['turn-device-to-steer', 'drive-with-one-thumb', 'build-and-use-overcharge', 'choose-track-and-car', 'drive-by-ear-sounds']) {
      assert.equal(await page.evaluate(() => globalThis.__turnAchievements.store.isUnlocked('learn-to-play')), false);
      await openCard(page, id, true);
      await page.waitForFunction((part) => globalThis.__turnAchievements.store.state.progress.howToPlayDisclosures.includes(part), id);
    }
    await page.waitForFunction(() => globalThis.__turnAchievements.store.isUnlocked('learn-to-play'));
  });

  await run('LEARN TO PLAY for a player who read the old HOW TO PLAY', {
    played: true,
    howToPlayRead: ['choose-track-and-car', 'turn-device-to-steer', 'drive-with-one-thumb', 'build-and-use-overcharge',
      'catch-and-use-overcharge', 'shift', 'drift-points', 'flow-points', 'drive-by-ear-sounds']
  }, async (page) => {
    assert.equal(await page.evaluate(() => globalThis.__turnAchievements.store.isUnlocked('learn-to-play')), true,
      'Parts read before still count, and cover the new five');
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
