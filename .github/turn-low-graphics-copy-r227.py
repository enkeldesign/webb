from pathlib import Path
import json

setting_path = Path('turn/ui/low-graphics-setting.js')
source = setting_path.read_text()
old = 'Uses lower resolution, no shadows, no contours and cheaper lighting. Antialiasing and all track scenery stay unchanged. Restart TURN to apply changes.'
new = 'Uses lower resolution, no shadows, no contours and cheaper lighting. Restart TURN to apply changes.'
if old not in source:
    raise SystemExit('Expected LOW GRAPHICS settings copy not found')
setting_path.write_text(source.replace(old, new))

test_path = Path('turn-tests/low-graphics-production.mjs')
test = test_path.read_text()
marker = "assert.match(settingSource, /Restart TURN to apply changes/);\n"
insertion = marker + "assert.doesNotMatch(settingSource, /Antialiasing and all track scenery stay unchanged/,\n  'LOW GRAPHICS settings copy should avoid implementation-detail reassurance.');\n"
if marker not in test:
    raise SystemExit('Expected LOW GRAPHICS copy assertion marker not found')
test_path.write_text(test.replace(marker, insertion))

release_path = Path('turn/release.json')
release = json.loads(release_path.read_text())
expected = {
    'version': '1.19.12',
    'id': '2026.09.14-r226',
    'cacheKey': '20260914-r226'
}
if release != expected:
    raise SystemExit(f'Unexpected release base: {release!r}')
release_path.write_text(json.dumps({
    'version': '1.19.12',
    'id': '2026.09.14-r227',
    'cacheKey': '20260914-r227'
}, indent=2) + '\n')

# Current-release test expectations must follow the release-bound URLs.
for root in (Path('turn-tests'), Path('turn-lab/tests')):
    for path in root.rglob('*.mjs'):
        text = path.read_text()
        updated = text.replace('20260914-r226', '20260914-r227')
        if updated != text:
            path.write_text(updated)
