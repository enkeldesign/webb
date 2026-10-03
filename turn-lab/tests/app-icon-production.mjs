import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const turnRoot = path.resolve(here, '../../turn');

const index = fs.readFileSync(path.join(turnRoot, 'index.html'), 'utf8');
const homeSource = fs.readFileSync(path.join(turnRoot, 'm8-home.js'), 'utf8');
const appBar = fs.readFileSync(path.join(turnRoot, 'home-app-bar.css'), 'utf8');
const release = JSON.parse(fs.readFileSync(path.join(turnRoot, 'release.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(turnRoot, 'site.webmanifest'), 'utf8'));

assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));

for (const source of [index]) {
  assert.match(source, /<link rel="icon" href="\.\/TURNicon\.PNG\?icon=20260803-profile-512" type="image\/png" sizes="512x512">/);
  assert.match(source, /<link rel="apple-touch-icon" href="\.\/TURNicon\.PNG\?icon=20260803-profile-512" sizes="512x512">/);
  assert.match(source, /<img class="install-icon" src="\.\/TURNicon\.PNG\?icon=20260803-profile-512" alt="">/);
  assert.doesNotMatch(source, /favicon-r45|apple-touch-icon-r45|icon-512-r45/);
}

// The app bar carries TURN's badge: the start screen's framed icon.
assert.match(homeSource, /<img class="m8-home-logo turn-pr-app-logo" src="\/turn\/TURNicon\.PNG\?icon=\$\{ICON_REVISION\}" alt="TURN">/);
assert.match(homeSource, /ICON_REVISION = '20260803-profile-512'/);
// Framed and tilted like the start screen's icon, hanging over the bar's rule.
const preRace = fs.readFileSync(new URL('../../turn/pre-race.css', import.meta.url), 'utf8');
assert.match(preRace, /html body \.turn-pr-app-logo \{[^}]*width: var\(--turn-pr-logo-size\);[^}]*border: 3px solid[^}]*border-radius: 24%;[^}]*object-fit: cover;[^}]*transform: rotate\(-3deg\);[^}]*pointer-events: none;/);
assert.doesNotMatch(appBar, /\.m8-home-logo \{[^}]*width: \d+px/, 'The app bar leaves the logo size to the badge');

assert.match(index, new RegExp(`<link rel="manifest" href="\\.\\/site\\.webmanifest\\?build=${release.cacheKey}-icon-20260803-profile-512">`));

const expectedIcons = [
  {
    src: '/turn/TURNicon.PNG?icon=20260803-profile-512',
    sizes: '512x512',
    type: 'image/png',
    purpose: 'any maskable'
  }
];
assert.deepEqual(manifest.icons, expectedIcons);
assert.equal(manifest.background_color, '#08090a');
assert.equal(manifest.theme_color, '#08090a');

const icon = fs.readFileSync(path.join(turnRoot, 'TURNicon.PNG'));
assert.deepEqual(
  [...icon.subarray(0, 8)],
  [137, 80, 78, 71, 13, 10, 26, 10],
  'TURNicon.PNG must be a PNG'
);
assert.deepEqual([icon.readUInt32BE(16), icon.readUInt32BE(20)], [512, 512]);
assert.ok(icon.length > 1000, 'TURNicon.PNG must contain the supplied artwork');
const blobSha = crypto
  .createHash('sha1')
  .update(`blob ${icon.length}\0`)
  .update(icon)
  .digest('hex');
assert.equal(
  blobSha,
  'd0b246a92512d9b4e74799bbed70249c342233b3',
  'All icon surfaces must remain tied to the exact current user-supplied TURNicon.PNG blob'
);

console.log(`TURN ${release.id} supplied app icon, favicon, bookmarks, install onboarding and Home branding passed.`);
