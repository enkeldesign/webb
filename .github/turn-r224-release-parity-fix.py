from pathlib import Path

path = Path('turn/scripts/release.mjs')
source = path.read_text()
old = '''    .replace(/((?:href|src)="\\.\\/[^"?]+\\?build=)\\d{8}-r\\d+/g, `$1${release.cacheKey}`);'''
new = '''    .replace(/((?:href|src)="\\.\\/[^"?]+\\?build=)\\d{8}-r\\d+/g, `$1${release.cacheKey}`)
    .replace(
      /(src="\\.\\/tracks\\/kenney-track-landmarks-r517\\.js\\?revision=r532-countryside-nature-polish)(?:&build=\\d{8}-r\\d+)?"/,
      `$1&build=${release.cacheKey}"`
    );'''
if old not in source:
    raise SystemExit('Production release-index build replacement anchor not found')
path.write_text(source.replace(old, new, 1))

lab_test_path = Path('turn-lab/tests/mountain-long-lab.mjs')
lab_test = lab_test_path.read_text()
lab_test = lab_test.replace(
    '  productionWorld,\n  visualWorkflow\n] = await Promise.all([',
    '  productionWorld,\n  visualWorkflow,\n  releaseSource\n] = await Promise.all([',
    1
)
lab_test = lab_test.replace(
    "  readText('turn/tracks/mountain-world-long.js'),\n  readText('.github/workflows/turn-lab-mountain-long-visual.yml')\n]);",
    "  readText('turn/tracks/mountain-world-long.js'),\n  readText('.github/workflows/turn-lab-mountain-long-visual.yml'),\n  readText('turn/release.json')\n]);\nconst release = JSON.parse(releaseSource);",
    1
)
old_assertion = "assert.match(productionWorld, /mountain-world-r3\\.js\\?revision=r177-ipad-sky-aspect/);"
new_assertion = "assert.ok(productionWorld.includes(`./mountain-world-r3.js?build=${release.cacheKey}`),\n  'Production MOUNTAIN long wrapper must advance the mature base world with the current TURN release identity');"
if old_assertion not in lab_test:
    raise SystemExit('Legacy MOUNTAIN LAB wrapper assertion not found')
lab_test_path.write_text(lab_test.replace(old_assertion, new_assertion, 1))
