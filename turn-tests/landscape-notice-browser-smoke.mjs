import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

// The temporary portrait LANDSCAPE ORIENTATION RECOMMENDED notice: menu surfaces only,
// never covering their controls, closable, and back on the next launch.
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
const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' };

async function openHome(browser, options) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.addInitScript(() => {
    localStorage.setItem('turn-low-graphics-v1', '1');
    localStorage.setItem('turn-steering-mode-v1', 'manual');
    localStorage.setItem('turn-audio-enabled-v1', 'off');
    localStorage.setItem('turn-racing-music-volume-v1', '0');
    Object.defineProperty(globalThis.navigator, 'standalone', { configurable: true, value: true });
  });
  await page.route('https://cdn.jsdelivr.net/npm/three@0.184.0/**', async (route) => {
    const suffix = route.request().url().split('/three@0.184.0/')[1];
    await route.fulfill({ contentType: 'text/javascript', body: await fs.readFile(path.join(threeRoot, suffix)) });
  });
  await page.goto(`${origin}/turn/`);
  if (await page.locator('#playBrowserButton').isVisible()) await page.locator('#playBrowserButton').click();
  await page.waitForFunction(() => document.documentElement.classList.contains('turn-home-ready'), { timeout: 90000 });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return { context, page, errors };
}

const noticeVisible = (page) => page.locator('.turn-landscape-notice').isVisible();
const belowNotice = (page, selector) => page.evaluate((selector) => {
  const strip = document.querySelector('.turn-landscape-notice').getBoundingClientRect();
  return document.querySelector(selector).getBoundingClientRect().top >= strip.bottom - 0.5;
}, selector);

async function run(name, browser) {
  // Phone portrait: Home shows the notice first in reading order, below nothing, covering nothing.
  let { context, page, errors } = await openHome(browser, phone);
  assert.ok(await noticeVisible(page), `${name}: Home in portrait shows the notice`);
  assert.match((await page.locator('.turn-landscape-notice').innerText()).replace(/\s+/g, ' '),
    /LANDSCAPE ORIENTATION RECOMMENDED TURN’s portrait design is still being refined\. We recommend you rotate your device to landscape\./);
  assert.equal(await page.locator('.turn-landscape-notice').evaluate((node) => node === document.body.firstElementChild), true,
    `${name}: the notice comes first in reading order`);
  assert.equal(await page.locator('.turn-landscape-notice-close').getAttribute('aria-label'), 'Close landscape recommendation');
  // The notice close must look exactly like the existing Home dialog close.
  const closeStyle = (selector) => page.evaluate((selector) => {
    const style = globalThis.getComputedStyle(document.querySelector(selector));
    return ['width', 'height', 'border-top-width', 'border-top-color', 'border-top-left-radius', 'background-color',
      'color', 'box-shadow', 'font-size', 'font-weight', 'line-height', 'font-family', 'text-align']
      .map((property) => `${property}: ${style.getPropertyValue(property)}`);
  }, selector);
  const noticeClose = await closeStyle('.turn-landscape-notice-close');
  // SETTINGS lives in the Home menu sheet.
  await page.locator('.turn-home-menu-button').click();
  await page.locator('.m8-home-settings').click();
  await page.waitForSelector('.m8-settings-dialog[open]');
  assert.deepEqual(noticeClose, await closeStyle('.m8-settings-dialog [data-dialog-close]'),
    `${name}: the notice close matches the Home dialog close`);
  await page.locator('.m8-settings-dialog [data-dialog-close]').click();
  await page.waitForFunction(() => !document.querySelector('.m8-settings-dialog[open]'));
  assert.ok(await belowNotice(page, '.m8-home'), `${name}: Home moves below the notice instead of being covered`);

  // Rotating to landscape removes it and returns Home to the top; rotating back restores it.
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => !document.querySelector('.turn-landscape-notice:not([hidden])'));
  assert.equal(await page.evaluate(() => Math.round(document.querySelector('.m8-home').getBoundingClientRect().top)), 0,
    `${name}: landscape Home uses the full screen`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForSelector('.turn-landscape-notice:not([hidden])');

  // The Lot keeps the notice without covering its heading or back control; racing hides it.
  await page.locator('.m8-track-continue').click();
  await page.waitForSelector('.lot-showroom');
  assert.ok(await noticeVisible(page), `${name}: The Lot in portrait shows the notice`);
  for (const selector of ['.lot-screen', '.lot-back', '#lot-title']) {
    assert.ok(await belowNotice(page, selector), `${name}: ${selector} is not covered by the notice`);
  }
  await page.locator('.lot-race').click();
  await page.waitForSelector('#controls:not([hidden])', { timeout: 90000 });
  await page.waitForFunction(() => !document.querySelector('.turn-landscape-notice:not([hidden])'), null, { timeout: 30000 });
  assert.deepEqual(errors, [], `${name}: no page errors`);
  await context.close();

  // Closing by keyboard keeps focus on Home, lasts for the session and returns on a new launch.
  ({ context, page } = await openHome(browser, phone));
  await page.locator('.turn-landscape-notice-close').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('.turn-landscape-notice'));
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'm8HomeTitle', `${name}: focus returns to the Home title`);
  assert.equal(await page.evaluate(() => Math.round(document.querySelector('.m8-home').getBoundingClientRect().top)), 0,
    `${name}: Home returns to the top once the notice is closed`);
  await page.reload();
  if (await page.locator('#playBrowserButton').isVisible()) await page.locator('#playBrowserButton').click();
  await page.waitForFunction(() => document.documentElement.classList.contains('turn-home-ready'), { timeout: 90000 });
  assert.equal(await noticeVisible(page), false, `${name}: a closed notice stays closed for the session`);
  await context.close();
  ({ context, page } = await openHome(browser, phone));
  assert.ok(await noticeVisible(page), `${name}: a new launch in portrait shows the notice again`);
  await context.close();

  // A portrait-shaped desktop window cannot be rotated and is never asked to.
  ({ context, page } = await openHome(browser, { viewport: { width: 500, height: 900 } }));
  assert.equal(await noticeVisible(page), false, `${name}: a narrow desktop window does not show the notice`);
  await context.close();
}

try {
  for (const name of (process.env.TURN_RESPONSIVE_BROWSERS || 'chromium,webkit').split(',')) {
    const browser = await ({ chromium, webkit })[name].launch({ headless: true });
    try {
      await run(name, browser);
      console.log(`${name}: portrait landscape notice on Home and The Lot, never covering controls or racing, closable for the session passed.`);
    } finally {
      await browser.close();
    }
  }
} finally {
  server.close();
}
