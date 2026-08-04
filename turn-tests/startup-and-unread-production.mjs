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
assert.deepEqual(release, {
  version: '1.5.0',
  id: '2026.08.04-r159',
  cacheKey: '20260804-r159'
});
assert.match(index, /TURN v1\.5\.0 · Build 2026\.08\.04-r159/);
assert.match(index, /app\.js\?build=20260804-r159-browser-consent-r159-startup-polish/);
assert.match(nextIndex, /TURN NEXT · Source TURN v1\.5\.0 · Build 2026\.08\.04-r159/);
assert.match(nextIndex, /turn-next\/app\.js\?source=20260804-r159-browser-consent/);

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

assert.match(fixedLayout, /achievements\/unread-markers\.js\?build=\$\{buildKey\}-r159-unread-cards/);
assert.match(fixedLayout, /installAchievementUnreadMarkers\(achievements\)/);
assert.match(fixedLayout, /achievementUnreadMarkers,/);
assert.match(unreadMarkers, /new Set\(achievements\.store\.unseenIds\(\)\)/);
assert.match(unreadMarkers, /addEventListener\('click', captureBeforeOpen, \{ capture: true \}\)/);
assert.match(unreadMarkers, /turn-achievement-unread-dot/);
assert.match(unreadMarkers, /Newly unlocked achievement\./);
assert.match(unreadMarkers, /new MutationObserver\(queueDecoration\)/);
assert.match(unreadMarkers, /listObserver\.observe\(list, \{ childList: true \}\)/);

console.log('TURN 1.5.0 startup cover, fixed Home viewport and unread achievement markers passed.');
