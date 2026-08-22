import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [m8Home, showroom, showroomCss, showroomCleanupCss, wrapper, accessibility] = await Promise.all([
  fs.readFile(new URL('../turn/m8-home.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/garage/lot-showroom-experiment.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/garage/lot-showroom-experiment.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/garage/lot-showroom-cleanup-r201.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/garage/lot-track-select.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/garage/lot-accessibility-r118.js', import.meta.url), 'utf8')
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
assert.match(wrapper, /function mountEnhancedLot\(options\)/,
  'Prepared callers must have a synchronous showroom mount path');
assert.match(wrapper, /export function showEnhancedLot/);
assert.match(wrapper, /if \(originalLotModule\) return mountEnhancedLot\(options\)/,
  'M8 must not cross another asynchronous boundary once the showroom has been prepared');
assert.match(wrapper, /lot-showroom-experiment\.js\?revision=r200-production-candidate/,
  'The production wrapper must lazy-load the current showroom implementation');
assert.match(wrapper, /lot-showroom-experiment\.css\?revision=r200-production-candidate/,
  'The showroom stylesheet must have its own cache identity');
assert.match(wrapper, /lot-showroom-cleanup-r201\.css\?revision=r201-loading-cleanup/,
  'The production wrapper must preload the small showroom polish layer before mount');
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
  'Locked PAINTJOB must remain a compact floating control inside the 3D preview'
);
assert.match(showroomCss, /\.lot-showroom \.lot-color-control input\[type='color'\]/,
  'Unlocked paint must remain a native colour input presented as a swatch');
assert.match(
  showroomCss,
  /\.lot-showroom \.lot-paint-lock-copy[\s\S]*clip-path: inset\(50%\)/,
  'The locked PAINTJOB explanation must remain accessible without occupying visible showroom space'
);
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

assert.match(accessibility, /screen\.classList\.contains\('lot-showroom'\)/,
  'Accessibility behavior must explicitly recognize the visible showroom radio rail');
assert.match(accessibility, /if \(!preserveVisualOrder && selectedCarId/,
  'VoiceOver support must preserve stable visual DOM order in the showroom while retaining the legacy hidden-radio behavior elsewhere');
assert.match(accessibility, /aria-posinset/);
assert.match(accessibility, /aria-setsize/);
assert.match(accessibility, /describeVehicleStats\(car\.stats\)/,
  'Screen-reader vehicle summaries must still use the same canonical attributes as the visible panel');

console.log('TURN M8 Home now enters a prepared production showroom Lot with compact paint, yaw-only level car rotation, simple colour-block loading placeholders, real 3D car thumbnails, bounded rendering and stable accessible card order.');
