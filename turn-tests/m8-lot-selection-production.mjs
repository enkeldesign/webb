import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  m8Home,
  showroom,
  showroomCss,
  showroomCleanupCss,
  wrapper,
  accessibility,
  screenReaderPass,
  perkDisclosure,
  paintReward,
  enhancementRuntime
] = await Promise.all([
  fs.readFile(new URL('../turn/m8-home.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/garage/lot-showroom-experiment.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/garage/lot-showroom-experiment.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/garage/lot-showroom-cleanup-r201.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/garage/lot-track-select.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/garage/lot-accessibility-r118.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/garage/lot-screen-reader-r202.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/garage/lot-perk-disclosure.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/progression/lot-paint-reward.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/garage/lot-enhancement-runtime.js', import.meta.url), 'utf8')
]);

assert.match(
  m8Home,
  /import \{ prepareEnhancedLot, showEnhancedLot as showTheLot \} from '\/turn\/garage\/lot-track-select\.js\?revision=r200-production-candidate';/,
  'The active M8 Home route must enter the prepared showroom wrapper instead of bypassing it through the legacy parking-lot implementation'
);
assert.match(
  m8Home,
  /await Promise\.all\(\[[\s\S]*activateTrack\(selectedTrackId, runtime\),[\s\S]*prepareEnhancedLot\(\)[\s\S]*\]\);/,
  'M8 must prepare the showroom in parallel with track activation so its controls can mount synchronously once Home is hidden'
);
assert.match(
  m8Home,
  /const lotPromise = showTheLot\(\{ initialSelection: selectedVehicle\(runtime\) \}\);/,
  'M8 must still open car selection with the current saved vehicle after activating the selected track'
);
assert.ok(
  m8Home.indexOf('prepareEnhancedLot()') < m8Home.indexOf('const lotPromise = showTheLot'),
  'The showroom must be prepared before M8 attaches the existing Race This Car motion-access gate'
);
assert.ok(
  m8Home.indexOf('const lotPromise = showTheLot') < m8Home.indexOf('const removeRaceGate = installLotRaceGate'),
  'Opening the prepared showroom must synchronously mount Race This Car before the M8 race gate queries it'
);

assert.match(wrapper, /export async function prepareEnhancedLot/,
  'The wrapper must expose an explicit showroom warmup contract');
assert.match(wrapper, /let originalLotModule = null/);
assert.match(wrapper, /originalLotModule = module/,
  'Warmup must retain the resolved showroom module for synchronous mounting');
assert.match(wrapper, /lot-screen-reader-r202\.js\?revision=r202-heading-structure/,
  'The production wrapper must preload the showroom-specific screen reader pass');
assert.match(wrapper, /screenReaderPassModule = module/,
  'The prepared accessibility pass must be retained for synchronous showroom mounting');
assert.match(wrapper, /function mountEnhancedLot\(options\)/,
  'Prepared callers must have a synchronous showroom mount path');
assert.match(wrapper, /const removeEnhancements = enhanceLotNow\(\);[\s\S]*const removeScreenReaderPass = installLotScreenReaderPass\(\);/,
  'The semantic pass must run after established Trophy Road, paint, perk and layout enhancements have produced their final DOM');
assert.match(wrapper, /removeScreenReaderPass\(\);[\s\S]*removeEnhancements\(\);/,
  'Showroom semantic cleanup must release before the underlying enhancement bundle');
assert.match(wrapper, /export function showEnhancedLot/);
assert.match(wrapper, /if \(originalLotModule && screenReaderPassModule\) return mountEnhancedLot\(options\)/,
  'M8 must not cross another asynchronous boundary once the showroom and semantic pass have been prepared');
assert.match(wrapper, /lot-showroom-experiment\.js\?revision=r200-production-candidate/,
  'The production wrapper must lazy-load the current showroom implementation');
assert.match(wrapper, /lot-showroom-experiment\.css\?revision=r200-production-candidate/,
  'The showroom stylesheet must have its own cache identity');
assert.match(wrapper, /lot-showroom-cleanup-r201\.css\?revision=r203-thumbnail-color-polish/,
  'The production wrapper must preload the current showroom polish layer with a fresh cache identity');
assert.match(wrapper, /SHOWROOM_CLEANUP_STYLE_ID = 'turn-lot-showroom-r203-polish'/,
  'The polish stylesheet link must not reuse the previous cached link identity');
assert.match(wrapper, /link\.addEventListener\('load', resolve/,
  'The Lot must wait for its showroom stylesheets before mounting to avoid a layout flash');

assert.match(showroom, /overlay\.className = 'lot-screen lot-showroom'/,
  'The production car selector must mount with the stable showroom state hook');
assert.match(showroom, /LOT_FRAME_INTERVAL_MS = 1000 \/ 30/,
  'The live hero preview must remain capped at 30fps');
assert.match(showroom, /document\.hidden/,
  'The hero renderer must stop doing useful work while the document is hidden');
assert.match(showroom, /prefers-reduced-motion: reduce/,
  'The showroom must retain reduced-motion behavior');
assert.match(showroom, /DRAG LEFT \/ RIGHT TO ROTATE/,
  'The visible interaction hint must describe the showroom yaw-only rotation');
assert.match(showroom, /yaw \+= dx \* 0\.012/,
  'Horizontal dragging must rotate the selected car around its vertical axis');
assert.match(showroom, /stage\.rotation\.set\(0, yaw, 0\)/,
  'The selected car must stay level by applying yaw with zero pitch and roll');
assert.doesNotMatch(showroom, /let pitch\s*=|pitch\s*=|stage\.rotation\.x\s*=|lastY|const dy = event\.clientY/,
  'Vertical pointer movement must never pitch or roll the selected showroom car');
assert.match(showroom, /function createThumbnailRenderer\(\)/,
  'The visible car rail must render actual TURN car models');
assert.match(showroom, /preserveDrawingBuffer: true/,
  'Real model thumbnails must be copied from the temporary WebGL renderer into persistent 2D canvases');
assert.match(showroom, /powerPreference: 'low-power'/,
  'Thumbnail rendering must prefer a low-power temporary context');
assert.match(showroom, /await yieldForThumbnailWork\(\)/,
  'Thumbnail generation must yield between vehicles rather than monopolizing the main thread');
assert.match(showroom, /requestIdleCallback/,
  'Thumbnail generation should use idle time when the browser exposes it');
assert.match(showroom, /renderer\?\.forceContextLoss\?\.\(\)/,
  'The temporary thumbnail WebGL context must be explicitly released');
assert.match(showroom, /className = 'lot-car-option-thumbnail'/,
  'Each visible vehicle card must receive a canvas for its real 3D model thumbnail');
assert.doesNotMatch(showroom, /makeLotGround|makeParkingPad|const positions = LOT_CARS/,
  'The showroom must not rebuild the legacy continuously rendered 15-car parking scene');

assert.match(
  showroomCss,
  /\.lot-showroom \.lot-view-host,[\s\S]*inset: 0;/,
  'Removing the paint rail must give the hero 3D preview the complete panel height'
);
assert.match(
  showroomCss,
  /\.lot-showroom \.lot-viewbox-with-paint \.lot-colors\.is-paint-locked[\s\S]*bottom: 12px;[\s\S]*left: 12px;/,
  'Locked PAINTJOB must retain the compact floating-control styling'
);
assert.match(showroomCss, /\.lot-showroom \.lot-color-control input\[type='color'\]/,
  'Unlocked paint must remain a native colour input presented as a swatch');
assert.match(showroomCss, /\.lot-showroom \.lot-car-option\.has-3d-thumbnail \.lot-car-option-thumbnail \{ opacity: 1; \}/,
  'Cards must progressively replace their lightweight fallback with the real model thumbnail');

assert.match(
  showroomCleanupCss,
  /\.lot-showroom \.lot-viewbox::before\s*\{[\s\S]*content: none;[\s\S]*display: none;/,
  'The 3D hero view must not carry the redundant decorative TURN sign'
);
assert.match(
  showroomCleanupCss,
  /\.lot-showroom \.lot-car-option-fallback i:first-child[\s\S]*background: var\(--lot-car-color/,
  'Thumbnail loading fallback must be a simple block using the car body colour'
);
assert.match(
  showroomCleanupCss,
  /\.lot-showroom \.lot-car-option-fallback i:nth-child\(2\),[\s\S]*i:nth-child\(3\)[\s\S]*display: none;/,
  'Thumbnail loading fallback must not draw wheels or other hand-drawn car details'
);
assert.doesNotMatch(showroomCleanupCss, /lot-car-secondary/,
  'The loading placeholder should stay deliberately abstract instead of trying to mimic the finished car');
assert.match(
  showroomCleanupCss,
  /\.lot-showroom \.lot-car-option-thumbnail\s*\{[\s\S]*object-fit: contain;[\s\S]*object-position: center;/,
  'Rendered 20:9 car thumbnails must preserve their intrinsic aspect ratio instead of stretching with responsive cards'
);
assert.match(showroomCleanupCss, /\.lot-showroom \.lot-color-visible-label[\s\S]*font-weight: 950/,
  'The floating paint swatch must have a visible COLOR label');
assert.match(
  showroomCleanupCss,
  /\.lot-showroom \.lot-paint-lock-copy[\s\S]*position: static !important;[\s\S]*clip-path: none !important;/,
  'Locked color must show its unlock requirement beside the swatch instead of hiding all explanatory copy'
);

assert.match(perkDisclosure, /const activeDisclosures = new WeakMap\(\)/,
  'Perk disclosure must keep one active installer per Lot screen');
assert.match(perkDisclosure, /const active = activeDisclosures\.get\(screen\);[\s\S]*if \(active\) return active\.release;/,
  'A second enhancement pass must reuse the existing perk disclosure rather than append another copy');
assert.match(perkDisclosure, /querySelectorAll\('\.lot-perk-disclosure'\)[\s\S]*stale\.remove\(\)/,
  'Any stale duplicate perk block from an older install must be removed before mounting the canonical copy');
assert.match(perkDisclosure, /activeDisclosures\.delete\(screen\)/,
  'Perk disclosure idempotency state must be released with the Lot');

assert.match(paintReward, /label\.className = 'lot-color-visible-label'/,
  'Paint gating must create a real visible COLOR label rather than relying on generated CSS content');
assert.match(paintReward, /label\.setAttribute\('aria-hidden', 'true'\)/,
  'The visual COLOR label must not duplicate the named Choose color group for screen readers');
assert.match(paintReward, /`<strong>\$\{threshold\} 🏆<\/strong><small>TO UNLOCK<\/small>`/,
  'Locked paint must display its Trophy Road unlock requirement next to the swatch');
assert.match(paintReward, /`Color locked\. Car color controls unlock at \$\{threshold\} trophies on Trophy Road\.`/,
  'The locked color button must explain specifically that color, not the whole car, is locked');
assert.match(enhancementRuntime, /lot-perk-disclosure\.js\?revision=r217-stable-perk-slot/,
  'The fixed perk installer must receive a fresh module cache identity');
assert.match(enhancementRuntime, /lot-paint-reward\.js\?revision=r203-color-label/,
  'The clarified color gate must receive a fresh module cache identity');

// The established accessibility layer stays available for legacy Lot compatibility.
assert.match(accessibility, /screen\.classList\.contains\('lot-showroom'\)/,
  'Accessibility behavior must still recognize the visible showroom radio rail');
assert.match(accessibility, /aria-posinset/);
assert.match(accessibility, /aria-setsize/);

// The showroom-specific pass owns the final non-visual information architecture.
assert.match(screenReaderPass, /makeHeading\(2, 'lot-sr-choose-car', 'Choose car'\)/,
  'The Lot must expose CHOOSE CAR as the first H2');
assert.match(screenReaderPass, /makeHeading\(3, 'lot-sr-car-information', 'Car information'\)/,
  'Selected vehicle detail must be introduced by H3 CAR INFORMATION');
assert.match(screenReaderPass, /makeHeading\(2, 'lot-sr-race', 'Race'\)/,
  'RACE must be the next H2 after CAR INFORMATION');
assert.doesNotMatch(screenReaderPass, /makeHeading\([^\n]*Choose (?:car )?colou?r/i,
  'CHOOSE COLOR must not become another heading between CAR INFORMATION and RACE');
assert.match(screenReaderPass, /colors\.setAttribute\('role', 'group'\);[\s\S]*colors\.setAttribute\('aria-label', 'Choose color'\)/,
  'Colour controls must be a named control group rather than a heading');
assert.match(screenReaderPass, /card\.insertBefore\(colors, raceHeading\)/,
  'The actual colour controls must follow car information and precede RACE in DOM order');
assert.match(screenReaderPass, /side\.insertAdjacentElement\('beforebegin', pickerShell\)/,
  'The CHOOSE CAR section must precede CAR INFORMATION in DOM order without changing the absolute visual layout');
assert.match(screenReaderPass, /screen\.removeAttribute\('aria-labelledby'\)/,
  'The full-screen section must not duplicate THE LOT as a named region and an H1');
assert.match(screenReaderPass, /headingPitch\?\.setAttribute\('aria-hidden', 'true'\)/,
  'The decorative CHOOSE YOUR RIDE tagline must not duplicate the CHOOSE CAR section name');
assert.match(screenReaderPass, /progressSummary\?\.removeAttribute\('aria-live'\)/,
  'Availability decoration must not repeatedly announce itself while Trophy Road classes settle');
assert.match(screenReaderPass, /carDescription\.removeAttribute\('aria-hidden'\);[\s\S]*stats\.removeAttribute\('aria-hidden'\)/,
  'CAR INFORMATION must expose the real visible description and stat rows once instead of a duplicate hidden summary');
assert.match(screenReaderPass, /button\.removeAttribute\('aria-labelledby'\);[\s\S]*button\.setAttribute\('aria-label', conciseCarLabel\(button\)\)/,
  'Car radios must use concise names instead of hidden labels containing the description and all six stats');
assert.doesNotMatch(screenReaderPass, /describeVehicleStats/,
  'The car picker must not repeat all vehicle stats before CAR INFORMATION');
assert.match(screenReaderPass, /raceSummary\.textContent = `\$\{carName\} on \$\{trackName\}`/,
  'RACE must state the selected car and selected track before the action');
assert.match(screenReaderPass, /raceButton\.removeAttribute\('aria-label'\);[\s\S]*raceButton\.setAttribute\('aria-describedby', descriptions\.join\(' '\)\)/,
  'RACE THIS CAR must keep its visible button name while car/track and lock information are descriptions');
assert.match(screenReaderPass, /event\.detail === 0\) queueInformationFocus\(\)/,
  'Screen-reader or keyboard activation of a car must move focus to CAR INFORMATION');
assert.match(screenReaderPass, /\['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'\]/,
  'Arrow-key car selection must also move focus to CAR INFORMATION');
assert.match(screenReaderPass, /infoHeading\.tabIndex = -1/,
  'CAR INFORMATION must support programmatic focus without adding an extra Tab stop');
assert.match(screenReaderPass, /cycle\.tabIndex = -1;[\s\S]*cycle\.setAttribute\('aria-hidden', 'true'\)/,
  'Redundant visual previous/next buttons must not add duplicate non-visual navigation stops');
assert.match(screenReaderPass, /lot-color-name'\)\?\.setAttribute\('aria-hidden', 'true'\)/,
  'Hidden visual colour labels must not be read separately from their native colour input');
assert.match(screenReaderPass, /input\.setAttribute\('aria-label', `\$\{label\} color\. \$\{cue\}\.`\)/,
  'Each native colour input must expose one concise label including the non-visual colour cue');
assert.match(screenReaderPass, /bottom: calc\(var\(--lot-picker-height, 122px\) \+ 12px\)/,
  'Moving the colour controls semantically must preserve their floating position over the 3D view');

console.log('TURN M8 Lot keeps proportional 3D thumbnails, one perk disclosure, a visibly labelled COLOR control with unlock info, and the H1/H2/H3/H2 screen-reader structure.');
