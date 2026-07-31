import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const releasePath = path.join(repositoryRoot, 'turn', 'release.json');
const outputPath = path.join(repositoryRoot, 'turn-next', 'index.html');

async function main() {
  const [releaseSource, current] = await Promise.all([
    fs.readFile(releasePath, 'utf8'),
    fs.readFile(outputPath, 'utf8')
  ]);
  const release = JSON.parse(releaseSource);

  assert.match(current, /data-turn-deployment="next"/);
  assert.match(current, /<base href="\/turn\/">/);
  assert.match(current, new RegExp(`TURN NEXT · Source TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));
  assert.match(current, new RegExp(`cacheKey: '${release.cacheKey}'`));
  assert.match(current, new RegExp(`/turn-next/storage-bootstrap\\.js\\?source=${release.cacheKey}`));
  assert.match(current, /\/turn-next\/site\.webmanifest/);
  assert.match(current, /\/turn-next\/identity\.css/);
  assert.match(current, /\/turn-next\/identity\.js/);
  assert.match(current, new RegExp(`/turn-next/app\\.js\\?source=${release.cacheKey}-promoted`));
  assert.match(current, /id="installGate"/);
  assert.match(current, /id="intro" hidden aria-hidden="true"/);
  assert.match(current, /id="motionButton"/);
  assert.match(current, /id="manualButton"/);
  assert.match(current, /id="status"/);
  assert.doesNotMatch(current, /class="start-card"|Enable motion &amp; race|Desktop \/ manual mode/);

  if (!process.argv.includes('--check')) {
    console.log('TURN NEXT entry is maintained as the isolated wrapper template; no rewrite was needed.');
    return;
  }

  console.log(`TURN NEXT entry wraps canonical TURN ${release.id} with isolated identity and storage.`);
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) await main();
