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
    return {
      fits: group.scrollWidth <= group.clientWidth + 1
        && visible.every((node) => { const r = node.getBoundingClientRect(); return r.left >= box.left - 1 && r.right <= box.right + 1; }),
      menu: !document.querySelector('.turn-race-menu-button').hidden,
      names: visible.map((node) => node.className.split(' ').find((name) => name !== 'utility'))
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
  try {
    await page.goto(`${origin}/turn/`);
    await page.waitForFunction(() => document.documentElement.classList.contains('turn-home-ready'), null, { timeout: 60000 });
    await page.locator('.m8-track-continue').click();
    await page.waitForSelector('.lot-showroom');
    await page.locator('.lot-race').click();
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
    assert.ok(wide.names.includes('spectate-button') && wide.names.includes('m8-race-settings-button'));

    await page.evaluate(() => { document.querySelector('.race-menu-fixture-button').hidden = false; });
    await page.setViewportSize({ width: 568, height: 320 });
    await settle(page);
    await settle(page);
    const narrow = await row(page);
    assert.ok(narrow.fits, `${name}: the start row never overflows at 568px (${narrow.names})`);
    assert.equal(narrow.menu, true, `${name}: ☰ appears when the row would overflow`);
    for (const kept of ['back-to-lot-button', 'turn-screen-blank-control', 'turn-race-achievements-button']) {
      assert.ok(narrow.names.includes(kept), `${name}: ${kept} stays in the row`);
    }
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
    assert.ok(sheet.entries.includes('spectate-button') && sheet.entries.includes('m8-race-settings-button') && sheet.entries.includes('recalibrate-button'),
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
    await page.setViewportSize({ width: 852, height: 393 });
    await settle(page);
    await settle(page);
    const restored = await row(page);
    assert.ok(restored.fits && !restored.menu && restored.names.includes('m8-race-settings-button'),
      `${name}: widening restores the full row`);
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
