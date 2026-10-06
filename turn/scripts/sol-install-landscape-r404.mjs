import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read = (path) => fs.readFile(path, 'utf8');
const write = (path, content) => fs.writeFile(path, content);

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  assert.notEqual(first, -1, `${label}: source pattern exists`);
  assert.equal(source.indexOf(before, first + before.length), -1, `${label}: source pattern is unique`);
  return `${source.slice(0, first)}${after}${source.slice(first + before.length)}`;
}

const releasePath = 'turn/release.json';
const release = JSON.parse(await read(releasePath));
assert.deepEqual(release, {
  version: '1.36.41',
  id: '2026.10.06-r403',
  cacheKey: '20261006-r403'
}, 'Repair must start from the current r403 production release');
await write(releasePath, `${JSON.stringify({
  version: '1.36.42',
  id: '2026.10.06-r404',
  cacheKey: '20261006-r404'
}, null, 2)}\n`);

const bootstrapPath = 'turn/ui/about-history-bootstrap-r165.js';
let bootstrap = await read(bootstrapPath);
bootstrap = replaceOnce(
  bootstrap,
  "const INSTALL_PITCH = 'TURN is a motion-controlled arcade drift racer.';",
  "const INSTALL_PITCH = 'TURN is an accessible motion-controlled arcade drift racer.';",
  'approved accessible install pitch'
);
await write(bootstrapPath, bootstrap);

const cssPath = 'turn/browser-install-r165.css';
let css = await read(cssPath);
css = replaceOnce(css, `.install-accessibility-symbol {
  display: block;
  width: calc(var(--turn-space-12) + var(--turn-space-12));
  height: auto;
}

/* The Commons SVG is a one-colour mark. In dark mode use it as a mask so its visible
   fill comes from TURN's light-blue token instead of retaining the dark source blue. */
:root[data-theme="dark"] .install-accessibility-symbol {
  display: none;
}

:root[data-theme="dark"] .install-accessibility::before {
  content: "";
  display: block;
  width: calc(var(--turn-space-12) + var(--turn-space-12));
  aspect-ratio: 1;
  background: var(--turn-blue-200);
  -webkit-mask: url("./assets/icons/accessibility.svg") center / contain no-repeat;
  mask: url("./assets/icons/accessibility.svg") center / contain no-repeat;
}
`, `.install-accessibility-symbol {
  display: none;
  width: calc(var(--turn-space-12) + var(--turn-space-12));
  height: auto;
}

/* Keep the vendored Commons SVG as geometry only. Its visible colour comes from the
   semantic information role in every theme, so palette changes do not leak into this
   component through the source asset's embedded fill. */
.install-accessibility::before {
  content: "";
  display: block;
  width: calc(var(--turn-space-12) + var(--turn-space-12));
  aspect-ratio: 1;
  background: var(--turn-action-information);
  -webkit-mask: url("./assets/icons/accessibility.svg") center / contain no-repeat;
  mask: url("./assets/icons/accessibility.svg") center / contain no-repeat;
}
`, 'semantic accessibility mark');
css = replaceOnce(css, `  display: grid;
  gap: var(--turn-space-4);
  align-items: stretch;
}`, `  display: grid;
  gap: var(--turn-space-4);
  align-items: stretch;
  align-content: start;
}`, 'action grid content sizing');
css = replaceOnce(css, `    column-gap: var(--turn-space-8);
    row-gap: var(--turn-space-3);
    align-items: center;
  }

  html.turn-browser:not(.turn-browser-launched) #installGate:not(.turn-startup-loading) .install-copy {`, `    column-gap: var(--turn-space-8);
    row-gap: var(--turn-space-3);
    grid-auto-rows: max-content;
    align-items: center;
    align-content: start;
  }

  html.turn-browser:not(.turn-browser-launched) #installGate:not(.turn-startup-loading) .install-copy {`, 'short landscape card track sizing');
css = replaceOnce(css, `  .install-accessibility-symbol,
  :root[data-theme="dark"] .install-accessibility::before {
    width: calc(var(--turn-space-12) + var(--turn-space-6));
  }`, `  .install-accessibility::before {
    width: calc(var(--turn-space-12) + var(--turn-space-6));
  }`, 'short landscape accessibility mark sizing');
css = replaceOnce(css, `    grid-area: actions;
    width: 100%;
    margin-top: 0;
    gap: var(--turn-space-2);`, `    grid-area: actions;
    width: 100%;
    margin-top: 0;
    gap: var(--turn-space-2);
    align-self: start;
    align-content: start;`, 'short landscape action sizing');
css = replaceOnce(css, `    grid-template-columns: minmax(0, 1fr) minmax(220px, 0.95fr);
    grid-template-areas:
      "copy accessibility"
      "actions accessibility"
      "kicker kicker";`, `    grid-template-columns: minmax(0, 1fr) minmax(220px, 0.95fr);
    grid-template-rows: max-content max-content max-content;
    grid-template-areas:
      "copy accessibility"
      "actions accessibility"
      "kicker kicker";
    align-content: start;`, 'wide short landscape rows');
await write(cssPath, css);

const aboutTestPath = 'turn-tests/about-history-production.mjs';
let aboutTest = await read(aboutTestPath);
aboutTest = replaceOnce(
  aboutTest,
  "TURN is a motion-controlled arcade drift racer\\.",
  "TURN is an accessible motion-controlled arcade drift racer\\.",
  'install pitch regression copy'
);
aboutTest = replaceOnce(
  aboutTest,
  'The browser install page must use the concise product pitch from the approved mockup',
  'The browser install page must use the approved accessible product pitch',
  'install pitch regression message'
);
aboutTest = replaceOnce(aboutTest, `assert.match(browserInstallCss, /data-theme="dark"[\\s\\S]*\\.install-accessibility::before[\\s\\S]*background: var\\(--turn-blue-200\\)[\\s\\S]*assets\\/icons\\/accessibility\\.svg/,
  'Dark mode must recolour the Wikimedia accessibility mark with TURN light blue');`, `assert.match(browserInstallCss, /\\.install-accessibility::before[\\s\\S]*background: var\\(--turn-action-information\\)[\\s\\S]*assets\\/icons\\/accessibility\\.svg/,
  'The Wikimedia accessibility mark must render through the semantic information colour in every theme');`, 'install accessibility semantic-token regression');
await write(aboutTestPath, aboutTest);

const browserTestPath = 'turn-tests/install-page-browser-smoke.mjs';
await write(browserTestPath, `import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';

const origin = process.env.TURN_TEST_ORIGIN || 'http://127.0.0.1:8000';
const safariUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const viewports = [
  { width: 568, height: 320, name: 'compact landscape' },
  { width: 852, height: 393, name: 'iPhone landscape' }
];

function insideViewport(rect, width, height, label) {
  assert.ok(rect.width > 0 && rect.height > 0, label + ': visible size');
  assert.ok(rect.left >= -1 && rect.right <= width + 1 && rect.top >= -1 && rect.bottom <= height + 1,
    label + ': stays in the initial viewport ' + JSON.stringify(rect));
}

async function inspectInstallPage(browser, browserName) {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport,
      hasTouch: true,
      isMobile: true,
      userAgent: safariUA,
      reducedMotion: 'reduce',
      serviceWorkers: 'block'
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    await page.addInitScript(() => {
      try { Object.defineProperty(globalThis.navigator, 'standalone', { configurable: true, value: false }); } catch (_) {}
      try { globalThis.localStorage.clear(); } catch (_) {}
    });
    try {
      await page.goto(origin + '/turn/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('html.turn-browser:not(.turn-browser-launched) #installGate:not(.turn-startup-loading) .install-accessibility');

      for (const theme of ['light', 'dark']) {
        await page.evaluate((value) => globalThis.__turnTheme.set(value), theme);
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const facts = await page.evaluate(() => {
          const rect = (node) => {
            const box = node.getBoundingClientRect();
            return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
          };
          const gate = document.querySelector('#installGate');
          const shell = gate.querySelector('.install-shell');
          const icon = gate.querySelector('.install-icon');
          const markImage = gate.querySelector('.install-accessibility-symbol');
          const accessibility = gate.querySelector('.install-accessibility');
          const before = getComputedStyle(accessibility, '::before');
          const probe = document.createElement('i');
          probe.style.cssText = 'position:fixed;left:-1000px;top:-1000px;width:1px;height:1px;background:var(--turn-action-information)';
          document.body.append(probe);
          const semanticInformation = getComputedStyle(probe).backgroundColor;
          probe.remove();
          const buttons = [...gate.querySelectorAll('.install-actions button')].map((button) => ({
            text: button.textContent.trim().replace(/\\s+/g, ' '),
            ...rect(button)
          }));
          return {
            viewport: { width: innerWidth, height: innerHeight },
            gate: { clientWidth: gate.clientWidth, scrollWidth: gate.scrollWidth, clientHeight: gate.clientHeight, scrollHeight: gate.scrollHeight },
            shell: rect(shell),
            icon: rect(icon),
            accessibility: rect(accessibility),
            imageDisplay: getComputedStyle(markImage).display,
            markBackground: before.backgroundColor,
            semanticInformation,
            mask: before.webkitMaskImage || before.maskImage,
            buttons
          };
        });

        assert.ok(facts.gate.scrollWidth <= facts.gate.clientWidth + 1,
          browserName + ' ' + viewport.name + ' ' + theme + ': no horizontal install-page overflow');
        assert.equal(facts.imageDisplay, 'none',
          browserName + ' ' + viewport.name + ' ' + theme + ': source SVG is geometry only');
        assert.equal(facts.markBackground, facts.semanticInformation,
          browserName + ' ' + viewport.name + ' ' + theme + ': accessibility mark uses semantic information colour');
        assert.match(facts.mask, /accessibility\\.svg/,
          browserName + ' ' + viewport.name + ' ' + theme + ': accessibility mark uses the local SVG mask');
        assert.equal(facts.buttons.length, 2, browserName + ' ' + viewport.name + ': both browser actions exist');
        for (const button of facts.buttons) {
          assert.ok(button.height <= 96,
            browserName + ' ' + viewport.name + ' ' + theme + ': action must stay content-sized, got ' + button.text + ' at ' + button.height + 'px');
          assert.ok(button.width > 0 && button.right <= facts.viewport.width + 1 && button.left >= -1,
            browserName + ' ' + viewport.name + ' ' + theme + ': action stays horizontally reachable');
        }
        if (viewport.width >= 760) {
          insideViewport(facts.icon, facts.viewport.width, facts.viewport.height,
            browserName + ' ' + viewport.name + ' ' + theme + ' app mark');
          assert.ok(facts.accessibility.top < facts.viewport.height && facts.accessibility.bottom > 0,
            browserName + ' ' + viewport.name + ' ' + theme + ': accessibility summary starts in the initial viewport');
        }
      }

      await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const enlarged = await page.evaluate(() => {
        const gate = document.querySelector('#installGate');
        return {
          clientWidth: gate.clientWidth,
          scrollWidth: gate.scrollWidth,
          buttons: [...gate.querySelectorAll('.install-actions button')].map((button) => button.getBoundingClientRect().height)
        };
      });
      assert.ok(enlarged.scrollWidth <= enlarged.clientWidth + 1,
        browserName + ' ' + viewport.name + ': enlarged install text reflows horizontally');
      assert.ok(enlarged.buttons.every((height) => height <= 144),
        browserName + ' ' + viewport.name + ': enlarged actions remain content-sized (' + enlarged.buttons.join(', ') + ')');
    } finally {
      await context.close();
    }
  }
}

for (const name of (process.env.TURN_INSTALL_BROWSERS || 'chromium,webkit').split(',')) {
  const browserType = { chromium, webkit }[name];
  assert.ok(browserType, 'Known browser: ' + name);
  const browser = await browserType.launch({ headless: true });
  try {
    await inspectInstallPage(browser, name);
    console.log(name + ': install page stays compact in short landscape, uses semantic icon colour and reflows at enlarged text.');
  } finally {
    await browser.close();
  }
}
`);

const workflowPath = '.github/workflows/turn-support-feedback-browser.yml';
let workflow = await read(workflowPath);
const pathAnchor = `      - 'turn/scripts/release.mjs'\n      - 'turn-tests/support-feedback-browser-smoke.mjs'`;
const pathReplacement = `      - 'turn/scripts/release.mjs'\n      - 'turn/browser-install-r165.css'\n      - 'turn/ui/about-history-bootstrap-r165.js'\n      - 'turn-tests/install-page-browser-smoke.mjs'\n      - 'turn-tests/support-feedback-browser-smoke.mjs'`;
assert.equal(workflow.split(pathAnchor).length - 1, 2, 'Browser workflow has pull-request and push path anchors');
workflow = workflow.replaceAll(pathAnchor, pathReplacement);
workflow = replaceOnce(workflow, `          - shard: responsive\n            tests: >-\n              turn-tests/responsive-browser-smoke.mjs`, `          - shard: responsive\n            tests: >-\n              turn-tests/install-page-browser-smoke.mjs\n              turn-tests/responsive-browser-smoke.mjs`, 'responsive browser shard');
await write(workflowPath, workflow);
