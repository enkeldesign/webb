import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const turnRoot = path.resolve(here, '../../turn');
const index = fs.readFileSync(path.join(turnRoot, 'index.html'), 'utf8');

assert.match(index, /<meta name="description" content="TURN is an accessible motion-controlled arcade drift racer, all about the feel of the drive and getting faster\. Your best laps become rivals to beat, and trophies unlock new tracks, cars and ways to play\.">/);
// Sharing says what TURN is for, as the install page and HOW TO PLAY do.
for (const property of ['property="og:description"', 'name="twitter:description"']) {
  assert.match(index, new RegExp(`<meta ${property} content="An accessible motion-controlled arcade drift racer, all about the feel of the drive and getting faster\\. Your best laps become rivals to beat, and trophies unlock new tracks, cars and ways to play\\.">`));
}
assert.match(index, /<link rel="canonical" href="https:\/\/enkel\.design\/turn\/">/);
assert.match(index, /<meta property="og:type" content="website">/);
assert.match(index, /<meta property="og:title" content="TURN — Tilt\. Drift\. Boost\.">/);
assert.match(index, /<meta property="og:url" content="https:\/\/enkel\.design\/turn\/">/);
assert.match(index, /<meta property="og:image" content="https:\/\/enkel\.design\/turn\/TURNicon\.PNG">/);
assert.match(index, /<meta property="og:image:secure_url" content="https:\/\/enkel\.design\/turn\/TURNicon\.PNG">/);
assert.match(index, /<meta property="og:image:type" content="image\/png">/);
assert.match(index, /<meta name="twitter:card" content="summary_large_image">/);
assert.match(index, /<meta name="twitter:image" content="https:\/\/enkel\.design\/turn\/TURNicon\.PNG">/);

const image = fs.readFileSync(path.join(turnRoot, 'TURNicon.PNG'));
assert.deepEqual(
  [...image.subarray(0, 8)],
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'Social preview must be a PNG'
);
assert.ok(image.length > 10_000, 'Social preview must contain the supplied TURN icon artwork');

console.log('TURN Open Graph and PNG social preview metadata passed.');
