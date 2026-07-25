import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, releaseSource, selector, renderer, css] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/track-select.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/track-best-car.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/track-select-r61.css', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const importMapText = index.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
assert.ok(importMapText, 'Production must expose its import map');
const imports = JSON.parse(importMapText).imports;
const releaseTarget = (path) => `${path}?build=${release.cacheKey}`;

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

assert.match(css, /\.track-card-best \{[\s\S]*display: grid;[\s\S]*grid-template-columns: minmax\(90px, max-content\) minmax\(88px, 1fr\);[\s\S]*width: 100%;[\s\S]*background: transparent;/, 'The Best row must use the available summary width for copy and car');
assert.match(css, /\.track-card-best-model \{[\s\S]*width: clamp\(86px, 8vw, 126px\)[\s\S]*height: clamp\(54px, 6\.8vw, 88px\)[\s\S]*object-fit: contain/, 'The stored vehicle must be large enough to read while retaining its proportions');
assert.match(css, /@media \(max-height: 610px\) and \(orientation: landscape\)/, 'Short landscape devices must retain a fitted record-car treatment');
assert.match(css, /\.track-card-coming-soon \{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/, 'The locked card must not reserve an empty car column');
assert.match(css, /\.track-card-best-model\[hidden\] \{[\s\S]*display: none;/, 'No-time cards must remove the decorative model from layout');

console.log(`TURN ${release.id} expanded track-specific record car layout passed.`);
