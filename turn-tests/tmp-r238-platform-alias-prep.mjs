import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const release = JSON.parse(fs.readFileSync('turn/release.json', 'utf8'));
if (release.id !== '2026.09.15-r238' || release.cacheKey !== '20260915-r238') {
  throw new Error(`Unexpected prepared release: ${JSON.stringify(release)}`);
}

const canonicalKey = '/turn/platform/platform-context.js';
const canonicalValue = `${canonicalKey}?build=${release.cacheKey}`;

function addPlatformAlias(path) {
  let source = fs.readFileSync(path, 'utf8');
  if (source.includes(`"${canonicalKey}": "${canonicalValue}"`)) return;
  const marker = /^(\s*)"three\/addons\/":\s*"[^"]+",$/m;
  const match = source.match(marker);
  if (!match) throw new Error(`Import-map insertion point not found in ${path}`);
  source = source.replace(marker, `${match[0]}\n${match[1]}"${canonicalKey}": "${canonicalValue}",`);
  fs.writeFileSync(path, source);
}

addPlatformAlias('turn/index.html');
addPlatformAlias('turn-lab/index.html');
addPlatformAlias('yourturn/index.html');

// Refresh TURN NEXT's parity identity first, then canonicalize its own import map.
execFileSync('node', ['turn-next/scripts/build-parity-entry.mjs'], { stdio: 'inherit' });
addPlatformAlias('turn-next/index.html');

const testPath = 'turn-tests/platform-production.mjs';
let testSource = fs.readFileSync(testPath, 'utf8');
const marker = `assert.match(platformContextSource, /Symbol\\.for\\('turn\\.platform\\.context'\\)/);
assert.doesNotMatch(platformContextSource, /let installedPlatform = null/);
assert.match(productionApp`;
const replacement = `assert.match(platformContextSource, /Symbol\\.for\\('turn\\.platform\\.context'\\)/);
assert.doesNotMatch(platformContextSource, /let installedPlatform = null/);

const releaseIdentity = JSON.parse(fs.readFileSync(new URL('../turn/release.json', import.meta.url), 'utf8'));
const canonicalPlatformContext = '/turn/platform/platform-context.js?build=' + releaseIdentity.cacheKey;
for (const [shellName, shellPath] of [
  ['TURN', '../turn/index.html'],
  ['TURN NEXT', '../turn-next/index.html'],
  ['TURN LAB', '../turn-lab/index.html'],
  ['YOUR TURN', '../yourturn/index.html']
]) {
  const shellSource = fs.readFileSync(new URL(shellPath, import.meta.url), 'utf8');
  assert.ok(
    shellSource.includes('"/turn/platform/platform-context.js": "' + canonicalPlatformContext + '"'),
    shellName + ' must resolve platform-context.js to the current TURN build identity'
  );
}

assert.match(productionApp`;
if (!testSource.includes(marker)) throw new Error('Platform shell identity assertion insertion point not found');
testSource = testSource.replace(marker, replacement);
fs.writeFileSync(testPath, testSource);

execFileSync('node', ['turn/scripts/release.mjs', '--write'], { stdio: 'inherit' });
execFileSync('node', ['turn-next/scripts/build-parity-entry.mjs', '--check'], { stdio: 'inherit' });
execFileSync('node', ['turn-tests/platform-production.mjs'], { stdio: 'inherit' });
execFileSync('node', ['turn-tests/release-composition-production.mjs', '--base', '5bd501a2a585ce30fac19432c46c1b6d19bcbc0c'], { stdio: 'inherit' });
