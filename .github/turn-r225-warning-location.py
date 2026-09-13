from pathlib import Path
import json

world_path = Path('turn/tracks/mountain-world-r3.js')
world = world_path.read_text()
old = "const MOUNTAIN_SLALOM_WARNING_TARGET = Object.freeze({ x: 66, z: 62 });"
new = "const MOUNTAIN_SLALOM_WARNING_TARGET = Object.freeze({ x: 138, z: 168 });"
if old not in world:
    raise SystemExit('warning target anchor not found')
world = world.replace(old, new, 1)
world = world.replace(
    "// The old tree landmark sat on the north/outside shoulder in the player's\n  // sightline before the plunge. Choosing the higher-z candidate preserves\n  // that landmark even if the sampled normal flips direction.",
    "// The old tree landmark sat on the right/outside shoulder of the broad summit\n  // bend, well before the plunge. Choosing the higher-z candidate preserves that\n  // approach sightline even if the sampled normal flips direction.",
    1
)
world_path.write_text(world)

test_path = Path('turn-tests/mountain-track-production.mjs')
test = test_path.read_text()
old_test = "assert.match(baseWorld, /MOUNTAIN_SLALOM_WARNING_TARGET = Object\\.freeze\\(\\{ x: 66, z: 62 \\}\\)/,\n  'MOUNTAIN warning sign must stay anchored to the summit-to-slalom landmark');"
new_test = "assert.match(baseWorld, /MOUNTAIN_SLALOM_WARNING_TARGET = Object\\.freeze\\(\\{ x: 138, z: 168 \\}\\)/,\n  'MOUNTAIN warning sign must stay anchored to the broad summit bend before the plunge');"
if old_test not in test:
    raise SystemExit('warning target test anchor not found')
test = test.replace(old_test, new_test, 1)
test = test.replace('20260913-r224', '20260913-r225')
test_path.write_text(test)

release_path = Path('turn/release.json')
release = json.loads(release_path.read_text())
if release != {'version': '1.19.10', 'id': '2026.09.13-r224', 'cacheKey': '20260913-r224'}:
    raise SystemExit(f'unexpected starting release: {release}')
release_path.write_text(json.dumps({
    'version': '1.19.11',
    'id': '2026.09.13-r225',
    'cacheKey': '20260913-r225'
}, indent=2) + '\n')

history_path = Path('turn/content/about-history-current.js')
history = history_path.read_text()
insert_after = """const MOUNTAIN_WARNING_HISTORY = Object.freeze({
  period: '13 September',
  title: 'A warning before the MOUNTAIN plunge',
  paragraphs: Object.freeze([
    'TURN 1.19.10 restores a strong visual timing landmark before MOUNTAIN’s technical downhill slalom. A large yellow triangular warning sign now stands on the north/outside shoulder where the earlier tree used to help drivers judge the plunge.',
    'The sign is authored from lightweight TURN geometry with its own black border and exclamation mark, faces the approaching driver, has no collision role and does not require another downloaded scenery asset.'
  ]),
  milestones: Object.freeze([
    'Readable warning landmark before the downhill slalom',
    'Authored low-poly sign with no extra asset download or collision',
    'TURN 1.19.10 · 2026.09.13-r224'
  ])
});
"""
addition = insert_after + """
const MOUNTAIN_WARNING_PLACEMENT_HISTORY = Object.freeze({
  period: '13 September',
  title: 'The MOUNTAIN warning returns to the old sightline',
  paragraphs: Object.freeze([
    'TURN 1.19.11 moves the MOUNTAIN warning landmark up to the broad summit bend where the old tree was actually used as a planning cue. Drivers can now see it before committing to the plunge rather than only after reaching the slalom entry.',
    'This is a world-placement correction only: the minimap is unchanged, the sign remains visual-only, and the lightweight authored sign geometry is otherwise unchanged.'
  ]),
  milestones: Object.freeze([
    'Warning landmark moved to the broad summit bend before the plunge',
    'No minimap marker or gameplay collision added',
    'TURN 1.19.11 · 2026.09.13-r225'
  ])
});
"""
if insert_after not in history:
    raise SystemExit('history insertion anchor not found')
history = history.replace(insert_after, addition, 1)
history = history.replace(
    "  MOUNTAIN_WARNING_HISTORY\n]);",
    "  MOUNTAIN_WARNING_HISTORY,\n  MOUNTAIN_WARNING_PLACEMENT_HISTORY\n]);",
    1
)
history = history.replace(
    "      Object.freeze(['Slalom landmark', 'The sign is lightweight authored geometry, faces the approach and remains visual-only with no collision or extra asset download.'])",
    "      Object.freeze(['Slalom landmark', 'The sign is lightweight authored geometry, faces the approach and remains visual-only with no collision or extra asset download.']),\n      Object.freeze(['1.19.11 r225', 'Moves the MOUNTAIN warning landmark to the broad summit bend where the old tree actually served as a planning cue before the plunge.']),\n      Object.freeze(['Landmark placement correction', 'Leaves the minimap untouched and keeps the warning sign visual-only while restoring the earlier approach sightline.'])",
    1
)
history = history.replace(
    "  version: '1.19.10',\n  build: '2026.09.13-r224',\n  note: 'TURN 1.19.10 adds a warning landmark before MOUNTAIN’s downhill slalom.'",
    "  version: '1.19.11',\n  build: '2026.09.13-r225',\n  note: 'TURN 1.19.11 moves MOUNTAIN’s warning landmark back to the summit sightline before the plunge.'",
    1
)
history_path.write_text(history)
