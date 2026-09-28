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
// playable car, ALL CARS in a sheet on phones and on the page on iPad, back to
// ROADBOOK with the track kept, and a layout that fits 320px to iPad. Every step here
// is a real pointer tap on what the player sees.
const root = fileURLToPath(new URL('../', import.meta.url));
const threeRoot = fileURLToPath(new URL('../', import.meta.resolve('three')));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.PNG': 'image/png', '.webp': 'image/webp' };
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

// textSize: the browser's own text size setting (Chromium); it moves rem media queries
// too, as a player's enlarged text does.
async function openGarage(browserType, { width, height, isMobile = true, unlocked = false, textSize = 0 }) {
  const browser = await browserType.launch();
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: browserType !== webkit && isMobile, reducedMotion: 'reduce' });
  const page = await context.newPage();
  if (textSize) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Page.enable');
    await cdp.send('Page.setFontSizes', { fontSizes: { standard: textSize, fixed: Math.round(textSize * 0.8) } });
  }
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
  const inline = document.querySelector('.garage-catalog-inline');
  const cards = [...document.querySelectorAll('.garage-catalog-inline .garage-car-card')];
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
    dockFixed: globalThis.getComputedStyle(document.querySelector('.garage-dock')).position === 'fixed',
    catalog: garage.dataset.catalog,
    allCarsButton: visible(document.querySelector('.garage-all-cars-button')),
    inlineCards: visible(inline) ? cards.length : 0,
    inlineColumns: new Set(cards.map((card) => Math.round(card.getBoundingClientRect().left))).size,
    clippedName: document.querySelector('.garage-name').scrollWidth > document.querySelector('.garage-name').clientWidth + 1,
    lastClearsDock: (() => {
      garage.scrollTop = garage.scrollHeight;
      const last = [document.querySelector('.garage-details'), visible(inline) ? inline : null]
        .filter(Boolean)
        .reduce((lowest, node) => Math.max(lowest, node.getBoundingClientRect().bottom), -Infinity);
      const clear = last <= document.querySelector('.garage-dock').getBoundingClientRect().top + 1;
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

    // ALL CARS: every car in a sheet. A playable card becomes the choice, a locked one
    // only a preview; the sheet closes on either and focus returns to ALL CARS.
    const allCarsButton = page.locator('.garage-all-cars-button');
    assert.equal((await allCarsButton.textContent()).trim(), `ALL CARS · ${order.length}`);
    await allCarsButton.click();
    await page.waitForSelector('.garage-all-cars[open]');
    await page.waitForFunction(() => {
      const still = document.querySelector('.garage-all-cars .garage-car-still');
      return still.complete && still.naturalWidth > 0;
    });
    const sheet = await page.evaluate(() => {
      const dialog = document.querySelector('.garage-all-cars');
      const close = dialog.querySelector('.turn-pr-close');
      const body = dialog.querySelector('.turn-pr-sheet-body');
      const cards = [...dialog.querySelectorAll('.garage-car-card')];
      const box = dialog.querySelector('.turn-pr-sheet-card').getBoundingClientRect();
      const locked = cards.filter((card) => card.classList.contains('is-locked'));
      const open = cards.filter((card) => !card.classList.contains('is-locked'));
      return {
        focus: document.activeElement === dialog.querySelector('#garageAllCarsTitle'),
        closeColor: globalThis.getComputedStyle(close).backgroundColor,
        ids: cards.map((card) => card.dataset.carId),
        pressed: cards.filter((card) => card.getAttribute('aria-pressed') === 'true').map((card) => card.dataset.carId),
        selectedState: dialog.querySelector('.garage-car-card.is-selected .garage-car-state').textContent.trim(),
        openStills: open.every((card) => /\/stills\/[a-z-]+\.webp/.test(card.querySelector('img').src) && !/-outline\.webp/.test(card.querySelector('img').src)),
        lockedDrawings: locked.length > 0 && locked.every((card) => /-outline\.webp/.test(card.querySelector('img').src)),
        lockedLabels: locked.every((card) => /, \d+ of \d+\. Locked until \d+ trophies\. Preview\.$/.test(card.getAttribute('aria-label'))),
        lockedThresholds: locked.every((card) => /^\d+$/.test(card.querySelector('.garage-car-threshold')?.textContent || '')),
        columns: new Set(cards.slice(0, 4).map((card) => Math.round(card.getBoundingClientRect().left))).size,
        inside: box.left >= 0 && box.right <= globalThis.innerWidth + 0.5 && box.bottom <= globalThis.innerHeight + 0.5,
        overflowX: body.scrollWidth - body.clientWidth,
        small: cards.filter((card) => {
          const rect = card.getBoundingClientRect();
          return rect.width < 44 || rect.height < 44;
        }).length
      };
    });
    assert.deepEqual(sheet, {
      focus: true,
      closeColor: 'rgb(255, 123, 84)',
      ids: order,
      pressed: [order[0]],
      selectedState: '✓Selected',
      openStills: true,
      lockedDrawings: true,
      lockedLabels: true,
      lockedThresholds: true,
      columns: 2,
      inside: true,
      overflowX: 0,
      small: 0
    }, `${name}: ALL CARS shows every car in two columns, the choice selected and locked cars as line drawings`);

    const secondCar = order[1];
    assert.equal(locks.find((car) => car.id === secondCar)?.locked, false);
    await page.locator(`.garage-all-cars .garage-car-card[data-car-id="${secondCar}"]`).click();
    await page.waitForFunction(() => !document.querySelector('.garage-all-cars').open);
    state = await garageState(page);
    assert.deepEqual([state.viewed, state.choice], [secondCar, secondCar], `${name}: a playable card becomes the choice`);
    const afterChoice = await page.evaluate(() => ({
      focus: document.activeElement?.classList.contains('garage-all-cars-button'),
      announced: document.querySelector('.garage-announcer').textContent
    }));
    assert.deepEqual(afterChoice, { focus: true, announced: `${carName[secondCar]}, 2 of ${order.length}.` },
      `${name}: focus returns to ALL CARS and the new car is announced`);

    await allCarsButton.click();
    await page.waitForSelector('.garage-all-cars[open]');
    await page.locator(`.garage-all-cars .garage-car-card[data-car-id="${firstLocked}"]`).click();
    await page.waitForFunction(() => !document.querySelector('.garage-all-cars').open);
    state = await garageState(page);
    assert.deepEqual([state.viewed, state.choice, state.race, state.leave], [firstLocked, secondCar, null, `Back to ${carName[secondCar]}`],
      `${name}: a locked card is only a preview`);
    await allCarsButton.click();
    await page.waitForSelector('.garage-all-cars[open]');
    const previewed = await page.evaluate((id) => {
      const card = document.querySelector(`.garage-all-cars .garage-car-card[data-car-id="${id}"]`);
      return {
        previewed: card.classList.contains('is-previewed'),
        state: card.querySelector('.garage-car-state').textContent.trim(),
        chosen: document.querySelector('.garage-all-cars .garage-car-card[aria-pressed="true"]').dataset.carId
      };
    }, firstLocked);
    assert.deepEqual(previewed, { previewed: true, state: 'Previewing', chosen: secondCar },
      `${name}: the sheet marks the preview apart from the choice`);
    // Escape closes the sheet and changes nothing.
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.garage-all-cars').open);
    assert.equal((await garageState(page)).viewed, firstLocked, `${name}: closing ALL CARS keeps the car on stage`);
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('garage-all-cars-button')), true);
    await page.locator('.garage-leave-preview').click();

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

    // 17/17: every card is a coloured still, and the last car can be chosen.
    await page.locator('.garage-all-cars-button').click();
    await page.waitForSelector('.garage-all-cars[open]');
    const unlockedCards = await page.evaluate(() => [...document.querySelectorAll('.garage-all-cars .garage-car-card')]
      .map((card) => ({ locked: card.classList.contains('is-locked'), drawing: /-outline\.webp/.test(card.querySelector('img').src) })));
    assert.equal(unlockedCards.length, order.length);
    assert.ok(unlockedCards.every((card) => !card.locked && !card.drawing), 'With every car unlocked, no card is a line drawing');
    const lastCar = order[order.length - 1];
    await page.locator(`.garage-all-cars .garage-car-card[data-car-id="${lastCar}"]`).click();
    await page.waitForFunction(() => !document.querySelector('.garage-all-cars').open);
    const last = await garageState(page);
    assert.deepEqual([last.viewed, last.choice, last.race?.label], [lastCar, lastCar, 'RACE'], 'The last car is chosen from ALL CARS');

    // A fixed service livery is shown, never repainted.
    await page.evaluate((id) => globalThis.__turnGarage.viewCar(id), fixedLiveryId);
    await page.locator('.garage-paint-toggle').click();
    await page.waitForSelector('.garage-paint-fixed');
    assert.equal(await page.locator('.garage-swatch input[type="color"]').count(), 0, 'A fixed livery has no paint inputs');

    // SHIFT opens its gearbox for a playable car and closes back to GARAGE.
    await page.evaluate(() => globalThis.__turnGarage.viewCar('classic'));
    await page.locator('.garage-shift').click();
    await page.waitForSelector('.garage-shift-dialog[open]');
    await page.locator('.garage-shift-cancel').click();
    await page.waitForFunction(() => !document.querySelector('.garage-shift-dialog').open);

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

    // Saved colours show on the car's card in ALL CARS; resetting brings back the factory still.
    await page.evaluate(() => globalThis.__turnGarage.viewCar('van'));
    await page.waitForSelector('#garagePaintBody');
    await page.evaluate(() => {
      const input = document.querySelector('#garagePaintBody');
      input.value = '#1e8f3e';
      input.dispatchEvent(new globalThis.Event('input', { bubbles: true }));
    });
    await page.locator('.garage-paint-save').click();
    await page.locator('.garage-all-cars-button').click();
    await page.waitForSelector('.garage-all-cars[open]');
    await page.locator('.garage-all-cars .garage-car-card[data-car-id="van"]').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const still = document.querySelector('.garage-all-cars .garage-car-card[data-car-id="van"] .garage-car-still');
      return still.src.startsWith('blob:') && still.complete && still.naturalWidth > 0;
    }, null, { timeout: 30000 });
    const vanCard = await page.evaluate(() => {
      const still = document.querySelector('.garage-all-cars .garage-car-card[data-car-id="van"] .garage-car-still');
      const canvas = document.createElement('canvas');
      canvas.width = still.naturalWidth;
      canvas.height = still.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(still, 0, 0);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let green = 0;
      let orange = 0;
      for (let index = 0; index < data.length; index += 4) {
        const [red, greenChannel, blue, alpha] = data.slice(index, index + 4);
        if (alpha < 200) continue;
        if (greenChannel > red + 40 && greenChannel > blue + 20) green += 1;
        if (red > 200 && greenChannel > 90 && greenChannel < 190 && blue < 80) orange += 1;
      }
      return {
        size: [still.naturalWidth, still.naturalHeight],
        green,
        orange,
        others: document.querySelector('.garage-all-cars .garage-car-card[data-car-id="suv"] .garage-car-still').getAttribute('src')
      };
    });
    assert.deepEqual(vanCard.size, [480, 288], 'A repainted card keeps the card size');
    assert.ok(vanCard.green > 500, `The Van's card wears its saved green (${vanCard.green} green pixels)`);
    assert.ok(vanCard.orange < 50, `The Van's factory orange is gone from its card (${vanCard.orange})`);
    assert.match(vanCard.others, /\/stills\/suv\.webp/, 'Cars without saved colours keep their factory still');
    await page.locator('.garage-all-cars .turn-pr-close').click();
    await page.waitForFunction(() => !document.querySelector('.garage-all-cars').open);
    await page.locator('.garage-paint-save[data-mode="reset"]').click();
    await page.locator('.garage-all-cars-button').click();
    await page.waitForSelector('.garage-all-cars[open]');
    assert.match(await page.locator('.garage-all-cars .garage-car-card[data-car-id="van"] .garage-car-still').getAttribute('src'), /\/stills\/van\.webp/,
      'Reset to factory brings back the factory still');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.garage-all-cars').open);
    // Behind a closed sheet, a new save renders nothing; the card catches up on opening.
    await page.evaluate(() => {
      const input = document.querySelector('#garagePaintBody');
      input.value = '#2050d0';
      input.dispatchEvent(new globalThis.Event('input', { bubbles: true }));
    });
    await page.locator('.garage-paint-save').click();
    await page.waitForTimeout(400);
    const hidden = await page.evaluate(() => {
      const card = document.querySelector('.garage-all-cars .garage-car-card[data-car-id="van"]');
      return { src: card.querySelector('.garage-car-still').getAttribute('src'), painting: card.classList.contains('is-painting') };
    });
    assert.deepEqual(hidden, { src: null, painting: false }, 'A closed ALL CARS sheet starts no repaint render');
    await page.locator('.garage-all-cars-button').click();
    await page.waitForSelector('.garage-all-cars[open]');
    await page.waitForFunction(() => document.querySelector('.garage-all-cars .garage-car-card[data-car-id="van"] .garage-car-still').src.startsWith('blob:'),
      null, { timeout: 30000 });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.garage-all-cars').open);

    // Short landscape: PAINT opens below the fold and scrolls its panel into view,
    // clear of the app bar and the RACE dock.
    await page.setViewportSize({ width: 852, height: 393 });
    await page.evaluate(() => {
      globalThis.__turnGarage.viewCar('classic');
      const toggle = document.querySelector('.garage-paint-toggle');
      if (toggle.getAttribute('aria-expanded') === 'true') toggle.click();
      document.querySelector('.garage').scrollTop = 0;
      globalThis.scrollTo(0, 0);
    });
    await page.locator('.garage-paint-toggle').click();
    await page.waitForFunction(() => {
      const save = document.querySelector('.garage-paint-save')?.getBoundingClientRect();
      const dock = document.querySelector('.garage-dock').getBoundingClientRect();
      return save && save.bottom <= dock.top + 1;
    }, null, { timeout: 5000 }).catch(() => {});
    const reveal = await page.evaluate(() => {
      const panel = document.querySelector('.garage-paint').getBoundingClientRect();
      const save = document.querySelector('.garage-paint-save').getBoundingClientRect();
      const dock = document.querySelector('.garage-dock').getBoundingClientRect();
      const bar = document.querySelector('.garage .turn-app-bar, .garage-head')?.getBoundingClientRect();
      return { saveAboveDock: save.bottom <= dock.top + 1, belowBar: !bar || panel.top >= bar.bottom - 1, at: { panelTop: panel.top, saveBottom: save.bottom, dockTop: dock.top, barBottom: bar?.bottom } };
    });
    assert.ok(reveal.saveAboveDock && reveal.belowBar, `852x393: PAINT scrolls its panel into view above the dock (${JSON.stringify(reveal.at)})`);
    assert.deepEqual(errors, [], 'unlocked: no page errors');
  } finally {
    await browser.close();
  }
}

// The ALL CARS sheet at the current size: columns, bounds and whole names.
async function sheetFacts(page) {
  await page.locator('.garage-all-cars-button').click();
  await page.waitForSelector('.garage-all-cars[open]');
  const facts = await page.evaluate(() => {
    const dialog = document.querySelector('.garage-all-cars');
    const body = dialog.querySelector('.turn-pr-sheet-body');
    const cards = [...dialog.querySelectorAll('.garage-car-card')];
    const box = dialog.querySelector('.turn-pr-sheet-card').getBoundingClientRect();
    return {
      columns: new Set(cards.slice(0, 6).map((card) => Math.round(card.getBoundingClientRect().left))).size,
      inside: box.left >= 0 && box.top >= 0 && box.right <= globalThis.innerWidth + 0.5 && box.bottom <= globalThis.innerHeight + 0.5,
      overflowX: body.scrollWidth - body.clientWidth,
      clippedNames: cards.map((card) => card.querySelector('.garage-car-name'))
        .filter((node) => node.scrollWidth > node.clientWidth + 1)
        .map((node) => node.textContent),
      // A word wider than its card would break mid-word ("AMBULANC-E").
      brokenWords: cards.map((card) => card.querySelector('.garage-car-name')).filter((node) => {
        const style = globalThis.getComputedStyle(node);
        const probe = document.createElement('span');
        Object.assign(probe.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', font: style.font, letterSpacing: style.letterSpacing, textTransform: style.textTransform });
        node.appendChild(probe);
        const broken = node.textContent.trim().split(/\s+/).some((word) => {
          probe.textContent = word;
          return probe.getBoundingClientRect().width > node.clientWidth + 0.5;
        });
        probe.remove();
        return broken;
      }).map((node) => node.textContent)
    };
  });
  await page.locator('.garage-all-cars .turn-pr-close').click();
  await page.waitForFunction(() => !document.querySelector('.garage-all-cars').open);
  return facts;
}

async function layoutAt(name, size, check) {
  const { browser, page, errors } = await openGarage(chromium, size);
  try {
    const facts = await garageLayout(page);
    assert.ok(facts.overflowX <= 0, `${name}: no sideways scroll (${facts.overflowX})`);
    assert.deepEqual(facts.small, [], `${name}: every target is at least 44px`);
    if (facts.dockFixed) {
      assert.ok(facts.dock.bottom <= facts.viewport.height + 0.5, `${name}: the dock stays inside the viewport`);
    } else {
      const end = await page.evaluate(() => {
        const garage = document.querySelector('.garage');
        garage.scrollTop = garage.scrollHeight;
        const race = document.querySelector('.garage-race').getBoundingClientRect();
        const result = race.bottom <= globalThis.innerHeight + 0.5 && race.top >= 0;
        garage.scrollTop = 0;
        return result;
      });
      assert.equal(end, true, `${name}: at the end of the page RACE is in view`);
    }
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
  await layoutAt('320x568', { width: 320, height: 568 }, async (facts, page) => {
    assert.equal(facts.specsOpen, false);
    assert.deepEqual([facts.catalog, facts.allCarsButton], ['sheet', true]);
    assert.deepEqual(await sheetFacts(page), { columns: 2, inside: true, overflowX: 0, clippedNames: [], brokenWords: [] },
      '320: ALL CARS keeps two columns and whole names');
  });
  await layoutAt('393x852 200% text', { width: 393, height: 852, textSize: 32 }, async (facts, page) => {
    assert.equal(facts.dockFixed, false, '200% text: the dock joins the end of the page');
    assert.equal(facts.catalog, 'sheet');
    const sheet = await sheetFacts(page);
    assert.deepEqual([sheet.inside, sheet.overflowX, sheet.clippedNames, sheet.brokenWords], [true, 0, [], []],
      '200% text: ALL CARS reflows with whole names');
  });
  await layoutAt('1180x820 iPad landscape, 200% text', { width: 1180, height: 820, isMobile: false, textSize: 32 }, (facts) => {
    assert.equal(facts.catalog, 'sheet', 'iPad at 200% text: ALL CARS moves into its sheet rather than squeezing three columns');
  });
  await layoutAt('852x393 short landscape', { width: 852, height: 393 }, async (facts, page) => {
    assert.ok(facts.dock.height <= 80, `short landscape: a one-line dock (${facts.dock.height})`);
    assert.equal(facts.catalog, 'sheet');
    const sheet = await sheetFacts(page);
    assert.ok(sheet.columns >= 3, `short landscape: ALL CARS uses the width (${sheet.columns} columns)`);
    assert.deepEqual([sheet.inside, sheet.overflowX, sheet.clippedNames, sheet.brokenWords], [true, 0, [], []]);
  });
  await layoutAt('820x1180 iPad portrait', { width: 820, height: 1180, isMobile: false }, async (facts, page) => {
    assert.equal(facts.specsOpen, true, 'iPad: Specifications start open');
    assert.deepEqual([facts.catalog, facts.allCarsButton, facts.inlineCards, facts.inlineColumns], ['below', false, order.length, 4],
      'iPad portrait: ALL CARS sits below the featured car, four across');
    // A tap on a card below the stage features that car and brings it into view.
    const target = order[2];
    await page.locator(`.garage-catalog-inline .garage-car-card[data-car-id="${target}"]`).scrollIntoViewIfNeeded();
    await page.evaluate(() => { document.querySelector('.garage').scrollTop = document.querySelector('.garage').scrollHeight; });
    await page.locator(`.garage-catalog-inline .garage-car-card[data-car-id="${target}"]`).click();
    await page.waitForFunction(() => {
      const stage = document.querySelector('.garage-stage').getBoundingClientRect();
      return stage.bottom > 0 && stage.top < globalThis.innerHeight;
    });
    const chosen = await page.evaluate(() => ({
      viewed: globalThis.__turnGarage.getViewedCarId(),
      focus: document.activeElement?.dataset?.carId,
      pressed: document.querySelector('.garage-catalog-inline .garage-car-card[aria-pressed="true"]')?.dataset.carId
    }));
    assert.deepEqual(chosen, { viewed: target, focus: target, pressed: target }, 'iPad portrait: a card features its car and keeps focus');
  });
  await layoutAt('1180x820 iPad landscape', { width: 1180, height: 820, isMobile: false }, async (facts, page) => {
    assert.equal(facts.specsOpen, true);
    assert.deepEqual([facts.catalog, facts.allCarsButton, facts.inlineCards], ['side', false, order.length],
      'iPad landscape: ALL CARS sits beside the featured car');
    const beside = await page.evaluate(() => {
      const catalog = document.querySelector('.garage-catalog-inline').getBoundingClientRect();
      const feature = document.querySelector('.garage-feature').getBoundingClientRect();
      const details = document.querySelector('.garage-details').getBoundingClientRect();
      return { catalogFirst: catalog.right <= feature.left + 1, detailsBeside: details.left >= feature.right - 1 };
    });
    assert.deepEqual(beside, { catalogFirst: true, detailsBeside: true }, 'iPad landscape: list, featured car, details');
    // The featured car stays in view while the list scrolls.
    const pinned = await page.evaluate(() => {
      const garage = document.querySelector('.garage');
      garage.scrollTop = garage.scrollHeight;
      const stage = document.querySelector('.garage-stage').getBoundingClientRect();
      const bar = document.querySelector('.garage-bar').getBoundingClientRect();
      return garage.classList.contains('is-detail-pinned') && stage.top >= bar.bottom - 1 && stage.bottom <= globalThis.innerHeight;
    });
    assert.equal(pinned, true, 'iPad landscape: the featured car stays in view at the end of the list');
  });
  console.log('GARAGE features one car at a time, keeps the choice apart from a locked preview, races it and fits 320px to iPad.');
} finally {
  server.close();
}
