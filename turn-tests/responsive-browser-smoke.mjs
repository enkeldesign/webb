import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const threeRoot = fileURLToPath(new URL('../', import.meta.resolve('three')));
const sizes = [[320, 568], [568, 320], [393, 852], [852, 393], [667, 308], [810, 1080], [1080, 810], [1440, 900], [240, 360]];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer(async (request, response) => {
  try {
    let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const filename = path.resolve(root, `.${pathname}`);
    if (!filename.startsWith(root)) throw new Error('Outside fixture root');
    let body = await fs.readFile(filename);
    if (pathname === '/turn/roadbook/roadbook.js') {
      // Exercise the real ROADBOOK renderer with extra catalog entries. These
      // fixtures never enter racing or bypass mandatory track integration checks.
      const source = body.toString();
      const placeholders = 'const placeholders = Array.isArray(TRACK_PLACEHOLDERS) ? TRACK_PLACEHOLDERS : [];';
      if (!source.includes(placeholders)) throw new Error('ROADBOOK placeholder fixture point moved');
      body = source.replace(placeholders, `const placeholders = [...(TRACK_PLACEHOLDERS || []),
        ...Array.from({ length: 4 }, (_, index) => ({ id: 'responsive-fixture-' + index, name: 'Additional responsive track ' + index }))];`);
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
// Dense, not tiny: visible text never below 11px, visible controls never below 44px.
// The drive pad's contextual LOCK / SHIFT / REVERSE bubbles are gameplay geometry
// owned by the race layout and are measured there, not here.
async function readability(page, label) {
  const { text, targets } = await page.evaluate(() => {
    // Content scrolled under the full-width portrait action dock is off screen until
    // the page scrolls, like content below the fold.
    const dock = [...document.querySelectorAll('.roadbook-dock, .garage-dock')]
      .map((node) => node.getBoundingClientRect())
      .find((rect) => rect.width >= globalThis.innerWidth * 0.8);
    const foldTop = dock ? dock.top - 12 : globalThis.innerHeight;
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = globalThis.getComputedStyle(el);
      const insideDock = Boolean(el.closest('.roadbook-dock, .garage-dock'));
      return rect.width > 1 && rect.height > 1 && style.visibility !== 'hidden'
        && rect.bottom > 0 && rect.top < globalThis.innerHeight && rect.right > 0 && rect.left < globalThis.innerWidth
        && (insideDock || (rect.top + rect.height / 2) < foldTop)
        && !el.closest('[aria-hidden="true"], [hidden], .garage-visually-hidden, .visually-hidden, .sr-only');
    };
    const text = [...document.querySelectorAll('body *')]
      .filter((el) => [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim()) && visible(el))
      .filter((el) => parseFloat(globalThis.getComputedStyle(el).fontSize) < 10.95)
      .map((el) => `${el.className?.toString().split(' ')[0] || el.tagName} ${parseFloat(globalThis.getComputedStyle(el).fontSize).toFixed(1)}px`);
    const targets = [...document.querySelectorAll('button, a[href], summary, [role="button"]')]
      .filter((el) => visible(el) && !el.closest('.drive-stack'))
      .filter((el) => { const rect = el.getBoundingClientRect(); return rect.width < 43.5 || rect.height < 43.5; })
      .filter((el) => { // A transparent hit area may extend a small icon control.
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2; const cy = rect.top + rect.height / 2;
        return ![[-21.5, 0], [21.5, 0], [0, -21.5], [0, 21.5]].every(([dx, dy]) => {
          if (cy + dy >= foldTop) return true;
          const hit = document.elementFromPoint(cx + dx, cy + dy);
          return hit && (hit === el || el.contains(hit));
        });
      })
      .map((el) => { const rect = el.getBoundingClientRect(); return `${el.className?.toString().split(' ')[0] || el.tagName} ${Math.round(rect.width)}x${Math.round(rect.height)}`; });
    return { text: [...new Set(text)], targets: [...new Set(targets)] };
  });
  assert.deepEqual(text, [], `${label}: no visible text below 11px`);
  assert.deepEqual(targets, [], `${label}: no visible control below 44x44`);
}

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
    const count = await page.locator('.roadbook-card').count();
    assert.ok(count > 10, 'Catalog fixture exceeds ten entries, without defining a maximum');
    assert.equal(await page.locator('.roadbook-card.is-coming-soon').count(), 4);
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await settle(page);
      const home = await bounds(page, '.m8-home');
      assert.ok(home.scrollWidth <= home.clientWidth + 1, `${name} ${width}: Home reflows horizontally`);
      await readability(page, `${name} ${width}x${height} Home`);
      // Every orientation: one slim app bar (logo, ACHIEVEMENTS, menu) and CHOOSE CAR in
      // reach: docked, or, on a window too short for a fixed dock (reflow at 240x360),
      // at the end of the page.
      const head = await bounds(page, '.m8-home-head');
      assert.ok(head.height <= 64, `${name} ${width}x${height}: the app bar is ${head.height}px`);
      for (const control of ['.turn-home-menu-button', '.turn-app-bar-actions .m8-achievements-button']) {
        within(await bounds(page, control), width, height, `${name} ${width}x${height} ${control}`);
      }
      const dockFixed = await page.evaluate(() => globalThis.getComputedStyle(document.querySelector('.roadbook-dock')).position === 'fixed');
      if (!dockFixed) await page.evaluate(() => { const home = document.querySelector('.m8-home'); home.scrollTop = home.scrollHeight; });
      within(await bounds(page, '.m8-track-continue'), width, height, `${name} ${width}x${height} .m8-track-continue`);
      if (!dockFixed) await page.evaluate(() => { document.querySelector('.m8-home').scrollTop = 0; });
      if (width >= 320 && width <= 736 && height > width) {
        // Portrait phones: the last track card scrolls clear of the dock.
        const clear = await page.evaluate(() => {
          const scroller = document.querySelector('.m8-home');
          scroller.scrollTop = scroller.scrollHeight;
          const dock = document.querySelector('.roadbook-dock').getBoundingClientRect();
          const cards = [...document.querySelectorAll('.roadbook-card')].map((card) => card.getBoundingClientRect());
          return Math.max(...cards.map((rect) => rect.bottom)) <= dock.top;
        });
        assert.ok(clear, `${name} ${width}x${height}: the last track card scrolls clear of the dock`);
      }
      const last = page.locator('.roadbook-card').last();
      await last.scrollIntoViewIfNeeded();
      const card = await last.boundingBox();
      assert.ok(card.y < height && card.y + card.height > 0, 'Last catalog entry remains reachable');
      if (await page.locator('.roadbook-sheet-button').isVisible()) {
        await page.locator('.roadbook-sheet-button').click();
        await page.waitForSelector('#turnTrackSheet[open]');
        await settle(page);
        const sheet = await bounds(page, '#turnTrackSheet .turn-pr-sheet-card');
        within(sheet, width, height, `${name} ${width}x${height} Track sheet`);
        // A sheet that fits because it collapsed is not a sheet: it shows its content.
        const head = await bounds(page, '#turnTrackSheet .turn-pr-sheet-head');
        assert.ok(sheet.height >= Math.min(240, height - 48) && head.bottom <= sheet.bottom + 0.5,
          `${name} ${width}x${height}: the Track sheet shows its content (${JSON.stringify({ sheet: sheet.height, head: head.bottom })})`);
        const body = await bounds(page, '#turnTrackSheet .turn-pr-sheet-body');
        assert.ok(body.scrollWidth <= body.clientWidth + 1, `${name} ${width}x${height}: the Track sheet reflows`);
        await readability(page, `${name} ${width}x${height} Track sheet`);
        // If the close control cannot take the tap, say where it is drawn and what
        // is on top of it there instead of only timing out.
        await page.locator('#turnTrackSheet .turn-pr-close').click({ timeout: 8000 }).catch(async (error) => {
          const where = await page.evaluate(() => {
            const box = (node) => {
              const rect = node?.getBoundingClientRect();
              return rect && [rect.x, rect.y, rect.width, rect.height].map(Math.round);
            };
            const close = document.querySelector('#turnTrackSheet .turn-pr-close');
            const rect = close.getBoundingClientRect();
            const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
            return {
              close: box(close),
              card: box(document.querySelector('#turnTrackSheet .turn-pr-sheet-card')),
              dialog: box(document.querySelector('#turnTrackSheet')),
              top: top && `${top.tagName}.${String(top.className)}`,
              scroll: [globalThis.scrollX, globalThis.scrollY, document.scrollingElement.scrollTop],
              visualViewport: globalThis.visualViewport && [globalThis.visualViewport.offsetLeft, globalThis.visualViewport.offsetTop,
                globalThis.visualViewport.width, globalThis.visualViewport.height, globalThis.visualViewport.scale]
            };
          });
          throw new Error(`${name} ${width}x${height}: the Track sheet close cannot take a tap ${JSON.stringify(where)}\n${error.message.split('\n')[0]}`);
        });
        await page.waitForFunction(() => !document.querySelector('#turnTrackSheet').open);
      }
      assert.equal(await page.locator('.turn-orientation-hint').count(), 0);
    }
    await page.setViewportSize({ width: 393, height: 852 });
    // A halved CSS viewport covers page-zoom reflow; doubling root text separately
    // exercises text resizing without shrinking the game surface.
    // One button shape: the menu sheet's entries are the shared rounded rectangle,
    // and its close is the same round close as every dialog.
    await page.locator('.turn-home-menu-button').click();
    const shape = (selector) => page.$$eval(selector, (nodes) => nodes
      .filter((node) => node.getBoundingClientRect().width > 0)
      .map((node) => { const style = globalThis.getComputedStyle(node); return [style.borderTopLeftRadius, style.borderTopWidth, style.boxShadow].join(' / '); }));
    assert.deepEqual([...new Set(await shape('.turn-home-sheet .m8-home-menu > button'))], ['12px / 3px / rgb(8, 9, 10) 3px 3px 0px 0px'],
      'Menu entries use the shared control shape');
    const sheetClose = (await shape('.turn-home-sheet-close'))[0];
    await page.locator('.m8-home-settings').click();
    await page.waitForSelector('.m8-settings-dialog[open]');
    assert.equal(sheetClose, (await shape('.m8-settings-dialog [data-dialog-close]'))[0], 'The sheet closes like every dialog');
    await page.locator('.m8-settings-dialog [data-dialog-close]').click();
    await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    for (const [trigger, dialog] of [['.m8-home-settings', '.m8-settings-dialog'], ['.m8-achievements-button', '.turn-achievements-dialog']]) {
      if (!(await page.locator(trigger).isVisible())) await page.locator('.turn-home-menu-button').click();
      await page.locator(trigger).click();
      if (dialog === '.turn-achievements-dialog') {
        // Trophy Road's cells are taller than wide in portrait: a bend turned a quarter
        // still covers its whole cell, so the road meets itself with no gaps (#1039).
        await page.waitForSelector('.turn-trophy-road-bend');
        const bends = await page.$$eval('.turn-trophy-road-bend', (nodes) => nodes.filter((node) => node.getClientRects().length).map((node) => {
          const cell = node.getBoundingClientRect();
          const tile = globalThis.getComputedStyle(node, '::before');
          const turned = /--turn-road-rotation:\s*(90|270)deg/.test(node.getAttribute('style'));
          const [w, h] = [parseFloat(tile.width), parseFloat(tile.height)];
          const [across, down] = turned ? [h, w] : [w, h];
          return Math.abs(across - cell.width) < 1 && Math.abs(down - cell.height) < 1 ? '' : `${Math.round(across)}x${Math.round(down)} in ${Math.round(cell.width)}x${Math.round(cell.height)}`;
        }));
        assert.ok(bends.length > 0 && bends.every((bend) => bend === ''), `Every Trophy Road bend fills its cell: ${bends.filter(Boolean).join(', ')}`);
      }
      await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
      await settle(page);
      const box = await bounds(page, dialog);
      within(box, 393, 852, dialog);
      // Portrait phones: every dialog is a bottom sheet, full width and flush with
      // the bottom edge.
      const sheet = await bounds(page, `${dialog} > :first-child`);
      assert.ok(Math.round(sheet.x) === 0 && Math.round(sheet.width) === 393 && Math.round(sheet.bottom) === 852,
        `${dialog} is a portrait bottom sheet`);
      assert.ok(box.scrollWidth <= box.clientWidth + 1, 'Dialog text reflows at 200%');
      await page.locator(`${dialog} [data-dialog-close]`).click();
      await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    }
    // CHOOSE CAR and GARAGE's RACE are both the forward action at the foot of the
    // screen, in the primary colour.
    const dockStyle = async (selector) => (await page.mouse.move(1, 1), page.locator(selector).evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { bottomGap: Math.round(globalThis.innerHeight - rect.bottom), background: globalThis.getComputedStyle(node).backgroundColor };
    }));
    // ROADBOOK and GARAGE are titled in the TURN font, as LOADING is (#1040).
    const turnFont = (selector) => page.locator(selector).evaluate((node) => {
      const style = globalThis.getComputedStyle(node);
      return { family: style.fontFamily, weight: style.fontWeight };
    });
    // The real LOADING heading stays in the page, hidden, once ROADBOOK is up.
    const loadingFont = await page.evaluate(() => {
      const heading = document.querySelector('#installGate .install-card h1');
      const style = globalThis.getComputedStyle(heading);
      return { text: heading.textContent, family: style.fontFamily, weight: style.fontWeight };
    });
    assert.equal(loadingFont.text, 'LOADING', 'The loading screen heading is in the page');
    delete loadingFont.text;
    assert.deepEqual(await turnFont('#m8HomeTitle'), loadingFont, 'ROADBOOK is titled in the LOADING font');
    const homeDock = await dockStyle('.m8-track-continue');
    await page.locator('.m8-track-continue').click();
    await page.waitForSelector('.garage');
    await settle(page);
    assert.deepEqual(await turnFont('#garageTitle'), loadingFont, 'GARAGE is titled in the LOADING font');
    const lotDock = await dockStyle('.garage-race');
    assert.equal(lotDock.background, homeDock.background, `${name}: RACE uses ROADBOOK's primary colour`);
    assert.ok(homeDock.bottomGap <= 24 && lotDock.bottomGap <= 24, `${name}: both forward actions sit at the foot (${JSON.stringify([homeDock, lotDock])})`);
    // Nothing in GARAGE paints over the dock: with the tools scrolled under it, a tap
    // on RACE still reaches the button.
    assert.ok(await page.evaluate(() => {
      const screen = document.querySelector('.garage');
      const tools = document.querySelector('.garage-tools');
      const race = document.querySelector('.garage-race');
      const dock = race.getBoundingClientRect();
      screen.scrollTop += tools.getBoundingClientRect().top - dock.top;
      const hit = document.elementFromPoint(dock.x + dock.width / 2, dock.y + dock.height / 2);
      screen.scrollTop = 0;
      return race.contains(hit);
    }), `${name}: RACE receives taps with the GARAGE tools scrolled under it`);
    // Standalone dialogs (GARAGE SHIFT, reset rivals) are portrait sheets too.
    for (const dialog of ['.garage-shift-dialog', '.nuke-dialog']) {
      await page.$eval(dialog, (node) => node.showModal());
      await settle(page);
      const sheet = await bounds(page, `${dialog} > :first-child`);
      assert.ok(Math.round(sheet.x) === 0 && Math.round(sheet.width) === 393 && Math.round(sheet.bottom) === 852,
        `${dialog} is a portrait bottom sheet`);
      if (dialog === '.garage-shift-dialog') {
        assert.equal((await shape('.garage-shift-close'))[0], sheetClose, 'SHIFT closes like every dialog');
      }
      await page.$eval(dialog, (node) => node.close());
    }
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await settle(page);
      const lot = await bounds(page, '.garage');
      assert.ok(lot.scrollWidth <= lot.clientWidth + 1, `${name} ${width}: GARAGE reflows`);
      await readability(page, `${name} ${width}x${height} GARAGE`);
      // Docked, or at the end of the page when the window is too short for a fixed dock.
      const dockFixed = await page.evaluate(() => globalThis.getComputedStyle(document.querySelector('.garage-dock')).position === 'fixed');
      if (!dockFixed) await page.evaluate(() => { const garage = document.querySelector('.garage'); garage.scrollTop = garage.scrollHeight; });
      within(await bounds(page, '.garage-race'), width, height, 'GARAGE RACE action');
      if (!dockFixed) await page.evaluate(() => { document.querySelector('.garage').scrollTop = 0; });
    }
    await page.setViewportSize({ width: 393, height: 852 });
    await page.locator('.garage-race').click();
    // One line and the rotate-device symbol, short enough to read before the track loads (#1041).
    // Waited for and read in one go: the TIP only shows for the track intro's hold.
    const tipFacts = await (await page.waitForFunction(() => {
      const hint = document.querySelector('.turn-orientation-hint');
      if (!hint || !hint.getClientRects().length) return null;
      const box = (node) => {
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
      };
      return {
        text: hint.textContent.trim(),
        symbol: Boolean(hint.querySelector('.turn-orientation-icon svg .turn-orientation-phone')),
        status: document.querySelector('#raceOrientationStatus').textContent,
        tip: box(hint),
        icon: box(hint.querySelector('.turn-orientation-icon'))
      };
    })).jsonValue();
    assert.deepEqual({ text: tipFacts.text, symbol: tipFacts.symbol, status: tipFacts.status },
      { text: 'TIP: ROTATE TO LANDSCAPE FOR RACING', symbol: true, status: 'Tip: rotate to landscape for racing.' },
      'Portrait loading shows the rotate TIP');
    within(tipFacts.tip, 393, 852, 'Rotate TIP');
    within(tipFacts.icon, 393, 852, 'Rotate symbol');
    await page.waitForSelector('#controls:not([hidden])');
    assert.equal(await page.locator('.turn-orientation-hint').count(), 0, 'Loading recommendation ends before active racing');
    // The TIP card and its symbol also stay on screen on a 320px phone and with doubled
    // text. A fresh module instance shows it again; the real one showed it once above.
    for (const [width, height] of [[320, 568], [393, 852]]) {
      for (const fontSize of ['', '32px']) {
        await page.setViewportSize({ width, height });
        await page.evaluate(async ([size, key]) => {
          document.documentElement.style.fontSize = size;
          globalThis.sessionStorage.removeItem('turn-first-race-orientation-v1');
          const host = document.createElement('div');
          host.id = 'tipBoundsHost';
          host.style.cssText = 'position:fixed;inset:0;z-index:40;pointer-events:none';
          document.body.append(host);
          const orientation = await import(`/turn/ui/race-orientation.js?tip-bounds=${key}`);
          orientation.showRaceOrientationRecommendation(host);
        }, [fontSize, `${width}-${fontSize || 'base'}`]);
        const label = `${width}x${height}${fontSize ? ' at 200% text' : ''}`;
        within(await bounds(page, '#tipBoundsHost .turn-orientation-hint'), width, height, `Rotate TIP ${label}`);
        within(await bounds(page, '#tipBoundsHost .turn-orientation-icon'), width, height, `Rotate symbol ${label}`);
        await page.evaluate(() => {
          document.querySelector('#tipBoundsHost').remove();
          document.querySelector('#raceOrientationStatus').textContent = '';
          document.documentElement.style.fontSize = '';
        });
      }
    }
    await page.setViewportSize({ width: 393, height: 852 });
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
          // The gauge sits under its score, out of the car's line, never above it.
          assert.ok(gauge.width > 20 && gauge.y >= drift.bottom - 4, 'Portrait intensity sits under its score');
          const scale = await page.locator('[data-score-feedback-meter-fill]').first().evaluate((node) => {
            const matrix = new globalThis.DOMMatrix(globalThis.getComputedStyle(node).transform);
            return { x: matrix.a, y: matrix.d };
          });
          assert.ok(Math.abs(scale.x - .65) < .001 && scale.y >= 1 && scale.y <= 1.08, `Portrait fill scales horizontally, as in landscape (${JSON.stringify(scale)})`);
        }
        // Every line of DRIFT and FLOW, five-digit records included, sits inside its panel,
        // in portrait and landscape (#1038). Text is measured, since it can overflow a line
        // box that fits.
        const spill = await page.evaluate(() => {
          for (const value of document.querySelectorAll('.score-feedback-history b')) value.textContent = '12 780';
          return [...document.querySelectorAll('.score-feedback-state')].flatMap((state) => {
            const box = state.getBoundingClientRect();
            const walker = document.createTreeWalker(state, globalThis.NodeFilter.SHOW_TEXT);
            const out = [];
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              if (!node.textContent.trim() || !node.parentElement.getClientRects().length) continue;
              const range = document.createRange();
              range.selectNodeContents(node);
              const r = range.getBoundingClientRect();
              if (r.width && (r.left < box.left - .5 || r.right > box.right + .5 || r.top < box.top - .5 || r.bottom > box.bottom + .5)) out.push(node.textContent.trim());
            }
            return out;
          });
        });
        assert.deepEqual(spill, [], `${width}x${height} ${handedness}: DRIFT and FLOW text stays inside its panel`);
      }
      // The lap banner fits its text with no scores yet, and with DRIFT and FLOW records
      // (#1037): nothing clipped, cut short or outside the yellow paper.
      for (const [label, detail] of [
        ['lap only', { position: 1, total: 1, time: 23.456 }],
        ['DRIFT and FLOW', { position: 2, total: 5, time: 23.456, drift: { available: true, score: 12345, bestScore: 23456 }, flow: { available: true, score: 8765, newBest: true } }]
      ]) {
        const cut = await page.evaluate(async (result) => {
          globalThis.dispatchEvent(new CustomEvent('turn:lap-result', { detail: result }));
          await new Promise((resolve) => globalThis.setTimeout(resolve, 300));
          const toast = document.querySelector('.lap-result-toast');
          const box = toast.getBoundingClientRect();
          const out = [];
          for (const node of toast.querySelectorAll('*')) {
            if (!node.getClientRects().length) continue;
            // Glyphs overhang a line-height of 1 by a pixel or two; a cut-off line does not.
            if (node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 3) out.push(`${node.className || node.tagName} clipped ${node.scrollWidth}x${node.scrollHeight}>${node.clientWidth}x${node.clientHeight}`);
          }
          const walker = document.createTreeWalker(toast, globalThis.NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (!node.textContent.trim() || !node.parentElement.getClientRects().length) continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            const r = range.getBoundingClientRect();
            if (r.left < box.left || r.right > box.right || r.top < box.top || r.bottom > box.bottom) out.push(node.textContent.trim());
          }
          return out;
        }, detail);
        assert.deepEqual(cut, [], `${width}x${height}: the ${label} lap banner fits its text`);
      }
      assert.equal(await page.locator('.rotate-panel').count(), 0);
      if (height > width) {
        // The portrait stat chips are a fixed grid: wider values never move a chip.
        const chipRects = () => page.$$eval('.stats > .chip', (chips) => chips
          .filter((chip) => chip.getBoundingClientRect().width > 0)
          .map((chip) => { const rect = chip.getBoundingClientRect(); return [rect.x, rect.y, rect.width, rect.height].map(Math.round).join(','); }));
        const before = await chipRects();
        await page.evaluate(() => {
          document.querySelector('#speed').textContent = '288';
          document.querySelector('#lapTime').textContent = '10:48.888';
          document.querySelector('#bestTime').textContent = '10:48.888';
        });
        assert.deepEqual(await chipRects(), before, `${width}x${height}: stat chips keep their place as values grow`);
        // Race utilities, BOOST and the drive pad never overlap.
        const clash = await page.evaluate(() => {
          const rects = [...document.querySelectorAll('.utility-group > .utility, .drive-pad, .boost-hud')]
            .filter((node) => node.getBoundingClientRect().width > 0 && globalThis.getComputedStyle(node).display !== 'none')
            .map((node) => [node.className.split(' ').slice(0, 2).join('.'), node.getBoundingClientRect()]);
          const hits = [];
          for (let i = 0; i < rects.length; i += 1) for (let j = i + 1; j < rects.length; j += 1) {
            const [a, r] = rects[i]; const [b, q] = rects[j];
            if (Math.min(r.right, q.right) - Math.max(r.left, q.left) > 1 && Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) > 1) hits.push(`${a} × ${b}`);
          }
          return hits;
        });
        assert.deepEqual(clash, [], `${width}x${height}: race controls do not overlap`);
      }
    }
    await page.setViewportSize({ width: 393, height: 852 });
    await page.keyboard.down('ArrowUp');
    assert.equal(await page.evaluate(() => globalThis.__turnRuntime.state.touchGas), true, 'Existing keyboard driving survives rotation');
    await page.keyboard.up('ArrowUp');
    assert.equal(await page.evaluate(() => globalThis.__turnRuntime.state.touchGas), false);
    assert.deepEqual(await page.evaluate(() => globalThis.orientationLocks), [], 'Racing never requests an orientation lock');
    assert.deepEqual(errors, [], 'No new browser runtime errors');
    console.log(`${name}: ${sizes.length} viewport families, larger catalog, 200% text, GARAGE, mirrored race HUD, keyboard and standalone window passed.`);
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
