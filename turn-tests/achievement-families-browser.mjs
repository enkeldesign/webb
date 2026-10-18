import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer(async (request, response) => {
  try {
    let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const filename = path.resolve(root, `.${pathname}`);
    if (!filename.startsWith(root)) throw new Error('Outside fixture root');
    response.writeHead(200, { 'content-type': types[path.extname(filename)] || 'application/octet-stream' });
    response.end(await fs.readFile(filename));
  } catch (_) { response.end(); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (error) => { if (!/^ResizeObserver loop/.test(error.message)) errors.push(error.message); });
  await page.addInitScript(() => {
    localStorage.setItem('turn-low-graphics-v1', '1');
    localStorage.setItem('turn-steering-mode-v1', 'manual');
    localStorage.setItem('turn-audio-enabled-v1', 'off');
    localStorage.setItem('turn-racing-music-volume-v1', '0');
    Object.defineProperty(globalThis.navigator, 'standalone', { configurable: true, value: true });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/turn/`);
  await page.waitForFunction(() => globalThis.__turnAchievements && document.documentElement.classList.contains('turn-home-ready'), null, { timeout: 60000 });
  const total = await page.evaluate(async () => {
    const { ACHIEVEMENT_FAMILIES } = await import('/turn/achievements/catalog.js');
    const a = globalThis.__turnAchievements;
    a.store.batch(() => {
      for (const family of ACHIEVEMENT_FAMILIES) {
        for (const id of [...family.childIds, family.masterId]) a.store.unlock(id);
      }
    });
    a.homeTrigger.click();
    return a.store.trophyTotal();
  });
  const master = page.locator('[data-achievement-family="faster-than-the-dev"]');
  const toggle = master.locator('[data-achievement-disclosure]');
  const children = master.locator('.turn-achievement-children');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(await children.isVisible(), false, 'Complete children collapse on first render');
  await toggle.focus();
  await page.keyboard.press('Enter');
  assert.equal(await children.isVisible(), true);
  assert.equal(await toggle.evaluate((node) => document.activeElement === node), true, 'Expansion keeps focus');
  await page.keyboard.press('Space');
  assert.equal(await children.isVisible(), false);
  await page.locator('[data-achievement-filter="unlocked"]').click();
  assert.equal(await children.isVisible(), false, 'UNLOCKED keeps completed children collapsed');
  await page.locator('[data-achievement-filter="time-trials"]').click();
  assert.equal(await toggle.isVisible(), true, 'Category filters keep the family summary');
  await page.locator('[data-achievement-filter="all"]').click();
  await page.evaluate(() => {
    const dialog = globalThis.__turnAchievements.dialog;
    dialog.dataset.achievementTrackScope = 'airport';
    dialog.querySelector('[data-achievement-filter="all"]').click();
  });
  // Open from a track sheet to exercise its explicit track filter.
  await page.evaluate(() => {
    globalThis.__turnAchievements.dialog.close();
    globalThis.__turnAchievements.open(null, { trackId: 'airport' });
  });
  assert.equal(await page.locator('[data-achievement-id="airport-sprint"]').isVisible(), true, 'Track-scoped children remain reachable');
  assert.equal(await page.evaluate(() => globalThis.__turnAchievements.store.trophyTotal()), total, 'Visibility never changes trophies');
  assert.deepEqual(errors, []);
  console.log('Achievement disclosure browser: keyboard, focus, ALL/category/UNLOCKED/track filters and totals pass.');
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
