import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.TURN_VISUAL_BASE_URL || 'http://127.0.0.1:8000';
const outputDir = process.env.TURN_VISUAL_OUTPUT || 'mountain-visual-artifact';
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']
});
const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const browserErrors = [];
page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  const text = message.text();
  if (message.type() === 'error' || /failed to load|mountain .* failed/i.test(text)) {
    browserErrors.push(`console ${message.type()}: ${text}`);
  }
});

try {
  const response = await page.goto(`${baseUrl}/turn-lab/mountain-visual.html?view=aerial`, {
    waitUntil: 'networkidle',
    timeout: 60_000
  });
  assert.equal(response?.ok(), true, '4:3 MOUNTAIN visual page must load successfully');
  await page.waitForFunction(() => globalThis.__mountainVisualReady === true, null, { timeout: 60_000 });
  await page.screenshot({ path: path.join(outputDir, 'aerial-ipad-4x3.png'), fullPage: true });
} finally {
  await browser.close();
}

assert.deepEqual(browserErrors, [], `4:3 MOUNTAIN sky produced browser errors:\n${browserErrors.join('\n')}`);
console.log('TURN MOUNTAIN 4:3 iPad sky visual frame captured.');
