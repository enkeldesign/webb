import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  CHALLENGE_SNAPSHOT_ID_PATTERN,
  CHALLENGE_STORE_BASE_URL,
  loadChallengeSnapshot,
  makeSelfContainedChallengeUrl,
  makeShareableChallengeUrl,
  makeSnapshotChallengeUrl,
  saveChallengeSnapshot,
  snapshotIdFromLocation
} from '../yourturn/challenge-store.js';

const SNAPSHOT_ID = '01abcdeghjkm';
const PAYLOAD = 'raw.QUJDREVGRw';

assert.equal(CHALLENGE_STORE_BASE_URL, 'https://turn-challenges.erik-jansson-ux.workers.dev');
assert.ok(CHALLENGE_SNAPSHOT_ID_PATTERN.test(SNAPSHOT_ID));
assert.equal(
  snapshotIdFromLocation({ search: `?c=${SNAPSHOT_ID}` }),
  SNAPSHOT_ID,
  'Short c= links must be recognized as immutable snapshot IDs'
);
assert.equal(
  snapshotIdFromLocation({ search: '?c=gz.not-a-short-id' }),
  '',
  'Legacy self-contained c= payloads must not be mistaken for snapshot IDs'
);

assert.equal(
  makeSnapshotChallengeUrl(SNAPSHOT_ID),
  `https://enkel.design/yourturn/?c=${SNAPSHOT_ID}`,
  'The public short link must remain on enkel.design and contain no replay payload'
);
const fallbackUrl = makeSelfContainedChallengeUrl(PAYLOAD);
assert.match(fallbackUrl, /^https:\/\/enkel\.design\/yourturn\/\?share=1#challenge=raw\./);
assert.ok(fallbackUrl.length > makeSnapshotChallengeUrl(SNAPSHOT_ID).length,
  'The self-contained URL remains available as a longer fallback');

let savedRequest = null;
const saveFetch = async (url, init) => {
  savedRequest = { url, init };
  return new Response(JSON.stringify({ id: SNAPSHOT_ID, created: true }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
};
assert.equal(
  await saveChallengeSnapshot(PAYLOAD, { fetchImpl: saveFetch, timeoutMs: 1000 }),
  SNAPSHOT_ID
);
assert.equal(savedRequest.url, `${CHALLENGE_STORE_BASE_URL}/v1/challenges`);
assert.equal(savedRequest.init.method, 'POST');
assert.equal(savedRequest.init.credentials, 'omit');
assert.deepEqual(JSON.parse(savedRequest.init.body), { payload: PAYLOAD });

let loadedRequest = null;
const loadFetch = async (url, init) => {
  loadedRequest = { url, init };
  return new Response(JSON.stringify({ id: SNAPSHOT_ID, payload: PAYLOAD }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
assert.equal(
  await loadChallengeSnapshot(SNAPSHOT_ID, { fetchImpl: loadFetch, timeoutMs: 1000 }),
  PAYLOAD
);
assert.equal(loadedRequest.url, `${CHALLENGE_STORE_BASE_URL}/v1/challenges/${SNAPSHOT_ID}`);
assert.equal(loadedRequest.init.method, 'GET');

const shortPrepared = await makeShareableChallengeUrl(PAYLOAD, {
  fetchImpl: saveFetch,
  timeoutMs: 1000
});
assert.equal(shortPrepared.usedSnapshot, true);
assert.equal(shortPrepared.snapshotId, SNAPSHOT_ID);
assert.equal(shortPrepared.url, `https://enkel.design/yourturn/?c=${SNAPSHOT_ID}`);
assert.equal(shortPrepared.fallbackUrl, fallbackUrl);

const fallbackPrepared = await makeShareableChallengeUrl(PAYLOAD, {
  fetchImpl: async () => { throw new TypeError('offline'); },
  timeoutMs: 1000
});
assert.equal(fallbackPrepared.usedSnapshot, false);
assert.equal(fallbackPrepared.url, fallbackUrl,
  'A failed Worker write must fall back to the existing self-contained challenge link');
assert.ok(fallbackPrepared.error instanceof Error);

const [sessionSource, turnShareSource, turnIndex, yourTurnIndex] = await Promise.all([
  fs.readFile(new URL('../yourturn/session.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/social/your-turn-share.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/index.html', import.meta.url), 'utf8')
]);

assert.match(sessionSource, /snapshotIdFromLocation/);
assert.match(sessionSource, /request\.snapshotId[\s\S]*loadChallengeSnapshot\(request\.snapshotId\)/,
  'YOUR TURN must resolve short IDs through the snapshot service before decoding the challenge');
assert.match(sessionSource, /makeShareableChallengeUrl\(encoded\)/,
  'Growing YOUR TURN shares must prefer the short snapshot transport');
assert.doesNotMatch(sessionSource, /const url = makeChallengeUrl\(encoded\)/,
  'YOUR TURN must no longer make the long fragment its primary share URL');

assert.match(turnShareSource, /makeShareableChallengeUrl/,
  'TURN-created seeds must use the same short-link transport');
assert.match(turnShareSource, /Preparing challenge link…/,
  'The composer should announce the short-link preparation delay');
assert.match(turnIndex, /your-turn-share-bootstrap\.js\?revision=r2/,
  'TURN must cache-bust the short-link sharing bootstrap');
assert.match(yourTurnIndex, /session\.js\?revision=r3[^\n]*session\.js\?revision=r7/,
  'YOUR TURN must cache-bust the session that understands short IDs');

console.log('TURN and YOUR TURN short snapshot links, readback and self-contained fallback regression passed.');
