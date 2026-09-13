from pathlib import Path

release_path = Path('turn/scripts/release.mjs')
release = release_path.read_text()
old = '''    .replace(
      /(src="\\.\\/tracks\\/kenney-track-landmarks-r517\\.js\\?revision=r532-countryside-nature-polish)(?:&build=\\d{8}-r\\d+)?"/,
      `$1&build=${release.cacheKey}"`
    )
    .replace(/<script type="importmap">[\\s\\S]*?<\\/script>/, productionImportMap);'''
new = '''    .replace(
      /(src="\\.\\/tracks\\/kenney-track-landmarks-r517\\.js\\?revision=r532-countryside-nature-polish)(?:&build=\\d{8}-r\\d+)?"/,
      `$1&build=${release.cacheKey}"`
    )
    .replace(
      /"\\.\\/tracks\\/mountain-world-r3\\.js\\?(?:revision=r177-ipad-sky-aspect|build=\\d{8}-r\\d+)"/,
      `"./tracks/mountain-world-r3.js?build=${release.cacheKey}"`
    )
    .replace(/<script type="importmap">[\\s\\S]*?<\\/script>/, productionImportMap);'''
if old not in release:
    raise SystemExit('TURN LAB release scope anchor not found')
release_path.write_text(release.replace(old, new, 1))

test_path = Path('turn-lab/tests/mountain-long-lab.mjs')
test = test_path.read_text()
anchor = '''assert.deepEqual(labImportMaps[0], productionImportMaps[0],
  'TURN LAB must continue to boot the exact production runtime map');
'''
addition = '''assert.deepEqual(labImportMaps[0], productionImportMaps[0],
  'TURN LAB must continue to boot the exact production runtime map');
const mountainWorldSpecifier = `./tracks/mountain-world-r3.js?build=${release.cacheKey}`;
assert.equal(
  labImportMaps[1]?.scopes?.['/turn/']?.[mountainWorldSpecifier],
  '/turn-lab/tracks/mountain-world-lab-r1.js?revision=mountain-slip-bridge-r18',
  'TURN LAB must keep its isolated MOUNTAIN world override when production advances the base-world build identity'
);
'''
if anchor not in test:
    raise SystemExit('TURN LAB import-map assertion anchor not found')
test_path.write_text(test.replace(anchor, addition, 1))
