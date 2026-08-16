import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const hierarchy = fs.readFileSync(path.join(root, 'hierarchy.css'), 'utf8');
const foundation = fs.readFileSync(path.join(root, 'runtime', 'app-foundation.js'), 'utf8');
const interaction = fs.readFileSync(path.join(root, 'runtime', 'interaction-boot.js'), 'utf8');
const tutorial = fs.readFileSync(path.join(root, 'runtime', 'tutorial.js'), 'utf8');
const region = fs.readFileSync(path.join(root, 'runtime', 'scene-region.js'), 'utf8');

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'HTML IDs must be unique');

for (const id of [
  'scene', 'scene-fallback', 'pause-btn', 'help-btn', 'incoming-btn', 'clock',
  'metric-ontime', 'metric-flow', 'metric-issues', 'focus-btn', 'find-btn',
  'action-dock', 'action-primary', 'action-details', 'package-rail', 'flow-feedback', 'sheet'
]) assert.ok(ids.includes(id), `Missing required UI hook #${id}`);

assert.match(html, /<canvas[^>]+aria-label=/, 'The interactive scene needs an accessible name');
assert.match(html, /<dialog[^>]+aria-labelledby="sheet-title"/, 'The bottom sheet needs an accessible name');
assert.match(html, /id="package-rail"[^>]+role="list"/, 'The persistent package rail needs list semantics');
assert.match(html, /id="action-primary"[^>]*>SELECT</, 'The direct action must be visible in the main HUD');
assert.doesNotMatch(html, /scene-help-btn|event-ribbon/, 'Retired duplicate and event-only controls must stay removed');

assert.doesNotMatch(foundation, /oopi\.glb/i, 'Alien workers must not return');
const characterModels = [...foundation.matchAll(/character-(?:female|male)-[a-f]\.glb/g)].map(match => match[0]);
assert.equal(new Set(characterModels).size, 9, 'Each depot worker needs a distinct Mini Character model');
assert.match(foundation, /treeClusterTall/);
assert.match(interaction, /app\.packageRail\.addEventListener\('click'/);
assert.match(interaction, /simulation\.dispatchTruck/);
assert.doesNotMatch(interaction, /showBriefingSheet\(\{\s*firstRun|needsFirstShiftBriefing/, 'The first day must be played, not opened as a modal briefing');
assert.match(tutorial, /select-package[\s\S]*choose-focus[\s\S]*select-chicago[\s\S]*send-national[\s\S]*send-timra/);
assert.match(region, /function roadRotationFor\(dx, dz\)[\s\S]*Math\.atan2\(dx, dz\)/, 'Road tiles must derive orientation from their route vector');
assert.match(region, /addRegionEdgeNature\(cityId\)/, 'Region edges need deliberate nature framing');
assert.match(foundation, /city-kit-roads|kenney\/roads/);
assert.match(css, /env\(safe-area-inset-top/);
assert.match(css, /prefers-reduced-motion/);
assert.match(hierarchy, /\.sheet\[open\][\s\S]*max-height:\s*min\(56dvh/, 'Information sheets must preserve a visible world above them');

const assetPaths = [...foundation.matchAll(/['"](\.\/assets\/[^'"]+)['"]/g)].map(match => match[1]);
assert.ok(assetPaths.length >= 30, 'The visual manifest should include the full diorama set');
for (const assetPath of assetPaths) {
  const absolutePath = path.join(root, assetPath);
  assert.ok(fs.existsSync(absolutePath), `Missing visual asset ${assetPath}`);
  if (!assetPath.endsWith('.glb')) continue;
  const glb = fs.readFileSync(absolutePath);
  assert.equal(glb.toString('ascii', 0, 4), 'glTF', `Invalid GLB header in ${assetPath}`);
  const jsonLength = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8').replace(/\0+$/g, ''));
  for (const image of json.images || []) {
    if (!image.uri || image.uri.startsWith('data:')) continue;
    const texturePath = path.resolve(path.dirname(absolutePath), decodeURIComponent(image.uri));
    assert.ok(fs.existsSync(texturePath), `Missing texture ${image.uri} required by ${assetPath}`);
  }
}

console.log('POSTAL UI contract tests passed');
