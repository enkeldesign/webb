import fs from 'node:fs/promises'; import http from 'node:http'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.glb': 'model/gltf-binary' };
const server = http.createServer(async (req, res) => { try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.resolve(root, '.' + p); const b = await fs.readFile(f); res.writeHead(200, { 'content-type': types[path.extname(f).toLowerCase()] || 'application/octet-stream' }); res.end(b); } catch { res.writeHead(404); res.end(); } });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
for (const motion of ['no-preference', 'reduce']) {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true, reducedMotion: motion });
  const page = await context.newPage(); page.setDefaultTimeout(60000);
  page.on('console', (m) => { if (m.text().startsWith('HIDE')) console.log(m.text().slice(0, 1500)); });
  await page.addInitScript(() => {
    localStorage.setItem('turn-low-graphics-v1', '1'); localStorage.setItem('turn-steering-mode-v1', 'manual'); localStorage.setItem('turn-audio-enabled-v1', 'off');
    Object.defineProperty(globalThis.navigator, 'standalone', { configurable: true, value: true });
    const desc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'hidden');
    Object.defineProperty(HTMLElement.prototype, 'hidden', { configurable: true, get() { return desc.get.call(this); }, set(v) { if (this.classList?.contains('m8-home') && v && globalThis.__watchHome) console.log('HIDE ' + (performance.now() - globalThis.__watchHome).toFixed(0) + 'ms ' + new Error().stack); desc.set.call(this, v); } });
    const remove = DOMTokenList.prototype.remove;
    DOMTokenList.prototype.remove = function (...names) { if (names.includes('turn-home-open') && globalThis.__watchHome) console.log('HIDE class ' + new Error().stack); return remove.apply(this, names); };
  });
  const cdp = await context.newCDPSession(page);
  await page.goto(`${origin}/turn/`);
  await page.waitForFunction(() => document.documentElement.classList.contains('turn-home-ready'));
  const touch = async (points) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: points[0][0], y: points[0][1] }] }); for (const [x, y] of points.slice(1)) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); await page.waitForTimeout(16); } await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
  const line = ([x0, y0], [x1, y1], steps = 12) => Array.from({ length: steps + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps]);
  for (let round = 0; round < 3; round += 1) {
    await page.locator('.m8-track-continue').click();
    await page.waitForSelector('.garage');
    await page.waitForTimeout(900);
    await page.evaluate(() => { globalThis.__watchHome = performance.now(); });
    await touch(line([4, 430], [300, 436], 10));
    for (let t = 0; t < 8; t += 1) {
      await page.waitForTimeout(1000);
      const s = await page.evaluate(() => ({ homeHidden: document.querySelector('.m8-home').hidden, cls: document.body.classList.contains('turn-home-open'), garage: !!document.querySelector('.garage'), depth: globalThis.__turnAppNavigation.depth(), tf: document.querySelector('.m8-home').style.transform }));
      if (t === 0 || t === 7 || s.homeHidden) console.log(motion, round, t, JSON.stringify(s));
    }
    await page.evaluate(() => { globalThis.__watchHome = 0; });
  }
  await context.close();
}
await browser.close(); server.close();
