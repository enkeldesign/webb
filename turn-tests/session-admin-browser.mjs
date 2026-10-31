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
    let pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/fixture') { response.end('<!doctype html><title>Storage fixture</title>'); return; }
    if (pathname.endsWith('/')) pathname += 'index.html';
    const filename = path.resolve(root, `.${pathname}`);
    if (!filename.startsWith(root)) throw new Error('Outside fixture');
    response.writeHead(200, { 'content-type': types[path.extname(filename)] || 'application/octet-stream' });
    response.end(await fs.readFile(filename));
  } catch (_) { response.writeHead(404); response.end(); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => Object.defineProperty(globalThis.navigator, 'standalone', { value: true }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.goto(`${origin}/fixture`);
  await page.evaluate(() => {
    localStorage.setItem('turn-low-graphics-v1', '1');
    localStorage.setItem('turn-steering-mode-v1', 'manual');
    localStorage.setItem('turn-audio-enabled-v1', 'off');
    localStorage.setItem('turn-racing-music-volume-v1', '0');
    localStorage.setItem('turn-achievements-v1', JSON.stringify({ version: 10, bonuses: { original: { trophies: 75, grantedAt: 1 } } }));
  });
  const ready = () => page.waitForFunction(() => globalThis.__turnAchievements && document.documentElement.classList.contains('turn-home-ready'), null, { timeout: 60000 });
  const persisted = async () => (await context.storageState()).origins.find((entry) => entry.origin === origin).localStorage.sort((a, b) => a.name.localeCompare(b.name));
  await page.goto(`${origin}/turn/`);
  await ready();
  const original = await persisted();
  await page.goto(`${origin}/turn/?turn-admin=1&keep=1#here`);
  await ready();
  assert.equal(page.url(), `${origin}/turn/?turn-admin=1&keep=1#here`, 'The address keeps admin for reopening or another browser');
  const openAdmin = async () => {
    await page.locator('.turn-home-menu-button').click();
    await page.getByRole('button', { name: 'ADMIN', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('dialog', { name: 'ADMIN', exact: true }).waitFor();
  };
  await openAdmin();
  assert.equal(await page.locator('#turnAdminTitle').evaluate((node) => node === document.activeElement), true);
  for (const name of ['Expose all tracks', 'Expose all cars', 'Expose perks and rewards']) await page.getByLabel(name, { exact: true }).check();
  assert.equal(await page.evaluate(async () => {
    const { isTrackUnlocked, isVehicleUnlocked, isFeatureUnlocked } = await import('/turn/progression/trophy-road.js');
    return isTrackUnlocked('mountain') && isVehicleUnlocked('monster') && isFeatureUnlocked('perkulator');
  }), true);
  const perkExposure = await page.evaluate(async () => {
    const { ACHIEVEMENT_PERKS } = await import('/turn/vehicle/perks.js');
    const { isPerkAvailable, installPerk, installedPerkFor } = await import('/turn/vehicle/perkulator.js');
    return ACHIEVEMENT_PERKS.map(({ id, achievementId }) => ({
      id, available: isPerkAvailable(id), installed: installPerk('compact', id),
      active: installedPerkFor('compact') === id,
      completed: globalThis.__turnAchievements.store.isUnlocked(achievementId)
    }));
  });
  assert.equal(perkExposure.length, 6);
  for (const perk of perkExposure) {
    assert.equal(perk.available && perk.installed && perk.active, true, `${perk.id} can be installed in admin`);
    assert.equal(perk.completed, false, 'Exposure never completes the master achievement');
  }
  assert.deepEqual(await persisted(), original, 'Installing all six achievement perks leaves the real save untouched');
  for (const name of ['Expose all tracks', 'Expose all cars', 'Expose perks and rewards']) await page.getByLabel(name, { exact: true }).uncheck();
  await page.getByLabel('Temporary trophy total').fill('1975');
  await page.getByRole('button', { name: 'SET TROPHY TOTAL' }).click();
  assert.equal(await page.evaluate(() => globalThis.__turnAchievements.store.isRewardUnlocked('perkulator')), false);
  // Normal lap-result handling awards achievements and announces the real threshold.
  const earned = await page.evaluate(() => {
    const rewards = [];
    window.addEventListener('turn:trophy-road-updated', (event) => rewards.push(...event.detail.unlocked), { once: true });
    window.dispatchEvent(new CustomEvent('turn:lap-result', { detail: { time: 120, ranked: false } }));
    return { total: globalThis.__turnAchievements.getTrophies(), rewards, first: globalThis.__turnAchievements.store.isUnlocked('first-turn') };
  });
  assert.equal(earned.first, true);
  assert.ok(earned.total >= 2000);
  assert.ok(earned.rewards.includes('perkulator'));
  await page.evaluate(() => {
    globalThis.__turnTheme.set('dark');
    localStorage.setItem('turn-personal-rivals-v1', 'session rival');
    globalThis.__turnAchievements.store.markAllSeen();
  });
  assert.deepEqual(await persisted(), original, 'Native browser storage is unchanged, including gameplay writes');
  for (const size of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size);
    assert.equal(await page.locator('#turnAdminPanel').evaluate((node) => node.scrollWidth <= node.clientWidth), true, 'Panel fits without horizontal scrolling');
  }
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.turn-home-menu-button').evaluate((node) => node === document.activeElement), true, 'Escape returns focus to the menu control');
  await page.reload();
  await ready();
  assert.equal(await page.evaluate(() => globalThis.__turnAchievements.getTrophies()), earned.total);
  await openAdmin();
  assert.equal(await page.locator('.roadbook-admin, .m8-admin-unlocks, [data-turn-route-test-hud-setting], #turnSwooshTestTitle').count(), 0);
  await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'LEAVE ADMIN', exact: true }).click()]);
  await ready();
  await page.waitForFunction(() => !globalThis.__turnSessionAdmin);
  assert.equal(await page.evaluate(() => globalThis.__turnAchievements.getTrophies()), 75);
  assert.deepEqual(await persisted(), original, 'Leaving and normal startup reveal the byte-identical save');
  assert.equal(await page.locator('.turn-admin-button').count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  // Reproduce the complete retired sequence. It must only open feedback.
  for (const track of ['countryside', 'cliffside', 'countryside', 'cliffside']) await page.locator(`.roadbook-card[data-track-id="${track}"]`).click();
  for (let i = 0; i < 4; i += 1) {
    await page.locator('.roadbook-sheet-button').click();
    await page.locator('#turnTrackSheet .turn-pr-close').click();
  }
  await page.locator('.turn-home-menu-button').click();
  await page.locator('.m8-home-menu .m8-feedback-button:not(.m8-achievements-button):not(.turn-dbe-training-home)').click();
  assert.equal(await page.evaluate(() => Boolean(globalThis.__turnSessionAdmin) || localStorage.getItem('turn-admin-unlock-v1') !== null), false);
  assert.deepEqual(errors, []);
  console.log('TURN session admin browser: keyboard/focus, responsive panel, lap → 2000 unlock, native save isolation, reload/leave and retired sequence passed.');
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
