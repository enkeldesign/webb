import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const productionAppPath = path.join(repositoryRoot, 'turn', 'app.js');
const releasePath = path.join(repositoryRoot, 'turn', 'release.json');
const outputPath = path.join(repositoryRoot, 'turn-next', 'app.js');

function replaceRequired(source, search, replacement, label) {
  const firstIndex = source.indexOf(search);
  assert.notEqual(firstIndex, -1, `TURN NEXT bootstrap generation could not find ${label}.`);
  assert.equal(
    source.indexOf(search, firstIndex + search.length),
    -1,
    `TURN NEXT bootstrap generation found more than one ${label}.`
  );
  return source.slice(0, firstIndex) + replacement + source.slice(firstIndex + search.length);
}

export function buildTurnNextApp(productionApp, release) {
  let output = productionApp;

  output = replaceRequired(
    output,
    "const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';\n\nfunction withBuild(path) {\n  const url = new URL(path, import.meta.url);",
    "const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';\nconst productionModuleBase = new URL('/turn/', globalThis.location?.href || 'https://enkel.design/turn-next/');\nconst platformModuleBase = new URL('/turn/platform/', globalThis.location?.href || 'https://enkel.design/turn-next/');\nconst turnNextModuleBase = new URL('/turn-next/', globalThis.location?.href || 'https://enkel.design/turn-next/');\n\nfunction withBuild(path) {\n  const url = new URL(path, productionModuleBase);",
    'module URL resolver'
  );

  output = replaceRequired(
    output,
    'function installStylesheet(path, dataAttribute) {',
    `const { createWebPlatform } = await import(new URL('./web-platform.js', platformModuleBase).href);
const { installTurnPlatform } = await import(new URL('./platform-context.js', platformModuleBase).href);
const webPlatform = createWebPlatform();
installTurnPlatform(webPlatform);
document.documentElement.dataset.turnPlatform = 'web-adapter';
const turnNextBadgeDetail = document.querySelector('.turn-next-badge span');
if (turnNextBadgeDetail) turnNextBadgeDetail.textContent += ' · Platform M1 · Safe Zone M3 · Limit M4.2';

const steadyLimitStylesheet = document.createElement('link');
steadyLimitStylesheet.rel = 'stylesheet';
steadyLimitStylesheet.href = new URL(
  './steering-limit-warning.css?source=${release.cacheKey}&stage=inertial-limit-m4-2',
  turnNextModuleBase
).href;
steadyLimitStylesheet.setAttribute('data-turn-next-steady-limit', '');
document.head.appendChild(steadyLimitStylesheet);

function installStylesheet(path, dataAttribute) {`,
    'platform composition point'
  );

  output = replaceRequired(
    output,
    'installTurnAudio();',
    `installTurnAudio();

const { installTurnNextSteeringLimitWarning } = await import(
  new URL('./steering-limit-warning.js?source=${release.cacheKey}&stage=inertial-limit-m4-2', turnNextModuleBase).href
);
installTurnNextSteeringLimitWarning();`,
    'directional limit warning composition point'
  );

  output = replaceRequired(
    output,
    "console.info(`TURN: ${globalThis.__TURN_BUILD__?.id || 'development'} loaded from the static module graph.`);",
    "console.info(`TURN NEXT: ${globalThis.__TURN_BUILD__?.id || 'development'} loaded through the isolated staging bootstrap.`);",
    'bootstrap completion log'
  );

  output = `// Generated from turn/app.js for TURN ${release.id}. Do not edit by hand.\n${output}`;

  assert.match(output, /const productionModuleBase = new URL\('\/turn\/'/);
  assert.match(output, /const platformModuleBase = new URL\('\/turn\/platform\/'/);
  assert.match(output, /const turnNextModuleBase = new URL\('\/turn-next\/'/);
  assert.match(output, /installTurnPlatform\(webPlatform\)/);
  assert.match(output, /data-turn-next-steady-limit/);
  assert.match(output, /steering-limit-warning\.css\?source=.*&stage=inertial-limit-m4-2/);
  assert.match(output, /installTurnNextSteeringLimitWarning\(\)/);
  assert.match(output, /steering-limit-warning\.js\?source=.*&stage=inertial-limit-m4-2/);
  assert.match(output, /dataset\.turnPlatform = 'web-adapter'/);
  assert.match(output, /Platform M1 · Safe Zone M3 · Limit M4\.2/);
  assert.doesNotMatch(output, /orientation-freeze|installTurnNextOrientationFreeze|Orientation M2/);
  assert.ok(
    output.indexOf('installTurnPlatform(webPlatform)') < output.indexOf("withBuild('./main.js')"),
    'TURN NEXT must install its platform before the game core loads.'
  );
  assert.ok(
    output.indexOf('installTurnNextSteeringLimitWarning()') < output.indexOf("withBuild('./main.js')"),
    'TURN NEXT must install directional limit feedback before the game core starts.'
  );
  assert.match(output, /new URL\(path, productionModuleBase\)/);
  assert.doesNotMatch(output, /new URL\(path, import\.meta\.url\)/);
  assert.match(output, /TURN NEXT:/);

  return output;
}

async function main() {
  const [productionApp, releaseSource] = await Promise.all([
    fs.readFile(productionAppPath, 'utf8'),
    fs.readFile(releasePath, 'utf8')
  ]);
  const release = JSON.parse(releaseSource);
  const generated = buildTurnNextApp(productionApp, release);

  if (process.argv.includes('--check')) {
    const current = await fs.readFile(outputPath, 'utf8').catch(() => null);
    assert.equal(
      current,
      generated,
      'turn-next/app.js is stale. Run node turn-next/scripts/build-parity-app.mjs.'
    );
    console.log(`TURN NEXT bootstrap matches TURN ${release.id}.`);
    return;
  }

  await fs.writeFile(outputPath, generated);
  console.log(`Generated turn-next/app.js from TURN ${release.id}.`);
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  await main();
}
