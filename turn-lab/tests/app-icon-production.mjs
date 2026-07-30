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
const release = JSON.parse(fs.readFileSync(path.join(turnRoot, 'release.json'), 'utf8'));
const styles = fs.readFileSync(path.join(turnRoot, 'styles.css'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(turnRoot, 'site.webmanifest'), 'utf8'));
const nextManifest = JSON.parse(fs.readFileSync(path.join(turnNextRoot, 'site.webmanifest'), 'utf8'));

assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));

for (const source of [index, nextIndex]) {
  assert.match(source, /<link rel="icon" href="\.\/TURNicon\.PNG\?icon=20260730-1136" type="image\/png" sizes="1136x1136">/);
  assert.match(source, /<link rel="apple-touch-icon" href="\.\/TURNicon\.PNG\?icon=20260730-1136" sizes="1136x1136">/);
  assert.match(source, /<img class="install-icon" src="\.\/TURNicon\.PNG\?icon=20260730-1136" alt="">/);
  assert.match(source, /<img class="start-logo" src="\.\/TURNicon\.PNG\?icon=20260730-1136" alt="TURN">/);
  assert.doesNotMatch(source, /favicon-r45|apple-touch-icon-r45|icon-512-r45/);
}

assert.match(index, /<link rel="manifest" href="\.\/site\.webmanifest\?build=20260729-r118-icon-20260730-1136">/);
assert.match(nextIndex, /<link rel="manifest" href="\/turn-next\/site\.webmanifest\?source=20260729-r118-icon-20260730-1136">/);

assert.match(styles, /\.start-logo-heading\s*\{[^}]*font-size:\s*0;/s);
assert.match(styles, /\.start-logo\s*\{[^}]*width:\s*clamp\(104px, 27vh, 210px\);[^}]*border-radius:\s*22%;/s);

const expectedIcons = [
  {
    src: '/turn/TURNicon.PNG?icon=20260730-1136',
    sizes: '1136x1136',
    type: 'image/png',
    purpose: 'any maskable'
  }
];
assert.deepEqual(manifest.icons, expectedIcons);
assert.deepEqual(nextManifest.icons, expectedIcons);

const icon = fs.readFileSync(path.join(turnRoot, 'TURNicon.PNG'));
assert.deepEqual(
  [...icon.subarray(0, 8)],
  [137, 80, 78, 71, 13, 10, 26, 10],
  'TURNicon.PNG must be a PNG'
);
assert.deepEqual([icon.readUInt32BE(16), icon.readUInt32BE(20)], [1136, 1136]);
assert.ok(icon.length > 1000, 'TURNicon.PNG must contain the supplied artwork');
const blobSha = crypto
  .createHash('sha1')
  .update(`blob ${icon.length}\0`)
  .update(icon)
  .digest('hex');
assert.equal(
  blobSha,
  '9fc33f974596118fdb36fe58583db766b8dae418',
  'All icon surfaces must remain tied to the exact current user-supplied TURNicon.PNG blob'
);

console.log(`TURN ${release.id} supplied app icon, favicon, bookmarks and start-screen branding passed.`);
