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

assert.match(css, /\.track-card-best \{[\s\S]*grid-template-columns: max-content max-content;[\s\S]*justify-content: start;[\s\S]*width: fit-content;[\s\S]*background: transparent;/, 'BEST copy and car must form one left-anchored content cluster rather than stretching apart');
assert.doesNotMatch(css, /grid-template-columns:[^;]*1fr[^;]*;/, 'The BEST layout must not use a flexible column that pushes the car away from the record copy');
assert.match(css, /\.track-card-best-model \{[\s\S]*justify-self: start;[\s\S]*width: clamp\(120px, 10\.5vw, 174px\)[\s\S]*height: clamp\(75px, 8\.5vw, 110px\)[\s\S]*object-fit: contain/, 'The stored vehicle must use the available card space while retaining its proportions');
assert.match(css, /@media \(max-height: 610px\) and \(orientation: landscape\)/, 'Short landscape devices must retain a fitted record-car treatment');
assert.match(css, /\.track-card-coming-soon \{[\s\S]*grid-template-columns: minmax\(0, 1fr\)[\s\S]*width: 100%/, 'The locked card must not reserve an empty car column');
assert.match(css, /\.track-card-best-model\[hidden\] \{[\s\S]*display: none;/, 'No-time cards must remove the decorative model from layout');

console.log(`TURN ${release.id} clustered track-specific record car layout passed.`);
