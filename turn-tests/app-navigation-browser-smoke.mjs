import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

// App navigation (ui/app-navigation.js) and safe areas, as on an iPhone:
// - every sheet and dialog clears the status bar, Dynamic Island, notch and home
//   indicator (Chromium emulates the insets);
// - back (Android, the browser, Safari's edge swipe) closes the top layer, never the
//   app, and a race declines it (Chromium and WebKit);
// - a bottom sheet drags down to close, a side menu drags right, and GARAGE swipes
//   back from the left edge in the installed app (real touches in Chromium).
const root = fileURLToPath(new URL('../', import.meta.url));
const threeRoot = fileURLToPath(new URL('../', import.meta.resolve('three')));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png' };
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

const IPHONE_PORTRAIT = { width: 393, height: 852, insets: { top: 59, bottom: 34, left: 0, right: 0 } };
const IPHONE_LANDSCAPE = { width: 852, height: 393, insets: { top: 0, bottom: 21, left: 59, right: 59 } };

async function open(browserType, { width, height, insets }) {
  const browser = await browserType.launch();
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: browserType !== webkit, reducedMotion: 'reduce' });
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
  let cdp = null;
  if (browserType === chromium) {
    cdp = await context.newCDPSession(page);
    if (insets) await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets });
  }
  await page.addInitScript(() => {
    localStorage.setItem('turn-low-graphics-v1', '1');
    localStorage.setItem('turn-steering-mode-v1', 'manual');
    localStorage.setItem('turn-audio-enabled-v1', 'off');
    localStorage.setItem('turn-racing-music-volume-v1', '0');
    Object.defineProperty(globalThis.navigator, 'standalone', { configurable: true, value: true });
  });
  await page.goto(`${origin}/turn/`);
  await page.waitForFunction(() => document.documentElement.classList.contains('turn-home-ready'), null, { timeout: 60000 });
  return { browser, page, cdp, errors };
}

const settle = (page, ms = 350) => page.waitForTimeout(ms);
const state = (page) => page.evaluate(() => ({
  layers: globalThis.__turnAppNavigation.layers().length,
  garage: Boolean(document.querySelector('.garage')),
  home: !document.querySelector('.m8-home').hidden,
  dialogs: document.querySelectorAll('dialog[open]').length
}));

// The sheet's card sits inside the safe frame: below the status bar, above the home
// indicator (portrait, bottom sheets reach the bottom edge but pad their content) and
// clear of the notch.
async function frame(page, selector, insets) {
  return page.evaluate(({ selector, insets }) => {
    const dialog = document.querySelector(selector);
    const card = dialog.querySelector(':scope > :first-child').getBoundingClientRect();
    const head = dialog.querySelector('.turn-pr-sheet-head, .m8-dialog-head').getBoundingClientRect();
    return {
      belowStatusBar: card.top >= insets.top && head.top >= insets.top,
      clearOfSides: card.left >= insets.left - 0.5 && card.right <= globalThis.innerWidth - insets.right + 0.5,
      onScreen: card.bottom <= globalThis.innerHeight + 0.5,
      at: { top: Math.round(card.top), left: Math.round(card.left), right: Math.round(card.right), bottom: Math.round(card.bottom) }
    };
  }, { selector, insets });
}

async function safeAreas() {
  const portrait = await open(chromium, IPHONE_PORTRAIT);
  try {
    const { page } = portrait;
    const { insets } = IPHONE_PORTRAIT;
    await page.locator('.roadbook-sheet-button').click();
    await page.waitForSelector('#turnTrackSheet[open]');
    await settle(page);
    const track = await frame(page, '#turnTrackSheet', insets);
    assert.ok(track.belowStatusBar && track.onScreen, `Portrait Track sheet clears the status bar (${JSON.stringify(track.at)})`);
    assert.equal(track.at.bottom, IPHONE_PORTRAIT.height, 'Portrait Track sheet is a bottom sheet');
    assert.equal(await page.locator('#turnTrackSheet .turn-sheet-grabber').count(), 1, 'A bottom sheet carries a grabber');
    await page.keyboard.press('Escape');
    await page.locator('.m8-track-continue').click();
    await page.waitForSelector('.garage');
    await page.locator('.garage-all-cars-button').click();
    await page.waitForSelector('.garage-all-cars[open]');
    await settle(page);
    const cars = await frame(page, '.garage-all-cars', insets);
    assert.ok(cars.belowStatusBar && cars.onScreen, `Portrait ALL CARS clears the status bar and Dynamic Island (${JSON.stringify(cars.at)})`);
    // Its last card scrolls clear of the home indicator.
    const lastClear = await page.evaluate((bottom) => {
      const body = document.querySelector('.garage-all-cars .turn-pr-sheet-body');
      body.scrollTop = body.scrollHeight;
      const cards = body.querySelectorAll('.garage-car-card');
      return cards[cards.length - 1].getBoundingClientRect().bottom <= globalThis.innerHeight - bottom;
    }, insets.bottom);
    assert.ok(lastClear, 'The last car scrolls clear of the home indicator');
    assert.deepEqual(portrait.errors, [], 'portrait: no page errors');
  } finally {
    await portrait.browser.close();
  }

  const landscape = await open(chromium, IPHONE_LANDSCAPE);
  try {
    const { page } = landscape;
    await page.locator('.m8-track-continue').click();
    await page.waitForSelector('.garage');
    await page.locator('.garage-all-cars-button').click();
    await page.waitForSelector('.garage-all-cars[open]');
    await settle(page);
    const cars = await frame(page, '.garage-all-cars', IPHONE_LANDSCAPE.insets);
    assert.ok(cars.clearOfSides && cars.onScreen, `Landscape ALL CARS stays clear of the notch (${JSON.stringify(cars.at)})`);
    assert.deepEqual(landscape.errors, [], 'landscape: no page errors');
  } finally {
    await landscape.browser.close();
  }
}

async function backStack(browserType, name) {
  const { browser, page, errors } = await open(browserType, IPHONE_PORTRAIT);
  try {
    const back = async () => {
      await page.evaluate(() => globalThis.history.back());
      await settle(page, 700);
    };
    assert.deepEqual(await state(page), { layers: 0, garage: false, home: true, dialogs: 0 }, `${name}: ROADBOOK is the root`);

    // A sheet: back closes it and ROADBOOK stays.
    await page.locator('.roadbook-sheet-button').click();
    await page.waitForSelector('#turnTrackSheet[open]');
    await settle(page);
    await back();
    assert.deepEqual(await state(page), { layers: 0, garage: false, home: true, dialogs: 0 }, `${name}: back closes the Track sheet`);
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('roadbook-sheet-button')), true,
      `${name}: focus returns to Track sheet, as after Escape`);

    // GARAGE, then a sheet over it: back closes one layer at a time.
    await page.locator('.m8-track-continue').click();
    await page.waitForSelector('.garage');
    await settle(page);
    await page.locator('.garage-all-cars-button').click();
    await page.waitForSelector('.garage-all-cars[open]');
    await settle(page);
    assert.equal((await state(page)).layers, 2, `${name}: GARAGE and ALL CARS are two layers`);
    await back();
    assert.deepEqual(await state(page), { layers: 1, garage: true, home: false, dialogs: 0 }, `${name}: back closes ALL CARS first`);
    await back();
    assert.deepEqual(await state(page), { layers: 0, garage: false, home: true, dialogs: 0 }, `${name}: back leaves GARAGE for ROADBOOK`);

    // Closing with the × keeps history in step: the next back is not wasted.
    await page.locator('.m8-track-continue').click();
    await page.waitForSelector('.garage');
    await settle(page);
    await page.locator('.garage-all-cars-button').click();
    await page.waitForSelector('.garage-all-cars[open]');
    await page.locator('.garage-all-cars .turn-pr-close').click();
    await settle(page, 700);
    await back();
    assert.deepEqual(await state(page), { layers: 0, garage: false, home: true, dialogs: 0 },
      `${name}: after × closes ALL CARS, one back leaves GARAGE`);

    // A race declines back: a stray gesture never ends it.
    await page.locator('.m8-track-continue').click();
    await page.waitForSelector('.garage');
    await page.waitForTimeout(700);
    await page.locator('.garage-race').click();
    await page.waitForSelector('#controls:not([hidden])', { timeout: 60000 });
    await settle(page, 600);
    await back();
    const race = await page.evaluate(() => ({
      racing: document.body.classList.contains('turn-race-active'),
      controls: !document.querySelector('#controls').hidden
    }));
    assert.deepEqual(race, { racing: true, controls: true }, `${name}: back during a race keeps racing`);
    assert.deepEqual(errors, [], `${name}: no page errors`);
  } finally {
    await browser.close();
  }
}

async function gestures() {
  const { browser, page, cdp, errors } = await open(chromium, IPHONE_PORTRAIT);
  const touch = async (points, { hold = false } = {}) => {
    const [x0, y0] = points[0];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (const [x, y] of points.slice(1)) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
      await page.waitForTimeout(16);
    }
    if (!hold) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const line = ([x0, y0], [x1, y1], steps = 12) => Array.from({ length: steps + 1 },
    (_, i) => [x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps]);
  try {
    // Track sheet: a short drag springs back, a long one closes it.
    await page.locator('.roadbook-sheet-button').click();
    await page.waitForSelector('#turnTrackSheet[open]');
    await settle(page);
    const head = await page.evaluate(() => {
      const box = document.querySelector('#turnTrackSheet .turn-pr-sheet-head').getBoundingClientRect();
      return [box.left + box.width / 2, box.top + 24];
    });
    await touch(line(head, [head[0], head[1] + 40], 4));
    await settle(page, 500);
    assert.deepEqual(await page.evaluate(() => ({
      open: document.querySelector('#turnTrackSheet').open,
      moved: document.querySelector('#turnTrackSheet .turn-pr-sheet-card').style.transform || ''
    })), { open: true, moved: '' }, 'A short drag springs the sheet back into place');
    await touch(line(head, [head[0], head[1] + 360]));
    await settle(page, 600);
    assert.equal(await page.evaluate(() => document.querySelector('#turnTrackSheet').open), false, 'Dragging the Track sheet down closes it');
    assert.equal(await page.evaluate(() => globalThis.__turnAppNavigation.depth()), 0, 'A drag-close keeps history in step');

    // The ☰ menu is a side sheet: it drags right to close.
    await page.locator('.turn-home-menu-button').click();
    await page.waitForSelector('#turnHomeMenuSheet[open]');
    await settle(page);
    const menu = await page.evaluate(() => {
      const box = document.querySelector('#turnHomeMenuSheet').getBoundingClientRect();
      return [box.left + 40, box.top + 320];
    });
    await touch(line(menu, [menu[0] + 240, menu[1] + 8]));
    await settle(page, 600);
    assert.equal(await page.evaluate(() => document.querySelector('#turnHomeMenuSheet').open), false, 'Dragging the menu right closes it');

    // GARAGE: from the left edge the screen follows the finger with ROADBOOK beneath.
    await page.locator('.m8-track-continue').click();
    await page.waitForSelector('.garage');
    await settle(page, 700);
    await touch(line([4, 430], [230, 436], 10), { hold: true });
    await settle(page, 150);
    const mid = await page.evaluate(() => ({
      moved: new globalThis.DOMMatrix(globalThis.getComputedStyle(document.querySelector('.garage')).transform).m41 > 100,
      beneath: !document.querySelector('.m8-home').hidden
    }));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.deepEqual(mid, { moved: true, beneath: true }, 'Mid-swipe, GARAGE follows the finger and ROADBOOK shows beneath');
    await settle(page, 900);
    assert.deepEqual(await state(page), { layers: 0, garage: false, home: true, dialogs: 0 }, 'An edge swipe goes back to ROADBOOK');

    // A short swipe returns GARAGE to place and hides ROADBOOK again.
    await page.locator('.m8-track-continue').click();
    await page.waitForSelector('.garage');
    await settle(page, 700);
    await touch(line([4, 430], [50, 432], 3));
    await settle(page, 700);
    assert.deepEqual(await state(page), { layers: 1, garage: true, home: false, dialogs: 0 }, 'A short edge swipe stays in GARAGE');
    assert.equal(await page.evaluate(() => document.querySelector('.garage').style.transform), '', 'GARAGE is back in place');
    assert.deepEqual(errors, [], 'gestures: no page errors');
  } finally {
    await browser.close();
  }
}

try {
  await safeAreas();
  await backStack(chromium, 'Chromium');
  await backStack(webkit, 'WebKit');
  await gestures();
  console.log('App navigation: safe areas, back stack (Chromium, WebKit), drag to dismiss and edge swipe passed.');
} finally {
  server.close();
}
