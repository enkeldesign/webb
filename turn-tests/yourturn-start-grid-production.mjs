import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  challengeFromLap,
  challengeWithLap,
  decodeChallenge,
  encodeChallenge,
  makeChallengeUrl
} from '../yourturn/protocol.js';

const [indexSource, sceneSource, labelsSource, bootstrapSource, colorsSource, cssSource, uiSource, mockSource] = await Promise.all([
  fs.readFile(new URL('../yourturn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/scene.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/racer-labels.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/racer-labels-bootstrap.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/racer-colors.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/growing-challenge.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/ui.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/mock-challenges.js', import.meta.url), 'utf8')
]);

assert.match(sceneSource, /rivalCount > 1/);
assert.match(sceneSource, /const totalCars = rivalCount \+ 1/);
assert.match(sceneSource, /const playerSlot = Math\.floor\(\(totalCars - 1\) \/ 2\)/,
  'The player belongs in the middle or left-middle start slot');
assert.match(sceneSource, /for \(let index = 0; index < competitorCars\.length; index \+= 1\)/,
  'Every rival car must be explicitly staged in a multi-car start row');
assert.match(bootstrapSource, /state\.challengeLaps\.length > 1[^\n]*state\.challengeLap = null/,
  'The single-rival smart start-line adapter must stand down for multi-car rows');

assert.match(labelsSource, /\( YOU \)/);
assert.match(labelsSource, /ownRacer\?\.order \|\| state\?\.challenge\?\.nextOrder/);
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
  'The share-name placeholder must use the middle-grey design token value');
assert.match(uiSource, /nameInput\.value = ''/,
  'Opening a share result must show a real placeholder instead of editable fake placeholder text');
assert.match(mockSource, /'erik-full-field-r1'/);
assert.match(mockSource, /challengerName: 'ERIK'/);

assert.match(indexSource, /property="og:image"/);
assert.match(indexSource, /property="og:image:secure_url"/);
assert.match(indexSource, /property="og:image:width" content="1200"/);
assert.match(indexSource, /property="og:image:height" content="630"/);
assert.match(indexSource, /name="twitter:card" content="summary_large_image"/);
assert.match(indexSource, /rel="image_src"/);

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
const url = makeChallengeUrl(encoded);
assert.ok(url.length < 8000, `A four-rival query URL must stay below common request-line limits for reliable OG previews; got ${url.length}`);

console.log('YOUR TURN full start grid, ordered colors, name entry and social-preview regression passed.');
