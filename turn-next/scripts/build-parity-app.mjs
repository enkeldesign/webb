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
  assert.equal(source.indexOf(search, firstIndex + search.length), -1, `TURN NEXT bootstrap generation found more than one ${label}.`);
  return source.slice(0, firstIndex) + replacement + source.slice(firstIndex + search.length);
}

export function buildTurnNextApp(productionApp, release) {
  let output = productionApp;

  output = replaceRequired(
    output,
    "const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';\n\nfunction withBuild(path) {\n  const url = new URL(path, import.meta.url);",
    "const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';\nconst productionModuleBase = new URL('/turn/', globalThis.location?.href || 'https://enkel.design/turn-next/');\nconst platformModuleBase = new URL('/turn/platform/', globalThis.location?.href || 'https://enkel.design/turn-next/');\nconst stagingModuleBase = new URL('/turn-next/', globalThis.location?.href || 'https://enkel.design/turn-next/');\n\nfunction withBuild(path) {\n  const url = new URL(path, productionModuleBase);",
    'module URL resolver'
  );

  output = replaceRequired(
    output,
    'function installStylesheet(path, dataAttribute) {',
    "const { createWebPlatform } = await import(new URL('./web-platform.js', platformModuleBase).href);\nconst { installTurnPlatform } = await import(new URL('./platform-context.js', platformModuleBase).href);\nconst { installMotionLifecycleBridge } = await import(\n  new URL(`./motion-lifecycle-bridge.js?source=${buildKey}-m5.1`, stagingModuleBase).href\n);\nconst { installDisplayLifecycleBridge } = await import(\n  new URL(`./display-lifecycle-bridge.js?source=${buildKey}-m6`, stagingModuleBase).href\n);\nconst webPlatform = createWebPlatform();\ninstallTurnPlatform(webPlatform);\nconst motionLifecycle = installMotionLifecycleBridge({ platform: webPlatform });\nconst displayLifecycle = installDisplayLifecycleBridge({ platform: webPlatform });\nglobalThis.__turnNextMotionLifecycle = motionLifecycle;\nglobalThis.__turnNextDisplayLifecycle = displayLifecycle;\ndocument.documentElement.dataset.turnPlatform = 'web-adapter';\ndocument.documentElement.dataset.turnMotionLifecycle = 'platform-m5';\ndocument.documentElement.dataset.turnDisplayLifecycle = 'platform-m6';\nconst turnNextBadgeDetail = document.querySelector('.turn-next-badge span');\nif (turnNextBadgeDetail) turnNextBadgeDetail.textContent += ' · Platform M5–M8 · Motion + Display + Session + Home';\n\nfunction installStylesheet(path, dataAttribute) {",
    'platform composition point'
  );

  output = replaceRequired(
    output,
    "await import(withBuild('./main.js'));",
    "await import(new URL(`./main.js?source=${buildKey}-m8`, stagingModuleBase).href);\ndocument.documentElement.dataset.turnSessionLifecycle = 'orchestrator-m7';",
    'M8 race-session entry'
  );

  output = replaceRequired(
    output,
    "await import(withBuild('./ui/in-game-menu.js'));",
    "await import(withBuild('./ui/in-game-menu.js'));\nconst m8StyleAttribute = 'data-turn-m8-home-styles';\nif (!document.querySelector(`link[${m8StyleAttribute}]`)) {\n  const stylesheet = document.createElement('link');\n  stylesheet.rel = 'stylesheet';\n  stylesheet.href = new URL(`./m8-home.css?source=${buildKey}-m8`, stagingModuleBase).href;\n  stylesheet.setAttribute(m8StyleAttribute, '');\n  document.head.appendChild(stylesheet);\n}\nconst { installM8HomeNavigation } = await import(\n  new URL(`./m8-home.js?source=${buildKey}-m8`, stagingModuleBase).href\n);\nawait installM8HomeNavigation();\nconst { installM8HomeFixedLayout } = await import(\n  new URL(`./m8-home-fixed-layout.js?source=${buildKey}-m8.3`, stagingModuleBase).href\n);\nawait installM8HomeFixedLayout();\ndocument.documentElement.dataset.turnHomeLifecycle = 'home-m8';",
    'M8 home composition point'
  );

  output = replaceRequired(
    output,
    "console.info(`TURN: ${globalThis.__TURN_BUILD__?.id || 'development'} loaded from the static module graph.`);",
    "console.info(`TURN NEXT: ${globalThis.__TURN_BUILD__?.id || 'development'} loaded through the isolated M8 staging bootstrap.`);",
    'bootstrap completion log'
  );

  output = `// Generated from turn/app.js for TURN ${release.id}. Do not edit by hand.\n${output}`;

  assert.match(output, /const productionModuleBase = new URL\('\/turn\/'/);
  assert.match(output, /const platformModuleBase = new URL\('\/turn\/platform\/'/);
  assert.match(output, /const stagingModuleBase = new URL\('\/turn-next\/'/);
  assert.match(output, /motion-lifecycle-bridge\.js\?source=\$\{buildKey\}-m5\.1/);
  assert.match(output, /display-lifecycle-bridge\.js\?source=\$\{buildKey\}-m6/);
  assert.match(output, /installTurnPlatform\(webPlatform\)/);
  assert.match(output, /installMotionLifecycleBridge\(\{ platform: webPlatform \}\)/);
  assert.match(output, /installDisplayLifecycleBridge\(\{ platform: webPlatform \}\)/);
  assert.match(output, /__turnNextMotionLifecycle = motionLifecycle/);
  assert.match(output, /__turnNextDisplayLifecycle = displayLifecycle/);
  assert.match(output, /turnMotionLifecycle = 'platform-m5'/);
  assert.match(output, /turnDisplayLifecycle = 'platform-m6'/);
  assert.match(output, /turnSessionLifecycle = 'orchestrator-m7'/);
  assert.match(output, /turnHomeLifecycle = 'home-m8'/);
  assert.match(output, /main\.js\?source=\$\{buildKey\}-m8/);
  assert.match(output, /m8-home\.css\?source=\$\{buildKey\}-m8/);
  assert.match(output, /m8-home\.js\?source=\$\{buildKey\}-m8/);
  assert.match(output, /m8-home-fixed-layout\.js\?source=\$\{buildKey\}-m8\.3/);
  assert.match(output, /installM8HomeNavigation\(\)/);
  assert.match(output, /installM8HomeFixedLayout\(\)/);
  assert.match(output, /installStylesheet\('\.\/steering-limit-warning\.css'/);
  assert.match(output, /installSteeringLimitWarning\(\)/);
  assert.match(output, /Platform M5–M8 · Motion \+ Display \+ Session \+ Home/);
  assert.doesNotMatch(output, /turn-next\/steering-limit-warning|installTurnNextSteeringLimitWarning/);
  assert.ok(output.indexOf('installTurnPlatform(webPlatform)') < output.indexOf('main.js?source=${buildKey}-m8'));
  assert.ok(output.indexOf('installMotionLifecycleBridge({ platform: webPlatform })') < output.indexOf('main.js?source=${buildKey}-m8'));
  assert.ok(output.indexOf('installDisplayLifecycleBridge({ platform: webPlatform })') < output.indexOf('main.js?source=${buildKey}-m8'));
  assert.ok(output.indexOf('installSteeringLimitWarning()') < output.indexOf('main.js?source=${buildKey}-m8'));
  assert.ok(output.indexOf("withBuild('./ui/in-game-menu.js')") < output.indexOf('installM8HomeNavigation()'));
  assert.ok(output.indexOf('installM8HomeNavigation()') < output.indexOf('installM8HomeFixedLayout()'));
  assert.match(output, /new URL\(path, productionModuleBase\)/);
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
    assert.equal(current, generated, 'turn-next/app.js is stale. Run node turn-next/scripts/build-parity-app.mjs.');
    console.log(`TURN NEXT bootstrap matches TURN ${release.id}.`);
    return;
  }

  await fs.writeFile(outputPath, generated);
  console.log(`Generated turn-next/app.js from TURN ${release.id}.`);
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) await main();
