import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, selector, renderer, css] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/track-select.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/track-best-car.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/track-select-r61.css', import.meta.url), 'utf8')
]);

assert.match(index, /track-select-r61\.css\?build=20260724-r61/, 'Production must load the record-car thumbnail layout');
assert.match(index, /"\.\/ui\/track-select\.js\?build=20260722-r51": "\.\/ui\/track-select\.js\?build=20260724-r61"/, 'Production must cache-bust the enhanced selector');
assert.match(index, /"\.\/race\/rival-storage\.js\?build=20260722-r50": "\.\/race\/rival-storage\.js\?build=20260724-r61"/, 'The selector must receive paint-aware record summaries');

assert.match(selector, /track-card-best-model/, 'Every Best badge must reserve a model thumbnail');
assert.match(selector, /renderBestCarThumbnail\(bestLap\)/, 'Best badges must request the stored record car');
assert.match(selector, /bestLap\.carColor/, 'The thumbnail identity must include the stored body paint');
assert.match(selector, /bestLap\.carSecondaryColor/, 'The thumbnail identity must include stored secondary paint');
assert.match(selector, /aria-hidden="true"/, 'The decorative model must not duplicate the readable car name');
assert.match(selector, /model\.hidden = false/, 'The model must appear only after its render succeeds');

assert.match(renderer, /createCarVisual\(\{[\s\S]*carId,[\s\S]*color,[\s\S]*secondaryColor/, 'The thumbnail must use the real local GLB and its recorded paint');
assert.match(renderer, /preserveDrawingBuffer: true/, 'The one-shot WebGL render must remain capturable after drawing');
assert.match(renderer, /renderer\.domElement\.toDataURL\('image\/png'\)/, 'The real 3D render must become a lightweight reusable thumbnail');
assert.match(renderer, /thumbnailCache/, 'Repeated track visits must reuse identical rendered cars');
assert.match(renderer, /renderQueue/, 'Multiple record cars must render serially rather than opening several WebGL contexts at once');
assert.match(renderer, /renderer\.dispose\(\)/, 'Each one-shot renderer must release GPU resources');
assert.match(renderer, /renderer\.forceContextLoss\?\.\(\)/, 'The temporary WebGL context must be explicitly released');
assert.doesNotMatch(renderer, /requestAnimationFrame|setAnimationLoop|setInterval/, 'Record thumbnails must add no continuous render loop');

assert.match(css, /grid-template-columns: minmax\(0, 1fr\) clamp\(64px, 7\.2vw, 86px\)/, 'The Best badge must reserve a controlled model column');
assert.match(css, /\.track-card-best-model \{[\s\S]*object-fit: contain/, 'Every vehicle shape must fit without distortion');
assert.match(css, /@media \(max-height: 610px\) and \(orientation: landscape\)/, 'Short landscape devices must receive a compact thumbnail treatment');
assert.match(css, /:has\(\.track-card-best-model:not\(\[hidden\]\)\)/, 'No-time cards must collapse back to the compact text-only badge');

console.log('TURN track-specific record car 3D thumbnails passed.');
