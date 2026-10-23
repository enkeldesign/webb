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
  // A perk master's reward has a row of its own, never "0 trophies" (#1247), and no
  // trophy-style line on the meta row (#1274).
  const masterCard = page.locator('[data-achievement-id="faster-than-the-dev"]').first();
  assert.equal(await masterCard.locator(':scope > .turn-achievement-copy > .turn-achievement-meta .turn-achievement-trophies').count(), 0);
  const masterReward = (await masterCard.locator(':scope > .turn-achievement-copy > .turn-achievement-reward').textContent()).replace(/\s+/g, ' ').trim();
  assert.match(masterReward, /^REWARD: (Earned, revealed with PERKULATOR|Rarity MYTHIC TURBO perk Install in PERKULATOR)$/, masterReward);
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
  await page.locator('[data-achievement-filter="new"]').click();
  assert.equal(await children.isVisible(), true, 'NEW exposes matching children even when their master is also new');
  assert.equal(await toggle.isVisible(), false, 'No collapsed disclosure contradicts the NEW filter');
  await page.locator('[data-achievement-filter="all"]').click();
  assert.equal(await children.isVisible(), false, 'ALL restores the chosen collapsed state');
  await page.locator('[data-achievement-filter="unlocked"]').click();
  assert.equal(await children.isVisible(), false, 'UNLOCKED keeps completed children collapsed');
  await page.locator('[data-achievement-filter="time-trials"]').click();
  assert.equal(await toggle.isVisible(), true, 'Category filters keep the family summary');
  await page.locator('[data-achievement-filter="all"]').click();
  // Open from a track sheet to exercise its explicit track filter.
  await page.evaluate(async () => {
    const achievements = globalThis.__turnAchievements;
    await new Promise((resolve) => {
      achievements.dialog.addEventListener('close', resolve, { once: true });
      achievements.close();
    });
    achievements.open(null, { trackId: 'airport' });
  });
  await page.locator('[data-achievement-id="airport-sprint"]').waitFor({ state: 'visible' });
  assert.equal(await page.locator('[data-achievement-id="airport-sprint"]').isVisible(), true, 'Track-scoped children remain reachable');
  assert.equal(await page.evaluate(() => globalThis.__turnAchievements.store.trophyTotal()), total, 'Visibility never changes trophies');

  // #1274: once PERKULATOR reveals it, a master's PERK reads as a reward: REWARD:, the
  // rarity in words on its chip, the perk's name and where it goes. At 320px portrait the
  // row wraps and nothing scrolls sideways.
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(async () => {
    const achievements = globalThis.__turnAchievements;
    await new Promise((resolve) => {
      achievements.dialog.addEventListener('close', resolve, { once: true });
      achievements.close();
    });
    achievements.store.grantBonus('perkulator-reveal-test', 2500);
    achievements.store.syncRewards();
    achievements.open();
  });
  const revealed = page.locator('[data-achievement-id="drift-master"] > .turn-achievement-copy > .turn-achievement-reward').first();
  await revealed.waitFor({ state: 'visible' });
  assert.equal((await revealed.textContent()).replace(/\s+/g, ' ').trim(), 'REWARD: Rarity EPIC PRECISION perk Install in PERKULATOR');
  assert.equal(await revealed.locator('.turn-pr-chip.is-epic').count(), 1, 'The rarity chip is PERKULATOR’s');
  const overflow = await page.evaluate(() => {
    const dialog = globalThis.__turnAchievements.dialog;
    const wide = [...dialog.querySelectorAll('.turn-achievement-reward')].filter((row) => row.scrollWidth > row.clientWidth + 1).length;
    return { page: document.documentElement.scrollWidth - document.documentElement.clientWidth, dialog: dialog.scrollWidth - dialog.clientWidth, wide };
  });
  assert.deepEqual(overflow, { page: 0, dialog: 0, wide: 0 }, '320px: PERK rewards wrap without sideways scroll');
  assert.deepEqual(errors, []);
  console.log('Achievement disclosure browser: keyboard, focus, ALL/category/UNLOCKED/track filters, totals and the 320px PERK reward row pass.');
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
