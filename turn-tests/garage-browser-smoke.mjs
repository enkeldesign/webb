import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
import { CAR_CATALOG } from '../turn/vehicle/catalog.js';
import { garageCarOrder } from '../turn/garage/garage-cars.js';

// GARAGE (garage/garage.js): one featured car at a time in Trophy Road order, the
// saved car, the current choice and a locked preview kept apart, RACE only for a
// playable car, back to ROADBOOK with the track kept, and a layout that fits 320px
// to iPad. Every step here is a real pointer tap on what the player sees.
const root = fileURLToPath(new URL('../', import.meta.url));
const threeRoot = fileURLToPath(new URL('../', import.meta.resolve('three')));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.PNG': 'image/png' };
const server = http.createServer(async (request, response) => {
  try {
    let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const filename = path.resolve(root, `.${pathname}`);
    if (!filename.startsWith(root)) throw new Error('Outside fixture root');
    const body = await fs.readFile(filename);
    response.writeHead(200, { 'content-type': types[path.extname(filename)] || 'application/octet-stream' });
    response.end(body);
  } catch (_) {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const order = garageCarOrder(CAR_CATALOG.map((car) => car.id));
const carName = Object.fromEntries(CAR_CATALOG.map((car) => [car.id, car.name]));
const fixedLiveryId = CAR_CATALOG.find((car) => car.fixedLivery)?.id;
assert.ok(fixedLiveryId, 'The catalog has an emergency car with a fixed livery');

async function openGarage(browserType, { width, height, isMobile = true, unlocked = false }) {
  const browser = await browserType.launch();
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: browserType !== webkit && isMobile, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', (error) => {
    if (error.message.includes('different audio context') && error.stack.includes('organic-ribbon')) return;
    errors.push(error.message);
  });
  await page.route('https://cdn.jsdelivr.net/npm/three@0.184.0/**', async (route) => {
    const suffix = route.request().url().split('/three@0.184.0/')[1];
    await route.fulfill({ contentType: 'text/javascript', body: await fs.readFile(path.join(threeRoot, suffix)) });
  });
  await page.addInitScript(() => {
    localStorage.setItem('turn-low-graphics-v1', '1');
    localStorage.setItem('turn-steering-mode-v1', 'manual');
    localStorage.setItem('turn-audio-enabled-v1', 'off');
    localStorage.setItem('turn-racing-music-volume-v1', '0');
    Object.defineProperty(globalThis.navigator, 'standalone', { configurable: true, value: true });
  });
  const ready = () => page.waitForFunction(() => document.documentElement.classList.contains('turn-home-ready'), null, { timeout: 60000 });
  await page.goto(`${origin}/turn/`);
  await ready();
  if (unlocked) {
    await page.evaluate(async () => {
      const admin = await import('/turn/testing/admin-unlock-sequence.js');
      admin.unlockRewardsForTesting();
    });
    await page.reload();
    await ready();
  }
  await page.locator('.roadbook-card[data-track-id="cliffside"]').click();
  await page.locator('.m8-track-continue').click();
  await page.waitForSelector('.garage', { timeout: 60000 });
  // RACE ignores taps in the first moments, so a double-tap that opened GARAGE never races.
  await page.waitForTimeout(700);
  return { browser, page, errors };
}

const garageState = (page) => page.evaluate(() => {
  const garage = globalThis.__turnGarage;
  const visible = (node) => Boolean(node) && !node.hidden && node.getClientRects().length > 0;
  const race = document.querySelector('.garage-race');
  const leave = document.querySelector('.garage-leave-preview');
  return {
    viewed: garage.getViewedCarId(),
    choice: garage.getChoice().carId,
    ordinal: document.querySelector('.garage-ordinal').textContent.trim(),
    name: document.querySelector('.garage-name').textContent.replace(/\s+/g, ' ').trim(),
    description: document.querySelector('.garage-description').textContent.trim(),
    lockNote: visible(document.querySelector('.garage-lock-note')) ? document.querySelector('.garage-lock-note').textContent.replace(/\s+/g, ' ').trim() : '',
    race: visible(race) ? { label: race.querySelector('.turn-pr-button-label').textContent, name: race.getAttribute('aria-label') } : null,
    leave: visible(leave) ? leave.textContent.trim() : null,
    paint: visible(document.querySelector('.garage-paint-toggle')),
    shift: visible(document.querySelector('.garage-shift'))
  };
});

// Layout facts the player can see: no sideways scroll, targets, dock bounds.
const garageLayout = (page) => page.evaluate(() => {
  const garage = document.querySelector('.garage');
  const visible = (node) => !node.hidden && node.getClientRects().length > 0 && globalThis.getComputedStyle(node).visibility !== 'hidden';
  const dock = document.querySelector('.garage-dock').getBoundingClientRect();
  const view = document.querySelector('.garage-view').getBoundingClientRect();
  const targets = [...garage.querySelectorAll('button')].filter(visible);
  return {
    overflowX: Math.max(garage.scrollWidth - garage.clientWidth, document.documentElement.scrollWidth - globalThis.innerWidth),
    small: targets.filter((node) => {
      const box = node.getBoundingClientRect();
      return box.width < 44 || box.height < 44;
    }).map((node) => node.className),
    dock: { top: dock.top, bottom: dock.bottom, height: dock.height },
    view: { width: view.width, height: view.height },
    viewport: { width: globalThis.innerWidth, height: globalThis.innerHeight },
    specsOpen: !document.querySelector('#garageSpecs').hidden,
    clippedName: document.querySelector('.garage-name').scrollWidth > document.querySelector('.garage-name').clientWidth + 1,
    lastClearsDock: (() => {
      garage.scrollTop = garage.scrollHeight;
      const details = document.querySelector('.garage-details').getBoundingClientRect();
      const clear = details.bottom <= document.querySelector('.garage-dock').getBoundingClientRect().top + 1;
      garage.scrollTop = 0;
      return clear;
    })()
  };
});

async function phoneFlow(browserType, name) {
  const { browser, page, errors } = await openGarage(browserType, { width: 393, height: 793 });
  try {
    const opened = await page.evaluate(() => ({
      focus: document.activeElement?.id,
      title: document.querySelector('#garageTitle').textContent,
      lead: document.querySelector('.garage-head .turn-pr-lead').textContent,
      back: document.querySelector('.garage-back').textContent.replace(/\s+/g, ' ').trim(),
      backColor: globalThis.getComputedStyle(document.querySelector('.garage-back')).backgroundColor,
      track: document.querySelector('.garage-dock-track').textContent.replace(/\s+/g, ' ').trim(),
      runtimeTrack: globalThis.__turnRuntime.state.trackId
    }));
    assert.deepEqual(opened, {
      focus: 'garageTitle',
      title: 'GARAGE',
      lead: 'Choose your car',
      back: '← TRACKS',
      backColor: 'rgb(255, 123, 84)',
      track: 'Cliffside EASY',
      runtimeTrack: 'cliffside'
    }, `${name}: GARAGE opens on its heading, for the chosen track, with an orange back`);

    let state = await garageState(page);
    assert.equal(state.viewed, 'classic', `${name}: a new profile starts on the Learner Car`);
    assert.equal(state.ordinal, `01 / ${order.length}`);
    assert.match(state.name, /Beginner-friendly/, `${name}: the Learner Car is marked beginner-friendly`);
    assert.ok(state.description.length > 20, `${name}: one approved description per car`);
    assert.deepEqual(state.race, { label: 'RACE', name: `Race ${carName.classic.replace(/\b\w/g, (letter) => letter.toUpperCase())}` },
      `${name}: RACE names the car for assistive technology`);
    assert.equal(state.leave, null);

    const phone = await garageLayout(page);
    assert.ok(phone.overflowX <= 0, `${name}: no sideways scroll at 393px (${phone.overflowX})`);
    assert.deepEqual(phone.small, [], `${name}: every target is at least 44px`);
    assert.ok(phone.dock.bottom <= phone.viewport.height + 0.5, `${name}: the dock stays inside the viewport`);
    assert.equal(phone.specsOpen, false, `${name}: phones start with Specifications closed`);
    assert.equal(phone.lastClearsDock, true, `${name}: the last disclosure scrolls clear of the dock`);

    // Specifications: stock stats with meters, and the 18-point note.
    await page.locator('.garage-specs .garage-disclosure-toggle').click();
    const specs = await page.evaluate(() => ({
      expanded: document.querySelector('.garage-specs .garage-disclosure-toggle').getAttribute('aria-expanded'),
      rows: document.querySelectorAll('.garage-spec').length,
      label: document.querySelector('.garage-setup-label').textContent.trim()
    }));
    assert.deepEqual(specs, { expanded: 'true', rows: 6, label: 'Stock' }, `${name}: Specifications open on a tap`);
    // Clean by default: explanations appear only when asked for, and stay on.
    const explanations = () => page.evaluate(() => ({
      checked: document.querySelector('#garageSpecExplain').checked,
      help: document.querySelectorAll('.garage-spec-help').length,
      note: !document.querySelector('.garage-spec-note').hidden,
      announced: /without boost/.test(document.querySelector('.garage-spec[data-stat="speed"]').getAttribute('aria-label'))
    }));
    assert.deepEqual(await explanations(), { checked: false, help: 0, note: false, announced: false },
      `${name}: Specifications start without explanations`);
    await page.locator('.garage-spec-explain').click();
    assert.deepEqual(await explanations(), { checked: true, help: 6, note: true, announced: true },
      `${name}: Show explanations adds each attribute's meaning and the 18-point note`);
    await page.locator('.garage-step.is-next').click();
    await page.locator('.garage-step.is-previous').click();
    assert.equal((await explanations()).help, 6, `${name}: explanations stay on while browsing cars`);
    await page.locator('.garage-spec-explain').click();
    assert.equal((await explanations()).help, 0);

    // Walking the order: each car is viewed; locked ones are previews with no RACE.
    const locks = [];
    for (let index = 1; index < order.length; index += 1) {
      await page.locator('.garage-step.is-next').click();
      state = await garageState(page);
      assert.equal(state.viewed, order[index], `${name}: next shows ${order[index]}`);
      assert.equal(state.ordinal, `${String(index + 1).padStart(2, '0')} / ${order.length}`);
      locks.push({ id: state.viewed, locked: state.race === null });
      if (state.race === null) {
        assert.match(state.lockNote, /unlocks at \d+ trophies/, `${name}: ${state.viewed} says what unlocks it`);
        assert.equal(state.leave, `Back to ${carName[state.choice]}`, `${name}: a preview leads back to the choice`);
        assert.equal(state.paint, false, `${name}: a preview has no paint`);
        assert.equal(state.shift, false, `${name}: a preview has no SHIFT`);
      } else {
        assert.equal(state.choice, state.viewed, `${name}: a playable car becomes the choice`);
      }
    }
    await page.locator('.garage-step.is-next').click();
    assert.equal((await garageState(page)).viewed, order[0], `${name}: next wraps to the first car`);
    const firstLocked = locks.find((car) => car.locked)?.id;
    assert.ok(firstLocked, `${name}: a new profile has locked cars to preview`);

    // Saved car → current choice → locked preview → back: the choice, not the saved car.
    const playable = locks.find((car) => !car.locked)?.id || 'classic';
    await page.evaluate((id) => globalThis.__turnGarage.viewCar(id), playable);
    await page.evaluate((id) => globalThis.__turnGarage.viewCar(id), firstLocked);
    state = await garageState(page);
    assert.deepEqual([state.viewed, state.choice, state.race], [firstLocked, playable, null]);
    await page.locator('.garage-leave-preview').click();
    state = await garageState(page);
    assert.deepEqual([state.viewed, state.choice], [playable, playable], `${name}: leaving the preview returns to the choice`);
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('garage-race')), true,
      `${name}: focus moves to RACE after leaving the preview`);
    // Escape leaves a preview too.
    await page.evaluate((id) => globalThis.__turnGarage.viewCar(id), firstLocked);
    await page.keyboard.press('Escape');
    assert.equal((await garageState(page)).viewed, playable, `${name}: Escape leaves the preview`);

    // Paint is a Trophy Road reward: a new profile sees why it is locked.
    await page.locator('.garage-paint-toggle').click();
    await page.waitForSelector('.garage-paint-locked');
    const dialog = page.locator('dialog[open]');
    if (await dialog.count()) await page.keyboard.press('Escape');

    // Back keeps the track; re-entering keeps the choice made this visit.
    await page.locator('.garage-back').click();
    await page.waitForFunction(() => !document.querySelector('.m8-home').hidden && !document.querySelector('.garage'));
    assert.equal(await page.evaluate(() => document.querySelector('.roadbook-card.is-selected')?.dataset.trackId), 'cliffside',
      `${name}: back returns to ROADBOOK with the track kept`);
    await page.locator('.m8-track-continue').click();
    await page.waitForSelector('.garage', { timeout: 60000 });
    assert.equal((await garageState(page)).viewed, playable, `${name}: GARAGE reopens on this visit's choice`);
    await page.waitForTimeout(700);

    // RACE starts the choice on the chosen track and saves it.
    await page.locator('.garage-race').click();
    await page.waitForFunction(() => !document.querySelector('.garage') && globalThis.__turnRuntime?.state?.vehicleId, null, { timeout: 60000 });
    const raced = await page.evaluate(() => ({
      vehicle: globalThis.__turnRuntime.state.vehicleId,
      track: globalThis.__turnRuntime.state.trackId,
      saved: JSON.parse(localStorage.getItem('turn-vehicle-selection-v1') || '{}').carId
    }));
    assert.deepEqual(raced, { vehicle: playable, track: 'cliffside', saved: playable }, `${name}: RACE starts and saves the choice`);
    assert.deepEqual(errors, [], `${name}: no page errors`);
  } finally {
    await browser.close();
  }
}

// With every reward unlocked: paint, fixed liveries, SHIFT and the secret.
async function unlockedFlow() {
  const { browser, page, errors } = await openGarage(chromium, { width: 393, height: 793, unlocked: true });
  try {
    const progress = await page.locator('.garage-available').textContent();
    assert.match(progress, new RegExp(`${order.length}\\s*/\\s*${order.length}|${order.length} of ${order.length}`), `All cars available: ${progress}`);

    // A fixed service livery is shown, never repainted.
    await page.evaluate((id) => globalThis.__turnGarage.viewCar(id), fixedLiveryId);
    await page.locator('.garage-paint-toggle').click();
    await page.waitForSelector('.garage-paint-fixed');
    assert.equal(await page.locator('.garage-swatch input[type="color"]').count(), 0, 'A fixed livery has no paint inputs');

    // SHIFT opens its gearbox for a playable car and closes back to GARAGE.
    await page.evaluate(() => globalThis.__turnGarage.viewCar('classic'));
    await page.locator('.garage-shift').click();
    await page.waitForSelector('.lot-shift-dialog[open]');
    await page.locator('.lot-shift-cancel').click();
    await page.waitForFunction(() => !document.querySelector('.lot-shift-dialog').open);

    // Sport trim #666 on the Sports Car is the secret.
    await page.evaluate(() => globalThis.__turnGarage.viewCar('sedan-sports'));
    await page.waitForSelector('.garage-swatch input[type="color"]');
    // Paint is TURN's native colour input: unstyled, explicitly labelled, a full-height row.
    const paint = await page.evaluate(() => [...document.querySelectorAll('.garage-swatch')].map((row) => {
      const input = row.querySelector('input[type="color"]');
      const box = input.getBoundingClientRect();
      return {
        label: input.labels[0]?.querySelector('.garage-swatch-label')?.textContent,
        clipped: box.width <= 1 && box.height <= 1,
        height: row.getBoundingClientRect().height >= 44
      };
    }));
    assert.deepEqual(paint, [
      { label: 'Body', clipped: true, height: true },
      { label: 'Sport trim', clipped: true, height: true }
    ]);
    // A tap on the visible face reaches the real input through its label.
    const activated = await page.evaluate(() => {
      const input = document.querySelector('#garagePaintBody');
      let clicked = false;
      input.addEventListener('click', (event) => { clicked = true; event.preventDefault(); }, { once: true });
      document.querySelector('.garage-swatch-face').click();
      return clicked;
    });
    assert.equal(activated, true, 'The painted face activates the native colour input');
    const cueBefore = await page.locator('.garage-color-cue').textContent();
    assert.match(cueBefore, /^CAR COLOR · [A-Z]+$/, 'Color Cues names the chosen body colour');
    await page.evaluate(() => {
      const input = document.querySelector('#garagePaintBody');
      input.value = '#1e8f3e';
      input.dispatchEvent(new globalThis.Event('input', { bubbles: true }));
    });
    assert.equal(await page.locator('.garage-color-cue').textContent(), 'CAR COLOR · GREEN', 'The cue follows a repaint');
    await page.evaluate(() => {
      const input = document.querySelector('#garagePaintSecondary');
      input.value = '#666666';
      input.dispatchEvent(new globalThis.Event('input', { bubbles: true }));
    });
    const secret = await page.evaluate(() => ({
      name: document.querySelector('.garage-name').textContent.trim(),
      notice: !document.querySelector('.garage-secret').hidden,
      race: document.querySelector('.garage-race').getAttribute('aria-label')
    }));
    assert.deepEqual(secret, { name: 'SATAN’S SPORTS CAR', notice: true, race: 'Race Satan’s Sports Car' });
    assert.deepEqual(errors, [], 'unlocked: no page errors');
  } finally {
    await browser.close();
  }
}

async function layoutAt(name, size, check) {
  const { browser, page, errors } = await openGarage(chromium, size);
  try {
    const facts = await garageLayout(page);
    assert.ok(facts.overflowX <= 0, `${name}: no sideways scroll (${facts.overflowX})`);
    assert.deepEqual(facts.small, [], `${name}: every target is at least 44px`);
    assert.ok(facts.dock.bottom <= facts.viewport.height + 0.5, `${name}: the dock stays inside the viewport`);
    assert.equal(facts.clippedName, false, `${name}: the car name wraps instead of clipping`);
    assert.equal(facts.lastClearsDock, true, `${name}: the details scroll clear of the dock`);
    assert.ok(facts.view.width > 0 && facts.view.height > 0, `${name}: the car is on stage`);
    await check(facts, page);
    assert.deepEqual(errors, [], `${name}: no page errors`);
  } finally {
    await browser.close();
  }
}

try {
  await phoneFlow(chromium, 'Chromium');
  await phoneFlow(webkit, 'WebKit');
  await unlockedFlow();
  await layoutAt('320x568', { width: 320, height: 568 }, (facts) => {
    assert.equal(facts.specsOpen, false);
  });
  await layoutAt('852x393 short landscape', { width: 852, height: 393 }, (facts) => {
    assert.ok(facts.dock.height <= 80, `short landscape: a one-line dock (${facts.dock.height})`);
  });
  await layoutAt('820x1180 iPad portrait', { width: 820, height: 1180, isMobile: false }, (facts) => {
    assert.equal(facts.specsOpen, true, 'iPad: Specifications start open');
  });
  await layoutAt('1180x820 iPad landscape', { width: 1180, height: 820, isMobile: false }, async (facts, page) => {
    assert.equal(facts.specsOpen, true);
    const beside = await page.evaluate(() => document.querySelector('.garage-details').getBoundingClientRect().left
      >= document.querySelector('.garage-feature').getBoundingClientRect().right - 1);
    assert.equal(beside, true, 'iPad landscape: the details sit beside the featured car');
  });
  console.log('GARAGE features one car at a time, keeps the choice apart from a locked preview, races it and fits 320px to iPad.');
} finally {
  server.close();
}
