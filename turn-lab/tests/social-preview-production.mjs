import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const turnRoot = path.resolve(here, '../../turn');
const index = fs.readFileSync(path.join(turnRoot, 'index.html'), 'utf8');

assert.match(index, /<meta name="description" content="TURN is a motion-controlled arcade drift racer\./);
assert.match(index, /<link rel="canonical" href="https:\/\/enkel\.design\/turn\/">/);
assert.match(index, /<meta property="og:type" content="website">/);
assert.match(index, /<meta property="og:title" content="TURN — Tilt\. Drift\. Boost\.">/);
assert.match(index, /<meta property="og:url" content="https:\/\/enkel\.design\/turn\/">/);
assert.match(index, /<meta property="og:image" content="https:\/\/enkel\.design\/turn\/turn-og-r58\.jpg">/);
assert.match(index, /<meta property="og:image:width" content="1200">/);
assert.match(index, /<meta property="og:image:height" content="630">/);
assert.match(index, /<meta name="twitter:card" content="summary_large_image">/);
assert.match(index, /<meta name="twitter:image" content="https:\/\/enkel\.design\/turn\/turn-og-r58\.jpg">/);

const image = fs.readFileSync(path.join(turnRoot, 'turn-og-r58.jpg'));
assert.deepEqual([...image.subarray(0, 3)], [0xff, 0xd8, 0xff], 'Social preview must be a JPEG');
assert.ok(image.length > 10_000, 'Social preview must contain the supplied artwork');

console.log('TURN Open Graph and social preview metadata passed.');
