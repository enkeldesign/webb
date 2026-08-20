import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [turnIndex, yourTurnIndex] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/index.html', import.meta.url), 'utf8')
]);

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
  assert.equal(
    resolveImport(yourTurnImportMap, catalogSpecifier, 'https://enkel.design/yourturn/'),
    resolveImport(turnImportMap, catalogSpecifier, 'https://enkel.design/turn/'),
    `YOUR TURN must resolve ${catalogSpecifier} through the same canonical vehicle definition as TURN`
  );
  assert.match(
    resolveImport(yourTurnImportMap, catalogSpecifier, 'https://enkel.design/yourturn/'),
    /r588-canonical-attributes/,
    'TURN and YOUR TURN must share the fresh canonical attribute/tuning graph'
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

console.log('YOUR TURN production motion/orientation and canonical vehicle-attribute parity contract passed.');