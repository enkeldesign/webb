import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [releaseSource, index, nextIndex, app, legacyViewportEntry, startupPerformance, fixedLayout, unreadMarkers] = await Promise.all([
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/startup-viewport-r177.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/startup-performance-r180.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/achievements/unread-markers.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
assert.deepEqual(release, {
  version: '1.5.1',
  id: '2026.08.05-r160',
  cacheKey: '20260805-r160'
});
assert.match(index, /TURN v1\.5\.1 · Build 2026\.08\.05-r160/);
assert.match(index, /app\.js\?build=20260805-r160-browser-consent-r176-bella-road-derived-zone/);
assert.match(index, /countryside-bella-rescue-hotfix-r176\.js\?revision=r176-video-proven-rescue/,
  'The canonical startup document must replace cached Bella rescue behavior independently');
assert.match(index, /startup-performance-r180\.js\?revision=r180-single-viewport-owner/);
assert.doesNotMatch(index, /startup-viewport-r177\.js/,
  'Production must no longer request the faulty viewport bootstrap');
assert.match(nextIndex, /TURN NEXT · Source TURN v1\.5\.1 · Build 2026\.08\.05-r160/);
assert.match(nextIndex, /turn-next\/app\.js\?source=20260805-r160-browser-consent-r166-bella-records/);
assert.match(nextIndex, /startup-performance-r180\.js\?revision=r180-single-viewport-owner/);
assert.doesNotMatch(nextIndex, /startup-viewport-r177\.js/);

assert.match(app, /function installStartupCover\(\)/);
assert.match(app, /copy\.textContent = 'Loading TURN'/);
assert.match(app, /turn-startup-spinner/);
assert.match(app, /prefers-reduced-motion: reduce/);
assert.match(app, /\.m8-home\.m8-home-fixed-layout[\s\S]*height: auto !important/);
assert.match(app, /document\.documentElement\.classList\.add\('turn-home-ready'\)/);
assert.match(app, /document\.dispatchEvent\(new CustomEvent\('turn:home-ready'\)\)/);
assert.ok(
  app.indexOf("turnHomeLifecycle = 'home-m8'") < app.indexOf('startupCover.finish()'),
  'The loading cover must remain above the early Countryside frame until Home is complete'
);

assert.match(legacyViewportEntry, /startup-performance-r180\.js\?revision=r180-single-viewport-owner/,
  'Old documents may only forward to the non-layout startup module');
assert.doesNotMatch(legacyViewportEntry, /screen\.|visualViewport|renderer|camera|--app-width|--app-height|setSize/,
  'The compatibility entry must contain no viewport or renderer behavior');

assert.match(startupPerformance, /SLOW_LOADING_MESSAGE_DELAY_MS = 1400/,
  'Expectation-setting copy must appear only when startup is genuinely taking time');
assert.match(startupPerformance, /note\.textContent = 'This might take a minute\.'/);
assert.match(startupPerformance, /const launchStartedAt = performance\.now\(\)/);
assert.match(startupPerformance, /elapsed >= SLOW_LOADING_MESSAGE_DELAY_MS && loadingCoverIsActive\(\)/);
assert.match(startupPerformance, /document\.addEventListener\('turn:home-ready', stop, \{ once: true \}\)/,
  'The slow-start message must disappear with the loading cover');
assert.match(startupPerformance, /link\.rel = 'modulepreload'/);
assert.match(startupPerformance, /'\.\/main\.js'/);
assert.match(startupPerformance, /'\.\/render\/world\.js\?revision=r175-bella-broad-rear-zone'/);
assert.match(startupPerformance, /'\.\/m8-home\.js\?revision=r131-motion-permission-retry&trophy-road=r159'/);
assert.match(startupPerformance, /three@0\.184\.0\/build\/three\.module\.js/,
  'The large shared Three.js dependency must begin downloading before the sequential app graph reaches main.js');
assert.doesNotMatch(startupPerformance, /screen\.|visualViewport|renderer\.setSize|camera\.aspect|--turn-stage|--app-width|--app-height/,
  'Cold-start optimization must not own viewport or rendering dimensions');

assert.match(fixedLayout, /achievements\/unread-markers\.js\?build=\$\{buildKey\}-r159-unread-cards/);
assert.match(fixedLayout, /installAchievementUnreadMarkers\(achievements\)/);
assert.match(fixedLayout, /achievementUnreadMarkers,/);
assert.match(fixedLayout, /function installDriveByEarSpokenLabels\(training\)/);
assert.match(fixedLayout, /const spokenName = 'Drive By Ear one oh one'/);
assert.match(fixedLayout, /homeButton\?\.setAttribute\('aria-label', spokenName\)/);
assert.match(fixedLayout, /installDriveByEarSpokenLabels\(driveByEarTraining\)/);
assert.match(unreadMarkers, /new Set\(achievements\.store\.unseenIds\(\)\)/);
assert.match(unreadMarkers, /addEventListener\('click', captureBeforeOpen, \{ capture: true \}\)/);
assert.match(unreadMarkers, /turn-achievement-unread-dot/);
assert.match(unreadMarkers, /Newly unlocked achievement\./);
assert.match(unreadMarkers, /new MutationObserver\(queueDecoration\)/);
assert.match(unreadMarkers, /listObserver\.observe\(list, \{ childList: true \}\)/);

console.log('TURN 1.5.1 startup preloading and loading guidance remain independent from viewport sizing.');