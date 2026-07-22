import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const turnRoot = path.resolve(here, '../../turn');

const index = fs.readFileSync(path.join(turnRoot, 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(turnRoot, 'styles.css'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(turnRoot, 'site.webmanifest'), 'utf8'));

assert.match(index, /TURN v1\.6\.2 · Build 2026\.07\.22-r52/);
assert.match(index, /<link rel="icon" href="\.\/favicon-r45\.ico" sizes="any">/);
assert.match(index, /<link rel="icon" href="\.\/favicon-32-r45\.png" type="image\/png" sizes="32x32">/);
assert.match(index, /<link rel="apple-touch-icon" href="\.\/apple-touch-icon-r45\.png" sizes="180x180">/);
assert.match(index, /<link rel="manifest" href="\.\/site\.webmanifest\?build=20260722-r52">/);
assert.match(index, /<img class="install-icon" src="\.\/icon-512-r45\.png" alt="">/);
assert.match(index, /<h1 class="start-logo-heading" id="title">\s*<img class="start-logo" src="\.\/icon-512-r45\.png" alt="TURN">\s*<\/h1>/);
assert.doesNotMatch(index, /apple-touch-icon-v4|icon-192-v4/);

assert.match(styles, /\.start-logo-heading\s*\{[^}]*font-size:\s*0;/s);
assert.match(styles, /\.start-logo\s*\{[^}]*width:\s*clamp\(104px, 27vh, 210px\);[^}]*border-radius:\s*22%;/s);

const expectedIcons = [
  { src: '/turn/icon-192-r45.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/turn/icon-512-r45.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/turn/icon-maskable-512-r45.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
];
assert.deepEqual(manifest.icons, expectedIcons);

function readPngSize(fileName) {
  const data = fs.readFileSync(path.join(turnRoot, fileName));
  assert.deepEqual(
    [...data.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
    `${fileName} must be a PNG`
  );
  assert.ok(data.length > 1000, `${fileName} must contain the supplied artwork`);
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
}

assert.deepEqual(readPngSize('favicon-32-r45.png'), [32, 32]);
assert.deepEqual(readPngSize('apple-touch-icon-r45.png'), [180, 180]);
assert.deepEqual(readPngSize('icon-192-r45.png'), [192, 192]);
assert.deepEqual(readPngSize('icon-512-r45.png'), [512, 512]);
assert.deepEqual(readPngSize('icon-maskable-512-r45.png'), [512, 512]);

const ico = fs.readFileSync(path.join(turnRoot, 'favicon-r45.ico'));
assert.equal(ico.readUInt16LE(0), 0, 'favicon ICO reserved field');
assert.equal(ico.readUInt16LE(2), 1, 'favicon must be an icon');
assert.equal(ico.readUInt16LE(4), 3, 'favicon must contain three sizes');
const icoSizes = Array.from({ length: 3 }, (_, index) => {
  const offset = 6 + index * 16;
  return [ico[offset] || 256, ico[offset + 1] || 256];
});
assert.deepEqual(icoSizes, [[16, 16], [32, 32], [48, 48]]);

console.log('TURN production app icon, bookmarks and start-screen branding passed.');
