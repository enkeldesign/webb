import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const foundation = fs.readFileSync(path.join(root, 'runtime', 'app-foundation.js'), 'utf8');

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'HTML IDs must be unique');

for (const id of ['scene', 'scene-fallback', 'pause-btn', 'clock', 'metric-ontime', 'metric-flow', 'metric-issues', 'focus-btn', 'find-btn', 'event-ribbon', 'sheet']) {
  assert.ok(ids.includes(id), `Missing required UI hook #${id}`);
}

assert.match(html, /<canvas[^>]+aria-label=/, 'The interactive scene needs an accessible name');
assert.match(html, /<dialog[^>]+aria-labelledby="sheet-title"/, 'The bottom sheet needs an accessible name');
assert.doesNotMatch(foundation, /oopi\.glb/i, 'Alien workers must not return');
assert.match(foundation, /character-female-c\.glb/);
assert.match(foundation, /character-male-c\.glb/);
assert.match(foundation, /city-kit-roads|kenney\/roads/);
assert.match(css, /env\(safe-area-inset-top/);
assert.match(css, /prefers-reduced-motion/);

const assetPaths = [...foundation.matchAll(/['"](\.\/assets\/[^'"]+)['"]/g)].map(match => match[1]);
assert.ok(assetPaths.length >= 30, 'The visual manifest should include the full diorama set');
for (const assetPath of assetPaths) {
  assert.ok(fs.existsSync(path.join(root, assetPath)), `Missing visual asset ${assetPath}`);
}

console.log('POSTAL UI contract tests passed');
