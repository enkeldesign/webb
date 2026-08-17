import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [releaseSource, index, nextIndex, app, fixedLayout, unreadMarkers] = await Promise.all([
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/achievements/unread-markers.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const escapedVersion = escapeRegex(release.version);
const escapedId = escapeRegex(release.id);
const escapedCacheKey = escapeRegex(release.cacheKey);

assert.match(index, new RegExp(`TURN v${escapedVersion} · Build ${escapedId}`));
assert.match(index, new RegExp(`app\\.js\\?build=${escapedCacheKey}-browser-consent-r176-bella-road-derived-zone`));
assert.ok(
  index.includes(`app.js?build=${release.cacheKey}-browser-consent-r176-bella-road-derived-zone-voiceover-paint-parent-click-r420-music-warm-r426-loading-copy`),
  'The production document must cache-bust the revised loading-screen copy under the current release key'
);
assert.match(
  index,
  new RegExp(`startup-screen-reader-handoff-r529\\.js\\?build=${escapedCacheKey}&revision=r531-screen-reader-followup`),
  'The screen-reader follow-up coordinator must be bound to the current release cache identity'
);
assert.match(
  index,
  new RegExp(`countryside-bella-rescue-hotfix-r176\\.js\\?build=${escapedCacheKey}&revision=r530-screen-reader-quality`),
  'The Bella directional-audio hotfix must be bound to the current release cache identity'
);
assert.ok(
  index.indexOf('<h1 id="installTitle">TURN</h1>') < index.indexOf('<span class="install-kicker">TURN v'),
  'Install-page reading order must expose the H1 and primary content before release/About information'
);
assert.match(nextIndex, new RegExp(`TURN NEXT · Source TURN v${escapedVersion} · Build ${escapedId}`));
assert.match(nextIndex, new RegExp(`turn-next\\/app\\.js\\?source=${escapedCacheKey}-browser-consent-r166-bella-records`));

assert.match(app, /function installStartupCover\(\)/);
assert.match(app, /title\.textContent = 'LOADING'/,
  'The startup cover heading must read LOADING');
assert.match(app, /copy\.textContent = 'YOU’LL BE RACING IN NO TIME'/,
  'The startup cover status copy must reassure the player that racing is imminent');
assert.match(app, /turn-startup-spinner/);
assert.match(app, /prefers-reduced-motion: reduce/);
assert.match(app, /\.m8-home\.m8-home-fixed-layout[\s\S]*height: auto !important/);
assert.match(app, /document\.documentElement\.classList\.add\('turn-home-ready'\)/);
assert.match(app, /document\.dispatchEvent\(new CustomEvent\('turn:home-ready'\)\)/);
assert.ok(
  app.indexOf("turnHomeLifecycle = 'home-m8'") < app.indexOf('startupCover.finish()'),
  'The loading cover must remain above the early Countryside frame until Home is complete'
);

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

console.log(`TURN ${release.version} startup cover, screen-reader follow-up cache contracts, refreshed Bella graph, fixed Home viewport, spoken training labels and unread achievement markers passed.`);

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}