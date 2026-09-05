import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  index,
  releaseSource,
  app,
  wrapper,
  enhancementRuntime,
  perkDisclosure,
  layout,
  layoutCss,
  infoPanel,
  infoTypography,
  lot,
  legend,
  accessibility,
  trainingGuide
] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-track-select.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-enhancement-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-perk-disclosure.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-layout-r60.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-layout-r60.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-info-panel-r212.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-info-typography-r213.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-r10.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-stat-legend.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-accessibility-r118.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/training-car-guide.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const importMapText = index.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
assert.ok(importMapText, 'Production must expose its import map');
const imports = JSON.parse(importMapText).imports;

assert.match(
  index,
  new RegExp(`lot-layout-r60\\.css\\?build=${release.cacheKey}-native-html`),
  'Production must cache-bust the HTML-first Lot layout stylesheet with the active release'
);
assert.match(index, new RegExp(`app\\.js\\?build=${release.cacheKey}-browser-consent`));
assert.equal(
  imports['./garage/lot-r10.js?build=20260720-r19'],
  `./garage/lot-track-select.js?build=${release.cacheKey}&revision=r223-training-car-taxi`,
  'Production must request the optimized Lot wrapper under a fresh cache identity'
);
assert.equal(
  imports['./garage/lot-accessibility-r118.js?build=20260729-r118'],
  `./garage/lot-accessibility-r118.js?build=${release.cacheKey}&revision=r163-voiceover-first-lot-focus`
);
assert.equal(
  imports['./garage/lot-enhancement-runtime.js?revision=r163-native-picker-parent-click&build=20260809-r163'],
  `./garage/lot-enhancement-runtime.js?build=${release.cacheKey}&revision=r223-training-car-taxi`,
  'The interaction-freeze hotfix must retain its cache-safe enhancement-runtime route'
);

assert.match(app, /installLotEnhancementRuntime\(\)/);
assert.ok(
  app.indexOf('installLotEnhancementRuntime()') < app.indexOf("withBuild('./main.js')"),
  'The Lot enhancement observer must exist before any route can open The Lot'
);

assert.match(wrapper, /export async function showEnhancedLot/);
assert.match(wrapper, /lot-r10\.js\?build=20260809-r163-native-html&revision=r590-canonical-lock-icon/,
  'The wrapper must load the canonical-lock Lot implementation under a fresh URL');
assert.match(wrapper, /lot-enhancement-runtime\.js\?revision=r588-canonical-attributes/,
  'The wrapper must load the canonical-attribute accessibility bundle');
assert.match(wrapper, /lot-enhancement-runtime\.js\?revision=r217-stable-perk-slot&build=20260804-r157/,
  'The wrapper must bypass cached Lot layout enhancements');
assert.match(wrapper, /lot-info-panel-r212\.css\?revision=r216-meter-density/,
  'The tightened race-action spacing must load under a fresh stylesheet URL');
assert.match(wrapper, /lot-info-typography-r213\.css\?revision=r218-meter-black-outline/,
  'The black-edged attribute meters must load under a fresh stylesheet URL');
assert.match(wrapper, /const removeEnhancements = enhanceLotNow\(\)/);
assert.match(wrapper, /await chooseTrackBeforeLot\(\)/);
assert.doesNotMatch(wrapper, /installLotLayout|installLotStatLegend|installLotAccessibility/);

assert.match(enhancementRuntime, /ENHANCEMENT_ID = 'enhanced-lot-r164-vintage-rally-perks'/);
assert.match(enhancementRuntime, /TROPHY_ROAD_ENHANCEMENT_ID = 'enhanced-lot-r164-vintage-rally-perks'/);
assert.match(enhancementRuntime, /lot-perk-disclosure\.js\?revision=r240-trophy-road-2/);
assert.match(enhancementRuntime, /lot-trophy-gate\.js\?revision=r240-trophy-road-2/);
assert.match(enhancementRuntime, /lot-accessibility-r118\.js\?build=20260729-r118&revision=r588-canonical-attributes/);
assert.match(enhancementRuntime, /activeEnhancements = new WeakMap\(\)/);
assert.match(enhancementRuntime, /LOT_ENTRY_CLICK_GUARD_MS = 600/);
assert.match(enhancementRuntime, /installLotPerkDisclosure\(scope\)/);
assert.match(enhancementRuntime, /installLotStatLegend\(scope\)/);
assert.match(enhancementRuntime, /installLotLayout\(scope\)/);
assert.match(enhancementRuntime, /installLotAccessibility\(scope\)/);
assert.ok(
  enhancementRuntime.indexOf('installLotPerkDisclosure(scope)') < enhancementRuntime.indexOf('installLotAccessibility(scope)'),
  'Perk information must exist before the accessibility enhancer completes selected-car semantics'
);
assert.match(enhancementRuntime, /new MutationObserver\(sync\)/);
assert.match(enhancementRuntime, /if \(active\) return active\.release/);
assert.match(enhancementRuntime, /released = true/);

assert.match(perkDisclosure, /className = 'lot-perk-copy'/);
assert.match(perkDisclosure, /getCarDefinition\(vehicleId\)\?\.perk/);
assert.doesNotMatch(perkDisclosure, /rewardForVehicle\(/,
  'Perk ownership must never be confused with the selected car’s own Trophy Road lock');
assert.match(perkDisclosure, /rewardForVehiclePerk\(vehicleId\)/,
  'The selected car’s independent perk reward must drive locked/unlocked disclosure');
assert.match(perkDisclosure, /className = 'lot-perk-button is-layout-placeholder'/);
assert.match(perkDisclosure, /trigger\.textContent = 'PERK'/);
assert.match(perkDisclosure, /trigger\.setAttribute\('aria-haspopup', 'dialog'\)/);
assert.match(perkDisclosure, /trigger\.setAttribute\('aria-controls', popoverId\)/);
assert.match(perkDisclosure, /trigger\.setAttribute\('aria-expanded', 'false'\)/);
assert.match(perkDisclosure, /popover\.setAttribute\('popover', 'auto'\)/);
assert.match(perkDisclosure, /popover\.setAttribute\('role', 'dialog'\)/);
assert.match(perkDisclosure, /popover\.setAttribute\('aria-labelledby', titleId\)/);
assert.match(perkDisclosure, /popover\.setAttribute\('aria-describedby', descriptionId\)/);
assert.match(perkDisclosure, /\.lot-perk-button\.is-layout-placeholder\s*\{[\s\S]*visibility: hidden;[\s\S]*pointer-events: none;/,
  'Cars without perks must reserve the same title-row footprint without drawing a false action');
assert.match(perkDisclosure, /trigger\.disabled = !available;[\s\S]*trigger\.classList\.toggle\('is-layout-placeholder', !available\)/,
  'Only cars with named perk content may expose an interactive PERK action');
assert.match(perkDisclosure, /trigger\.setAttribute\('aria-hidden', 'true'\)[\s\S]*trigger\.tabIndex = -1/,
  'The layout placeholder must stay out of the accessibility tree and tab order');
assert.match(perkDisclosure, /trigger\.removeAttribute\('aria-hidden'\);[\s\S]*trigger\.removeAttribute\('tabindex'\)/,
  'A real PERK action must return to the accessibility tree and normal tab order');
assert.match(perkDisclosure, /if \(isOpen \|\| !currentPerkText \|\| trigger\.disabled\) return;/,
  'The invisible layout placeholder must never open the perk popover');
assert.match(perkDisclosure, /restoreFocus && trigger\.isConnected && !trigger\.disabled/,
  'Popover cleanup must never move focus to an unavailable placeholder');
assert.match(perkDisclosure, /closePopover\(\);[\s\S]*setTriggerAvailable\(Boolean\(perkText\)\)/,
  'Changing cars must close any open perk before updating action availability');
assert.doesNotMatch(perkDisclosure, /trigger\.hidden = !perkText/,
  'Hiding the PERK action must not collapse the shared information layout');
assert.match(perkDisclosure, /event\.key !== 'Escape'/);
assert.match(perkDisclosure, /closePopover\(\{ restoreFocus: true \}\)/);
assert.doesNotMatch(perkDisclosure, /innerHTML\s*=/,
  'Perk names and descriptions must be written as text rather than parsed markup');
assert.match(perkDisclosure, /const picker = screen\?\.querySelector\?\.\('\.lot-car-picker'\)/);
assert.match(
  perkDisclosure,
  /observer\.observe\(picker, \{[\s\S]*subtree: true,[\s\S]*attributes: true,[\s\S]*attributeFilter: \['aria-checked'\][\s\S]*\}\);/,
  'Perk synchronization must observe only car radio selection state'
);
assert.doesNotMatch(perkDisclosure, /observer\.observe\(screen,/,
  'The perk presentation must never observe the subtree that contains its own generated copy');
assert.doesNotMatch(perkDisclosure, /childList:\s*true|characterData:\s*true/,
  'The perk presentation must not react to DOM/text mutations that its own sync function can create');
assert.match(enhancementRuntime, /lot-perk-disclosure\.js\?revision=r217-stable-perk-slot/,
  'The stable PERK slot must load under a fresh module URL');

assert.match(
  lot,
  /<section class="lot-viewbox lot-viewbox-with-paint">[\s\S]*<div class="lot-colors" aria-label="Choose car paint colours"><\/div>[\s\S]*<\/section>/,
  'Native paint controls and 3D preview must share their final panel from initial render'
);
assert.match(lot, /lot-viewbox-head" aria-hidden="true"/);
assert.match(lot, /lot-view-host" aria-hidden="true"/);
assert.doesNotMatch(lot, /lot-view-close|lot-view-open/);
assert.match(lot, /LOT_FRAME_INTERVAL_MS = 1000 \/ 30/,
  'The Lot must stay at a cooler 30fps without changing race rendering');
assert.match(lot, /renderer\.forceContextLoss\?\.\(\)/,
  'Closing The Lot must release its WebGL context');

const requestedOrder = [
  'classic', 'truck', 'sedan', 'van', 'suv',
  'convertible', 'sedan-sports', 'firetruck', 'ambulance', 'police',
  'race', 'vintage-racer', 'race-future', 'monster-truck', 'toy-racer'
];
const orderSource = lot.match(/export const LOT_CAR_ORDER = Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] || '';
const actualOrder = [...orderSource.matchAll(/'([^']+)'/g)].map((match) => match[1]);
assert.deepEqual(actualOrder, requestedOrder,
  'The visible 5x3 Lot order must stay stable and match the ease/category progression design');
assert.match(lot, /color: getVehicleDefaultColor\(car\.id\)/,
  'Unselected cars must be created in their own factory colours');
assert.match(lot, /secondaryColor: getVehicleDefaultSecondaryColor\(car\.id\)/,
  'Factory secondary colours must remain visible in the collection');
assert.doesNotMatch(lot, /UNSELECTED_COLOR/,
  'Selection must not be communicated by dulling every other vehicle');
assert.match(lot, /function makeParkingPad\(selected = false\)/);
assert.match(lot, /turnLotPadPointer/,
  'The selected vehicle must have a shape cue in addition to the yellow bay');
assert.match(lot, /function makeLockMarker\(\)/);
assert.match(lot, /classList\.contains\('is-trophy-locked'\)/,
  '3D lock markers must follow the existing Trophy Road gate');
assert.match(lot, /import \{ LOCK_ICON \} from '\.\.\/progression\/trophy-road\.js/,
  'The Lot must reuse the canonical Trophy Road lock icon instead of drawing a second lock shape');
assert.match(lot, /LOCK_ICON[\s\S]*new THREE\.TextureLoader\(\)\.load/,
  'The canonical lock SVG must be rasterized directly into the 3D lock badge texture');
assert.doesNotMatch(lot, /ctx\.arc\(80, 64, 34/,
  'The old hand-drawn 3D padlock must not return');
assert.match(lot, /function makeBeginnerFriendlyMarker\(\)/);
assert.match(lot, /sprite\.scale\.set\(5\.7, 3\.15, 1\)/,
  'The polished speech bubble must preserve the reference-like wider rounded silhouette');
assert.match(lot, /canvas\.width = 720/,
  'The beginner bubble must use a high-resolution texture for crisp 3D rendering');
assert.match(lot, /canvas\.height = 400/);
assert.match(lot, /ctx\.scale\(scale, scale\)/);
assert.match(lot, /const radius = 34/,
  'The speech bubble must keep the strongly rounded reference corners');
assert.match(lot, /ctx\.lineTo\(tailRight, bottom\)[\s\S]*ctx\.lineTo\(tailTipX, tailTipY\)[\s\S]*ctx\.lineTo\(tailLeft, bottom\)/,
  'The pointer must be part of the same continuous silhouette instead of a separate triangle');
assert.match(lot, /ctx\.lineWidth = 10/,
  'The speech bubble must retain the heavy black outline from the reference');
assert.match(lot, /ctx\.font = '700 37px system-ui, sans-serif'/,
  'The beginner guide must use the cleaner, slightly lighter reference-like type');
assert.match(lot, /BEGINNER-/);
assert.match(lot, /FRIENDLY/);
assert.match(lot, /showBeginnerGuide = !hasTriedTrainingCar\(\)/);
assert.match(lot, /stats\.replaceChildren\(\.\.\.makeStats\(car\.stats\)\)/,
  'Every visible attribute bar must render directly from the selected canonical car stats');
assert.doesNotMatch(lot, /RALLY_RACER_DISPLAY_STATS|displayStats/,
  'The Lot must not maintain display-only per-car attribute profiles');

assert.match(trainingGuide, /TRAINING_CAR_ID = 'classic'/);
assert.match(trainingGuide, /TRAINING_CAR_TRIED_STORAGE_KEY = 'turn-training-car-tried-v1'/);
assert.match(trainingGuide, /event\.detail\?\.running !== true/,
  'The beginner sign may retire only after TURN enters an actual running race');
assert.match(trainingGuide, /vehicleId === TRAINING_CAR_ID/);
assert.match(trainingGuide, /markTrainingCarTried\(\)/);

assert.doesNotMatch(layout, /appendChild\(colors\)|lot-view-close|lot-view-open/);
assert.match(layout, /document\.createTextNode\('ATTRIBUTES'\)/);
assert.match(layout, /carDescription\?\.classList\.add\('lot-a11y-only'\)/,
  'The visual description must become screen-reader-only without leaving CAR INFORMATION');
assert.match(layout, /carDescription\?\.classList\.remove\('lot-a11y-only'\)/,
  'The layout cleanup must restore the original description class state');
assert.match(layout, /infoButton\.textContent = 'i'/);
assert.match(layout, /aria-label', 'What do the attributes mean\?'/);
assert.doesNotMatch(layout, /MutationObserver|setAnimationLoop|requestAnimationFrame/);

assert.match(layoutCss, /\.lot-a11y-only \{[\s\S]*clip-path: inset\(50%\)/);
assert.match(layoutCss, /--lot-paint-rail-height: 54px/);
assert.match(layoutCss, /min-height: clamp\(150px, 28vh, 230px\)/);
assert.match(
  layoutCss,
  /\.lot-side \{[\s\S]*--lot-viewbox-min-height: clamp\(150px, 28vh, 230px\);[\s\S]*--lot-side-gap: 10px/,
  'The details card must derive its viewport budget from the protected 3D preview and rail gap'
);
assert.match(
  layoutCss,
  /\.lot-card \{[\s\S]*max-height: calc\(100% - var\(--lot-viewbox-min-height\) - var\(--lot-side-gap\)\);[\s\S]*overflow-y: auto;[\s\S]*overscroll-behavior: contain/,
  'Growing descriptions, perks and future detail rows must overflow inside the card rather than below the viewport'
);
assert.match(
  layoutCss,
  /\.lot-card-actions \{[\s\S]*position: sticky;[\s\S]*bottom: 0;/,
  'Race This Car must remain visible at the bottom of a constrained details card'
);
assert.match(
  layoutCss,
  /\.lot-card-actions \{[\s\S]*margin: 1px -6px -3px;[\s\S]*padding: 0 6px 3px;[\s\S]*background: transparent;/,
  'The sticky Race This Car shell must stay close to the button instead of masking stats with a broad opaque band'
);
assert.match(
  layoutCss,
  /@media \(max-height: 520px\)[\s\S]*--lot-viewbox-min-height: 140px;[\s\S]*--lot-side-gap: 7px/,
  'Short tablet landscapes must keep the card budget aligned with the compact viewer and gap'
);
assert.match(
  layoutCss,
  /@media \(max-height: 430px\)[\s\S]*--lot-viewbox-min-height: 120px;[\s\S]*--lot-side-gap: 7px/,
  'Short iPhone landscapes must keep the card budget aligned with the compact viewer and gap'
);
assert.match(layoutCss, /\.lot-viewbox-with-paint \.lot-colors \{[\s\S]*border-top: 3px solid var\(--ink\)/);
assert.doesNotMatch(layoutCss, /\.lot-color-input|\.lot-color-preset/);
assert.match(layoutCss, /\.lot-race \{[\s\S]*background: var\(--pink\)/);
assert.match(layoutCss, /@media \(max-height: 520px\)/);
assert.match(layoutCss, /@media \(max-height: 430px\)/);

assert.match(
  infoTypography,
  /\.lot-showroom \.lot-car-description\.lot-a11y-only\s*\{[\s\S]*display: block !important;/,
  'Short landscape layouts must keep the visually hidden description in the accessibility tree'
);
assert.match(infoTypography, /flex: 1 1 88px;[\s\S]*grid-template-rows: repeat\(6, minmax\(13px, 34px\)\);[\s\S]*align-content: space-between;[\s\S]*min-height: 88px;/,
  'All six attribute rows must stay readable while yielding enough height to avoid inner scrolling');
assert.match(infoTypography, /height: clamp\(13px, 2\.7vh, 18px\)/,
  'Meter segments must remain substantially larger than the old 7px bars');
assert.match(infoTypography, /border: 2px solid var\(--lot-stat-accent\)/,
  'Attribute category outlines must stay thin enough to preserve the dark meter fill');
assert.match(infoTypography, /outline: 0\.5px solid #000/,
  'Attribute meters must gain a 0.5px black outer edge');
assert.match(infoTypography, /outline-offset: -0\.5px/,
  'The black edge must sit inside the existing meter footprint rather than increase its size');
assert.match(infoPanel, /\.lot-showroom \.lot-card-actions\s*\{[\s\S]*padding: 2px 0 0;/,
  'The race action must sit close to the last attribute row');
assert.match(infoTypography, /--lot-stat-accent: var\(--turn-control-gas, #8ce99a\)/);
assert.match(infoTypography, /--lot-stat-accent: var\(--turn-control-drift, #38d9ff\)/);
assert.match(infoTypography, /--lot-stat-accent: var\(--turn-control-boost, #ffd43b\)/);
assert.match(infoTypography, /b\.is-full\s*\{[\s\S]*background: #313131;/,
  'Filled attribute segments must use the requested neutral #313131 fill');

assert.match(accessibility, /makeHiddenHeading\('lot-choose-car-heading', 'Choose car'\)/);
assert.match(accessibility, /makeHiddenHeading\('lot-paint-heading', 'Choose car colour'\)/);
assert.match(accessibility, /makeHiddenHeading\('lot-car-info-heading', 'Car information'\)/);
assert.match(accessibility, /button\.setAttribute\('aria-labelledby', description\.id\)/);
assert.match(accessibility, /selectedSummary\.textContent = completeTextByCarId\.get\(selectedCarId\)/);
assert.match(accessibility, /visibleOrder\.slice\(selectedIndex\)/,
  'VoiceOver order must rotate through the same stable order as the visible parking lot');
assert.match(accessibility, /describeVehicleStats\(car\.stats\)/,
  'VoiceOver must announce attributes from the same canonical car stats as the visible bars');
assert.doesNotMatch(accessibility, /RALLY_RACER_DISPLAY_STATS|getLotDisplayStats/,
  'VoiceOver must not maintain a separate per-car attribute profile');
assert.match(accessibility, /aria-posinset/);
assert.match(accessibility, /aria-setsize/);
assert.match(accessibility, /lotTitle\.focus\(\{ preventScroll: true \}\)/);
assert.match(accessibility, /Top speed/);
assert.match(accessibility, /Boost tank/);
assert.doesNotMatch(accessibility, /setInterval|requestAnimationFrame|setAnimationLoop/);

assert.match(legend, /VEHICLE_STAT_LEGEND/);
assert.match(legend, /aria-haspopup', 'dialog'/);
assert.match(legend, /role', 'dialog'/);
assert.match(legend, /name\.textContent = entry\.label/);
assert.match(legend, /description\.textContent = entry\.description/);

console.log(`TURN ${release.id} redesigned full-colour Lot, stable 5x3 order, canonical attributes, selection marker, progression locks, polished beginner guide and accessibility contract passed.`);
