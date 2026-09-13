from pathlib import Path
import json
import re


def replace_once(path, old, new):
    p = Path(path)
    source = p.read_text()
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one occurrence of {old!r}, found {count}')
    p.write_text(source.replace(old, new, 1))


release_path = Path('turn/release.json')
release = json.loads(release_path.read_text())
if release.get('id') == '2026.09.13-r222':
    print('TURN r222 tuning already applied.')
    raise SystemExit(0)
if release != {
    'version': '1.19.7',
    'id': '2026.09.13-r221',
    'cacheKey': '20260913-r221'
}:
    raise SystemExit(f'Unexpected release base: {release}')

replace_once('turn/graphics-profile.js', '  antialias: !lowGraphics,', '  antialias: true,')
replace_once('turn/graphics-profile.js', '  optionalScenery: !lowGraphics', '  optionalScenery: true')
replace_once('turn/three-runtime.js', '? { ...parameters, antialias: false }', '? { ...parameters, antialias: true }')

world_path = Path('turn/render/world.js')
world = world_path.read_text()
replace_import = "import { graphicsProfile } from '../graphics-profile.js';\n"
if world.count(replace_import) != 1:
    raise SystemExit('turn/render/world.js: graphics profile import not found exactly once')
world = world.replace(replace_import, '', 1)
pattern = re.compile(r"\n  if \(graphicsProfile\.lowGraphics\) \{.*?\n  \}\n\n  const \[beauty, art, identity", re.S)
world, count = pattern.subn('\n  const [beauty, art, identity', world, count=1)
if count != 1:
    raise SystemExit(f'turn/render/world.js: expected one LOW GRAPHICS world-loader branch, found {count}')
world_path.write_text(world)

replace_once(
    'turn/ui/low-graphics-setting.js',
    'Uses lower resolution, no shadows or antialiasing, fewer real lights, no outline draw calls and less cosmetic scenery. Restart TURN to apply changes.',
    'Uses lower resolution, no shadows, fewer real lights and no outline draw calls. Antialiasing and full track scenery stay on. Restart TURN to apply changes.'
)

production_test = Path('turn-tests/low-graphics-production.mjs')
test = production_test.read_text()
for old, new in [
    ("assert.equal(release.version, '1.19.7');", "assert.equal(release.version, '1.19.8');"),
    ("assert.equal(release.id, '2026.09.13-r221');", "assert.equal(release.id, '2026.09.13-r222');"),
    ("assert.equal(release.cacheKey, '20260913-r221');", "assert.equal(release.cacheKey, '20260913-r222');"),
    ('build=20260913-r221', 'build=20260913-r222'),
    ('/antialias: !lowGraphics/', '/antialias: true/'),
    ('/optionalScenery: !lowGraphics/', '/optionalScenery: true/'),
    ('/antialias: false/', '/antialias: true/')
]:
    if old not in test:
        raise SystemExit(f'low-graphics-production.mjs: expected {old!r}')
    test = test.replace(old, new)
old_world_assertions = """const lowBranchStart = worldSource.indexOf('if (graphicsProfile.lowGraphics)');
const fullBranchStart = worldSource.indexOf('const [beauty, art, identity');
assert.ok(lowBranchStart >= 0 && fullBranchStart > lowBranchStart, 'World loader exposes a LOW GRAPHICS branch before the full cosmetic graph.');
const lowBranch = worldSource.slice(lowBranchStart, fullBranchStart);
assert.doesNotMatch(lowBranch, /world-beauty\\.js/);
assert.doesNotMatch(lowBranch, /world-art-pass\\.js/);
assert.doesNotMatch(lowBranch, /countryside-scenery-r177\\.js/);
assert.match(lowBranch, /countryside-bella-r166\\.js/);
assert.match(lowBranch, /track-identity\\.js/);
assert.match(lowBranch, /section-intensity\\.js/);
"""
new_world_assertions = """assert.doesNotMatch(worldSource, /if \\(graphicsProfile\\.lowGraphics\\)/,
  'LOW GRAPHICS must not bypass the full Countryside cosmetic graph.');
assert.match(worldSource, /world-beauty\\.js/);
assert.match(worldSource, /world-art-pass\\.js/);
assert.match(worldSource, /countryside-scenery-r177\\.js/);
assert.match(worldSource, /countryside-bella-r166\\.js/);
assert.match(worldSource, /track-identity\\.js/);
assert.match(worldSource, /section-intensity\\.js/);
"""
if old_world_assertions not in test:
    raise SystemExit('low-graphics-production.mjs: old world assertions not found')
production_test.write_text(test.replace(old_world_assertions, new_world_assertions, 1))

replace_once(
    'turn-tests/low-graphics-browser-smoke.mjs',
    "assert.equal(result.antialias, false, `${browserType.name()} disables WebGL antialiasing.`);",
    "assert.equal(result.antialias, true, `${browserType.name()} keeps WebGL antialiasing enabled.`);"
)

history_path = Path('turn/content/about-history-current.js')
history = history_path.read_text()
tuning_history = """const LOW_GRAPHICS_TUNING_HISTORY = Object.freeze({
  period: '13 September',
  title: 'LOW GRAPHICS keeps the smooth edges and full countryside',
  paragraphs: Object.freeze([
    'TURN 1.19.8 tunes LOW GRAPHICS after device testing. Antialiasing stays enabled, and Countryside once again loads its deferred world-beauty, art and extra scenery passes while the mode keeps its DPR 1.0 cap, disabled shadows, reduced real lights and suppressed outline draw calls.',
    'This keeps the strongest visual-quality wins that proved worthwhile in testing without giving up the lower-resolution, shadowless rendering profile aimed at older devices.'
  ]),
  milestones: Object.freeze([
    'Antialiasing remains enabled in LOW GRAPHICS',
    'Full Countryside world-beauty, art and extra scenery restored',
    'TURN 1.19.8 · 2026.09.13-r222'
  ])
});

"""
marker = 'const previousLatest = BASE_CHANGELOG.at(-1);'
if history.count(marker) != 1:
    raise SystemExit('about-history-current.js: insertion marker not unique')
history = history.replace(marker, tuning_history + marker, 1)
replace_history = '  LOW_GRAPHICS_HISTORY\n]);'
if history.count(replace_history) != 1:
    raise SystemExit('about-history-current.js: development history tail not found')
history = history.replace(replace_history, '  LOW_GRAPHICS_HISTORY,\n  LOW_GRAPHICS_TUNING_HISTORY\n]);', 1)
changelog_anchor = "      Object.freeze(['One graphics profile', 'Applies the same low profile to the race renderer and TURN secondary WebGL previews after a restart.'])"
if history.count(changelog_anchor) != 1:
    raise SystemExit('about-history-current.js: changelog anchor not unique')
history = history.replace(
    changelog_anchor,
    changelog_anchor + ",\n      Object.freeze(['1.19.8 r222', 'Keeps antialiasing and the full Countryside world-beauty, art and extra scenery pipeline enabled in LOW GRAPHICS after device testing.']),\n      Object.freeze(['Tuned low profile', 'Retains DPR 1.0, disabled shadows, fewer real lights and suppressed outline draw calls while restoring those visual-quality features.'])",
    1
)
old_note = "note: 'TURN 1.19.7 adds LOW GRAPHICS for better performance on older devices.'"
if history.count(old_note) != 1:
    raise SystemExit('about-history-current.js: current release note not found')
history = history.replace(old_note, "note: 'TURN 1.19.8 tunes LOW GRAPHICS to keep antialiasing and full Countryside scenery.'", 1)
history_path.write_text(history)

release_path.write_text(json.dumps({
    'version': '1.19.8',
    'id': '2026.09.13-r222',
    'cacheKey': '20260913-r222'
}, indent=2) + '\n')

print('Prepared TURN 1.19.8 r222 LOW GRAPHICS tuning.')
