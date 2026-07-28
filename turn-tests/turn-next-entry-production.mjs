import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [productionIndex, nextIndex, storage, identity, manifestSource, releaseSource] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/storage-bootstrap.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/identity.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/site.webmanifest', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8')
]);

const manifest = JSON.parse(manifestSource);
const release = JSON.parse(releaseSource);

assert.match(productionIndex, new RegExp(`TURN v${release.version} · Build ${release.id}`));
assert.match(nextIndex, /<base href="\/turn\/">/, 'TURN NEXT must reuse the current production module graph during the parity milestone');
assert.match(nextIndex, /data-turn-deployment="next"/);
assert.match(nextIndex, /<meta name="robots" content="noindex,nofollow">/);
assert.match(nextIndex, /TURN NEXT · Source TURN/);
assert.match(nextIndex, /class="turn-next-badge"/);
assert.match(nextIndex, /\/turn-next\/storage-bootstrap\.js/);
assert.match(nextIndex, /\/turn-next\/identity\.css/);
assert.match(nextIndex, /\/turn-next\/identity\.js/);
assert.match(nextIndex, /\/turn-next\/site\.webmanifest/);
assert.match(nextIndex, /src="\.\/app\.js\?build=/, 'The parity entry must launch the production app through the /turn/ base URL');
assert.ok(
  nextIndex.indexOf('/turn-next/storage-bootstrap.js') < nextIndex.indexOf('./install-gate.js'),
  'Storage isolation must install before any production script can access storage'
);
assert.doesNotMatch(nextIndex, /href="\.\/site\.webmanifest/);

assert.match(storage, /const LOCAL_PREFIX = 'turn-next:';/);
assert.match(storage, /const SESSION_PREFIX = 'turn-next-session:';/);
assert.match(storage, /proto\.getItem = function getItem/);
assert.match(storage, /proto\.setItem = function setItem/);
assert.match(storage, /proto\.removeItem = function removeItem/);
assert.match(storage, /proto\.clear = function clear/);
assert.match(storage, /proto\.key = function key/);
assert.match(storage, /globalThis\.__TURN_NEXT_STORAGE_READY__ = true/);
assert.doesNotMatch(storage, /seed|copyProduction|COPY_ONCE/i, 'TURN NEXT must not copy production data automatically');
assert.match(identity, /MutationObserver/, 'Dynamic install-gate copy must retain the TURN NEXT identity');

assert.deepEqual(
  {
    id: manifest.id,
    name: manifest.name,
    shortName: manifest.short_name,
    startUrl: manifest.start_url,
    scope: manifest.scope,
    display: manifest.display,
    orientation: manifest.orientation
  },
  {
    id: '/turn-next/',
    name: 'TURN NEXT',
    shortName: 'TURN NEXT',
    startUrl: '/turn-next/',
    scope: '/turn-next/',
    display: 'fullscreen',
    orientation: 'landscape'
  }
);

console.log(`TURN NEXT isolated parity entry for TURN ${release.id} passed.`);
