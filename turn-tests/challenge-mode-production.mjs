import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  challengeFromLap,
  decodeChallenge,
  encodeChallenge,
  makeBuiltInChallengeUrl,
  makeChallengeUrl,
  normalizeChallenge
} from '../turn-next/challenge-codec.js';

const [
  productionIndex,
  nextIndex,
  nextApp,
  bootstrapSource,
  sessionSource,
  sceneSource,
  sharingSource,
  uiSource,
  codecSource,
  cssSource,
  storageSource,
  releaseSource
] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/challenge-mode.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/challenge-session.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/challenge-scene.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/challenge-sharing.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/challenge-ui.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/challenge-codec.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/challenge-mode.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/storage-bootstrap.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8')
]);
const release = JSON.parse(releaseSource);

assert.doesNotMatch(productionIndex, /challenge-mode|challenge-codec|RACE MY GHOST/,
  'The prototype must remain isolated from production TURN');
assert.match(nextIndex, new RegExp(`TURN NEXT · Source TURN v${escapeRegex(release.version)} · Build ${escapeRegex(release.id)}`));
assert.match(nextIndex, /"\/turn\/tracks\/track-manager\.js\?build=20260805-r160": "\/turn\/tracks\/track-manager\.js\?source=20260729-r118-m8"/,
  'Challenge mode must reuse TURN NEXT’s canonical Track Manager singleton');
assert.match(nextIndex, /"\/turn\/tracks\/catalog\.js\?build=20260805-r160": "\/turn\/tracks\/catalog\.js\?source=20260729-r118-m8"/);
assert.match(nextIndex, /"\/turn\/vehicle\/catalog\.js\?build=20260805-r160": "\/turn\/vehicle\/catalog\.js\?revision=r223-training-car-taxi"/,
  'Challenge mode must reuse the fresh canonical vehicle catalog containing steering wheels and APEX GRIP');
assert.match(nextApp, /\/turn-next\/challenge-mode\.js\?revision=r182-race-my-ghost/);
assert.ok(
  nextApp.indexOf('/turn-next/challenge-mode.js') < nextApp.indexOf("new URL('/turn/app.js'"),
  'Challenge routing must release browser launch before the canonical runtime waits for consent'
);
assert.match(bootstrapSource, /challenge-mode\.css\?revision=r182-race-my-ghost/);
assert.match(bootstrapSource, /if \(request\.hasChallenge\) globalThis\.__turnStartBrowserGame\?\.\(\)/);
assert.match(bootstrapSource, /installChallengeSharing/);
assert.match(bootstrapSource, /createChallengeSession/);
assert.match(bootstrapSource, /await waitForHomeReady\(\);[\s\S]*await challengeSession\.launch\(\)/,
  'The challenge must hide the fully constructed Home rather than racing its installation lifecycle');
assert.match(bootstrapSource, /globalThis\.__turnHome[\s\S]*dataset\.turnHomeLifecycle === 'home-m8'/,
  'Challenge launch must use the canonical Home-ready boundary');

assert.match(sessionSource, /'sol-countryside-r1'/,
  'TURN NEXT must ship one short stable challenge for device testing');
assert.match(sessionSource, /challengerName: 'SOL'/);
assert.match(sessionSource, /time: 13\.5/);
assert.match(sessionSource, /await activateTrack\(challenge\.trackId, runtime\)/);
assert.match(sessionSource, /const denominator = Math\.max\(1, samples\.length - 1\)/);
assert.match(sessionSource, /t: definition\.time \* index \/ denominator/);
assert.match(sessionSource, /p: index \/ denominator/,
  'The built-in challenge must reach its exact target time and full track progress');
assert.match(sessionSource, /await raceSession\.selectVehicle\(challengeVehicle\(challenge\)\)/,
  'The recipient and ghost must use the challenge vehicle');
assert.match(sessionSource, /runtime\.state\.competitorLaps = \[state\.challengeLap\]/,
  'Personal rivals must not appear in the challenge race');
assert.match(sessionSource, /state\.personalRivals = cloneLaps\(runtime\.state\.competitorLaps\)/,
  'Personal rivals must be preserved before the shared ghost replaces the race roster');
assert.match(sessionSource, /\.sort\(\(a, b\) => a\.time - b\.time\)[\s\S]*\.slice\(0, RIVAL_LIMIT\)/,
  'Every valid attempt must still compete for the player’s private top four');
assert.match(sessionSource, /saveRivalsState\(\{[\s\S]*competitorLaps: state\.personalRivals/);
assert.ok(
  sessionSource.indexOf("document.querySelector('#resetButton')?.click();")
    < sessionSource.indexOf('await raceSession.startGame(access.fullscreenPromise)'),
  'Accepting must reset both cars to the canonical stage before the challenge begins'
);

assert.match(sessionSource, /Beat \$\{escapeHtml\(challenge\.challengerName\)\}’s ghost\. Race as many laps as you need\./);
assert.doesNotMatch(sessionSource, /watch[^\n]*then[^\n]*(race|run)/i,
  'The challenge must not instruct the recipient to watch before racing');
assert.match(sessionSource, /RESTART LAP|restartLap/);
assert.match(sessionSource, /SHARE GIVE-UP REPLY/);
assert.match(sharingSource, /reply: 'give-up'/);
assert.match(sessionSource, /SHARE WIN/);
assert.match(sharingSource, /replyTo: \{[\s\S]*kind: 'win'/);

assert.match(sceneSource, /if \(phase === 'staged'\) \{[\s\S]*if \(runtime\.state\.lapActive\) \{[\s\S]*phase = 'racing';[\s\S]*return false;/,
  'The ghost replay must remain parked until the player’s actual timed lap starts');
assert.match(sceneSource, /challengeCar\.position\.copy\(state\.position\)\.addScaledVector\(right, 4\.1\)/,
  'The player and ghost must be staged together at the start');
assert.match(sessionSource, /queueMicrotask\(\(\) => finishAttempt\(candidate\)\)/,
  'Challenge bookkeeping must run after the canonical lap system finishes its synchronous result');
assert.match(sessionSource, /state\.phase = runtime\.state\.lapActive \? 'racing' : 'staged'/,
  'A losing lap must flow directly into the next lap rather than ending the challenge');

assert.match(sharingSource, /data-share-lap-challenge/,
  'Lap summaries must offer a playable ghost link');
assert.match(sharingSource, /data-share-track-best/,
  'Home must offer sharing for the selected track’s stored best lap');
assert.match(sharingSource, /navigator\.share/);
assert.match(sharingSource, /navigator\.clipboard\.writeText/);
assert.match(codecSource, /CompressionStream\('gzip'\)/);
assert.match(codecSource, /DecompressionStream\('gzip'\)/);
assert.match(codecSource, /const frames = downsampleFrames\(source\.frames\)/,
  'Direct and built-in challenge definitions must be evenly reduced rather than truncated');
assert.match(codecSource, /const bufferPromise = new Response\(stream\.readable\)\.arrayBuffer\(\)/,
  'Large replay compression must begin reading before writing to avoid stream backpressure stalls');
assert.match(storageSource, /const LOCAL_PREFIX = 'turn-next:';/,
  'Challenge attempts must remain isolated from production TURN records');

assert.match(uiSource, /\.turn-challenge-dialog|turn-challenge-dialog/);
assert.match(cssSource, /\.turn-challenge-dialog/);
assert.match(cssSource, /\.turn-challenge-bar/);
assert.match(cssSource, /\.turn-challenge-share-best/);
assert.match(cssSource, /\.lap-result-toast \[data-share-lap-challenge\]/);
assert.match(cssSource, /:focus-visible/);

const frames = Array.from({ length: 1800 }, (_, index) => ({
  t: 65 * index / 1799,
  x: index * 0.08,
  z: index * 0.04,
  h: index * 0.001,
  s: 0,
  d: 0,
  p: index / 1799
}));
const challenge = challengeFromLap({
  challengerName: 'Erik',
  trackId: 'countryside',
  trackRevision: 'countryside',
  trackName: 'Countryside',
  lap: {
    time: 65,
    carId: 'sedan-sports',
    carColor: '#ff4fa3',
    carSecondaryColor: '#252a35',
    frames
  }
});
assert.ok(challenge.frames.length <= 450);
assert.ok(challenge.frames.at(-1).t > 64.99,
  'Replay downsampling must retain the finish rather than truncating long recordings');
const encoded = await encodeChallenge(challenge);
assert.ok(encoded.length < 10000,
  `A realistic challenge link must remain practical for messaging; received ${encoded.length} encoded characters`);
const decoded = await decodeChallenge(encoded);
assert.equal(decoded.challengerName, 'Erik');
assert.equal(decoded.trackId, 'countryside');
assert.equal(decoded.carId, 'sedan-sports');
assert.equal(decoded.time, 65);
assert.ok(decoded.frames.length > 20);
assert.ok(decoded.frames.at(-1).t > 64.99);
assert.ok(Math.abs(decoded.frames.at(-1).x - challenge.frames.at(-1).x) < 0.011,
  'Compact replay positions must retain centimetre-level precision');
assert.match(makeChallengeUrl(encoded), /^https:\/\/enkel\.design\/turn-next\/#challenge=/);
assert.equal(
  makeBuiltInChallengeUrl('sol-countryside-r1', { reply: 'give-up', responder: 'Erik' }),
  'https://enkel.design/turn-next/?challenge=sol-countryside-r1&reply=give-up&responder=Erik'
);

const builtInStyleFrames = Array.from({ length: 720 }, (_, index) => ({
  t: 65 * index / 719,
  x: index,
  z: index / 2,
  h: index / 720,
  s: 0,
  d: 0,
  p: index / 719
}));
const builtInStyleChallenge = normalizeChallenge({
  v: 1,
  challengerName: 'SOL',
  trackId: 'countryside',
  trackRevision: 'countryside',
  trackName: 'Countryside',
  time: 65,
  carId: 'sedan-sports',
  carColor: '#ff4fa3',
  carSecondaryColor: '#252a35',
  frames: builtInStyleFrames
});
assert.ok(builtInStyleChallenge.frames.length <= 450);
assert.ok(builtInStyleChallenge.frames.at(-1).t > 64.99,
  'The stable built-in device challenge must retain its finish frame');
assert.equal(builtInStyleChallenge.frames.at(-1).x, 719);

console.log('TURN NEXT Race My Ghost challenge, repeat attempts, top-four isolation, compact links and replies passed.');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
