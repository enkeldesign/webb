import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from 'playwright';
import { PNG } from 'pngjs';

const baseUrl = process.env.TURN_VISUAL_BASE_URL || 'http://127.0.0.1:8000';
const outputDir = process.env.TURN_RIVAL_PAINT_OUTPUT || 'rival-paint-diagnostic-artifact';
await fs.mkdir(outputDir, { recursive: true });

const cases = [
  { mode: 'direct-normal', paint: 'custom' },
  { mode: 'direct-ghost', paint: 'custom' },
  { mode: 'direct-ghost', paint: 'factory' },
  { mode: 'onboarding', paint: 'custom' },
  { mode: 'onboarding', paint: 'factory' }
];

const browserTypes = [
  ['chromium', chromium],
  ['webkit', webkit]
];
const report = {};

for (const [browserName, browserType] of browserTypes) {
  const launchOptions = browserName === 'chromium'
    ? { headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] }
    : { headless: true };
  const browser = await browserType.launch(launchOptions);
  const context = await browser.newContext({
    viewport: { width: 640, height: 360 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce'
  });
  const results = {};

  try {
    for (const diagnosticCase of cases) {
      const page = await context.newPage();
      const browserErrors = [];
      page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') browserErrors.push(`console error: ${message.text()}`);
      });

      const key = `${diagnosticCase.mode}-${diagnosticCase.paint}`;
      let failure = null;
      let metrics = null;
      let pixels = null;
      try {
        const response = await page.goto(
          `${baseUrl}/turn-lab/rival-paint-visual.html?mode=${diagnosticCase.mode}&paint=${diagnosticCase.paint}`,
          { waitUntil: 'domcontentloaded', timeout: 90_000 }
        );
        assert.equal(response?.ok(), true, `${browserName} ${key} fixture must load`);
        await page.waitForFunction(
          () => globalThis.__rivalPaintDiagnosticReady === true || Boolean(globalThis.__rivalPaintDiagnosticFailure),
          null,
          { timeout: 20_000 }
        );
        failure = await page.evaluate(() => globalThis.__rivalPaintDiagnosticFailure || null);
        metrics = await page.evaluate(() => globalThis.__rivalPaintDiagnosticMetrics || null);
        if (!failure) {
          const selector = diagnosticCase.mode === 'onboarding'
            ? '.rival-onboarding-model canvas'
            : '#direct-host canvas';
          const canvas = page.locator(selector);
          const image = await canvas.screenshot({
            path: path.join(outputDir, `${browserName}-${key}.png`)
          });
          pixels = pixelMetrics(image);
        } else {
          await page.screenshot({
            path: path.join(outputDir, `${browserName}-${key}-failure.png`),
            fullPage: true
          }).catch(() => {});
        }
      } catch (error) {
        failure = String(error?.stack || error?.message || error);
        await page.screenshot({
          path: path.join(outputDir, `${browserName}-${key}-exception.png`),
          fullPage: true
        }).catch(() => {});
      } finally {
        await page.close();
      }

      results[key] = { metrics, pixels, browserErrors, failure };
    }
  } finally {
    await browser.close();
  }

  const directCustom = results['direct-normal-custom'];
  const ghostCustom = results['direct-ghost-custom'];
  const ghostFactory = results['direct-ghost-factory'];
  const onboardingCustom = results['onboarding-custom'];
  const onboardingFactory = results['onboarding-factory'];

  for (const [key, result] of Object.entries(results)) {
    assert.equal(result.failure, null, `${browserName} ${key} failed: ${result.failure}`);
    assert.equal(result.browserErrors.length, 0, `${browserName} ${key} browser errors: ${result.browserErrors.join('\n')}`);
    assert.ok(result.pixels?.opaque > 0, `${browserName} ${key} must produce pixels`);
  }

  assert.equal(directCustom.metrics?.visualColor, '#ff0000', `${browserName} direct visual must retain custom body data`);
  assert.equal(ghostCustom.metrics?.visualColor, '#ff0000', `${browserName} ghost visual must retain custom body data`);
  assert.ok(directCustom.metrics?.semanticRecordCount > 0, `${browserName} direct custom visual must install semantic paint records`);
  assert.ok(ghostCustom.metrics?.semanticRecordCount > 0, `${browserName} custom ghost must install semantic paint records`);

  const customCreateCalls = onboardingCustom.metrics?.createCalls || [];
  assert.equal(customCreateCalls.length, 1,
    `${browserName} CHASE YOUR BEST must not replace the prepared custom rival with a second factory-colour preview`);
  assert.equal(customCreateCalls[0]?.color, '#ff0000',
    `${browserName} CHASE YOUR BEST must construct the saved custom body colour`);
  assert.equal(customCreateCalls[0]?.secondaryColor, '#0000ff',
    `${browserName} CHASE YOUR BEST must construct the saved custom secondary colour`);

  const classification = {
    directNormalCustomRed: directCustom.pixels.redDominant,
    directGhostCustomRed: ghostCustom.pixels.redDominant,
    directGhostFactoryRed: ghostFactory.pixels.redDominant,
    onboardingCustomRed: onboardingCustom.pixels.redDominant,
    onboardingFactoryRed: onboardingFactory.pixels.redDominant,
    directGhostPaintVisible: ghostCustom.pixels.redDominant > ghostFactory.pixels.redDominant + 12,
    onboardingPaintVisible: onboardingCustom.pixels.redDominant > onboardingFactory.pixels.redDominant + 100,
    onboardingPillCarriesCustomPaint:
      onboardingCustom.metrics?.pillColor === onboardingCustom.metrics?.expectedGhostColor
  };

  assert.equal(classification.directGhostPaintVisible, true,
    `${browserName} direct ghost control must visibly render its custom paint`);
  assert.equal(classification.onboardingPaintVisible, true,
    `${browserName} CHASE YOUR BEST must visibly render the saved custom paint instead of factory paint`);
  assert.equal(classification.onboardingPillCarriesCustomPaint, true,
    `${browserName} CHASE YOUR BEST pill must stay coupled to the saved custom paint`);

  report[browserName] = { results, classification };
  console.log(`${browserName}: ${JSON.stringify(classification)}`);
}

await fs.writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log('TURN CHASE YOUR BEST custom-paint browser regression passed in Chromium and WebKit.');

function pixelMetrics(buffer) {
  const image = PNG.sync.read(buffer);
  let opaque = 0;
  let redDominant = 0;
  let blueDominant = 0;
  let tealDominant = 0;
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const r = image.data[offset];
    const g = image.data[offset + 1];
    const b = image.data[offset + 2];
    const a = image.data[offset + 3];
    if (a < 16) continue;
    opaque += 1;
    if (r > 115 && r > g * 1.16 && r > b * 1.16) redDominant += 1;
    if (b > 115 && b > r * 1.16 && b > g * 1.16) blueDominant += 1;
    if (g > r * 1.08 && b > r * 1.08 && Math.abs(g - b) < 45) tealDominant += 1;
  }
  return { width: image.width, height: image.height, opaque, redDominant, blueDominant, tealDominant };
}
