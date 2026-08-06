import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [releaseSource, index, nextIndex, app, responsiveStartup, fixedLayout, unreadMarkers] = await Promise.all([
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/startup-viewport-r177.js', import.meta.url), 'utf8'),
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
assert.match(index, /startup-viewport-r177\.js\?revision=r177-cold-start-rotation-crop/);
assert.match(nextIndex, /TURN NEXT · Source TURN v1\.5\.1 · Build 2026\.08\.05-r160/);
assert.match(nextIndex, /turn-next\/app\.js\?source=20260805-r160-browser-consent-r166-bella-records/);
assert.match(nextIndex, /startup-viewport-r177\.js\?revision=r177-cold-start-rotation-crop/);

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

assert.match(responsiveStartup, /SLOW_LOADING_MESSAGE_DELAY_MS = 1400/,
  'Expectation-setting copy must appear only when startup is genuinely taking time');
assert.match(responsiveStartup, /note\.textContent = 'This might take a minute\.'/);
assert.match(responsiveStartup, /note\.hidden = true/);
assert.match(responsiveStartup, /if \(loading\(\)\) note\.hidden = false/);
assert.match(responsiveStartup, /document\.addEventListener\('turn:home-ready',[\s\S]*clearExpectation\(\)/,
  'The slow-start message must disappear with the loading cover');
assert.match(responsiveStartup, /link\.rel = 'modulepreload'/);
assert.match(responsiveStartup, /'\.\/main\.js'/);
assert.match(responsiveStartup, /'\.\/render\/world\.js\?revision=r175-bella-broad-rear-zone'/);
assert.match(responsiveStartup, /'\.\/m8-home\.js\?revision=r131-motion-permission-retry&trophy-road=r159'/);
assert.match(responsiveStartup, /'\.\/m8-home-fixed-layout\.js\?revision=m8\.9-track-title-alignment&trophy-road=r159&achievements=r166-bella-records&bella-rescue=r174-siren-zone'/);
assert.match(responsiveStartup, /three@0\.184\.0\/build\/three\.module\.js/,
  'The large shared Three.js dependency must begin downloading before the sequential app graph reaches main.js');
assert.match(responsiveStartup, /without[\s\S]*changing initialization order|changing initialization order/,
  'The optimization must preload bytes without executing game modules out of order');

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

console.log('TURN 1.5.1 cold-start preload, delayed loading guidance, fixed Home viewport, spoken training labels and unread achievement markers passed.');