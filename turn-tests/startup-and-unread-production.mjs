import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  achievementCardMatchesFilters,
  achievementCardTags
} from '../turn/achievements/filter-state.js';

const [
  releaseSource,
  index,
  nextIndex,
  app,
  fixedLayout,
  unreadMarkers,
  trophyRoadFeedback,
  screenReaderCoordinator
] = await Promise.all([
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/achievements/unread-markers.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/achievements/trophy-road-feedback.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/startup-screen-reader-handoff-r529.js', import.meta.url), 'utf8')
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

assert.match(screenReaderCoordinator, /const LANDSCAPE_SETTLE_MS = 1200/,
  'Automatic non-visual onboarding must leave a short quiet window after landscape settles');
assert.match(screenReaderCoordinator, /function installLandscapeWatch\(\)[\s\S]*window\.addEventListener\('resize', handleLandscapeCandidate[\s\S]*window\.addEventListener\('orientationchange', handleLandscapeCandidate[\s\S]*visualViewport\?\.addEventListener\('resize', handleLandscapeCandidate/,
  'The onboarding coordinator must react to both viewport and OS orientation transitions');
assert.match(screenReaderCoordinator, /function scheduleNonVisualOnboarding\(\)[\s\S]*if \(viewportIsPortrait\(\)\) return;[\s\S]*window\.setTimeout\([\s\S]*viewportIsPortrait\(\)\) return;[\s\S]*speak\(`TURN is ready\. \$\{NON_VISUAL_ONBOARDING_MESSAGE\}`/,
  'The onboarding itself must only enter the live region after landscape remains confirmed');
assert.match(screenReaderCoordinator, /if \(viewportIsPortrait\(\)\) \{\s*speak\('TURN is ready\. Rotate your device to landscape\.', \{ priority: 'assertive' \}\);\s*\} else \{\s*scheduleNonVisualOnboarding\(\);/,
  'Portrait Home may request rotation, but must not append the onboarding before landscape');
assert.doesNotMatch(screenReaderCoordinator, /speak\(`\$\{readyMessage\} \$\{NON_VISUAL_ONBOARDING_MESSAGE\}`/,
  'The old portrait-ready plus onboarding utterance must not return');

assert.match(fixedLayout, /achievements\/unread-markers\.js\?build=\$\{buildKey\}-r219-unified-filters/);
assert.match(fixedLayout, /achievements\/trophy-road-feedback\.js\?build=\$\{buildKey\}-r244-reward-toast-guide/);
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
assert.doesNotMatch(unreadMarkers, /function installFilterButtons|function handleFilterClick/,
  'Unread decoration must not install a second competing achievement-filter controller');
assert.match(trophyRoadFeedback, /Object\.freeze\(\{ id: 'hidden', label: 'HIDDEN' \}\)/,
  'Achievements must expose a dedicated Hidden filter');
assert.match(trophyRoadFeedback, /Object\.freeze\(\{ id: 'new', label: 'NEW' \}\)/,
  'Achievements must always expose a New filter');
assert.match(trophyRoadFeedback, /Object\.freeze\(\{ id: 'locked', label: 'LOCKED' \}\)/,
  'The existing Locked filter must remain available alongside the composable tags');
assert.doesNotMatch(trophyRoadFeedback, /newButton\.hidden\s*=/,
  'NEW must stay visible in the filter row even when there is nothing new');
assert.match(trophyRoadFeedback, /newButton\.disabled = !available/,
  'NEW should remain visible but inert when there are no unseen achievements');
assert.match(unreadMarkers, /min-height: 34px/,
  'Achievement filter pills should use the more compact requested height');
assert.match(unreadMarkers, /achievement\?\.hidden === true/,
  'The Hidden filter must derive from the achievement hidden contract rather than title matching');
assert.match(unreadMarkers, /turn-achievement-toast-open/,
  'Achievement toasts must expose a full-toast activation target');
assert.match(unreadMarkers, /function achievementFromToast\(\)/);
assert.match(unreadMarkers, /function focusAchievement\(achievementId\)/);
assert.match(unreadMarkers, /scrollIntoView\(\{ block: 'center', behavior: 'auto' \}\)/,
  'Opening a toast must take the player directly to the unlocked achievement without extra motion');
assert.match(trophyRoadFeedback, /tags: card\.dataset\.achievementTags/,
  'The active controller must filter by composable achievement tags rather than the single primary category');
assert.match(trophyRoadFeedback, /unseen: card\.dataset\.achievementUnseen === 'true'/,
  'The active controller must include live NEW state in the same filter model');
assert.match(trophyRoadFeedback, /attributeFilter: \[[\s\S]*'data-achievement-tags'[\s\S]*'data-achievement-unseen'/,
  'Filter results and NEW availability must react when unread decoration updates existing cards');

assert.deepEqual(
  [...achievementCardTags({ category: 'time-trials' })].sort(),
  ['racing', 'time-trials'],
  'Time trials must remain discoverable through both RACING and TIME TRIALS'
);
assert.equal(achievementCardMatchesFilters(
  { tags: 'exploration hidden', category: 'exploration', status: 'locked' },
  { activeTags: new Set(['hidden']), activeStatuses: new Set(['locked']) }
), true, 'HIDDEN and LOCKED must compose against the same card');
assert.equal(achievementCardMatchesFilters(
  { tags: 'racing time-trials', category: 'time-trials', status: 'locked' },
  { activeTags: new Set(['racing']), activeStatuses: new Set(['unlocked']) }
), false, 'Status filters must narrow the union of selected tags');
assert.equal(achievementCardMatchesFilters(
  { tags: 'onboarding', category: 'onboarding', unseen: true, status: 'unlocked' },
  { activeTags: new Set(['new']), activeStatuses: new Set() }
), true, 'NEW must be derived from the live unseen marker without replacing static tags');

console.log(`TURN ${release.version} startup cover, landscape-gated screen-reader onboarding, refreshed Bella graph, fixed Home viewport, spoken training labels and unread achievement navigation passed.`);

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
