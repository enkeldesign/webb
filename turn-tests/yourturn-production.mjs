import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  challengeFromLap,
  decodeChallenge,
  encodeChallenge,
  makeChallengeUrl,
  makeMockChallengeUrl
} from '../yourturn/protocol.js';

const [
  indexSource,
  appSource,
  sessionSource,
  sceneSource,
  uiSource,
  cssSource,
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
  fs.readFile(new URL('../yourturn/storage-bootstrap.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/mock-challenges.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8')
]);

assert.match(indexSource, /<title>YOUR TURN<\/title>/);
assert.match(indexSource, /\/yourturn\/storage-bootstrap\.js/);
assert.match(indexSource, /\/yourturn\/app\.js/);
assert.match(indexSource, /id="yourTurnPauseButton"/);
assert.match(indexSource, /id="yourTurnRotate"/);
assert.match(indexSource, /ROTATE YOUR DEVICE TO LANDSCAPE/);
assert.doesNotMatch(indexSource, /manifest|install-gate/i,
  'YOUR TURN must remain a browser-first challenge app rather than a PWA install gate');

assert.match(appSource, /await import\(withBuild\('\/turn\/main\.js'\)\)/,
  'YOUR TURN must reuse the canonical TURN race runtime');
assert.doesNotMatch(appSource, /\/turn\/app\.js|m8-home|installM8HomeNavigation/,
  'YOUR TURN must not bootstrap the full TURN Home application');
assert.match(appSource, /installAnimationPauseBridge/);
assert.match(appSource, /nativeSetAnimationLoop\.call\(renderer, null\)/,
  'Pause must stop the rendering/physics loop rather than merely reducing motion');
assert.match(appSource, /installScreenBlanking/,
  'The non-visual screen blanking affordance must remain available');
assert.match(appSource, /installRaceSpeech/,
  'Screen-reader race announcements must be included');

assert.match(sessionSource, /prepareMotionAccess\(\)/,
  'Accept must request motion steering first');
assert.ok(
  sessionSource.indexOf('prepareMotionAccess()') < sessionSource.indexOf('awaitLandscapeAndStart()'),
  'Motion permission must happen before the landscape transition'
);
assert.match(sessionSource, /ui\.showRotate\(\)/);
assert.match(sessionSource, /prepareManualAccess\(\)/,
  'On-screen steering must remain an explicit fallback');
assert.match(sessionSource, /label: 'TRY LATER'/);
assert.match(sessionSource, /globalThis\.location\.href = '\/turn\/'/);
assert.match(sessionSource, /label: 'ABOUT TURN'/);
assert.match(sessionSource, /label: 'GET FULL TURN'/);
assert.match(sessionSource, /label: 'PAUSE'|titleText: 'PAUSED'/);
assert.match(sessionSource, /navigator\.share/);
assert.match(sessionSource, /navigator\.clipboard/);
assert.doesNotMatch(sessionSource, /ghost/i,
  'YOUR TURN recipient copy and challenge layer must describe the challenger’s car, not a ghost');

assert.match(uiSource, /YOUR TURN/);
assert.match(uiSource, /rotate your phone like a steering wheel/i);
assert.match(uiSource, /spatial audio/i);
assert.match(uiSource, /screen-reader and non-visual play/i);
assert.match(uiSource, /visually-hidden/);
assert.doesNotMatch(uiSource, /ghost/i);

assert.match(sceneSource, /PREVIEW_START_DELAY_MS = 650/,
  'Opponent preview movement must not begin as an uncanny instant imitation');
assert.match(sceneSource, /STAGED_IMITATION_DELAY_MS = 650/);
assert.match(sceneSource, /prefers-reduced-motion/);

assert.match(cssSource, /background: rgb\(255 248 232 \/ 0\.9\)/,
  'Portrait invitation card must be slightly translucent so the challenger car remains perceptible');
assert.match(cssSource, /\.yourturn-pause-button[\s\S]*#ff9b66/,
  'The explicit Pause control must use the navigation/back orange');
assert.match(cssSource, /@media \(orientation: portrait\)/);
assert.match(cssSource, /@media \(max-height: 560px\) and \(orientation: landscape\)/,
  'Small in-app browser viewports need a dedicated compact landscape layout');

assert.match(storageSource, /const LOCAL_PREFIX = 'yourturn:';/);
assert.match(storageSource, /turn production TURN records|TURN records/i);
assert.match(mockSource, /'sol-countryside-r1'/);
assert.match(mockSource, /time: 13\.5/);

assert.match(productionApp, /installM8HomeNavigation\(\)/,
  'Production TURN remains the full application and is not replaced by YOUR TURN');

const frames = Array.from({ length: 900 }, (_, index) => ({
  t: 42 * index / 899,
  x: index * 0.08,
  z: index * 0.04,
  h: index * 0.001,
  s: 0,
  d: 0,
  p: index / 899
}));
const challenge = challengeFromLap({
  challengerName: 'Erik',
  trackId: 'countryside',
  trackRevision: 'countryside',
  trackName: 'Countryside',
  lap: {
    time: 42,
    carId: 'sedan-sports',
    carColor: '#ff4fa3',
    carSecondaryColor: '#252a35',
    frames
  }
});
assert.ok(challenge.frames.length <= 450);
const encoded = await encodeChallenge(challenge);
const decoded = await decodeChallenge(encoded);
assert.equal(decoded.challengerName, 'Erik');
assert.equal(decoded.trackId, 'countryside');
assert.equal(decoded.time, 42);
assert.match(makeChallengeUrl(encoded), /^https:\/\/enkel\.design\/yourturn\/#challenge=/);
assert.equal(
  makeMockChallengeUrl('sol-countryside-r1'),
  'https://enkel.design/yourturn/?challenge=sol-countryside-r1'
);

console.log('YOUR TURN standalone recipient, motion-first flow, pause, accessibility and protocol regression passed.');
