import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, releaseSource, app, selector, renderer, css, scaleCss, hud] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/track-select.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/track-best-car.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/track-select-r61.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/m8-record-car-scale.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/hud.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const importMapText = index.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
assert.ok(importMapText, 'Production must expose its import map');
const imports = JSON.parse(importMapText).imports;
const releaseTarget = (path) => `${path}?build=${release.cacheKey}`;
const bestLayoutBlock = css.match(/\.track-card-best \{[\s\S]*?\n\}/)?.[0] || '';

assert.match(index, new RegExp(`track-select-r61\\.css\\?build=${release.cacheKey}`), 'Production must load the record-car thumbnail layout through the current release');
assert.equal(imports['./ui/track-select.js?build=20260722-r51'], releaseTarget('./ui/track-select.js'), 'Production must publish the enhanced selector');
assert.ok(
  imports['./race/rival-storage.js?build=20260722-r50']?.startsWith(releaseTarget('./race/rival-storage.js')),
  'The selector must receive the current paint-aware ranked record summaries'
);

assert.match(selector, /track-card-best-model/, 'Every playable Best row must reserve a model thumbnail');
assert.match(selector, /renderBestCarThumbnail\(bestLap\)/, 'Best rows must request the stored record car');
assert.match(selector, /track-best-car\.js\?build=20260801-r123-crop/, 'The selector must refresh the transparent-cropped renderer');
assert.match(selector, /bestLap\.carColor/, 'The thumbnail identity must include the stored body paint');
assert.match(selector, /bestLap\.carSecondaryColor/, 'The thumbnail identity must include stored secondary paint');
assert.match(selector, /aria-hidden="true"/, 'The decorative model must not duplicate the readable car name');
assert.match(selector, /model\.hidden = false/, 'The model must appear only after its render succeeds');
assert.match(selector, /for \(const track of TRACK_CATALOG\)/, 'Locked placeholder slots must never request a record thumbnail');

assert.match(renderer, /createCarVisual\(\{[\s\S]*carId,[\s\S]*color,[\s\S]*secondaryColor/, 'The thumbnail must use the real local GLB and its recorded paint');
assert.match(renderer, /preserveDrawingBuffer: true/, 'The one-shot WebGL render must remain capturable after drawing');
assert.match(renderer, /croppedThumbnailDataUrl\(renderer\.domElement\)/, 'The rendered car must be cropped before becoming the reusable image');
assert.match(renderer, /getImageData\(/, 'Thumbnail cropping must inspect the rendered alpha bounds');
assert.match(renderer, /alpha <= THUMBNAIL_ALPHA_THRESHOLD/, 'Transparent pixels must not reserve invisible space before the car');
assert.match(renderer, /croppedCanvas\.toDataURL\('image\/png'\)/, 'The cropped real 3D render must become a reusable thumbnail');
assert.match(renderer, /thumbnailCache/, 'Repeated track visits must reuse identical rendered cars');
assert.match(renderer, /renderQueue/, 'Multiple record cars must render serially rather than opening several WebGL contexts at once');
assert.match(renderer, /renderer\.dispose\(\)/, 'Each one-shot renderer must release GPU resources');
assert.match(renderer, /renderer\.forceContextLoss\?\.\(\)/, 'The temporary WebGL context must be explicitly released');
assert.doesNotMatch(renderer, /requestAnimationFrame|setAnimationLoop|setInterval/, 'Record thumbnails must add no continuous render loop');

assert.match(bestLayoutBlock, /grid-template-columns: max-content max-content;/, 'BEST copy and car must use content-sized columns');
assert.match(bestLayoutBlock, /justify-content: start;/, 'The BEST cluster must remain left anchored');
assert.match(bestLayoutBlock, /width: fit-content;/, 'The BEST cluster must not stretch across the summary area');
assert.doesNotMatch(bestLayoutBlock, /1fr/, 'The BEST layout must not use a flexible column that pushes the car away from the record copy');
assert.match(css, /\.track-card-best-model \{[\s\S]*justify-self: start;[\s\S]*width: clamp\(120px, 10\.5vw, 174px\)[\s\S]*height: clamp\(75px, 8\.5vw, 110px\)[\s\S]*object-fit: contain/, 'The base stored-vehicle layout must retain its proportions');
assert.match(css, /@media \(max-height: 610px\) and \(orientation: landscape\)/, 'Short landscape devices must retain a fitted record-car treatment');
assert.match(css, /\.track-card-coming-soon \{[\s\S]*grid-template-columns: minmax\(0, 1fr\)[\s\S]*width: 100%/, 'The locked card must not reserve an empty car column');
assert.match(css, /\.track-card-best-model\[hidden\] \{[\s\S]*display: none;/, 'No-time cards must remove the decorative model from layout');

assert.match(app, /m8-record-car-scale\.css\?revision=r206-three-records/, 'The three-record car override must load after the fixed Home layout');
assert.ok(
  app.indexOf('await installM8HomeFixedLayout()') < app.indexOf('m8-record-car-scale.css?revision=r206-three-records'),
  'The three-record car override must win the M8 layout cascade'
);
assert.match(scaleCss, /\.track-card-record[\s\S]*grid-template-columns: minmax\(0, 1fr\) minmax\(92px, 40%\)/, 'Each Home record must reserve readable copy and car columns');
assert.match(scaleCss, /\.track-card-record-model[\s\S]*justify-self: end/, 'Record cars must align consistently at the outside edge');
assert.match(scaleCss, /object-position: right center/, 'The visible car must face the record copy from a consistent image box');
assert.match(scaleCss, /width: clamp\(88px, 9vw, 122px\)/, 'Standard record cars must be clearly visible without dominating the card');
assert.match(scaleCss, /height: clamp\(48px, 7vh, 66px\)/, 'Three standard car rows must fit inside an expanded card');
assert.match(scaleCss, /width: clamp\(72px, 9vw, 102px\)/, 'Short landscape cards must use the smaller three-record car');
assert.match(scaleCss, /height: 46px/, 'Short landscape record cars must stay within their record rows');
assert.doesNotMatch(scaleCss, /width: clamp\(144px, 18vw, 236px\)|height: clamp\(86px, 14vh, 140px\)/, 'The post-crop oversized dimensions must not return');

assert.doesNotMatch(app, /installPlayerMapMarker|player-map-marker\.js/, 'The runtime must not install a second player-marker overlay');
assert.match(hud, /const PLAYER_MAP_RADIUS = 9;/, 'The canonical local-player marker must be larger than six-pixel rival dots');
assert.match(hud, /const PLAYER_MAP_FILL = '#ffff09';/, 'The canonical local-player marker must use the requested vivid yellow');
assert.match(hud, /const PLAYER_MAP_INK = '#000000';/, 'The canonical player border and centre must be black');
assert.match(hud, /const PLAYER_MAP_INNER_RADIUS = 3;/, 'The player marker must have a visible black centre dot');
assert.match(hud, /const PLAYER_MAP_BORDER_WIDTH = 4;/, 'The yellow marker must retain a strong black outline');
assert.equal((hud.match(/drawPlayerMapMarker\(mapCtx, playerPoint\)/g) || []).length, 1, 'The canonical map pass must compute and paint one player marker');
assert.ok(
  hud.indexOf('for (let index = 0; index < state.competitorLaps.length; index += 1)') < hud.indexOf('drawPlayerMapMarker(mapCtx, playerPoint)'),
  'The player marker must be drawn after every rival and stay on top'
);
assert.doesNotMatch(hud, /queueMicrotask|requestAnimationFrame|setInterval/, 'The player marker must remain part of the existing synchronous HUD paint');

console.log(`TURN ${release.id} three-record Home cars and one top-layer canonical player marker passed.`);
