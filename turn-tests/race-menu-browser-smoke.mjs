import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

// Race ☰ (ui/race-menu.js): the start row never overflows. Where it would, its
// secondary buttons move into a menu sheet behind ☰; where it fits, nothing changes.
const root = fileURLToPath(new URL('../', import.meta.url));
const threeRoot = fileURLToPath(new URL('../', import.meta.resolve('three')));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
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
const settle = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function row(page) {
  return page.evaluate(() => {
    const group = document.querySelector('.utility-group');
    const box = group.getBoundingClientRect();
    const visible = [...group.children].filter((node) => !node.hidden && node.getClientRects().length);
    const tops = visible.map((node) => Math.round(node.getBoundingClientRect().top));
    return {
      fits: group.scrollWidth <= group.clientWidth + 1
        && visible.every((node) => { const r = node.getBoundingClientRect(); return r.left >= box.left - 1 && r.right <= box.right + 1; }),
      rows: new Set(tops).size,
      sheet: [...document.querySelectorAll('.turn-race-menu > button')].filter((node) => !node.hidden)
        .map((node) => node.className.split(' ').find((name) => name !== 'utility')),
      menu: !document.querySelector('.turn-race-menu-button').hidden,
      names: visible.map((node) => node.className.split(' ').find((name) => name !== 'utility')),
      // A scrolling row clips at its padding edge: the 3px control shadow must fit inside it.
      shadowRoom: visible.every((node) => {
        const r = node.getBoundingClientRect();
        return r.bottom + 3 <= box.top + group.clientTop + group.clientHeight + 0.5 && r.right + 3 <= box.left + group.clientLeft + group.clientWidth + 0.5;
      })
    };
  });
}

async function run(browserType, name) {
  const browser = await browserType.launch();
  const context = await browser.newContext({ viewport: { width: 852, height: 393 }, hasTouch: true, isMobile: browserType !== webkit, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', (error) => {
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
  try {
    await page.goto(`${origin}/turn/`);
    await page.waitForFunction(() => document.documentElement.classList.contains('turn-home-ready'), null, { timeout: 60000 });
    await page.locator('.m8-track-continue').click();
    await page.waitForSelector('.garage');
    // RACE ignores taps in GARAGE's first moments (a double-tap that opened it).
    await page.waitForTimeout(700);
    await page.locator('.garage-race').click();
    await page.waitForSelector('#controls:not([hidden])', { timeout: 60000 });
    // A saved rival shows SPECTATE; show it so the row carries its widest set. The
    // fixture entry opens a dialog that returns focus to its own trigger on close,
    // like the audio panel.
    await page.evaluate(() => {
      document.querySelector('.spectate-button').hidden = false;
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'utility race-menu-fixture-button';
      trigger.textContent = 'Fixture';
      trigger.hidden = true;
      const dialog = document.createElement('dialog');
      dialog.className = 'race-menu-fixture-dialog';
      dialog.innerHTML = '<button type="button">Close</button>';
      dialog.querySelector('button').addEventListener('click', () => dialog.close());
      document.body.appendChild(dialog);
      trigger.addEventListener('click', () => dialog.showModal());
      dialog.addEventListener('close', () => trigger.focus());
      document.querySelector('.utility-group').appendChild(trigger);
    });
    await settle(page);

    const wide = await row(page);
    assert.ok(wide.fits, `${name}: the start row fits at 852px`);
    assert.equal(wide.menu, false, `${name}: no ☰ while every button fits`);
    assert.ok(wide.shadowRoom, `${name}: the row keeps room for its buttons' shadows`);
    assert.ok(wide.names.includes('spectate-button') && wide.names.includes('m8-race-settings-button'));

    await page.evaluate(() => { document.querySelector('.race-menu-fixture-button').hidden = false; });
    await page.setViewportSize({ width: 568, height: 320 });
    await settle(page);
    await settle(page);
    const narrow = await row(page);
    assert.ok(narrow.fits, `${name}: the start row never overflows at 568px (${narrow.names})`);
    assert.equal(narrow.menu, true, `${name}: ☰ appears when the row would overflow`);
    assert.equal(narrow.rows, 1, `${name}: the start row is never two rows`);
    for (const kept of ['back-to-lot-button', 'turn-screen-blank-control', 'recalibrate-button']) {
      assert.ok(narrow.names.includes(kept), `${name}: ${kept} stays in the row`);
    }
    // Erik's priority: LEAVE RACE, blank screen, RECALIBRATE, ACHIEVEMENTS, SPECTATE,
    // SETTINGS. Nothing in the sheet outranks anything left in the row.
    const priority = ['back-to-lot-button', 'turn-screen-blank-control', 'recalibrate-button', 'turn-race-achievements-button', 'spectate-button', 'm8-race-settings-button'];
    const rank = (entry) => { const index = priority.indexOf(entry); return index === -1 ? priority.length : index; };
    const lowestInRow = Math.max(...narrow.names.filter((entry) => priority.includes(entry)).map(rank));
    const highestInSheet = Math.min(...narrow.sheet.map(rank));
    assert.ok(lowestInRow < highestInSheet, `${name}: the row keeps the highest-priority buttons (${narrow.names} | ${narrow.sheet})`);
    assert.ok(!narrow.names.includes('m8-race-settings-button'), `${name}: SETTINGS moves into the sheet`);

    await page.locator('.turn-race-menu-button').click();
    const sheet = await page.evaluate(() => {
      const dialog = document.querySelector('#turnRaceMenuSheet');
      const entries = [...dialog.querySelectorAll('.turn-race-menu > button')].filter((node) => node.getClientRects().length);
      return {
        open: dialog.open,
        expanded: document.querySelector('.turn-race-menu-button').getAttribute('aria-expanded'),
        entries: entries.map((node) => node.className.split(' ').find((name) => name !== 'utility')),
        small: entries.filter((node) => { const r = node.getBoundingClientRect(); return r.height < 44 || r.right > globalThis.innerWidth || r.bottom > globalThis.innerHeight; }).length
      };
    });
    assert.equal(sheet.open, true, `${name}: ☰ opens the race menu sheet`);
    assert.equal(sheet.expanded, 'true');
    assert.ok(sheet.entries.includes('spectate-button') && sheet.entries.includes('m8-race-settings-button'),
      `${name}: the sheet holds the moved buttons (${sheet.entries})`);
    assert.equal(sheet.small, 0, `${name}: sheet entries are 44px targets inside the viewport`);

    await page.locator('.turn-race-menu .m8-race-settings-button').click();
    await page.waitForSelector('.m8-settings-dialog[open]');
    assert.equal(await page.evaluate(() => document.querySelector('#turnRaceMenuSheet').open), false,
      `${name}: an entry closes the sheet before opening its own dialog`);
    await page.locator('.m8-settings-dialog[open] [data-dialog-close]').click();
    await page.waitForFunction(() => !document.querySelector('.m8-settings-dialog[open]'));
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('dialog[open]')].map((node) => node.className || node.id)), [],
      `${name}: no dialog stays open after SETTINGS closes`);
    await settle(page);
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('turn-race-menu-button')), true,
      `${name}: closing an entry's dialog returns focus to ☰, not the entry inside the closed sheet`);
    await page.locator('.turn-race-menu-button').click();
    await page.locator('.turn-race-menu .race-menu-fixture-button').click();
    await page.waitForSelector('.race-menu-fixture-dialog[open]');
    await page.locator('.race-menu-fixture-dialog[open] button').click();
    await page.waitForFunction(() => !document.querySelector('.race-menu-fixture-dialog[open]'));
    await settle(page);
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('turn-race-menu-button')), true,
      `${name}: a dialog that refocuses its entry still returns focus to ☰`);

    await page.evaluate(() => { document.querySelector('.race-menu-fixture-button').hidden = true; });
    await page.setViewportSize({ width: 393, height: 852 });
    await settle(page);
    await settle(page);
    const portrait = await row(page);
    assert.ok(portrait.fits && portrait.rows === 1, `${name}: portrait keeps one row (${portrait.names})`);
    const buttonWidths = await page.evaluate(() => [...document.querySelectorAll('.utility-group > button')]
      .filter((node) => !node.hidden && node.getClientRects().length)
      .map((node) => { const clone = node.cloneNode(true); clone.style.cssText = 'position:absolute;visibility:hidden;width:auto;flex:none'; node.parentElement.appendChild(clone); const natural = clone.getBoundingClientRect().width; clone.remove(); return node.getBoundingClientRect().width - natural; }));
    assert.ok(buttonWidths.every((extra) => extra < 1), `${name}: row buttons keep their natural width (${buttonWidths})`);

    await page.setViewportSize({ width: 852, height: 393 });
    await settle(page);
    await settle(page);
    const restored = await row(page);
    assert.ok(restored.fits && !restored.menu && restored.names.includes('m8-race-settings-button'),
      `${name}: widening restores the full row`);

    // LEAVE RACE is named for where it goes: its name starts with what it shows,
    // and it lands on ROADBOOK with the heading focused.
    const leave = await page.evaluate(() => {
      const button = document.querySelector('.back-to-lot-button');
      return { text: button.textContent.trim(), label: button.getAttribute('aria-label') };
    });
    assert.ok(leave.label.startsWith(leave.text) && leave.label.includes('ROADBOOK'),
      `${name}: LEAVE RACE's accessible name says it returns to ROADBOOK (${leave.label})`);
    await page.locator('.back-to-lot-button').click();
    await page.waitForFunction(() => document.activeElement?.id === 'm8HomeTitle');
    assert.deepEqual(await page.evaluate(() => ({
      heading: document.activeElement.textContent.trim(),
      garage: document.body.classList.contains('turn-garage-open'),
      controls: document.querySelector('#controls').hidden
    })), { heading: 'ROADBOOK', garage: false, controls: true }, `${name}: LEAVE RACE ends the race on ROADBOOK`);
    assert.deepEqual(errors, [], `${name}: no page errors`);
  } finally {
    await browser.close();
  }
}

try {
  await run(chromium, 'Chromium');
  await run(webkit, 'WebKit');
  console.log('Race ☰ keeps the start row inside the viewport in Chromium and WebKit.');
} finally {
  server.close();
}
