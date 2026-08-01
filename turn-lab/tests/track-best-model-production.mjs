import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, releaseSource, app, selector, renderer, css, scaleCss, playerMarker] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/track-select.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/track-best-car.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/track-select-r61.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/m8-record-car-scale.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/player-map-marker.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const importMapText = index.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
assert.ok(importMapText, 'Production must expose its import map');
const imports = JSON.parse(importMapText).imports;
const releaseTarget = (path) => `${path}?build=${release.cacheKey}`;
const bestLayoutBlock = css.match(/\.track-card-best \{[\s\S]*?\n\}/)?.[0] || '';

assert.match(index, new RegExp(`track-select-r61\\.css\\?build=${release.cacheKey}`), 'Production must load the record-car thumbnail layout through the current release');
assert.equal(imports['./ui/track-select.js?build=20260722-r51'], releaseTarget('./ui/track-select.js'), 'Production must publish the enhanced selector');
assert.equal(imports['./race/rival-storage.js?build=20260722-r50'], releaseTarget('./race/rival-storage.js'), 'The selector must receive paint-aware record summaries');

assert.match(selector, /track-card-best-model/, 'Every playable Best row must reserve a model thumbnail');
assert.match(selector, /renderBestCarThumbnail\(bestLap\)/, 'Best rows must request the stored record car');
assert.match(selector, /bestLap\.carColor/, 'The thumbnail identity must include the stored body paint');
assert.match(selector, /bestLap\.carSecondaryColor/, 'The thumbnail identity must include stored secondary paint');
assert.match(selector, /aria-hidden="true"/, 'The decorative model must not duplicate the readable car name');
assert.match(selector, /model\.hidden = false/, 'The model must appear only after its render succeeds');
assert.match(selector, /for \(const track of TRACK_CATALOG\)/, 'Locked placeholder slots must never request a record thumbnail');

assert.match(renderer, /createCarVisual\(\{[\s\S]*carId,[\s\S]*color,[\s\S]*secondaryColor/, 'The thumbnail must use the real local GLB and its recorded paint');
assert.match(renderer, /preserveDrawingBuffer: true/, 'The one-shot WebGL render must remain capturable after drawing');
assert.match(renderer, /renderer\.domElement\.toDataURL\('image\/png'\)/, 'The real 3D render must become a lightweight reusable thumbnail');
assert.match(renderer, /thumbnailCache/, 'Repeated track visits must reuse identical rendered cars');
assert.match(renderer, /renderQueue/, 'Multiple record cars must render serially rather than opening several WebGL contexts at once');
assert.match(renderer, /renderer\.dispose\(\)/, 'Each one-shot renderer must release GPU resources');
assert.match(renderer, /renderer\.forceContextLoss\?\.\(\)/, 'The temporary WebGL context must be explicitly released');
assert.doesNotMatch(renderer, /requestAnimationFrame|setAnimationLoop|setInterval/, 'Record thumbnails must add no continuous render loop');

assert.match(bestLayoutBlock, /grid-template-columns: max-content max-content;/, 'BEST copy and car must use content-sized columns');
assert.match(bestLayoutBlock, /justify-content: start;/, 'The BEST cluster must remain left anchored');
assert.match(bestLayoutBlock, /width: fit-content;/, 'The BEST cluster must not stretch across the summary area');
assert.doesNotMatch(bestLayoutBlock, /1fr/, 'The BEST layout must not use a flexible column that pushes the car away from the record copy');
assert.match(css, /\.track-card-best-model \{[\s\S]*justify-self: start;[\s\S]*width: clamp\(120px, 10\.5vw, 174px\)[\s\S]*height: clamp\(75px, 8\.5vw, 110px\)[\s\S]*object-fit: contain/, 'The stored vehicle must use the available card space while retaining its proportions');
assert.match(css, /@media \(max-height: 610px\) and \(orientation: landscape\)/, 'Short landscape devices must retain a fitted record-car treatment');
assert.match(css, /\.track-card-coming-soon \{[\s\S]*grid-template-columns: minmax\(0, 1fr\)[\s\S]*width: 100%/, 'The locked card must not reserve an empty car column');
assert.match(css, /\.track-card-best-model\[hidden\] \{[\s\S]*display: none;/, 'No-time cards must remove the decorative model from layout');

assert.match(app, /m8-record-car-scale\.css\?revision=r122/, 'The enlarged record-car override must load after the fixed Home layout');
assert.ok(
  app.indexOf('await installM8HomeFixedLayout()') < app.indexOf("m8-record-car-scale.css?revision=r122"),
  'The record-car scale override must win the M8 layout cascade'
);
assert.match(scaleCss, /grid-template-columns: minmax\(0, auto\) minmax\(144px, 1fr\)/, 'The BEST row must reserve room for the doubled car');
assert.match(scaleCss, /width: clamp\(144px, 18vw, 236px\)/, 'The standard record car must be twice the previous M8 width');
assert.match(scaleCss, /height: clamp\(86px, 14vh, 140px\)/, 'The standard record car must be twice the previous M8 height');
assert.match(scaleCss, /width: clamp\(120px, 16vw, 176px\)/, 'Short landscape cards must also double the record car');
assert.match(scaleCss, /height: 84px/, 'Short landscape record cars must retain twice their former height');

assert.match(app, /player-map-marker\.js\?revision=r122/, 'The player marker enhancement must be installed by the canonical runtime');
assert.ok(
  app.indexOf("await import(withBuild('./main.js'))") < app.indexOf('installPlayerMapMarker()'),
  'The marker must patch the live map context only after the canonical map exists'
);
assert.match(playerMarker, /const PLAYER_RADIUS = 9;/, 'The local player marker must be larger than six-pixel rival dots');
assert.match(playerMarker, /const PLAYER_FILL = '#ffff00';/, 'The local player marker must use the requested yellow');
assert.match(playerMarker, /const PLAYER_INK = '#000000';/, 'The local player marker border and centre must be black');
assert.match(playerMarker, /const PLAYER_INNER_RADIUS = 3;/, 'The player marker must have a visible black centre dot');
assert.match(playerMarker, /const PLAYER_BORDER_WIDTH = 4;/, 'The yellow marker must retain a strong black outline');
assert.match(playerMarker, /context\.clearRect = \(\.\.\.args\) =>/, 'The enhancement must attach to the existing map paint cycle');
assert.match(playerMarker, /queueMicrotask\(\(\) => \{[\s\S]*drawPlayerMarker\(\)/, 'The local player must repaint after rivals and remain the top map layer');
assert.doesNotMatch(playerMarker, /requestAnimationFrame|setInterval/, 'The map emphasis must not add a second continuous animation loop');

console.log(`TURN ${release.id} enlarged record cars and top-layer player map marker passed.`);
