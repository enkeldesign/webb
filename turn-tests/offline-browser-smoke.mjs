import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Offline play (#1030): after one online launch, TURN in airplane mode starts, shows
// ROADBOOK and GARAGE with their car pictures and races, with three.js served from
// TURN's own origin. A new release's worker takes over quietly and asks to restart.
// Chromium only: Playwright drives service workers and offline mode there.
const root = fileURLToPath(new URL('../', import.meta.url));
const types = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary'
};
// The test can publish a "next release" of the worker: same code, another name. And it
// can take the server away entirely: offline mode in the browser alone does not reach a
// service worker's own requests, so airplane mode here also means no server at all.
let nextRelease = null;
let serverDown = false;
const server = http.createServer(async (request, response) => {
  if (serverDown) {
    request.socket.destroy();
    return;
  }
  try {
    let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const filename = path.resolve(root, `.${pathname}`);
    if (!filename.startsWith(root)) throw new Error('Outside fixture root');
    let body = await fs.readFile(filename);
    if (nextRelease && pathname === '/turn/sw.js') {
      body = Buffer.from(body.toString('utf8').replace(/const RELEASE = '[^']+';/, `const RELEASE = '${nextRelease}';`));
    }
    response.writeHead(200, { 'content-type': types[path.extname(filename).toLowerCase()] || 'application/octet-stream' });
    response.end(body);
  } catch (_) {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const precache = JSON.parse(await fs.readFile(new URL('../turn/offline-precache.json', import.meta.url), 'utf8'));

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 852, height: 393 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', (error) => {
    if (error.message.includes('different audio context') && error.stack.includes('organic-ribbon')) return;
    errors.push(error.message);
  });
  const cdnThree = [];
  context.on('request', (request) => {
    if (/cdn\.jsdelivr\.net\/npm\/three@/.test(request.url())) cdnThree.push(request.url());
  });
  await page.addInitScript(() => {
    localStorage.setItem('turn-offline-under-test', '1');
    localStorage.setItem('turn-low-graphics-v1', '1');
    localStorage.setItem('turn-steering-mode-v1', 'manual');
    localStorage.setItem('turn-audio-enabled-v1', 'off');
    localStorage.setItem('turn-racing-music-volume-v1', '0');
    Object.defineProperty(globalThis.navigator, 'standalone', { configurable: true, value: true });
  });
  const ready = () => page.waitForFunction(() => document.documentElement.classList.contains('turn-home-ready'), null, { timeout: 60000 });

  // Online: the worker installs and stores the whole release.
  await page.goto(`${origin}/turn/`);
  await ready();
  const offlineStatus = () => page.evaluate(async () => {
    const offline = globalThis.__turnOffline;
    if (!offline || !globalThis.navigator.serviceWorker.controller) return null;
    return offline.status();
  });
  let status = null;
  for (const started = Date.now(); !status && Date.now() - started < 120000;) {
    status = await offlineStatus();
    if (!status) await page.waitForTimeout(500);
  }
  assert.ok(status, 'The offline worker installs and reports its release');
  assert.equal(status.release, precache.release, 'The worker stores the current release');
  assert.equal(status.files, precache.files.length, 'The worker stores every listed file');
  assert.equal(status.failed, 0, 'No listed file failed to store');
  assert.deepEqual(cdnThree, [], 'Three.js comes from TURN\'s own origin, not the CDN');

  // Airplane mode: TURN starts, ROADBOOK and GARAGE show, a race starts.
  await context.setOffline(true);
  serverDown = true;
  await page.reload();
  await ready();
  assert.equal(await page.locator('.roadbook-card').count() > 0, true, 'Offline, ROADBOOK lists the tracks');
  await page.locator('.m8-track-continue').click();
  await page.waitForSelector('.garage');
  await page.waitForTimeout(800);
  await page.locator('.garage-all-cars-button').click().catch(() => {});
  const stills = await page.evaluate(async () => {
    const images = [...document.querySelectorAll('.garage-car-still')].filter((image) => image.getClientRects().length).slice(0, 4);
    await Promise.all(images.map((image) => (image.complete ? null : new Promise((resolve) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
    }))));
    return images.map((image) => image.naturalWidth > 0);
  });
  assert.ok(stills.length > 0 && stills.every(Boolean), `Offline, ALL CARS shows the car pictures (${stills})`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.locator('.garage-race').click();
  await page.waitForSelector('#controls:not([hidden])', { timeout: 60000 });
  assert.equal(await page.evaluate(() => document.body.classList.contains('turn-race-active')), true, 'Offline, a race starts');

  // A page in the app that was never opened says it needs a connection and leads back.
  const other = await context.newPage();
  await other.goto(`${origin}/turn/stats/`);
  assert.equal((await other.locator('h1').textContent()).trim(), "You're offline");
  assert.equal(await other.locator('a').getAttribute('href'), '/turn/', 'The offline page leads back to TURN');
  await other.close();

  // Back online, a new release's worker takes over and asks to restart, after the race.
  await context.setOffline(false);
  serverDown = false;
  await page.locator('.back-to-lot-button').click();
  await ready();
  nextRelease = `${precache.release}-next`;
  await page.evaluate(async () => (await globalThis.navigator.serviceWorker.getRegistration('/turn/'))?.update());
  await page.waitForSelector('.turn-update-toast', { timeout: 120000 });
  assert.equal((await page.locator('.turn-update-toast-text').textContent()).trim(), 'New TURN version ready');
  await Promise.all([page.waitForEvent('load'), page.locator('.turn-update-toast-restart').click()]);
  await ready();
  const after = await offlineStatus();
  assert.equal(after.release, nextRelease, 'After RESTART the new release is in charge');
  assert.deepEqual(errors, [], 'no page errors');
  console.log(`Offline: ${status.files} files stored; airplane-mode ROADBOOK, GARAGE and race; update toast and restart passed.`);
} finally {
  await browser.close();
  server.close();
}
