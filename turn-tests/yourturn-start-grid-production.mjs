import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  challengeFromLap,
  challengeWithLap,
  decodeChallenge,
  encodeChallenge
} from '../yourturn/protocol.js';

const [
  indexSource,
  labelsSource,
  bootstrapSource,
  colorsSource,
  cssSource,
  uiSource,
  mockSource,
  startGateSource,
  socialProtocolSource
] = await Promise.all([
  fs.readFile(new URL('../yourturn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/racer-labels.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/racer-labels-bootstrap.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/racer-colors.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/growing-challenge.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/ui.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/mock-challenges.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/start-gate.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/protocol-social.js', import.meta.url), 'utf8')
]);

assert.match(indexSource, /start-gate\.js\?revision=r1/);
assert.match(indexSource, /Press Gas, Drift or Boost to start the race\./);
assert.match(startGateSource, /sessionState\.phase === 'staged'/);
assert.match(startGateSource, /renderStartGrid/);
assert.match(startGateSource, /const playerSlot = Math\.floor\(\(totalCars - 1\) \/ 2\)/,
  'The player belongs in the middle or left-middle start slot');
assert.match(startGateSource, /runtime\.state\.velocity\.set\(0, 0, 0\)/,
  'Cars must stand still while waiting for the start input');
assert.match(startGateSource, /#gasButton, \.drive-drift-zone, \.drive-boost-zone/,
  'Gas, Drift and Boost are the explicit race-start intents');
assert.match(startGateSource, /beginTimedLapState/,
  'The first forward control must start canonical lap timing immediately');
assert.match(startGateSource, /LAUNCH_BLEND_SECONDS = 0\.9/,
  'Rivals should merge smoothly from their side-by-side start slots into recorded trajectories');

assert.match(labelsSource, /playerLabel\.textContent = 'YOU'/);
assert.doesNotMatch(labelsSource, /\( YOU \)/);
assert.match(labelsSource, /ownRacer\?\.order \|\| state\?\.challenge\?\.nextOrder/);
assert.match(bootstrapSource, /requestAnimationFrame\(bootstrap\)/,
  'Name-plate bootstrap must keep waiting on slow cold starts');
assert.doesNotMatch(bootstrapSource, /FRAME_LIMIT/,
  'Name plates must not silently give up before a slow runtime finishes loading');
assert.match(colorsSource, /'#ffd1e6'[\s\S]*'#bdeeff'[\s\S]*'#c8f5d0'[\s\S]*'#fff0a8'[\s\S]*'#ffd0ae'/);
assert.match(colorsSource, /lap\.carColor = colorForOrder/);
assert.match(colorsSource, /raceSession\.selectVehicle/,
  'The recipient car must use the same order color as the YOU plate');
assert.match(cssSource, /text-transform: uppercase/);
assert.match(cssSource, /yourturn-order-1[\s\S]*#ffd1e6/);
assert.match(cssSource, /yourturn-order-5[\s\S]*#ffd0ae/);
assert.match(cssSource, /yourturn-player-label[\s\S]*font-weight: 1000/);

assert.match(indexSource, /placeholder="WRITE YOUR NAME HERE"/);
assert.match(cssSource, /input::placeholder[\s\S]*#666/,
  'The first-share name placeholder must use the middle-grey design token value');
assert.match(uiSource, /const rememberedName = loadSocialRacerProfile\(\)\.name/,
  'After a player has named a share, later share composers should use that name as the editable default');
assert.match(uiSource, /nameInput\.value = nameValue == null \? rememberedName : String\(nameValue\)/,
  'Explicit identity-recovery flows must still be able to clear or replace the remembered default');
assert.match(mockSource, /'erik-full-field-r1'/);
assert.match(mockSource, /challengerName: 'ERIK'/);

assert.match(indexSource, /property="og:image"/);
assert.match(indexSource, /property="og:image:secure_url"/);
assert.match(indexSource, /property="og:image:width" content="1200"/);
assert.match(indexSource, /property="og:image:height" content="630"/);
assert.match(indexSource, /name="twitter:card" content="summary_large_image"/);
assert.match(indexSource, /rel="image_src"/);
assert.match(indexSource, /protocol-social\.js\?revision=r1/,
  'Runtime sharing must use the OG-stable URL adapter');
assert.match(socialProtocolSource, /url\.searchParams\.set\('share', '1'\)/);
assert.match(socialProtocolSource, /fragment\.set\('challenge', String\(encoded \|\| ''\)\)/);
assert.doesNotMatch(socialProtocolSource, /searchParams\.set\('c', encoded\)/,
  'Large replay payloads must not be sent to social-preview servers in the query string');

const lap = (time, offset = 0) => ({
  time,
  carId: 'sedan-sports',
  carColor: '#ffffff',
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
  challengerName: 'ERIK',
  racerId: 'r-erik',
  chainId: 'yt-grid-order',
  trackId: 'countryside',
  trackRevision: 'countryside',
  trackName: 'Countryside',
  lap: lap(15.4)
});
chain = challengeWithLap({ challenge: chain, racerId: 'r-arvid', racerName: 'ARVID', lap: lap(14.9, 0.2) });
chain = challengeWithLap({ challenge: chain, racerId: 'r-kerstin', racerName: 'KERSTIN', lap: lap(16.1, -0.2) });
chain = challengeWithLap({ challenge: chain, racerId: 'r-sol', racerName: 'SOL', lap: lap(15.8, 0.4) });

assert.equal(chain.racers.find((racer) => racer.id === 'r-erik').order, 1,
  'First challenger stays pink even if someone later becomes faster');
assert.equal(chain.racers.find((racer) => racer.id === 'r-arvid').order, 2);
assert.equal(chain.racers.find((racer) => racer.id === 'r-kerstin').order, 3);
assert.equal(chain.racers.find((racer) => racer.id === 'r-sol').order, 4);
assert.equal(chain.nextOrder, 5, 'The next recipient gets the fifth/orange identity color');

const encoded = await encodeChallenge(chain);
const decoded = await decodeChallenge(encoded);
assert.deepEqual(
  decoded.racers.map(({ id, order }) => [id, order]),
  chain.racers.map(({ id, order }) => [id, order]),
  'Join order must survive a real challenge-link round trip'
);
assert.ok(encoded.length > 100,
  'The OG adapter test must use a meaningful self-contained replay payload');

console.log('YOUR TURN fixed start gate, reliable labels, ordered colors, remembered names and OG-stable sharing regression passed.');
