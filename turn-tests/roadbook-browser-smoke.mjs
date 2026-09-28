import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
import { TRACK_DEFINITIONS } from '../turn/tracks/definitions.js';
import { TRACK_ICON_ASSETS } from '../turn/ui/track-icons.js';

// ROADBOOK (roadbook/roadbook.js): every track from the catalog with its pictogram and
// route, one clear selection, locked tracks inspectable but never raced, the Track
// sheet, the dock inside the usable viewport, and the iPad overview.
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
const trackIds = TRACK_DEFINITIONS.map((track) => track.id);
assert.deepEqual(Object.keys(TRACK_ICON_ASSETS).sort(), [...trackIds].sort(), 'Every track has a canonical pictogram');

async function openHome(browserType, { width, height, isMobile = true }) {
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
  await page.goto(`${origin}/turn/`);
  await page.waitForFunction(() => document.documentElement.classList.contains('turn-home-ready'), null, { timeout: 60000 });
  return { browser, page, errors };
}

// Layout facts the player can see: no sideways scroll, targets, dock bounds.
function layout(page) {
  return page.evaluate(() => {
    const home = document.querySelector('.m8-home');
    const dock = document.querySelector('.roadbook-dock').getBoundingClientRect();
    const visible = (node) => node.getClientRects().length > 0 && globalThis.getComputedStyle(node).visibility !== 'hidden';
    const targets = [...document.querySelectorAll('.roadbook-card, .roadbook-dock button, .turn-app-bar-actions button')].filter(visible);
    const small = targets.filter((node) => {
      const box = node.getBoundingClientRect();
      return box.width < 44 || box.height < 44;
    }).map((node) => node.className);
    const names = [...document.querySelectorAll('.roadbook-card .turn-pr-card-name')];
    return {
      overflowX: Math.max(home.scrollWidth - home.clientWidth, document.documentElement.scrollWidth - globalThis.innerWidth),
      small,
      dock: { top: dock.top, bottom: dock.bottom, height: dock.height },
      viewport: { width: globalThis.innerWidth, height: globalThis.innerHeight },
      clippedNames: names.filter((node) => node.scrollWidth > node.clientWidth + 1).map((node) => node.textContent),
      art: [...document.querySelectorAll('.roadbook-card .turn-pr-card-art')].filter(visible).length,
      columns: new Set([...document.querySelectorAll('.roadbook-card')].map((node) => Math.round(node.getBoundingClientRect().left))).size,
      overview: !document.querySelector('.roadbook-overview').hidden,
      sheetButton: visible(document.querySelector('.roadbook-sheet-button'))
    };
  });
}

async function assertLastCardClearsDock(page, name) {
  const result = await page.evaluate(() => {
    const home = document.querySelector('.m8-home');
    home.scrollTop = home.scrollHeight;
    const cards = [...document.querySelectorAll('.roadbook-card')];
    const last = cards.at(-1).getBoundingClientRect();
    const dock = document.querySelector('.roadbook-dock').getBoundingClientRect();
    const overview = document.querySelector('.roadbook-overview');
    const overviewBottom = overview.hidden ? 0 : overview.getBoundingClientRect().bottom;
    const result = { lastBottom: last.bottom, overviewBottom, dockTop: dock.top };
    home.scrollTop = 0;
    return result;
  });
  assert.ok(result.lastBottom <= result.dockTop + 1, `${name}: the last track scrolls clear of the dock (${JSON.stringify(result)})`);
  assert.ok(result.overviewBottom <= result.dockTop + 1, `${name}: the overview scrolls clear of the dock (${JSON.stringify(result)})`);
}

async function phoneFlow(browserType, name) {
  const { browser, page, errors } = await openHome(browserType, { width: 393, height: 793 });
  try {
    const cards = await page.evaluate(() => [...document.querySelectorAll('.roadbook-card[data-track-id]')].map((card) => ({
      id: card.dataset.trackId,
      ordinal: card.querySelector('.turn-pr-card-ordinal')?.textContent,
      pictogram: Boolean(card.querySelector('.turn-pr-card-tab .turn-pr-icon > span')),
      route: Boolean(card.querySelector('.turn-pr-card-art svg path')),
      difficulty: card.querySelector('.turn-pr-chip')?.textContent,
      pressed: card.getAttribute('aria-pressed'),
      label: card.getAttribute('aria-label')
    })));
    assert.deepEqual(cards.map((card) => card.id), trackIds, `${name}: ROADBOOK lists the catalog in order`);
    assert.deepEqual(cards.map((card) => card.ordinal), trackIds.map((_, index) => String(index + 1).padStart(2, '0')));
    assert.ok(cards.every((card) => card.pictogram && card.route && card.difficulty), `${name}: every card has its pictogram, route and difficulty`);
    assert.equal(cards.filter((card) => card.pressed === 'true').length, 1, `${name}: exactly one track is selected`);
    assert.equal(await page.locator('#m8HomeTitle').textContent(), 'ROADBOOK');
    assert.equal(await page.locator('.roadbook .turn-pr-lead').textContent(), 'Choose your track');

    const phone = await layout(page);
    assert.ok(phone.overflowX <= 0, `${name}: no sideways scroll at 393px (${phone.overflowX})`);
    assert.deepEqual(phone.small, [], `${name}: every target is at least 44px`);
    assert.ok(phone.dock.bottom <= phone.viewport.height + 0.5, `${name}: the dock stays inside the usable viewport`);
    assert.equal(phone.overview, false, `${name}: phones use the Track sheet, not the overview`);
    assert.equal(phone.sheetButton, true);
    await assertLastCardClearsDock(page, `${name} 393`);
    // Keyboard focus moving back up the list keeps the focused card clear of the
    // sticky app bar (scroll-padding-top), just as the dock clears it below.
    await page.evaluate(() => {
      const home = document.querySelector('.m8-home');
      home.scrollTop = home.scrollHeight;
    });
    await page.locator('.roadbook-card').last().focus();
    for (let step = 0; step < 20; step += 1) {
      await page.keyboard.press('Shift+Tab');
      if (await page.evaluate(() => document.activeElement?.dataset?.trackId === 'cliffside')) break;
    }
    const clearance = await page.evaluate(() => {
      const card = document.activeElement.closest('.roadbook-card')?.getBoundingClientRect();
      const bar = document.querySelector('.m8-home-head').getBoundingClientRect();
      return card && { track: document.activeElement.dataset.trackId, cardTop: Math.round(card.top), barBottom: Math.round(bar.bottom) };
    });
    assert.ok(clearance?.track === 'cliffside' && clearance.cardTop >= clearance.barBottom,
      `${name}: a card focused going back up stays below the app bar (${JSON.stringify(clearance)})`);
    await page.evaluate(() => { document.querySelector('.m8-home').scrollTop = 0; });

    // Selection is never colour alone: the selected card says so.
    await page.locator('.roadbook-card[data-track-id="cliffside"]').click();
    const selected = await page.evaluate(() => {
      const card = document.querySelector('.roadbook-card.is-selected');
      return {
        id: card?.dataset.trackId,
        pressed: card?.getAttribute('aria-pressed'),
        state: card?.querySelector('.turn-pr-card-state')?.textContent.trim(),
        dock: document.querySelector('.turn-pr-dock-context').textContent.replace(/\s+/g, ' ').trim()
      };
    });
    assert.deepEqual(selected, { id: 'cliffside', pressed: 'true', state: '✓Selected', dock: 'Cliffside EASY' });

    // Track sheet: the chosen track's route, description and personal bests.
    await page.locator('.roadbook-sheet-button').click();
    await page.waitForSelector('#turnTrackSheet[open]');
    const sheet = await page.evaluate(() => {
      const dialog = document.querySelector('#turnTrackSheet');
      const close = dialog.querySelector('.turn-pr-close');
      const closeBox = close.getBoundingClientRect();
      const card = dialog.querySelector('.turn-pr-sheet-card').getBoundingClientRect();
      return {
        title: dialog.querySelector('.turn-pr-sheet-title').textContent,
        records: [...dialog.querySelectorAll('.turn-pr-record')].map((row) => `${row.dataset.recordKind}:${row.className.includes('is-locked') ? 'locked' : row.className.includes('is-empty') ? 'empty' : 'set'}`),
        route: Boolean(dialog.querySelector('.turn-pr-detail-route svg path')),
        pictogram: Boolean(dialog.querySelector('.turn-pr-detail-route .turn-pr-icon > span')),
        description: dialog.querySelector('.turn-pr-detail-description').textContent.length > 0,
        // TURN focuses every dialog's heading as it opens, so it is announced first.
        focus: document.activeElement === dialog.querySelector('#turnTrackSheetTitle'),
        closeColor: globalThis.getComputedStyle(close).backgroundColor,
        // The strip outside the viewport (painted by ios-viewport-gap.js) takes
        // --turn-modal-paper, so it dims with the backdrop.
        canvas: (() => {
          const probe = document.createElement('i');
          probe.style.background = 'var(--turn-modal-paper, rgb(255, 248, 232))';
          document.body.append(probe);
          const color = globalThis.getComputedStyle(probe).backgroundColor;
          probe.remove();
          return color;
        })(),
        closeSize: [closeBox.width, closeBox.height],
        inside: card.top >= 0 && card.bottom <= globalThis.innerHeight + 0.5 && card.left >= 0 && card.right <= globalThis.innerWidth + 0.5,
        // Fitting by collapsing is not fitting: the card holds its head and records.
        height: card.height,
        recordsInside: dialog.querySelector('.turn-pr-records').getBoundingClientRect().top < card.bottom
      };
    });
    assert.equal(sheet.title, 'Cliffside');
    assert.deepEqual(sheet.records, ['time:empty', 'drift:locked', 'flow:locked'], `${name}: a new profile has no time and locked DRIFT/FLOW records`);
    assert.ok(sheet.route && sheet.pictogram && sheet.description);
    assert.equal(sheet.focus, true, `${name}: the Track sheet opens on its heading`);
    assert.equal(sheet.closeColor, 'rgb(255, 123, 84)', `${name}: close is orange`);
    const channels = (color) => (color.match(/[\d.]+/g) || []).slice(0, 3).map(Number).map((value) => value <= 1 && /srgb/.test(color) ? value * 255 : value);
    const [red, green, blue] = channels(sheet.canvas);
    assert.ok(Math.abs(red - 119) <= 3 && Math.abs(green - 117) <= 3 && Math.abs(blue - 110) <= 3,
      `${name}: with the Track sheet open, the strip is Paper under the backdrop (${sheet.canvas})`);
    assert.ok(sheet.closeSize.every((size) => size >= 44), `${name}: close is a 44px target`);
    assert.equal(sheet.inside, true, `${name}: the Track sheet fits the viewport`);
    assert.ok(sheet.height >= 300 && sheet.recordsInside, `${name}: the Track sheet shows its content (${sheet.height}px)`);
    await page.locator('#turnTrackSheet .turn-pr-close').click();
    await page.waitForFunction(() => !document.querySelector('#turnTrackSheet').open);
    assert.equal(await page.evaluate(() => globalThis.getComputedStyle(document.documentElement).getPropertyValue('--turn-modal-paper')), '',
      `${name}: closing the sheet returns the strip to Paper`);
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('roadbook-sheet-button')), true,
      `${name}: closing the Track sheet returns focus to its button`);
    assert.equal(await page.evaluate(() => globalThis.__turnNextHome.getSelectedTrackId()), 'cliffside', `${name}: the Track sheet keeps the selection`);

    // A locked track is inspectable but never continues into GARAGE.
    await page.locator('.roadbook-card[data-track-id="airport"]').click();
    const locked = await page.evaluate(() => {
      const button = document.querySelector('.m8-track-continue');
      return {
        selected: globalThis.__turnNextHome.getSelectedTrackId(),
        label: button.querySelector('.turn-pr-button-label').textContent,
        disabled: button.getAttribute('aria-disabled'),
        name: button.getAttribute('aria-label')
      };
    });
    assert.equal(locked.selected, 'airport');
    assert.match(locked.label, /^UNLOCKS AT \d+$/, `${name}: the dock names the unlock threshold`);
    assert.equal(locked.disabled, 'true');
    assert.match(locked.name, /Airport is locked until \d+ trophies/);
    // aria-disabled keeps the button focusable and explainable; a tap still arrives.
    await page.evaluate(() => document.querySelector('.m8-track-continue').click());
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => document.querySelector('.m8-home').hidden), false, `${name}: a locked track never continues`);
    await page.locator('.roadbook-sheet-button').click();
    await page.waitForSelector('#turnTrackSheet[open]');
    assert.match(await page.locator('#turnTrackSheet .turn-pr-lock-note').textContent(), /unlocks at \d+ trophies/);
    await page.locator('#turnTrackSheet .turn-pr-close').click();
    await page.waitForFunction(() => !document.querySelector('#turnTrackSheet').open);

    // CHOOSE CAR continues with the chosen playable track; back returns to it.
    await page.locator('.roadbook-card[data-track-id="cliffside"]').click();
    await page.locator('.m8-track-continue').click();
    await page.waitForSelector('.garage', { timeout: 60000 });
    assert.equal(await page.evaluate(() => globalThis.__turnRuntime.state.trackId), 'cliffside', `${name}: GARAGE opens on the chosen track`);
    await page.locator('.garage-back').click();
    await page.waitForFunction(() => !document.querySelector('.m8-home').hidden);
    assert.equal(await page.evaluate(() => document.querySelector('.roadbook-card.is-selected')?.dataset.trackId), 'cliffside',
      `${name}: back from the car screen keeps the chosen track`);
    assert.deepEqual(errors, [], `${name}: no page errors`);
  } finally {
    await browser.close();
  }
}

// The tester unlock sequence stays reachable with visible controls: where the overview
// replaces the Track sheet button, its route takes the four records taps, then GIVE
// FEEDBACK from the ☰ sheet.
async function unlockWithVisibleControls(page, name) {
  for (const trackId of ['countryside', 'cliffside', 'countryside', 'cliffside']) {
    await page.locator(`.roadbook-card[data-track-id="${trackId}"]`).click();
  }
  const records = await page.locator('.roadbook-sheet-button').isVisible()
    ? page.locator('.roadbook-sheet-button')
    : page.locator('.roadbook-overview .turn-pr-detail-route');
  for (let tap = 0; tap < 4; tap += 1) {
    await records.click();
    if (await page.locator('#turnTrackSheet[open]').count()) {
      await page.locator('#turnTrackSheet .turn-pr-close').click();
    }
  }
  await page.locator('.turn-home-menu-button').click();
  await page.locator('.m8-home-menu .m8-feedback-button:not(.m8-achievements-button):not(.turn-dbe-training-home)').click();
  await page.waitForFunction(() => localStorage.getItem('turn-admin-unlock-v1') !== null, null, { timeout: 10000 })
    .catch(() => { throw new Error(`${name}: the tester unlock sequence cannot be completed with the visible controls`); });
}

async function layoutAt(browserType, name, size, check) {
  const { browser, page, errors } = await openHome(browserType, size);
  try {
    const facts = await layout(page);
    assert.ok(facts.overflowX <= 0, `${name}: no sideways scroll (${facts.overflowX})`);
    assert.deepEqual(facts.small, [], `${name}: every target is at least 44px`);
    assert.deepEqual(facts.clippedNames, [], `${name}: track names wrap instead of clipping`);
    assert.ok(facts.dock.bottom <= facts.viewport.height + 0.5, `${name}: the dock stays inside the viewport`);
    await assertLastCardClearsDock(page, name);
    await check(facts, page);
    assert.deepEqual(errors, [], `${name}: no page errors`);
  } finally {
    await browser.close();
  }
}

try {
  await phoneFlow(chromium, 'Chromium');
  await phoneFlow(webkit, 'WebKit');
  await layoutAt(chromium, '320x568', { width: 320, height: 568 }, (facts) => {
    assert.equal(facts.art, 0, '320px: the route gives way before the names do');
    assert.equal(facts.columns, 1);
  });
  await layoutAt(chromium, '852x393 short landscape', { width: 852, height: 393 }, (facts) => {
    assert.equal(facts.columns, 2, 'short landscape: two columns');
    assert.ok(facts.dock.height <= 80, `short landscape: a one-line dock (${facts.dock.height})`);
  });
  await layoutAt(chromium, '820x1180 iPad portrait', { width: 820, height: 1180, isMobile: false }, async (facts, page) => {
    await unlockWithVisibleControls(page, '820x1180 iPad portrait');
    assert.equal(facts.columns, 2);
    assert.equal(facts.overview, true, 'iPad portrait: the overview follows the grid');
    assert.equal(facts.sheetButton, false, 'the overview replaces the Track sheet button');
  });
  await layoutAt(chromium, '1180x820 iPad landscape', { width: 1180, height: 820, isMobile: false }, async (facts, page) => {
    assert.equal(facts.columns, 2);
    assert.equal(facts.overview, true, 'iPad landscape: the overview sits beside the grid');
    const beside = await page.evaluate(() => {
      const grid = document.querySelector('.roadbook-list').getBoundingClientRect();
      const overview = document.querySelector('.roadbook-overview').getBoundingClientRect();
      return overview.left >= grid.right;
    });
    assert.equal(beside, true);
    await page.locator('.roadbook-card[data-track-id="cliffside"]').click();
    assert.equal(await page.locator('#roadbookOverviewTitle').textContent(), 'Cliffside', 'the overview follows the selection');
    // Growing into the overview with the Track sheet open closes the sheet, and focus
    // lands on the overview, never on the Track sheet button that just disappeared.
    await page.setViewportSize({ width: 900, height: 820 });
    await page.waitForFunction(() => !document.querySelector('.roadbook-sheet-button').hidden);
    await page.locator('.roadbook-sheet-button').click();
    await page.waitForSelector('#turnTrackSheet[open]');
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.waitForFunction(() => !document.querySelector('#turnTrackSheet').open);
    const focus = await page.evaluate(() => ({
      id: document.activeElement?.id,
      sheetButtonHidden: document.querySelector('.roadbook-sheet-button').hidden
    }));
    assert.deepEqual(focus, { id: 'roadbookOverviewTitle', sheetButtonHidden: true },
      'the sheet hands focus to the overview when the screen grows into it');
    // Shrinking back hides the overview; focus moves to the Track sheet button that
    // replaces it, never to <body>.
    await page.setViewportSize({ width: 900, height: 820 });
    await page.waitForFunction(() => document.querySelector('.roadbook-overview').hidden);
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('roadbook-sheet-button')), true,
      'the overview hands focus to the Track sheet button when the screen shrinks out of it');
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.waitForFunction(() => !document.querySelector('.roadbook-overview').hidden);
    await unlockWithVisibleControls(page, '1180x820 iPad landscape');
  });
  console.log('ROADBOOK lists every track, keeps one clear selection, gates locked tracks and fits 320px to iPad.');
} finally {
  server.close();
}
