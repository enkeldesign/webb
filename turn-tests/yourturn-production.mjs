import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  MAX_CHALLENGE_RACERS,
  challengeFromLap,
  challengeLeader,
  challengeWithLap,
  decodeChallenge,
  encodeChallenge,
  encodedChallengeFromLocation,
  makeChallengeUrl,
  makeMockChallengeUrl,
  normalizeChallenge
} from '../yourturn/protocol.js';

const [
  indexSource,
  appSource,
  sessionSource,
  sceneSource,
  uiSource,
  cssSource,
  growingCssSource,
  labelsSource,
  labelBootstrapSource,
  nonVisualSource,
  storageSource,
  mockSource,
  productionApp
] = await Promise.all([
  fs.readFile(new URL('../yourturn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/session.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/scene.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/ui.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/yourturn.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/growing-challenge.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/racer-labels.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/racer-labels-bootstrap.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/nonvisual.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/storage-bootstrap.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/mock-challenges.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8')
]);

assert.match(indexSource, /<title>YOUR TURN<\/title>/);
assert.match(indexSource, /\/yourturn\/storage-bootstrap\.js/);
assert.match(indexSource, /\/yourturn\/app\.js\?revision=r6/);
assert.match(indexSource, /growing-challenge\.css/);
assert.match(indexSource, /racer-labels-bootstrap\.js/);
assert.match(indexSource, /session\.js\?revision=r3[^\n]*session\.js\?revision=r6/,
  'The page must cache-bust the new growing-challenge session even though app.js stays canonical');
assert.match(indexSource, /Your name in the challenge/);
assert.match(indexSource, /id="yourTurnChallengeButton"[\s\S]*>THE CHALLENGE<\/button>/);
assert.match(indexSource, /The race starts when you cross the starting line\./);
assert.doesNotMatch(indexSource, /manifest|install-gate/i,
  'YOUR TURN remains browser-first rather than a PWA install gate');

assert.match(appSource, /await import\(withBuild\('\/turn\/main\.js'\)\)/,
  'YOUR TURN must reuse the canonical TURN race runtime');
assert.doesNotMatch(appSource, /\/turn\/app\.js|m8-home|installM8HomeNavigation/,
  'YOUR TURN must not bootstrap the full TURN Home application');
assert.match(appSource, /installHardPauseController/);
assert.match(appSource, /classList\.add\('turn-lot-open', 'yourturn-runtime-paused'\)/,
  'THE CHALLENGE modal must hard-pause physics and replay movement');
assert.match(appSource, /FINAL_MOTION_CENTER_DELAY_MS = 320/);
assert.match(appSource, /installStartLineFormationAdapter/);
assert.match(appSource, /formation\.rivalDistance = Math\.min\(formation\.rivalDistance, playerDistance\)/);
assert.match(appSource, /installScreenBlanking/);
assert.match(appSource, /installRaceSpeech/);

assert.match(sessionSource, /challengeLaps: \[\]/,
  'A challenge session must support a field of replay cars');
assert.match(sessionSource, /state\.challenge\.racers\.map\(racerToLap\)/,
  'Every racer in the bundle must become a canonical TURN replay lap');
assert.match(sessionSource, /runtime\.state\.competitorLaps = state\.challengeLaps/,
  'The growing challenge field must feed TURN’s canonical rival runtime');
assert.match(sessionSource, /challengeWithLap\(/,
  'Sharing a run must merge it into the existing challenge instead of replacing the challenge');
assert.match(sessionSource, /state\.racerId:|racerId: loadOrCreateRacerId\(\)/,
  'A browser participant needs a stable racer identity so their later best can replace their earlier car');
assert.match(sessionSource, /if \(!state\.bestRun \|\| candidate\.time < state\.bestRun\.time\) state\.bestRun = candidate/,
  'A player can share their best attempt even without taking the overall lead');
assert.match(sessionSource, /label: 'SHARE'/);
assert.match(sessionSource, /label: 'SHARE YOUR TURN'/);
assert.doesNotMatch(sessionSource, /label: 'GIVE UP'|label: 'YES, GIVE UP'/,
  'The active framework must use neutral sharing instead of Give Up');
assert.match(sessionSource, /label: 'GET THE GAME', game: true/);
assert.match(sessionSource, /label: 'BACK', back: true/);
assert.match(sessionSource, /racerSummaryHtml/);
assert.match(sessionSource, /players challenge you|PLAYERS CHALLENGE YOU/i);
assert.match(sessionSource, /navigator\.share/);
assert.match(sessionSource, /navigator\.clipboard/);
assert.doesNotMatch(sessionSource, /ghost/i,
  'Recipient-facing YOUR TURN challenge code describes people and cars, not ghosts');

assert.match(uiSource, /action\.share/);
assert.match(uiSource, /action\.game/);
assert.match(uiSource, /action\.back/);
assert.match(uiSource, /is-share/);
assert.match(uiSource, /is-game/);
assert.match(uiSource, /is-back/);
assert.match(uiSource, /const PAUSE_ICON[\s\S]*<rect[\s\S]*<rect/);
assert.match(uiSource, /const PLAY_ICON[\s\S]*<path/);
assert.doesNotMatch(uiSource, /⏸|▶/);

assert.match(growingCssSource, /\.is-share[\s\S]*#ff4fa3/,
  'Share is the pink CTA');
assert.match(growingCssSource, /\.is-game[\s\S]*#38d9ff/,
  'Get the Game uses blue rather than navigation orange');
assert.match(growingCssSource, /\.is-back[\s\S]*#ff9b66/,
  'Back remains the design-system orange');
assert.match(growingCssSource, /\.yourturn-racer-summary/);
assert.match(growingCssSource, /\.yourturn-racer-label/);
assert.match(labelsSource, /lap\.challengerName/,
  'Visual replay labels must use the player name carried by each racer lap');
assert.match(labelsSource, /runtime\.competitorCars/);
assert.match(labelBootstrapSource, /installRacerLabels/);
assert.match(labelBootstrapSource, /carId = state\.challenge\.carId/,
  'All social racers must retain the challenge car identity');

assert.match(sceneSource, /PREVIEW_START_DELAY_MS = 650/);
assert.match(sceneSource, /STAGED_IMITATION_DELAY_MS = 650/);
assert.match(sceneSource, /prefers-reduced-motion/);
assert.match(cssSource, /background: rgb\(255 248 232 \/ 0\.9\)/);
assert.match(nonVisualSource, /Drive By Ear 101 training/);
assert.match(nonVisualSource, /yourTurnDbeBalance/);
assert.match(nonVisualSource, /removeRivalResetUi/);
assert.match(storageSource, /const LOCAL_PREFIX = 'yourturn:';/);
assert.match(mockSource, /'sol-countryside-r1'/);
assert.match(productionApp, /installM8HomeNavigation\(\)/,
  'Production TURN remains the full application and is not replaced by YOUR TURN');

assert.equal(MAX_CHALLENGE_RACERS, 4);

const lap = (time, offset = 0) => ({
  time,
  carId: 'sedan-sports',
  carColor: '#ff4fa3',
  carSecondaryColor: '#252a35',
  frames: Array.from({ length: 900 }, (_, index) => ({
    t: time * index / 899,
    x: index * 0.08 + offset,
    z: index * 0.04,
    h: index * 0.001,
    s: Math.sin(index / 40) * 0.2,
    d: 0,
    p: index / 899
  }))
});

let chain = challengeFromLap({
  challengerName: 'ARVID',
  racerId: 'r-arvid',
  chainId: 'yt-family-chain',
  trackId: 'countryside',
  trackRevision: 'countryside',
  trackName: 'Countryside',
  lap: lap(15.8)
});
assert.equal(chain.racers.length, 1);
assert.equal(challengeLeader(chain).name, 'ARVID');
assert.ok(chain.racers[0].frames.length <= 120);

chain = challengeWithLap({ challenge: chain, racerId: 'r-erik', racerName: 'ERIK', lap: lap(15.5, 0.3) });
chain = challengeWithLap({ challenge: chain, racerId: 'r-kerstin', racerName: 'KERSTIN', lap: lap(16.1, -0.25) });
assert.deepEqual(chain.racers.map((racer) => racer.name), ['ERIK', 'ARVID', 'KERSTIN']);

chain = challengeWithLap({ challenge: chain, racerId: 'r-erik', racerName: 'ERIK', lap: lap(15.2, 0.15) });
assert.equal(chain.racers.filter((racer) => racer.id === 'r-erik').length, 1,
  'A returning player must keep exactly one car in the challenge');
assert.equal(chain.racers.find((racer) => racer.id === 'r-erik').time, 15.2,
  'A better repeat lap must replace that player’s older car');

chain = challengeWithLap({ challenge: chain, racerId: 'r-d', racerName: 'D', lap: lap(17.2, 0.5) });
chain = challengeWithLap({ challenge: chain, racerId: 'r-e', racerName: 'E', lap: lap(18.4, -0.5) });
assert.equal(chain.racers.length, 4, 'Self-contained links are capped at four rival cars');
assert.ok(chain.racers.some((racer) => racer.id === 'r-e'), 'The newest contributor must survive the four-car cap');
assert.equal(chain.chainId, 'yt-family-chain', 'The social challenge identity must survive every share');

const encoded = await encodeChallenge(chain);
const decoded = await decodeChallenge(encoded);
assert.equal(decoded.racers.length, 4);
assert.deepEqual(decoded.racers.map((racer) => racer.id), chain.racers.map((racer) => racer.id));
assert.equal(decoded.chainId, chain.chainId);
assert.ok(encoded.length < 18000, `Four-car challenge link payload should stay practical; got ${encoded.length} characters`);

const challengeUrl = makeChallengeUrl(encoded);
assert.match(challengeUrl, /^https:\/\/enkel\.design\/yourturn\/\?c=/);
assert.equal(encodedChallengeFromLocation(new URL(challengeUrl)), encoded);
assert.equal(encodedChallengeFromLocation(new URL(`https://enkel.design/yourturn/#challenge=${encoded}`)), encoded,
  'Previously shared hash-carried challenge links remain readable');
assert.equal(makeMockChallengeUrl('sol-countryside-r1'), 'https://enkel.design/yourturn/?challenge=sol-countryside-r1');

const legacy = normalizeChallenge({
  v: 1,
  challengerName: 'SOL',
  trackId: 'countryside',
  trackRevision: 'countryside',
  trackName: 'Countryside',
  time: 18.75,
  carId: 'sedan-sports',
  carColor: '#ff4fa3',
  carSecondaryColor: '#252a35',
  frames: lap(18.75).frames
});
assert.equal(legacy.v, 2);
assert.equal(legacy.racers.length, 1, 'Old one-car links must transparently upgrade into a challenge field');
assert.equal(legacy.racers[0].name, 'SOL');

console.log('YOUR TURN growing four-car social challenge, named racers, share CTA and compatibility regression passed.');
