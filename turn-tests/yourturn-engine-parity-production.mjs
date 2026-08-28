import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [turnIndex, yourTurnIndex, yourTurnApp, yourTurnSession, releaseSource] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/session.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);

function readImportMap(source, label) {
  const match = source.match(/<script\s+type="importmap">\s*([\s\S]*?)\s*<\/script>/i);
  assert.ok(match, `${label} must expose an import map`);
  return JSON.parse(match[1]);
}

function canonicalScriptUrl(source, basename, baseUrl, label) {
  const sources = [...source.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/gi)]
    .map((match) => match[1]);
  const sourceUrl = sources.find((value) => new URL(value, baseUrl).pathname.endsWith(`/${basename}`));
  assert.ok(sourceUrl, `${label} must load ${basename}`);
  return new URL(sourceUrl, baseUrl).href;
}

function resolveImport(importMap, specifier, baseUrl) {
  const imports = importMap.imports || {};
  if (imports[specifier]) return new URL(imports[specifier], baseUrl).href;

  const requestedUrl = new URL(specifier, baseUrl).href;
  for (const [key, target] of Object.entries(imports)) {
    if (new URL(key, baseUrl).href === requestedUrl) return new URL(target, baseUrl).href;
  }
  return requestedUrl;
}

const turnImportMap = readImportMap(turnIndex, 'TURN');
const yourTurnImportMap = readImportMap(yourTurnIndex, 'YOUR TURN');
const motionSpecifier = '/turn/input/motion.js';

assert.equal(
  yourTurnImportMap.imports?.[motionSpecifier],
  turnImportMap.imports?.[motionSpecifier],
  'YOUR TURN must resolve the canonical motion input module through the exact production TURN route'
);
assert.match(
  yourTurnImportMap.imports?.[motionSpecifier] || '',
  /ipad-motion-profile/,
  'The shared production motion route must include the iPad steering profile cache bust'
);

for (const catalogSpecifier of [
  '/turn/vehicle/catalog.js?build=20260720-r19',
  '/turn/vehicle/catalog.js?build=20260720-r20'
]) {
  const turnCatalogUrl = new URL(
    resolveImport(turnImportMap, catalogSpecifier, 'https://enkel.design/turn/')
  );
  const yourTurnCatalogUrl = new URL(
    resolveImport(yourTurnImportMap, catalogSpecifier, 'https://enkel.design/yourturn/')
  );
  assert.equal(
    yourTurnCatalogUrl.href,
    turnCatalogUrl.href,
    `YOUR TURN must use TURN's exact canonical vehicle catalog route for ${catalogSpecifier}`
  );
  assert.equal(yourTurnCatalogUrl.pathname, '/turn/vehicle/catalog.js');
  assert.match(
    yourTurnCatalogUrl.search,
    /r219-canonical-vehicle-catalog/,
    'TURN and YOUR TURN must cache-bust the shared vehicle catalog instead of carrying stale or separate data'
  );
}

for (const carModelSpecifier of [
  '/turn/vehicle/car-models.js?build=20260720-r19',
  '/turn/vehicle/car-models.js?build=20260720-r22'
]) {
  assert.equal(
    resolveImport(yourTurnImportMap, carModelSpecifier, 'https://enkel.design/yourturn/'),
    resolveImport(turnImportMap, carModelSpecifier, 'https://enkel.design/turn/'),
    `YOUR TURN must load the current production car factory for ${carModelSpecifier}`
  );
}

for (const basename of ['motion-safe-zone.js', 'orientation-compat.js']) {
  assert.equal(
    canonicalScriptUrl(yourTurnIndex, basename, 'https://enkel.design/yourturn/', 'YOUR TURN'),
    canonicalScriptUrl(turnIndex, basename, 'https://enkel.design/turn/', 'TURN'),
    `YOUR TURN must load the exact production TURN ${basename} bootstrap URL`
  );
}

assert.doesNotMatch(
  yourTurnIndex,
  /\/yourturn\/(?:input\/)?motion[^"']*\.js/i,
  'YOUR TURN must not grow a challenge-specific copy of the motion steering engine'
);
assert.doesNotMatch(
  yourTurnIndex,
  /\/yourturn\/(?:vehicle\/)?catalog[^"']*\.js/i,
  'YOUR TURN must not grow a challenge-specific copy of vehicle attributes or tuning'
);

assert.match(
  yourTurnApp,
  /installMotionLifecycleBridge\(\{ platform: webPlatform \}\)/,
  'YOUR TURN must install TURN’s production motion lifecycle bridge'
);
assert.doesNotMatch(
  yourTurnApp,
  /__turnMotionLifecycle\?\.uninstall|__turnMotionLifecycle\.uninstall/,
  'YOUR TURN must never tear down TURN’s canonical motion lifecycle after startup'
);
assert.doesNotMatch(
  `${yourTurnApp}\n${yourTurnSession}`,
  /addEventListener\(['"]devicemotion/,
  'YOUR TURN orchestration must not own a parallel device-motion subscription'
);
assert.doesNotMatch(
  `${yourTurnApp}\n${yourTurnSession}`,
  /neutralRoll\s*=|horizonRollReference\s*=/,
  'YOUR TURN orchestration must not rewrite TURN steering calibration state'
);
assert.doesNotMatch(
  yourTurnIndex,
  /start-axis-guard\.js/,
  'YOUR TURN must not wrap TURN race start with a challenge-specific motion guard'
);

assert.match(
  yourTurnIndex,
  /\/turn\/design-semantic\.css\?revision=r593-yourturn-parity/,
  'YOUR TURN must consume TURN’s semantic control colors so BOOST/GAS/DRIFT/BRAKE stay visually current'
);
assert.match(
  yourTurnIndex,
  new RegExp(`/turn/drive-pad\\.css\\?build=${release.cacheKey}&source=yourturn-r593`),
  'YOUR TURN must use a fresh production drive-pad cache identity'
);
assert.match(
  yourTurnImportMap.imports?.['/yourturn/session.js?revision=r3'] || '',
  /r595-landscape-recalibrate/,
  'YOUR TURN must cache-bust the canonical-motion session handoff while preserving canonical TURN steering ownership'
);

console.log('YOUR TURN production steering, controls and vehicle parity contract passed.');
