import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.TURN_PLAYWRIGHT_PATH || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const generated = JSON.parse(await fs.readFile(new URL('../turn/wiki/generated-pages.json', import.meta.url)));
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png' };
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const file = path.resolve(root, `.${url.pathname}${url.pathname.endsWith('/') ? 'index.html' : ''}`);
    assert(file.startsWith(root));
    const body = await fs.readFile(file);
    response.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.TURN_CHROMIUM_PATH ? { executablePath: process.env.TURN_CHROMIUM_PATH } : {}) });
const failures = [];
const requests = new Set();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
page.on('pageerror', (error) => failures.push(error.message));
page.on('response', (response) => { if (response.status() >= 400) failures.push(`${response.status()}: ${response.url()}`); });
page.on('request', (request) => requests.add(new URL(request.url()).pathname));
const visit = (route) => page.goto(`${origin}/turn/wiki/${route}`);
try {
  // All generated pages work as direct entries, with one main heading, labelled
  // navigation, no missing images and no horizontal page overflow on a phone.
  for (const file of generated) {
    await visit(file.replace('index.html', ''));
    assert.equal(await page.locator('h1').count(), 1, file);
    assert.equal(await page.locator('main').count(), 1, file);
    assert.equal(await page.locator('.primary-nav a').count(), 6, file);
    assert.equal(await page.locator('img:not([alt])').count(), 0, `${file}: image alternatives`);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= globalThis.innerWidth + 1), `${file}: phone overflow`);
    assert.equal(await page.locator('body').evaluate((body) => [...body.querySelectorAll('a')].filter((a) => !a.textContent.trim() && !a.getAttribute('aria-label')).length), 0, `${file}: unnamed links`);
  }
  const samples = ['', 'tracks/mountain/', 'cars/vintage-racer/', 'perks/torque/', 'getting-started/controls/', 'driving/overcharge/', 'reference/car-stats/', 'reference/trophy-road/', 'reference/achievements/'];
  for (const theme of ['light', 'dark']) {
    for (const [width, height] of [[320, 568], [852, 393], [810, 1080], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      for (const route of samples) {
        await visit(route);
        await page.locator('#wiki-theme').selectOption(theme);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= globalThis.innerWidth + 1), `${theme} ${width} ${route}: overflow`);
        const broken = await page.locator('img').evaluateAll((images) => images.filter((img) => img.complete && img.naturalWidth === 0).map((img) => img.src));
        assert.deepEqual(broken, [], `${route}: images`);
      }
    }
  }
  await page.setViewportSize({ width: 320, height: 568 });
  for (const route of samples) {
    await visit(route);
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= globalThis.innerWidth + 1), `${route}: 200% text reflow`);
  }
  await visit('');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').textContent(), 'Skip to content');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator(':focus').getAttribute('id'), 'main');
  await page.locator('#home-search').fill('full tank');
  await page.locator('#home-search').press('Enter');
  await page.waitForURL('**/search/?q=full+tank');
  assert.equal(await page.locator('.search-results li:visible a strong', { hasText: 'FULL TANK' }).count(), 1);
  assert.equal(await page.locator('#wiki-query').inputValue(), 'full tank');
  for (const [query, title] of [['drift', 'DRIFT'], ['future-racer', 'Future Racer'], ['DBE', 'DRIVE BY EAR'], ['harbor', 'Harbor'], ['overcharge', 'OVERCHARGE']]) {
    await page.locator('#wiki-query').fill(query);
    await page.locator('#wiki-query').press('Enter');
    assert(await page.locator('.search-results li:visible strong').allTextContents().then((titles) => titles.includes(title)), query);
  }
  await page.locator('#wiki-query').fill('<img src=x onerror=alert(1)>');
  await page.locator('#wiki-query').press('Enter');
  assert(await page.locator('#no-results').isVisible());
  assert.equal(await page.locator('#search-status img').count(), 0);
  await page.locator('#wiki-query').fill('');
  await page.locator('#wiki-query').press('Enter');
  assert.equal(await page.locator('.search-results li:visible').count(), generated.length - 2);
  await visit('reference/achievements/#golden-hour');
  assert(await page.locator('#golden-hour').isVisible(), 'A deep link opens its spoiler disclosure');
  await page.locator('#wiki-theme').selectOption('light');
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 568 } });
  const fallback = await noJs.newPage();
  await fallback.goto(`${origin}/turn/wiki/`);
  await fallback.getByRole('link', { name: 'TRACKS', exact: true }).click();
  await fallback.locator('.card').filter({ hasText: 'Harbor' }).click();
  assert.equal(await fallback.locator('h1').textContent(), 'Harbor');
  assert(await fallback.locator('#find-time').isVisible());
  await noJs.close();
  assert(![...requests].some((request) => /three|\/turn\/(?:app|main)\.js|\.glb$/.test(request)), 'No game renderer or race modules in the wiki browser');
  assert.deepEqual(failures, []);
  if (process.env.TURN_WIKI_SCREENSHOTS) {
    await fs.mkdir(process.env.TURN_WIKI_SCREENSHOTS, { recursive: true });
    for (const [name, route, width, height, theme] of [['home', '', 1440, 1100, 'light'], ['mobile', '', 390, 844, 'dark'], ['car', 'cars/vintage-racer/', 1100, 1100, 'dark'], ['track', 'tracks/mountain/', 390, 844, 'light'], ['controls', 'getting-started/controls/', 390, 844, 'light']]) {
      await page.setViewportSize({ width, height });
      await visit(route);
      await page.locator('#wiki-theme').selectOption(theme);
      await page.evaluate(() => globalThis.scrollTo(0, 0));
      await page.screenshot({ path: path.join(process.env.TURN_WIKI_SCREENSHOTS, `${name}.png`), fullPage: true });
    }
  }
  console.log(`Wiki browser smoke passed: ${generated.length} direct pages; light/dark, phone/tablet/desktop, 200% text, keyboard, search, no-JS and no game runtime.`);
} finally {
  await browser.close();
  server.close();
}
