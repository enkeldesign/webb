import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { trophyRoadDetailPlacement } from '../turn/achievements/view.js';
import {
  ICONS,
  TRACK_IDS,
  getAchievement
} from '../turn/achievements/catalog.js';
import {
  ICONS as PRESENTATION_ICONS,
  TRACK_IDS as PRESENTATION_TRACK_IDS,
  getAchievement as getPresentationAchievement
} from '../turn/achievements/catalog-track-icons.js';
import {
  TROPHY_ROAD_REWARDS,
  TROPHY_ROAD_REWARD_ICONS
} from '../turn/progression/trophy-road.js';
import {
  TROPHY_ROAD_REWARD_ICONS as PRESENTATION_TROPHY_ROAD_REWARD_ICONS,
  getTrophyRoadReward as getPresentationTrophyRoadReward
} from '../turn/progression/trophy-road-track-icons.js';
import {
  TRACK_ICON_ASSETS,
  TRACK_ICON_MARKUP
} from '../turn/ui/track-icons.js';
import {
  AUTHORED_DRIFT_ICON,
  AUTHORED_PAINT_ICON,
  AUTHORED_SAFETY_ICON
} from '../turn/ui/authored-icons.js';

const [
  view,
  feedback,
  showcase,
  styles,
  productionIndex,
  labIndex,
  homeRewardReplay,
  trophyRoadPerksFacade,
  lotTrackIconWrapper,
  ...trackIconSources
] = await Promise.all([
  fs.readFile(new URL('../turn/achievements/view.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/achievements/trophy-road-feedback.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/achievements/trophy-road-showcase.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/progression/trophy-road.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-lab/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/achievements/home-reward-replay-r225.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/progression/trophy-road-perks-r164.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/garage/lot-showroom-track-icon.js', import.meta.url), 'utf8'),
  ...TRACK_IDS.map((trackId) => fs.readFile(
    new URL(`../turn/assets/trophy-road/${trackId}.svg`, import.meta.url),
    'utf8'
  ))
]);

assert.deepEqual(trophyRoadDetailPlacement({
  rowRect: { top: 120, bottom: 220 },
  mapRect: { left: 40, right: 960 },
  detailHeight: 130,
  viewportWidth: 1000,
  viewportHeight: 700
}), {
  placement: 'below',
  top: 228,
  left: 40,
  width: 920
}, 'A selected row with room beneath it must anchor the reward modal below');

assert.deepEqual(trophyRoadDetailPlacement({
  rowRect: { top: 480, bottom: 580 },
  mapRect: { left: -20, right: 1040 },
  detailHeight: 150,
  viewportWidth: 1000,
  viewportHeight: 640
}), {
  placement: 'above',
  top: 322,
  left: 10,
  width: 980
}, 'A lower selected row must place the modal above and clamp it to viewport edges');

assert.equal(ICONS.drift, AUTHORED_DRIFT_ICON,
  'Achievement DRIFT artwork must come from the shared authored SVG source');
assert.equal(ICONS.safety, AUTHORED_SAFETY_ICON,
  'Achievement SAFETY artwork must come from the shared authored SVG source');
assert.equal(getAchievement('around-the-turn')?.icon, 'safety');
assert.equal(getAchievement('on-course-of-course')?.icon, 'safety',
  'ON COURSE, OF COURSE belongs to the SAFETY artwork family');
for (const trackId of TRACK_IDS) {
  assert.equal(getAchievement(`${trackId}-safety`)?.icon, 'safety',
    `${trackId} SAFETY must use the shared SAFETY artwork`);
}
assert.equal(TROPHY_ROAD_REWARD_ICONS.drift, AUTHORED_DRIFT_ICON,
  'The DRIFT ATTACK Trophy Road reward must reuse the authored DRIFT SVG');
assert.equal(TROPHY_ROAD_REWARD_ICONS.paint, AUTHORED_PAINT_ICON,
  'The PAINTJOB Trophy Road reward must reuse the optimized authored spray-can SVG');
assert.match(AUTHORED_DRIFT_ICON, /currentColor/);
assert.match(AUTHORED_SAFETY_ICON, /currentColor/);
assert.match(AUTHORED_PAINT_ICON, /currentColor/);
assert.match(AUTHORED_DRIFT_ICON, /aria-hidden="true"/);
assert.match(AUTHORED_SAFETY_ICON, /aria-hidden="true"/);
assert.match(AUTHORED_PAINT_ICON, /aria-hidden="true"/);
assert.match(AUTHORED_PAINT_ICON, /viewBox="150 160 700 1335"/,
  'The supplied PAINTJOB artwork must use its cropped production viewBox instead of the oversized source canvas');
assert.doesNotMatch(AUTHORED_PAINT_ICON, /<\?xml|<!DOCTYPE|width="958px"|height="1571px"|fill="#(?:000000|ffffff)"/i,
  'The production PAINTJOB icon must drop source-document boilerplate, fixed dimensions and hard-coded black/white fills');
assert.doesNotMatch(AUTHORED_DRIFT_ICON, /mask/i);
assert.doesNotMatch(AUTHORED_SAFETY_ICON, /mask/i);
assert.doesNotMatch(AUTHORED_PAINT_ICON, /mask/i);

const trustYourEarsIcon = getAchievement('trust-your-ears')?.icon;
assert.equal(trustYourEarsIcon, 'blind');
for (const achievementId of ['drive-by-ear', 'listen-closely', 'beyond-sight']) {
  assert.equal(getAchievement(achievementId)?.icon, trustYourEarsIcon,
    `${achievementId} must use the same non-visual-driving icon as TRUST YOUR EARS`);
}

assert.deepEqual(PRESENTATION_TRACK_IDS, TRACK_IDS,
  'The track-icon presentation catalog must preserve the canonical track set');
for (const [index, trackId] of TRACK_IDS.entries()) {
  const iconKey = `track-${trackId}`;
  assert.equal(getPresentationAchievement(`${trackId}-winner`)?.icon, iconKey,
    `${trackId.toUpperCase()} WINNER must use its own track pictogram`);
  assert.equal(PRESENTATION_ICONS[iconKey], TRACK_ICON_MARKUP[trackId],
    `${trackId} achievement artwork must reuse the shared track icon source`);
  assert.equal(TRACK_ICON_ASSETS[trackId], `/turn/assets/trophy-road/${trackId}.svg`);
  assert.match(trackIconSources[index], /<svg[^>]+viewBox=/,
    `${trackId} track pictogram must remain a vector SVG`);
  assert.match(trackIconSources[index], /currentColor/,
    `${trackId} track pictogram must inherit the surface colour`);
  assert.doesNotMatch(trackIconSources[index], /<image\b|data:image|\.png|\.jpe?g/i,
    `${trackId} track pictogram must not embed raster artwork`);
}
assert.equal(getPresentationAchievement('an-army-of-me')?.icon, 'trophy',
  'AN ARMY OF ME must use the TROPHY icon');
assert.equal(getPresentationAchievement('your-own-rival')?.icon, 'flag',
  'YOUR OWN RIVAL must use the FLAG icon');
assert.equal(getPresentationAchievement('charge-through-it')?.icon, 'drift',
  'CHARGE THROUGH IT must use the authored DRIFT icon');
assert.equal(getPresentationAchievement('catch-the-charge')?.icon, 'safety',
  'CATCH THE CHARGE must use the authored SAFETY icon');
assert.equal(PRESENTATION_ICONS.drift, AUTHORED_DRIFT_ICON);
assert.equal(PRESENTATION_ICONS.safety, AUTHORED_SAFETY_ICON);

const midnightReward = getPresentationTrophyRoadReward('midnight-city');
const mountainReward = getPresentationTrophyRoadReward('mountain');
assert.equal(PRESENTATION_TROPHY_ROAD_REWARD_ICONS[midnightReward.icon], TRACK_ICON_MARKUP['midnight-city'],
  'MIDNIGHT CITY must use the new authored track icon on Trophy Road');
assert.equal(PRESENTATION_TROPHY_ROAD_REWARD_ICONS[mountainReward.icon], TRACK_ICON_MARKUP.mountain,
  'MOUNTAIN must use the new authored track icon on Trophy Road');

for (const document of [productionIndex, labIndex]) {
  assert.match(document, /"\/turn\/achievements\/catalog\.js\?revision=r241-learning-achievements": "\/turn\/achievements\/catalog-track-icons\.js\?revision=r1-track-reward-icons"/,
    'Current achievement consumers must route through the track-icon presentation catalog');
  assert.match(document, /"\/turn\/achievements\/catalog-production\.js\?revision=r241-learning-achievements": "\/turn\/achievements\/catalog-track-icons\.js\?revision=r1-track-reward-icons"/,
    'Legacy achievement facades must also converge on the track-icon presentation catalog');
  for (const revision of ['r243-mountain-1300', 'r248-supercar', 'r253-supercar-release']) {
    assert.match(document, new RegExp(
      `"/turn/progression/trophy-road\\.js\\?revision=${revision}": "/turn/progression/trophy-road-track-icons\\.js\\?revision=r1-track-reward-icons"`
    ), `Trophy Road ${revision} consumers must converge on the authored track-icon presentation`);
  }
  assert.match(document, /"\/turn\/garage\/lot-showroom-experiment\.js\?revision=r252-supercar-outward-rims": "\/turn\/garage\/lot-showroom-track-icon\.js\?revision=r2-swift-lot-ui"/,
    'The current Lot showroom must route through the chosen-track icon wrapper');
}
assert.match(homeRewardReplay, /trophy-road-perks-r164\.js\?revision=r243-mountain-1300/,
  'Home reward replay must continue through the compatibility Trophy Road facade');
assert.match(trophyRoadPerksFacade, /trophy-road\.js\?revision=r243-mountain-1300/,
  'The home reward facade must converge on the routed Trophy Road icon catalog');
assert.match(feedback, /trophy-road\.js\?revision=r253-supercar-release/,
  'Reward-detail rehydration must use the current Trophy Road route that is redirected to authored track icons');
assert.match(lotTrackIconWrapper, /__turnNextHome\?\.getSelectedTrackId\?\.\(\)/,
  'The Lot track pictogram must mirror Home selection instead of owning duplicate state');
assert.match(lotTrackIconWrapper, /gridTemplateColumns = 'auto auto'/,
  'The Lot header must reserve real layout space for the chosen-track pictogram');
assert.match(lotTrackIconWrapper, /aria-hidden', 'true'/,
  'The chosen-track Lot pictogram must remain decorative');

assert.match(view, /data-trophy-road-detail-layer hidden/);
assert.match(view, /role="dialog"[\s\S]*aria-modal="true"[\s\S]*aria-labelledby="turnTrophyRoadDetailTitle"/,
  'Reward details must be exposed as a labelled modal within the one Achievements top-layer dialog');
assert.match(view, /data-trophy-road-detail-close aria-label="Close reward details"/);
assert.match(view, /data-trophy-reward="\$\{reward\.id\}"[\s\S]*aria-haspopup="dialog"[\s\S]*aria-controls="turnTrophyRoadDetailDialog"/,
  'Every reward control must announce that it opens the detail dialog');
assert.match(view, /if \(event\.target === trophyRoadDetailLayer\) closeTrophyRoadDetail\(\)/,
  'Clicking outside the reward paper must close it');
assert.match(view, /event\.key === 'Escape'[\s\S]*closeTrophyRoadDetail\(\)/,
  'Escape must close reward details before closing Achievements');
assert.match(view, /achievementsCard\.inert = true/,
  'The underlying Achievements content must be inert while reward details are modal');
assert.match(view, /selectedRewardMarker\(\)\?\.focus\(\{ preventScroll: true \}\)/,
  'Closing reward details must restore focus to the selected reward');
assert.match(view, /row\.getBoundingClientRect\(\)[\s\S]*trophyRoadMap\.getBoundingClientRect\(\)/,
  'Placement must be measured from the selected reward row and the road map');
assert.match(view, /horizontalPlacement[\s\S]*--turn-trophy-road-detail-width[\s\S]*detailHeight: trophyRoadDetail\.getBoundingClientRect\(\)\.height/,
  'The modal must establish its final road width before measuring wrapped content height');
assert.match(view, /<span>TROPHY ROAD<\/span>/);
assert.doesNotMatch(view, /TROPHY ROAD\s+2|turn-achievements-percent|>COMPLETION</,
  'The current UI must use the plain Trophy Road name and trophies rather than a competing percentage');

assert.match(styles, /\.turn-trophy-road-detail-layer \{[\s\S]*position: fixed/);
assert.match(styles, /\.turn-trophy-road-detail \{[\s\S]*top: var\(--turn-trophy-road-detail-top[^;]*;[\s\S]*left: var\(--turn-trophy-road-detail-left/);
assert.match(styles, /\.turn-trophy-road-detail-layer \{[\s\S]*touch-action: pan-y/,
  'Compact reward details must remain vertically scrollable on touch devices');
assert.doesNotMatch(styles, /\.turn-trophy-road-detail(?:-layer)?[^}]*animation(?:-name)?:/,
  'The modal and its placement must not add a continuous animation path');

assert.match(feedback, /function renderedSelection\(\)/,
  'The enhanced Trophy Road must adopt the reward selected by the canonical view');
assert.match(feedback, /trophy-road-showcase\.js\?revision=r253-supercar-release/,
  'The reward preview must use the current vehicle catalog through a fresh module identity');
assert.match(feedback, /trophy-road-r157\.css\?build=\$\{buildKey\}-r244-reward-toast-guide/,
  'The detail enhancement must share the current serpentine stylesheet identity');
assert.match(feedback, /syncRenderedSelection: \(\) => preserveUserSelection\(\{ adoptRendered: true \}\)/,
  'Opening Achievements must preserve the already rendered first reward card');
assert.doesNotMatch(feedback, /homeTrigger\?\.addEventListener\('click', resetView\)/,
  'The Home trigger must not clear the detail card after the canonical view opens it');
assert.doesNotMatch(feedback, /raceTrigger\?\.addEventListener\('click', resetView\)/,
  'The race trigger must not clear the detail card after the canonical view opens it');
assert.match(feedback, /queueMicrotask\(\(\) => \{[\s\S]*preserveUserSelection\(\{ adoptRendered \}\)/,
  'Reward synchronization must run after the canonical click renderer has replaced the card DOM');
assert.match(feedback, /if \(reward\.type !== 'vehicle' && reward\.type !== 'vehicle-pack'\) \{[\s\S]*showcase\.clear\(\);[\s\S]*restoreStaticRewardIcon\(reward, host\)/,
  'Only vehicle rewards may start WebGL; tracks, features, perks and scoring systems restore static artwork');
assert.match(feedback, /host\.innerHTML = icon/,
  'The selected line-art reward must be rehydrated even if the previous canvas removed its contents');
assert.match(feedback, /if \(summary\.detailLayer\.hidden \|\| !reward \|\| !host\) \{[\s\S]*showcase\.clear\(\)/,
  'A closed reward modal must not leave the 3D showcase rendering');
assert.match(feedback, /turn:trophy-road-detail-closed[\s\S]*handleDetailClosed/,
  'Closing the reward modal must release its showcase');
assert.doesNotMatch(feedback, /requestAnimationFrame|scrollLeft|scrollBy|scrollWidth|clientWidth/,
  'The complete road grid must not retain carousel geometry or an animation-frame layout path');

const vehicleRewards = TROPHY_ROAD_REWARDS.filter((reward) => (
  reward.type === 'vehicle' || reward.type === 'vehicle-pack'
));
for (const reward of vehicleRewards) {
  const keyPattern = reward.id.includes('-')
    ? `['\"]${reward.id}['\"]`
    : `(?:['\"]${reward.id}['\"]|${reward.id})`;
  assert.match(showcase, new RegExp(`${keyPattern}\\s*:\\s*Object\\.freeze\\(\\[`),
    `${reward.id} must have a 3D Trophy Road reward-description showcase`);
}
assert.match(showcase, /supercar:\s*Object\.freeze\(\[[\s\S]*carId: 'supercar'/,
  'The 2300 SUPERCAR reward must load the actual Supercar vehicle model rather than stop at its line-art icon');

console.log('TURN Trophy Road anchored reward modal, shared track icons, chosen-track Lot cue and complete vehicle showcase coverage passed.');
