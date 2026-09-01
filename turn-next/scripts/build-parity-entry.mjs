import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const releasePath = path.join(repositoryRoot, 'turn', 'release.json');
const outputPath = path.join(repositoryRoot, 'turn-next', 'index.html');

export function renderParityEntry(source, release) {
  const currentBuild = source.match(
    /globalThis\.__TURN_BUILD__ = Object\.freeze\(\{\s*version: '([^']+)',\s*id: '([^']+)',\s*cacheKey: '([^']+)'\s*\}\);/
  );
  assert.ok(currentBuild, 'TURN NEXT entry must expose its source TURN build identity');

  const [, currentVersion, currentId, currentCacheKey] = currentBuild;
  return source
    .replaceAll(currentVersion, release.version)
    .replaceAll(currentId, release.id)
    .replaceAll(currentCacheKey, release.cacheKey);
}

function validateParityEntry(current, release) {
  assert.match(current, /data-turn-deployment="next"/);
  assert.match(current, /<base href="\/turn\/">/);
  assert.match(current, new RegExp(`TURN NEXT · Source TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));
  assert.match(current, new RegExp(`cacheKey: '${release.cacheKey}'`));
  assert.match(current, new RegExp(`/turn-next/storage-bootstrap\\.js\\?source=${release.cacheKey}`));
  assert.match(current, /\/turn-next\/site\.webmanifest/);
  assert.match(current, /\/turn-next\/identity\.css/);
  assert.match(current, /\/turn-next\/identity\.js/);
  assert.match(current, new RegExp(`/turn-next/app\\.js\\?source=${release.cacheKey}-browser-consent`));
  assert.match(current, new RegExp(`install-gate\\.js\\?build=${release.cacheKey}-social-browser`));
  assert.match(current, new RegExp(`install-gate\\.css\\?build=${release.cacheKey}-social-browser`));
  assert.match(current, new RegExp(`orientation-guard\\.css\\?build=${release.cacheKey}-home-portrait`));
  assert.match(current, new RegExp(`live-steering-setting\\.js\\?build=${release.cacheKey}-live-steering`));
  assert.match(current, new RegExp(`m8-menu-font-fix\\.css\\?build=${release.cacheKey}-menu-font`));
  assert.match(current, /id="installGate"/);
  assert.match(current, /ROTATE YOUR DEVICE TO LANDSCAPE/);
  assert.match(current, /aria-label="Rotate your device to landscape"/);
  assert.doesNotMatch(current, /Return to landscape/);
  assert.match(current, /id="intro" hidden aria-hidden="true"/);
  assert.match(current, /id="motionButton"/);
  assert.match(current, /id="manualButton"/);
  assert.match(current, /id="status"/);
  assert.doesNotMatch(current, /class="start-card"|Enable motion &amp; race|Desktop \/ manual mode/);
}

async function main() {
  const [releaseSource, current] = await Promise.all([
    fs.readFile(releasePath, 'utf8'),
    fs.readFile(outputPath, 'utf8')
  ]);
  const release = JSON.parse(releaseSource);
  const expected = renderParityEntry(current, release);

  if (process.argv.includes('--check')) {
    assert.equal(current, expected, 'TURN NEXT entry is not synchronized with turn/release.json. Run: node turn-next/scripts/build-parity-entry.mjs');
    validateParityEntry(current, release);
    console.log(`TURN NEXT entry wraps canonical TURN ${release.id} with isolated identity and storage.`);
    return;
  }

  if (current !== expected) await fs.writeFile(outputPath, expected);
  validateParityEntry(expected, release);
  console.log(`TURN NEXT entry synchronized with canonical TURN ${release.id}.`);
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) await main();
