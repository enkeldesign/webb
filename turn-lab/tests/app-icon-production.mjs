import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const turnRoot = path.resolve(here, '../../turn');
const turnNextRoot = path.resolve(here, '../../turn-next');

const index = fs.readFileSync(path.join(turnRoot, 'index.html'), 'utf8');
const nextIndex = fs.readFileSync(path.join(turnNextRoot, 'index.html'), 'utf8');
const homeSource = fs.readFileSync(path.join(turnRoot, 'm8-home.js'), 'utf8');
const orientationGuard = fs.readFileSync(path.join(turnRoot, 'orientation-guard.css'), 'utf8');
const shellRecovery = fs.readFileSync(path.join(turnRoot, 'motion-safe-zone.js'), 'utf8');
const release = JSON.parse(fs.readFileSync(path.join(turnRoot, 'release.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(turnRoot, 'site.webmanifest'), 'utf8'));
const nextManifest = JSON.parse(fs.readFileSync(path.join(turnNextRoot, 'site.webmanifest'), 'utf8'));

assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));

for (const source of [index, nextIndex]) {
  assert.match(source, /<link rel="icon" href="\.\/TURNicon\.PNG\?icon=20260803-profile-512" type="image\/png" sizes="512x512">/);
  assert.match(source, /<link rel="apple-touch-icon" href="\.\/TURNicon\.PNG\?icon=20260803-profile-512" sizes="512x512">/);
  assert.match(source, /<img class="install-icon" src="\.\/TURNicon\.PNG\?icon=20260803-profile-512" alt="">/);
  assert.doesNotMatch(source, /favicon-r45|apple-touch-icon-r45|icon-512-r45/);
}

assert.match(homeSource, /<img class="m8-home-logo" src="\/turn\/TURNicon\.PNG\?icon=\$\{ICON_REVISION\}" alt="TURN">/);
assert.match(homeSource, /ICON_REVISION = '20260803-profile-512'/);
assert.match(orientationGuard, /\.m8-home-fixed-layout \.m8-home-logo[\s\S]*object-fit: contain/);
assert.match(orientationGuard, /object-position: left center/);

assert.match(index, new RegExp(`<link rel="manifest" href="\\.\\/site\\.webmanifest\\?build=${release.cacheKey}-icon-20260803-profile-512">`));
assert.match(nextIndex, new RegExp(`<link rel="manifest" href="\\/turn-next\\/site\\.webmanifest\\?source=${release.cacheKey}-icon-20260803-profile-512-m8\\.5">`));

const expectedIcons = [
  {
    src: '/turn/TURNicon.PNG?icon=20260803-profile-512',
    sizes: '512x512',
    type: 'image/png',
    purpose: 'any maskable'
  }
];
assert.deepEqual(manifest.icons, expectedIcons);
assert.deepEqual(nextManifest.icons, expectedIcons);
assert.equal(manifest.id, '/turn/', 'The production manifest identity must remain stable while its launch URL is versioned');
assert.equal(nextManifest.id, '/turn-next/', 'TURN NEXT must retain its independent stable manifest identity');
assert.equal(manifest.start_url, '/turn/?shell=20260806-r179');
assert.equal(nextManifest.start_url, '/turn-next/?shell=20260806-r179');
assert.equal(manifest.scope, '/turn/');
assert.equal(nextManifest.scope, '/turn-next/');
assert.equal(manifest.background_color, '#08090a');
assert.equal(manifest.theme_color, '#08090a');
assert.equal(nextManifest.background_color, '#08090a');
assert.equal(nextManifest.theme_color, '#08090a');

assert.match(shellRecovery, /PWA_SHELL_REVISION = '20260806-r179'/);
assert.match(shellRecovery, /#turn-landscape-launch-containment-r178/,
  'A cached PR #351 document must have its harmful inline containment rule removed immediately');
assert.match(shellRecovery, /manifest\.href = `\$\{manifestPath\}\?shell=\$\{PWA_SHELL_REVISION\}`/,
  'The active document must retarget its manifest to a versioned URL');
assert.match(shellRecovery, /if \(isStandalone\)/,
  'Only installed standalone contexts may perform the document-shell handoff');
assert.match(shellRecovery, /sessionStorage\.getItem\(PWA_REDIRECT_GUARD\)/);
assert.match(shellRecovery, /launchUrl\.searchParams\.set\('shell', PWA_SHELL_REVISION\)/);
assert.match(shellRecovery, /window\.location\.replace\(launchUrl\.href\)/,
  'The standalone handoff must request a genuinely new same-origin document without adding browser history');
assert.match(shellRecovery, /return;[\s\S]*const SAFE_ZONE_DEGREES = 24/,
  'No game bootstrap may continue in the stale document after navigation begins');

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
  '8917377dc6368f9d543a118f764710433d79da01',
  'All icon surfaces must remain tied to the exact current user-supplied TURNicon.PNG blob'
);

console.log(`TURN ${release.id} supplied app icon, versioned standalone shell recovery and Home branding passed.`);