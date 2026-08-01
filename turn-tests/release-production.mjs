import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { checkReleaseFiles, loadReleaseDefinition } from '../turn/scripts/release.mjs';

const [release, index, app, main, manifest, workflow, nextApp, nextIndex, installGate, installGateCss, orientationGuardCss] = await Promise.all([
  loadReleaseDefinition(),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/site.webmanifest', import.meta.url), 'utf8'),
  fs.readFile(new URL('../.github/workflows/turn-lab-tests.yml', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/install-gate.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/install-gate.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/orientation-guard.css', import.meta.url), 'utf8')
]);

await checkReleaseFiles();

const visibleBuild = `TURN v${release.version} · Build ${release.id}`;
assert.match(index, new RegExp(escapeRegExp(`<title>${visibleBuild}</title>`)));
assert.equal(
  index.split(visibleBuild).length - 1,
  2,
  'Title and install onboarding must share the static release identity; Home receives it from the runtime source of truth'
);
assert.match(index, new RegExp(`version: '${escapeRegExp(release.version)}'`));
assert.match(index, new RegExp(`id: '${escapeRegExp(release.id)}'`));
assert.match(index, new RegExp(`cacheKey: '${escapeRegExp(release.cacheKey)}'`));
assert.match(index, new RegExp(`install-gate\\.js\\?build=${escapeRegExp(release.cacheKey)}-browser-consent`));
assert.match(index, new RegExp(`install-gate\\.css\\?build=${escapeRegExp(release.cacheKey)}-browser-consent`));
assert.match(index, new RegExp(`orientation-guard\\.css\\?build=${escapeRegExp(release.cacheKey)}-home-portrait`));
assert.match(index, new RegExp(`app\\.js\\?build=${escapeRegExp(release.cacheKey)}-browser-consent`));
assert.match(index, /Return to landscape/);
assert.match(app, /const launchReady = globalThis\.__turnLaunchReady/);
assert.match(app, /await launchReady/);
assert.ok(app.indexOf('await launchReady') < app.indexOf('retireLegacyStartPanel()'));
assert.match(app, /const release = globalThis\.__TURN_BUILD__/);
assert.match(app, /buildLabel\.textContent = `TURN V\$\{release\?\.version \|\| ''\} · BUILD \$\{\(release\?\.id \|\| ''\)\.toUpperCase\(\)\}`/);
assert.match(app, /retireLegacyStartPanel\(\)/);
assert.doesNotMatch(index, /class="start-card"/);

assert.match(installGate, /globalThis\.__turnLaunchReady = launchReady/);
assert.match(installGate, /browserButton\.addEventListener\('click', \(\) => startBrowserGame\(gate\)\)/);
assert.doesNotMatch(installGate, /sessionStorage|turn-play-in-browser/);
assert.match(installGateCss, /\.install-gate \{[\s\S]*z-index: 2000/);
assert.match(orientationGuardCss, /\.rotate-panel \{[\s\S]*z-index: 1700/);

const attributeBuilds = [...index.matchAll(/(?:href|src)="\.\/[^"?]+\?build=([^"&]+)/g)].map((match) => match[1]);
assert.ok(attributeBuilds.length >= 15, 'Production entry document must cache-bust its local assets');
assert.ok(attributeBuilds.includes(release.cacheKey), 'The canonical release cache key must remain in use');
for (const build of attributeBuilds) {
  assert.ok(
    build === release.cacheKey || build.startsWith(`${release.cacheKey}-`),
    `Entry asset cache key ${build} must use the current release prefix`
  );
}

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
assert.match(app, /installTurnPlatform\(webPlatform\)/);
assert.match(app, /installMotionLifecycleBridge\(\{ platform: webPlatform \}\)/);
assert.match(app, /installDisplayLifecycleBridge\(\{ platform: webPlatform \}\)/);
assert.match(app, /await import\(withBuild\('\.\/main\.js'\)\)/);
assert.match(app, /installM8HomeNavigation\(\)/);
assert.match(app, /installM8HomeFixedLayout\(\)/);
assert.ok(app.indexOf('installTurnPlatform(webPlatform)') < app.indexOf("withBuild('./main.js')"));
assert.ok(app.indexOf("withBuild('./main.js')") < app.indexOf('installM8HomeNavigation()'));

for (const anchor of [
  "from '/turn/race/game-state.js'",
  "from '/turn/race/lap-system.js?build=20260720-r19'",
  "from '/turn/race/replay-system.js'",
  "from '/turn/race/rival-storage.js?build=20260720-r19'",
  "from '/turn/vehicle/physics.js?build=20260720-r19'",
  'createRaceSessionOrchestrator',
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
assert.equal(manifestData.background_color, '#08090a');
assert.equal(manifestData.theme_color, '#08090a');
assert.ok(
  manifestData.icons.some((icon) => String(icon.purpose || '').split(/\s+/).includes('maskable')),
  'Production manifest must provide a maskable-capable icon'
);

assert.match(nextIndex, new RegExp(`TURN NEXT · Source ${escapeRegExp(visibleBuild)}`));
assert.match(nextIndex, new RegExp(`/turn-next/app\\.js\\?source=${escapeRegExp(release.cacheKey)}-browser-consent`));
assert.match(nextIndex, /Return to landscape/);
assert.match(nextApp, /new URL\('\/turn\/app\.js'/);
assert.match(nextApp, /browser-consent/);
assert.match(nextApp, /await import\(url\.href\)/);
assert.doesNotMatch(nextApp, /installM8HomeNavigation|installMotionLifecycleBridge/);

assert.match(workflow, /node turn\/scripts\/release\.mjs --check/);
assert.match(workflow, /node turn-tests\/release-production\.mjs/);
assert.doesNotMatch(workflow, /node turn-lab\/scripts\/check-release\.mjs/, 'CI must verify the production release rather than the retired playable lab snapshot');

console.log(`TURN ${release.id} browser-consent and Home portrait release architecture passed.`);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
