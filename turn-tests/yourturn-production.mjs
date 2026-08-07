import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  challengeFromLap,
  decodeChallenge,
  encodeChallenge,
  encodedChallengeFromLocation,
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
assert.match(indexSource, /\/yourturn\/app\.js\?revision=r4/);
assert.match(indexSource, /id="yourTurnChallengeButton"[\s\S]*>THE CHALLENGE<\/button>/,
  'The in-race return point must read as the challenge hub, not as a verb or a Pause command');
assert.match(indexSource, /id="yourTurnMotionToggle"[\s\S]*aria-label="Pause background motion"/,
  'Invitation and result motion need an explicit pause/play control');
assert.match(indexSource, /<rect x="6"[\s\S]*<rect x="14"/,
  'The initial modal Pause icon must be vector artwork rather than an emoji glyph');
assert.match(indexSource, /id="yourTurnRotate"/);
assert.match(indexSource, /ROTATE YOUR DEVICE TO LANDSCAPE/);
assert.match(indexSource, /The race starts when you cross the starting line\./,
  'The landscape transition must explain that timing starts at the physical start line');
assert.doesNotMatch(indexSource, /manifest|install-gate/i,
  'YOUR TURN must remain a browser-first challenge app rather than a PWA install gate');

assert.match(appSource, /await import\(withBuild\('\/turn\/main\.js'\)\)/,
  'YOUR TURN must reuse the canonical TURN race runtime');
assert.doesNotMatch(appSource, /\/turn\/app\.js|m8-home|installM8HomeNavigation/,
  'YOUR TURN must not bootstrap the full TURN Home application');
assert.match(appSource, /installHardPauseController/);
assert.match(appSource, /classList\.add\('turn-lot-open', 'yourturn-runtime-paused'\)/,
  'YOUR TURN pause must use TURN’s canonical hard-occlusion path so physics and rendering both stop');
assert.match(appSource, /state\.lapStartedAt \+= pausedFor/,
  'Time spent in THE CHALLENGE menu must not count against an active lap');
assert.doesNotMatch(appSource, /WebGLRenderer\.prototype|installAnimationPauseBridge/,
  'Do not rely on prototype interception for Three.js animation pause; renderer methods may be instance-owned');
assert.ok(
  appSource.indexOf("await import(withBuild('/turn/main.js'))")
    < appSource.indexOf('globalThis.__turnMotionLifecycle?.uninstall?.()'),
  'YOUR TURN must restore native multi-listener motion semantics after canonical TURN startup'
);
assert.match(appSource, /single devicemotion[\s\S]*multi-listener semantics/,
  'The steering subscription collision must remain documented next to the compatibility fix');
assert.match(appSource, /FINAL_MOTION_CENTER_DELAY_MS = 320/,
  'Final centering must happen after TURN’s early startup-center window, not during the orientation transition');
assert.match(appSource, /animation\.deferResumeUntil\(silentlyCenterAfterLandscape\(runtime\)\)/,
  'The race runtime must stay hard-paused until final landscape centering finishes');
assert.match(appSource, /waitForSettledLandscape/);
assert.match(appSource, /waitForFreshMotionSamples\(FINAL_MOTION_SAMPLE_COUNT, 600\)/,
  'Final centering must use fresh post-rotation motion data');
assert.match(appSource, /state\.neutralRoll = state\.targetRoll[\s\S]*state\.steeringEngaged = false/,
  'The final landscape center must silently reset steering state');
assert.match(appSource, /PLAYER_START_LANE_OFFSET = 4\.1/,
  'Recipient and challenger need a stable side-by-side pre-start formation');
assert.match(appSource, /installStartLineFormationAdapter/);
assert.match(appSource, /formation\.rivalDistance = Math\.min\(formation\.rivalDistance, playerDistance\)/,
  'The challenger may advance toward the line but must never follow a player who backs away');
assert.match(appSource, /challengeLap\.frames\[0\]/,
  'The staged challenger must converge on the exact recorded t=0 start pose');
assert.match(appSource, /aheadIndex === 0 && Number\.isFinite\(startFrame\?\.x\)/,
  'The pre-start path must interpolate into the exact recorded start position rather than snap there');
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
assert.match(sessionSource, /centerMotionAfterLandscape\(\)/,
  'Landscape entry keeps its immediate center while r4 adds a final post-settle center before movement');
assert.match(sessionSource, /runtime\.state\.neutralRoll = runtime\.state\.targetRoll/);
assert.match(sessionSource, /prepareManualAccess\(\)/,
  'On-screen steering must remain an explicit fallback');
assert.match(sessionSource, /label: 'TRY LATER'/);
assert.match(sessionSource, /globalThis\.location\.href = '\/turn\/'/);
assert.match(sessionSource, /label: 'ABOUT TURN'/);
assert.match(sessionSource, /label: 'GET FULL TURN'/);
assert.match(sessionSource, /titleText: 'CHALLENGE'/);
assert.match(sessionSource, /label: 'GIVE UP'/,
  'Challenge menu must keep the route back to Give Up visible');
assert.match(sessionSource, /ambientPaused/);
assert.match(sessionSource, /toggleAmbientMotion/);
assert.match(sessionSource, /if \(state\.ambientPaused\) animation\.pause\(\)/,
  'A start-screen background pause preference must carry through to the result scene');
assert.match(sessionSource, /navigator\.share/);
assert.match(sessionSource, /navigator\.clipboard/);
assert.doesNotMatch(sessionSource, /ghost/i,
  'YOUR TURN recipient copy and challenge layer must describe the challenger’s car, not a ghost');

assert.match(uiSource, /YOUR TURN/);
assert.match(uiSource, /bindMotionToggle/);
assert.match(uiSource, /Play background motion/);
assert.match(uiSource, /Pause background motion/);
assert.match(uiSource, /const PAUSE_ICON[\s\S]*<rect[\s\S]*<rect/,
  'Pause must use two SVG bars');
assert.match(uiSource, /const PLAY_ICON[\s\S]*<path/,
  'Play must use matching SVG artwork');
assert.doesNotMatch(uiSource, /⏸|▶/,
  'Motion control artwork must not depend on platform emoji glyphs');
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
assert.match(cssSource, /\.yourturn-challenge-button[\s\S]*#ff9b66/,
  'The challenge-menu control must use the navigation/back orange');
assert.match(cssSource, /\.yourturn-motion-toggle[\s\S]*border-radius: 50%[\s\S]*background: #ff9b66/,
  'The modal pause/play control must be round and use the navigation/back orange');
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
assert.ok(challenge.frames.length <= 180);
const encoded = await encodeChallenge(challenge);
const decoded = await decodeChallenge(encoded);
assert.equal(decoded.challengerName, 'Erik');
assert.equal(decoded.trackId, 'countryside');
assert.equal(decoded.time, 42);
const challengeUrl = makeChallengeUrl(encoded);
assert.match(challengeUrl, /^https:\/\/enkel\.design\/yourturn\/\?c=/,
  'New challenge replies must use a query-carried URL so social preview crawlers receive the challenge URL');
assert.equal(
  encodedChallengeFromLocation(new URL(challengeUrl)),
  encoded,
  'Query-carried challenge URLs must decode normally'
);
assert.equal(
  encodedChallengeFromLocation(new URL(`https://enkel.design/yourturn/#challenge=${encoded}`)),
  encoded,
  'Previously shared hash-carried challenge links must remain valid'
);
assert.equal(
  makeMockChallengeUrl('sol-countryside-r1'),
  'https://enkel.design/yourturn/?challenge=sol-countryside-r1'
);

console.log('YOUR TURN final centering, seamless start formation, hard pause, vector controls and social-link regression passed.');