import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const threeRoot = fileURLToPath(new URL('../', import.meta.resolve('three')));
const sizes = [[320, 568], [568, 320], [393, 852], [852, 393], [810, 1080], [1080, 810], [1440, 900], [240, 360]];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer(async (request, response) => {
  try {
    let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const filename = path.resolve(root, `.${pathname}`);
    if (!filename.startsWith(root)) throw new Error('Outside fixture root');
    let body = await fs.readFile(filename);
    if (pathname === '/turn/tracks/catalog.js') {
      // Exercise the real catalog renderer with extra selection entries. These
      // fixtures never enter racing or bypass mandatory track integration checks.
      body = body.toString().replace('...TRACK_PLACEHOLDERS', `...TRACK_PLACEHOLDERS,
        ...Array.from({ length: 4 }, (_, index) => ({ ...TRACK_CATALOG[0],
          id: 'responsive-fixture-' + index, name: 'Additional responsive track ' + index, locked: true }))`);
    }
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

async function bounds(page, selector) {
  return page.locator(selector).first().evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height,
      clientWidth: node.clientWidth, scrollWidth: node.scrollWidth };
  });
}

function within(rect, width, height, label) {
  assert.ok(rect.width > 0 && rect.height > 0, `${label}: visible size`);
  assert.ok(rect.x >= -1 && rect.right <= width + 1, `${label}: horizontal bounds ${JSON.stringify(rect)}`);
  assert.ok(rect.y >= -1 && rect.bottom <= height + 1, `${label}: vertical bounds ${JSON.stringify(rect)}`);
}

async function orientationTransitions(browser) {
  for (const portrait of [true, false]) {
    const context = await browser.newContext({ viewport: portrait ? { width: 393, height: 852 } : { width: 852, height: 393 } });
    const page = await context.newPage();
    await page.route('**/__orientation-fixture', (route) => route.fulfill({ contentType: 'text/html', body: '<button id="start">Start</button>' }));
    const load = async () => {
      await page.goto(`${origin}/__orientation-fixture`);
      await page.evaluate(async () => { globalThis.orientationUI = await import('/turn/ui/race-orientation.js'); });
    };
    await load();
    assert.equal(await page.locator('.turn-orientation-hint').count(), 0, 'Menus do not announce orientation');
    await page.locator('#start').focus();
    await page.evaluate(() => globalThis.orientationUI.showRaceOrientationRecommendation(document.body, { staged: true }));
    assert.equal(await page.locator('.turn-orientation-hint').count(), Number(portrait));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'start', 'Recommendation never takes focus');
    assert.equal(await page.locator('#raceOrientationStatus').getAttribute('aria-live'), 'polite');
    await page.keyboard.press('ArrowUp');
    assert.equal(await page.locator('.turn-orientation-hint').count(), 0, 'Driving clears staged fallback');
    assert.equal(await page.locator('#raceOrientationStatus').textContent(), '');
    await page.setViewportSize({ width: 393, height: 852 });
    await page.evaluate(() => globalThis.orientationUI.showRaceOrientationRecommendation(document.body));
    assert.equal(await page.locator('.turn-orientation-hint').count(), 0, 'Later portrait races do not nag');
    await load();
    await page.evaluate(() => globalThis.orientationUI.showRaceOrientationRecommendation(document.body));
    assert.equal(await page.locator('.turn-orientation-hint').count(), 0, 'Same-tab reload retains the first handoff');
    await context.close();
  }
}

async function responsiveRace(browser, name) {
  // A landscape physical screen must not override a portrait standalone window.
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, screen: { width: 1920, height: 1080 }, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', (error) => {
    // Also reproduced on unchanged c7f7095c: existing organic audio cross-context
    // ribbon creation. Audio is outside this layout regression's scope (#905).
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
    globalThis.orientationLocks = [];
    if (globalThis.screen.orientation) globalThis.screen.orientation.lock = async (value) => globalThis.orientationLocks.push(value);
    Object.defineProperty(globalThis.navigator, 'standalone', { configurable: true, value: true });
  });
  try {
    await page.goto(`${origin}/turn/`);
    if (await page.locator('#playBrowserButton').isVisible()) await page.locator('#playBrowserButton').click();
    await page.waitForFunction(() => document.documentElement.classList.contains('turn-home-ready'), { timeout: 60000 });
    const count = await page.locator('.track-card').count();
    assert.ok(count > 6, 'Catalog fixture exceeds six tracks, without defining a maximum');
    assert.equal(await page.locator('.track-card[data-track-id^="responsive-fixture-"]').count(), 4);
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await settle(page);
      const home = await bounds(page, '.m8-home');
      assert.ok(home.scrollWidth <= home.clientWidth + 1, `${name} ${width}: Home reflows horizontally`);
      const last = page.locator('.track-card').last();
      await last.scrollIntoViewIfNeeded();
      const card = await last.boundingBox();
      assert.ok(card.y < height && card.y + card.height > 0, 'Last catalog entry remains reachable');
      await page.locator('.m8-track-bests-toggle').click();
      await last.scrollIntoViewIfNeeded();
      assert.equal(await page.locator('.track-card').count(), count, 'Expanded records retain the entire catalog');
      await page.locator('.m8-track-bests-toggle').click();
      assert.equal(await page.locator('.turn-orientation-hint').count(), 0);
    }
    await page.setViewportSize({ width: 393, height: 852 });
    // A halved CSS viewport covers page-zoom reflow; doubling root text separately
    // exercises text resizing without shrinking the game surface.
    for (const [trigger, dialog] of [['.m8-home-settings', '.m8-settings-dialog'], ['.m8-achievements-button', '.turn-achievements-dialog']]) {
      await page.locator(trigger).click();
      await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
      await settle(page);
      const box = await bounds(page, dialog);
      within(box, 393, 852, dialog);
      assert.ok(box.scrollWidth <= box.clientWidth + 1, 'Dialog text reflows at 200%');
      await page.locator(`${dialog} [data-dialog-close]`).click();
      await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    }
    await page.locator('.m8-track-continue').click();
    await page.waitForSelector('.lot-showroom');
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await settle(page);
      const lot = await bounds(page, '.lot-screen');
      assert.ok(lot.scrollWidth <= lot.clientWidth + 1, `${name} ${width}: Lot reflows`);
      if (width > 736) assert.ok((await bounds(page, '.lot-side')).height <= 481, 'Large-screen preview stays bounded');
      await page.locator('.lot-race').scrollIntoViewIfNeeded();
      within(await bounds(page, '.lot-race'), width, height, 'Lot RACE action');
    }
    await page.setViewportSize({ width: 393, height: 852 });
    await page.locator('.lot-race').click();
    await page.waitForSelector('.turn-orientation-hint');
    assert.match(await page.locator('.turn-orientation-hint').textContent(), /Portrait\/upright orientation is fully supported/);
    await page.waitForSelector('#controls:not([hidden])');
    assert.equal(await page.locator('.turn-orientation-hint').count(), 0, 'Loading recommendation ends before active racing');
    await page.evaluate(() => {
      const runtime = globalThis.__turnRuntime;
      // Freeze only simulation for stable geometry; use the real renderer,
      // camera, input handlers and score feedback API throughout.
      runtime.setSceneOverride(() => { runtime.renderer.render(runtime.scene, runtime.camera); return true; });
      for (const channel of ['drift', 'flow']) {
        runtime.scoreFeedback.setChannelVisible(channel, true, globalThis.performance.now());
        runtime.scoreFeedback.updateState(channel, { active: true, score: 12345, unbanked: 678, multiplier: 3, intensity: .65 }, globalThis.performance.now());
      }
      runtime.scoreFeedback.commit(globalThis.performance.now(), true);
    });
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await settle(page);
      within(await bounds(page, '#game'), width, height, 'Game viewport');
      const aspect = await page.evaluate(() => globalThis.__turnRuntime.camera.aspect);
      assert.ok(Math.abs(aspect - width / height) < .01, 'Camera uses window geometry, not physical screen');
      for (const handedness of ['right', 'left']) {
        await page.evaluate(async (value) => (await import('/turn/ui/control-handedness.js')).applyControlHandedness(value), handedness);
        await settle(page);
        const pad = await bounds(page, '.drive-pad');
        const steering = await bounds(page, '.manual-steer');
        within(pad, width, height, `${handedness} drive pad`);
        within(steering, width, height, `${handedness} manual steering`);
        assert.ok(pad.right <= steering.x || steering.right <= pad.x, 'Thumb zones do not overlap');
        if (height > width) {
          const drift = await bounds(page, '[data-score-feedback-drift-readout]');
          const flow = await bounds(page, '[data-score-feedback-flow-readout]');
          within(drift, width, height, 'Drift score');
          within(flow, width, height, 'Flow score');
          assert.equal(drift.x < flow.x, handedness === 'right', 'Portrait scores mirror');
          const gauge = await bounds(page, '.score-feedback-gauge-shell[data-score-channel="drift"]');
          assert.ok(gauge.width > 20 && gauge.y < drift.y, 'Portrait intensity grows above its score');
          const transform = await page.locator('[data-score-feedback-meter-fill]').first().evaluate((node) => globalThis.getComputedStyle(node).transform);
          assert.match(transform, /^matrix\(1, 0, 0, 0\.65/, 'Portrait fill scales vertically');
        }
      }
      assert.equal(await page.locator('.rotate-panel').count(), 0);
    }
    await page.setViewportSize({ width: 393, height: 852 });
    await page.keyboard.down('ArrowUp');
    assert.equal(await page.evaluate(() => globalThis.__turnRuntime.state.touchGas), true, 'Existing keyboard driving survives rotation');
    await page.keyboard.up('ArrowUp');
    assert.equal(await page.evaluate(() => globalThis.__turnRuntime.state.touchGas), false);
    assert.deepEqual(await page.evaluate(() => globalThis.orientationLocks), [], 'Racing never requests an orientation lock');
    assert.deepEqual(errors, [], 'No new browser runtime errors');
    console.log(`${name}: ${sizes.length} viewport families, larger catalog, 200% text, Lot, mirrored race HUD, keyboard and standalone window passed.`);
  } finally {
    await context.close();
  }
}

try {
  for (const name of (process.env.TURN_RESPONSIVE_BROWSERS || 'chromium,webkit').split(',')) {
    const browser = await ({ chromium, webkit })[name].launch({ headless: true,
      ...(name === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] } : {}) });
    try {
      await orientationTransitions(browser);
      await responsiveRace(browser, name);
    } finally {
      await browser.close();
    }
  }
} finally {
  server.close();
}
