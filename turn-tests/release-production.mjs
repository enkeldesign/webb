import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { checkReleaseFiles, loadReleaseDefinition } from '../turn/scripts/release.mjs';

const [release, index, app, main, manifest, workflow] = await Promise.all([
  loadReleaseDefinition(),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/site.webmanifest', import.meta.url), 'utf8'),
  fs.readFile(new URL('../.github/workflows/turn-lab-tests.yml', import.meta.url), 'utf8')
]);

await checkReleaseFiles();

const visibleBuild = `TURN v${release.version} · Build ${release.id}`;
assert.match(index, new RegExp(escapeRegExp(`<title>${visibleBuild}</title>`)));
assert.equal(index.split(visibleBuild).length - 1, 3, 'Title, install gate and start card must share one visible release identity');
assert.match(index, new RegExp(`version: '${escapeRegExp(release.version)}'`));
assert.match(index, new RegExp(`id: '${escapeRegExp(release.id)}'`));
assert.match(index, new RegExp(`cacheKey: '${escapeRegExp(release.cacheKey)}'`));

const attributeBuilds = [...index.matchAll(/(?:href|src)="\.\/[^"?]+\?build=([^"&]+)/g)].map((match) => match[1]);
assert.ok(attributeBuilds.length >= 15, 'Production entry document must cache-bust its local assets');
assert.deepEqual(new Set(attributeBuilds), new Set([release.cacheKey]), 'Every entry asset must use the release cache key');

const importMapText = index.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
assert.ok(importMapText, 'Production must retain the external Three.js import map');
const importMap = JSON.parse(importMapText);
assert.match(importMap.imports.three, /^https:\/\/cdn\.jsdelivr\.net\/npm\/three@/);
for (const [specifier, target] of Object.entries(importMap.imports)) {
  if (!target.startsWith('./')) continue;
  assert.equal(new URL(target, 'https://enkel.design/turn/').searchParams.get('build'), release.cacheKey, `${specifier} must resolve through the current release cache key`);
}

assert.match(app, /const buildKey = globalThis\.__TURN_BUILD__\?\.cacheKey/);
assert.match(app, /function withBuild\(path\)/);
assert.match(app, /await import\(withBuild\('\.\/main\.js'\)\)/);

for (const anchor of [
  "from './race/game-state.js'",
  "from './race/lap-system.js?build=20260720-r19'",
  "from './race/replay-system.js'",
  "from './race/rival-storage.js?build=20260720-r19'",
  "from './vehicle/physics.js?build=20260720-r19'",
  'updateVehiclePhysicsState({',
  'updateLapProgressState({',
  'globalThis.__turnRuntime = turnRuntime;'
]) {
  assert.ok(main.includes(anchor), `Production main.js is missing architecture anchor: ${anchor}`);
}

const manifestData = JSON.parse(manifest);
assert.equal(manifestData.start_url, '/turn/');
assert.equal(manifestData.scope, '/turn/');
assert.equal(manifestData.orientation, 'landscape');
assert.ok(manifestData.icons.some((icon) => icon.purpose === 'maskable'));

assert.match(workflow, /node turn\/scripts\/release\.mjs --check/);
assert.match(workflow, /node turn-tests\/release-production\.mjs/);
assert.doesNotMatch(workflow, /node turn-lab\/scripts\/check-release\.mjs/, 'CI must verify the production release rather than the retired playable lab snapshot');

console.log(`TURN ${release.id} production release architecture passed.`);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
