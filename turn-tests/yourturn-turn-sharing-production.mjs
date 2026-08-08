import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  turnIndex,
  shareBootstrap,
  shareSource,
  shareCss,
  profileSource,
  storageBootstrap,
  rivalStorage,
  fixedHome,
  coveredRendering,
  yourTurnIndex,
  yourTurnUi,
  challengeStore
] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/social/your-turn-share-bootstrap.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/social/your-turn-share.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/social/your-turn-share.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/social/racer-profile.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/storage-bootstrap.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/race/rival-storage.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/render/covered-rendering.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/ui.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/challenge-store.js', import.meta.url), 'utf8')
]);

assert.match(turnIndex, /\.\/social\/your-turn-share-bootstrap\.js\?revision=r2/,
  'Production TURN must load the short-link sharing bootstrap with a fresh cache identity');
assert.match(shareBootstrap, /your-turn-share\.js\?revision=r2/,
  'The bootstrap must load the short-link sharing implementation');
assert.match(shareBootstrap, /globalThis\.__turnHomeLayout\?\.home/,
  'Sharing must wait until all existing fixed-Home enhancements have completed');
assert.match(shareBootstrap, /installYourTurnShare\(\{ home \}\)/);
assert.doesNotMatch(fixedHome, /your-turn-share|installYourTurnShare/,
  'The established fixed Home module stays independent of the new sharing feature');

assert.match(rivalStorage, /export function getStoredBestReplayLap\(/,
  'TURN must expose the actual stored replay, not only the best-time summary');
assert.match(rivalStorage, /frames: lap\.frames\.map\(\(frame\) => \(\{ \.\.\.frame \}\)\)/,
  'Shareable replay reads must clone persisted frames');
assert.match(rivalStorage, /getStoredBestLap[\s\S]*getStoredBestReplayLap/,
  'Existing best-lap summaries must keep using the same canonical record source');
assert.match(rivalStorage, /historical summary-only fallback[\s\S]*oldGhost\?\.bestTime/,
  'Very old best-time-only Countryside records must remain visible even when they cannot be shared');

assert.match(shareSource, /challengeFromLap/);
assert.match(shareSource, /encodeChallenge/);
assert.match(shareSource, /makeShareableChallengeUrl/,
  'TURN seed creation must prefer the short immutable snapshot transport');
assert.doesNotMatch(shareSource, /makeChallengeUrl/,
  'TURN should not directly construct the old long URL anymore');
assert.match(challengeStore, /turn-challenges\.erik-jansson-ux\.workers\.dev/,
  'The short-link transport must target the deployed Worker');
assert.match(challengeStore, /makeSelfContainedChallengeUrl/,
  'The current self-contained challenge URL must remain as the automatic fallback');
assert.match(shareSource, /getTrackStorageRevision/,
  'Seed challenges must carry the current track revision');
assert.match(shareSource, /racerId: profile\.id/,
  'TURN-created seeds must carry the social racer ID in the challenge payload');
assert.match(shareSource, /SHARE YOUR TURN/);
assert.match(shareSource, /WRITE YOUR NAME HERE/);
assert.match(shareSource, /normalizeChallengeName\(input\.value, ''\)/,
  'TURN share must reject an empty name instead of falling back to an anonymous racer');
assert.doesNotMatch(shareSource, /A TURN PLAYER/,
  'TURN seed creation must never silently invent an anonymous display name');
assert.match(shareSource, /input\.value = profile\.name \|\| ''/,
  'The composer must prefill the last deliberately entered social name');
assert.match(shareSource, /saveSocialRacerName\(racerName\)/,
  'A successfully entered social name must become the next composer default');
assert.match(shareSource, /card\?\.classList\.contains\('is-selected'\) && best/,
  'Only the selected track with a shareable personal best gets the Home share control');
assert.match(shareSource, /time < previousBest - PB_EPSILON/,
  'The lap-result share entry must appear only for a new personal best');
assert.match(shareSource, /lap-result-yourturn-share/);
assert.match(shareSource, /turn-runtime-paused/,
  'Opening the composer during a race must hard-pause the runtime');
assert.match(shareSource, /state\.lapStartedAt \+= pausedFor/,
  'Time spent composing or sharing must not count against the automatically started next lap');
assert.match(shareSource, /__turnAudio\?\.silence\?\.\(\)/,
  'A hard-paused share composer must not leave the engine/audio state running behind it');
assert.match(coveredRendering, /turn-runtime-paused/,
  'The renderer guard must honour the sharing modal pause class');

assert.match(shareCss, /\.turn-yourturn-track-share/);
assert.match(shareCss, /\.lap-result-yourturn-share/);
assert.match(shareCss, /\.turn-yourturn-share-submit[\s\S]*#ff4fa3/,
  'SHARE YOUR TURN remains the pink CTA');
assert.match(shareCss, /\.turn-yourturn-share-back[\s\S]*#ff9b66/,
  'Back remains the navigation orange');
assert.match(shareCss, /\.turn-yourturn-track-slot[\s\S]*position: relative/,
  'The separate share button must use a valid sibling wrapper rather than nesting a button inside the track button');

assert.match(profileSource, /turn-social-racer-id-v1/);
assert.match(profileSource, /turn-social-racer-name-v1/);
assert.match(profileSource, /__TURN_SHARED_LOCAL_STORAGE__/,
  'The shared profile must use YOUR TURN raw-storage bridge when present');
assert.match(profileSource, /adoptSocialRacerIdentity/,
  'A browser context must be able to adopt a racer ID after explicit human confirmation');

assert.match(storageBootstrap, /__TURN_SHARED_LOCAL_STORAGE__/,
  'YOUR TURN must expose only a deliberate raw local-storage bridge for shared social identity');
assert.match(storageBootstrap, /effectiveRacerId = sharedRacerId \|\| legacyRacerId \|\| createRacerId\(\)/,
  'YOUR TURN must establish one shared racer ID before its existing session code initializes');
assert.match(storageBootstrap, /LEGACY_RACER_NAME_KEY[\s\S]*SHARED_RACER_NAME_KEY/,
  'Existing YOUR TURN names should migrate into the shared composer default');
assert.match(storageBootstrap, /storageNamespace: LOCAL_PREFIX/,
  'YOUR TURN gameplay storage remains isolated');
assert.match(yourTurnIndex, /storage-bootstrap\.js\?revision=r2/);
assert.match(yourTurnIndex, /ui\.js\?revision=r3[^\n]*ui\.js\?revision=r10/);

assert.match(yourTurnUi, /loadSocialRacerProfile\(\)\.name/,
  'YOUR TURN share composers must prefill the last deliberately entered social name');
assert.match(yourTurnUi, /IS ALREADY HERE/);
assert.match(yourTurnUi, /YES, THAT’S ME/);
assert.match(yourTurnUi, /NO, USE ANOTHER NAME/);
assert.match(yourTurnUi, /adoptSocialRacerIdentity\(\{ id: existing\.id, name: typedName \}\)/,
  'Confirming an existing named car must adopt its racer ID before the outgoing share is built');
assert.match(yourTurnUi, /challenge\.racers\.some\(\(racer\) => racer\.id === sessionState\.racerId\)/,
  'A recognized racer ID must bypass unnecessary identity confirmation');

console.log('TURN → YOUR TURN seed sharing, short transport, remembered names and returning-racer claim regression passed.');
