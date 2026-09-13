from pathlib import Path

release_path = Path('turn/scripts/release.mjs')
release = release_path.read_text()
old = '''    .replace(
      /"\\.\\/tracks\\/mountain-world-r3\\.js\\?(?:revision=r177-ipad-sky-aspect|build=\\d{8}-r\\d+)"/,
      `"./tracks/mountain-world-r3.js?build=${release.cacheKey}"`
    )'''
new = '''    .replace(
      /^\\s*"\\.\\/tracks\\/mountain-world-r3\\.js\\?(?:revision=r177-ipad-sky-aspect|build=\\d{8}-r\\d+)": "\\/turn-lab\\/tracks\\/mountain-world-lab-r1\\.js\\?revision=mountain-slip-bridge-r18",\\n/m,
      ''
    )'''
if old not in release:
    raise SystemExit('Release-bound LAB scope block not found')
release_path.write_text(release.replace(old, new, 1))

test_path = Path('turn-lab/tests/mountain-long-lab.mjs')
test = test_path.read_text()
old_assertion = '''const mountainWorldSpecifier = `./tracks/mountain-world-r3.js?build=${release.cacheKey}`;
assert.equal(
  labImportMaps[1]?.scopes?.['/turn/']?.[mountainWorldSpecifier],
  '/turn-lab/tracks/mountain-world-lab-r1.js?revision=mountain-slip-bridge-r18',
  'TURN LAB must keep its isolated MOUNTAIN world override when production advances the base-world build identity'
);
'''
new_assertion = '''const labMountainWorldOverrides = Object.keys(labImportMaps[1]?.scopes?.['/turn/'] || {})
  .filter((specifier) => specifier.startsWith('./tracks/mountain-world-r3.js?'));
assert.deepEqual(labMountainWorldOverrides, [],
  'TURN LAB app runtime must use the promoted production long-world wrapper; remapping its base r3 import would double-wrap and downsample the 2160-sample route');
'''
if old_assertion not in test:
    raise SystemExit('Release-bound LAB scope test assertion not found')
test = test.replace(old_assertion, new_assertion, 1)
old_comment = '''// Both wrappers still build the mature r177 production mountain world first, then
// apply the same long-course extension. LAB only adds its isolated diagnostics/name.
'''
new_comment = '''// Production app runtime owns the promoted long-world composition. The retained LAB
// world wrapper is exercised directly by the dedicated visual fixture only; it must not
// be injected into the production wrapper through the app import map.
'''
if old_comment in test:
    test = test.replace(old_comment, new_comment, 1)
test_path.write_text(test)
