import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Race PAUSE (#985) in a real race: the car drives across the start line, then
// - Ⅱ sits beside RESTART LAP only during an active lap;
// - a pause freezes the car, the lap time, BOOST and the race clock, and lets go of
//   held controls; the PAUSED dialog is modal and announced;
// - SETTINGS opens over it without resuming; Escape and back resume from where the
//   race stood, not one long step later; back during a race pauses;
// - TURN leaving the screen pauses, and coming back stays paused until RESUME;
// - RESTART LAP and LEAVE RACE from PAUSED take their usual paths;
// - portrait and left-handed layouts keep Ⅱ clear of the other controls, and a phone
//   turned while paused gets the paused frame drawn again.
const root = fileURLToPath(new URL('../', import.meta.url));
const types = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.glb': 'model/gltf-binary'
};
const server = http.createServer(async (request, response) => {
  try {
    let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const filename = path.resolve(root, `.${pathname}`);
    if (!filename.startsWith(root)) throw new Error('Outside fixture root');
    const body = await fs.readFile(filename);
    response.writeHead(200, { 'content-type': types[path.extname(filename).toLowerCase()] || 'application/octet-stream' });
    response.end(body);
  } catch (_) {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const errors = [];

async function openRace({ width, height, handedness = 'right' }) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', (error) => {
    if (error.message.includes('different audio context') && error.stack.includes('organic-ribbon')) return;
    errors.push(error.message);
  });
  await page.addInitScript((hand) => {
    localStorage.setItem('turn-low-graphics-v1', '1');
    localStorage.setItem('turn-steering-mode-v1', 'manual');
    localStorage.setItem('turn-audio-enabled-v1', 'off');
    localStorage.setItem('turn-racing-music-volume-v1', '0');
    localStorage.setItem('turn-control-handedness-v1', hand);
    Object.defineProperty(globalThis.navigator, 'standalone', { configurable: true, value: true });
  }, handedness);
  await page.goto(`${origin}/turn/`);
  await page.waitForFunction(() => document.documentElement.classList.contains('turn-home-ready'), null, { timeout: 60000 });
  await page.locator('.m8-track-continue').click();
  await page.waitForSelector('.garage');
  await page.waitForTimeout(600);
  await page.locator('.garage-race').click();
  await page.waitForSelector('#controls:not([hidden])', { timeout: 60000 });
  return { context, page };
}

// Hold GAS until the car crosses the start line and the timed lap begins.
async function startLap(page) {
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(() => globalThis.__turnRuntime.state.mode === 'racing', null, { timeout: 30000 });
  await page.waitForTimeout(800);
}

const race = (page) => page.evaluate(() => {
  const { state } = globalThis.__turnRuntime;
  return {
    mode: state.mode,
    lap: state.lapElapsed,
    x: state.position.x,
    z: state.position.z,
    heading: state.heading,
    speed: state.speed,
    vx: state.velocity.x,
    vz: state.velocity.z,
    progress: state.progress,
    checkpoint: state.lapCheckpointIndex,
    boost: globalThis.__turnBoostCharge,
    boosting: globalThis.__turnBoostActive,
    touchGas: state.touchGas,
    heldKeys: globalThis.__turnKeyboardDrivingControls.getHeldCount(),
    paused: globalThis.__turnRacePause.paused,
    reason: globalThis.__turnRacePause.reason,
    dialog: document.querySelector('.turn-race-pause-dialog').open,
    button: !document.querySelector('.turn-race-pause-button').hidden,
    status: document.querySelector('.turn-race-pause-status').textContent
  };
});
const frozen = ({ lap, x, z, heading, speed, vx, vz, progress, checkpoint, boost }) => ({ lap, x, z, heading, speed, vx, vz, progress, checkpoint, boost });

try {
  // ---------- Landscape phone ----------
  const { context, page } = await openRace({ width: 852, height: 393 });
  let now = await race(page);
  assert.equal(now.mode, 'staged');
  assert.equal(now.button, false, 'At the start line there is no lap to pause: Ⅱ is hidden');
  assert.equal(await page.evaluate(() => globalThis.__turnRacePause.pause('player')), false, 'Staged, nothing pauses');

  await startLap(page);
  now = await race(page);
  assert.equal(now.button, true, 'During a lap Ⅱ shows');
  const geometry = await page.evaluate(() => {
    const rect = (node) => node.getBoundingClientRect().toJSON();
    return {
      restart: rect(document.querySelector('#resetButton')),
      pause: rect(document.querySelector('.turn-race-pause-button')),
      label: document.querySelector('.turn-race-pause-button').getAttribute('aria-label')
    };
  });
  assert.equal(geometry.label, 'Pause race');
  assert.ok(geometry.pause.width >= 44 && geometry.pause.height >= 44, `Ⅱ is a full touch target (${geometry.pause.width}×${geometry.pause.height})`);
  assert.ok(geometry.pause.left >= geometry.restart.right && geometry.pause.left - geometry.restart.right < 24
    && Math.abs(geometry.pause.top - geometry.restart.top) < 4, 'Ⅱ sits right beside RESTART LAP');

  // Pause while GAS (a key) and BOOST (the drive pad) are held down.
  const boostZone = await page.locator('.drive-boost-zone').boundingBox();
  await page.mouse.move(boostZone.x + boostZone.width / 2, boostZone.y + boostZone.height / 2);
  await page.mouse.down();
  await page.waitForFunction(() => globalThis.__turnBoostActive === true && globalThis.__turnBoostCharge < 0.95, null, { timeout: 10000 });
  await page.evaluate(() => document.querySelector('.turn-race-pause-button').click());
  await page.waitForTimeout(120);
  const paused = await race(page);
  assert.equal(paused.paused, true);
  assert.equal(paused.reason, 'player');
  assert.equal(paused.dialog, true, 'PAUSED opens');
  assert.equal(paused.button, false, 'Ⅱ is not left behind the dialog');
  assert.equal(paused.heldKeys, 0, 'The held GAS key is let go');
  assert.equal(paused.touchGas, false, 'GAS is let go');
  assert.equal(paused.boosting, false, 'BOOST is let go');
  assert.equal(paused.status, 'Race paused.', 'The pause is announced');
  const modal = await page.evaluate(() => {
    const dialog = document.querySelector('.turn-race-pause-dialog');
    return {
      modal: dialog.matches(':modal'),
      focusInside: dialog.contains(document.activeElement),
      title: dialog.querySelector('h2').textContent,
      actions: [...dialog.querySelectorAll('[data-pause-action]')].map((button) => button.textContent),
      paused: document.body.classList.contains('turn-runtime-paused')
    };
  });
  assert.deepEqual(modal, {
    modal: true,
    focusInside: true,
    title: 'PAUSED',
    actions: ['RESUME', 'RESTART LAP', 'SETTINGS', 'LEAVE RACE'],
    paused: true
  });

  const clockAt = () => page.evaluate(async () => {
    const { raceNow } = await import('/turn/race/race-clock.js');
    return { race: raceNow(), wall: globalThis.performance.now() };
  });
  const clockBefore = await clockAt();
  await page.waitForTimeout(2000);
  const later = await race(page);
  assert.deepEqual(frozen(later), frozen(paused), 'Two seconds paused: car, lap time, progress and BOOST stand still');
  await page.mouse.up();
  const clockAfter = await clockAt();
  assert.equal(clockAfter.race, clockBefore.race,
    `The race clock stood still for ${Math.round(clockAfter.wall - clockBefore.wall)} ms of wall time`);

  // SETTINGS opens over PAUSED; the race stays paused.
  await page.locator('.turn-race-pause-dialog [data-pause-action="settings"]').click();
  await page.waitForSelector('.m8-settings-dialog[open]');
  await page.waitForTimeout(300);
  assert.equal((await race(page)).paused, true, 'Settings keeps the race paused');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.m8-settings-dialog:not([open])', { state: 'attached' });
  now = await race(page);
  assert.equal(now.paused, true, 'Closing Settings returns to PAUSED');
  assert.equal(now.dialog, true);
  assert.equal(now.lap, paused.lap);

  // Escape resumes from the paused moment: no catch-up step, no stuck GAS.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const resumed = await race(page);
  assert.equal(resumed.paused, false, 'Escape resumes');
  assert.equal(resumed.dialog, false);
  assert.equal(resumed.button, true);
  assert.equal(resumed.status, 'Race resumed.');
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('turn-race-pause-button')), true,
    'Focus returns to Ⅱ');
  assert.ok(resumed.lap > paused.lap && resumed.lap - paused.lap < 0.6,
    `The lap continues from ${paused.lap.toFixed(3)} s (now ${resumed.lap.toFixed(3)} s)`);
  assert.ok(Math.hypot(resumed.x - paused.x, resumed.z - paused.z) < 40, 'No long physics step after the pause');
  assert.equal(resumed.boost, paused.boost, 'BOOST held through the pause does not drain on after RESUME');
  assert.equal(resumed.boosting, false);
  assert.equal(resumed.touchGas, false, 'A key held through the pause does not drive on');
  await page.keyboard.up('ArrowUp');

  // Back during a race pauses; back from PAUSED resumes.
  await page.evaluate(() => globalThis.history.back());
  await page.waitForFunction(() => globalThis.__turnRacePause.paused === true);
  assert.equal((await race(page)).dialog, true, 'Back opens PAUSED');
  await page.waitForTimeout(300);
  await page.evaluate(() => globalThis.history.back());
  await page.waitForFunction(() => globalThis.__turnRacePause.paused === false);
  assert.equal((await race(page)).mode, 'racing', 'Back from PAUSED resumes the race');

  // TURN leaving the screen pauses; coming back stays paused until RESUME.
  const setHidden = (hidden) => page.evaluate((value) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (value ? 'hidden' : 'visible') });
    document.dispatchEvent(new globalThis.Event('visibilitychange'));
  }, hidden);
  await setHidden(true);
  now = await race(page);
  assert.equal(now.paused, true, 'Leaving the screen pauses the lap');
  assert.equal(now.reason, 'background');
  const background = frozen(now);
  await page.waitForTimeout(1000);
  await setHidden(false);
  await page.waitForTimeout(300);
  now = await race(page);
  assert.equal(now.paused, true, 'Coming back, the race is still paused');
  assert.equal(now.dialog, true, 'and PAUSED is showing');
  assert.equal(now.lap, background.lap);
  await page.locator('.turn-race-pause-resume').click();
  assert.equal((await race(page)).paused, false, 'RESUME continues');

  // RESTART LAP from PAUSED takes the usual restart path.
  await page.locator('.turn-race-pause-button').click();
  await page.locator('.turn-race-pause-dialog [data-pause-action="restart"]').click();
  await page.waitForTimeout(200);
  now = await race(page);
  assert.deepEqual([now.mode, now.paused, now.dialog, now.lap, now.button], ['staged', false, false, 0, false],
    'RESTART LAP ends the pause and stages the lap again');

  // LEAVE RACE from PAUSED takes the usual way out, back to ROADBOOK.
  await startLap(page);
  await page.keyboard.up('ArrowUp');
  await page.locator('.turn-race-pause-button').click();
  await page.locator('.turn-race-pause-dialog [data-pause-action="leave"]').click();
  await page.waitForFunction(() => document.body.classList.contains('turn-home-open'));
  now = await race(page);
  assert.equal(now.paused, false, 'LEAVE RACE ends the pause');
  assert.equal(await page.evaluate(() => document.body.classList.contains('turn-runtime-paused')), false);
  await context.close();

  // ---------- Portrait phone, left-handed ----------
  for (const [label, handedness] of [['portrait', 'right'], ['portrait, left-handed', 'left']]) {
    const opened = await openRace({ width: 393, height: 852, handedness });
    await startLap(opened.page);
    await opened.page.keyboard.up('ArrowUp');
    const layout = await opened.page.evaluate(() => {
      const pause = document.querySelector('.turn-race-pause-button').getBoundingClientRect();
      const overlaps = [...document.querySelectorAll('#controls button, .drive-pad, .manual-steer')]
        .filter((node) => !node.classList.contains('turn-race-pause-button') && node.getClientRects().length
          && !node.closest('.turn-race-pause-button'))
        .map((node) => ({ node: node.className || node.id, rect: node.getBoundingClientRect() }))
        .filter(({ rect }) => rect.left < pause.right - 1 && rect.right > pause.left + 1
          && rect.top < pause.bottom - 1 && rect.bottom > pause.top + 1)
        .map(({ node }) => node);
      return {
        inside: pause.left >= 0 && pause.right <= globalThis.innerWidth && pause.top >= 0 && pause.bottom <= globalThis.innerHeight,
        overlaps
      };
    });
    assert.equal(layout.inside, true, `${label}: Ⅱ is on screen`);
    assert.deepEqual(layout.overlaps, [], `${label}: Ⅱ overlaps no other control`);
    await opened.page.locator('.turn-race-pause-button').click();
    const fits = await opened.page.evaluate(() => {
      const rect = document.querySelector('.turn-race-pause-dialog .turn-dialog__surface').getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= globalThis.innerHeight && rect.left >= 0 && rect.right <= globalThis.innerWidth;
    });
    assert.equal(fits, true, `${label}: PAUSED fits the screen`);
    if (handedness === 'right') {
      // Turned on its side while paused: the paused frame is drawn again at the new size.
      const renders = await opened.page.evaluate(() => {
        const { renderer } = globalThis.__turnRuntime;
        const render = renderer.render.bind(renderer);
        globalThis.__pausedRenders = 0;
        renderer.render = (...args) => {
          globalThis.__pausedRenders += 1;
          return render(...args);
        };
        return globalThis.__pausedRenders;
      });
      await opened.page.waitForTimeout(500);
      assert.equal(await opened.page.evaluate(() => globalThis.__pausedRenders), renders, `${label}: paused, nothing is drawn`);
      await opened.page.setViewportSize({ width: 852, height: 393 });
      await opened.page.waitForTimeout(1500);
      assert.ok(await opened.page.evaluate(() => globalThis.__pausedRenders) > 0, `${label}: turned while paused, the frame is drawn again`);
      assert.equal(await opened.page.evaluate(() => globalThis.__turnRacePause.paused), true, `${label}: and the race stays paused`);
    }
    await opened.page.locator('.turn-race-pause-resume').click();
    await opened.context.close();
  }

  assert.deepEqual(errors, [], 'no page errors');
  console.log('Race pause: Ⅱ beside RESTART LAP during a lap; frozen car, lap time, BOOST and race clock; released controls; Settings, Escape, back, background, RESTART LAP and LEAVE RACE; landscape, portrait (turned while paused) and left-handed passed.');
} finally {
  await browser.close();
  server.close();
}
