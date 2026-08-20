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

console.log('YOUR TURN production motion/orientation parity contract passed.');
