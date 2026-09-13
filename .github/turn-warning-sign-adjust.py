from pathlib import Path
import json

world_path = Path('turn/tracks/mountain-world-r3.js')
source = world_path.read_text()

source = source.replace(
    "const MOUNTAIN_WARNING_POST = 0x34383d;\n",
    "const MOUNTAIN_WARNING_POST = 0x34383d;\nconst MOUNTAIN_WARNING_PLATE_Y = 5.0;\n"
)

source = source.replace(
    "function makeDownhillSlalomWarningSign() {\n",
    "function warningExclamationBarShape() {\n"
    "  const shape = new THREE.Shape();\n"
    "  shape.moveTo(-0.19, 0.70);\n"
    "  shape.lineTo(0.19, 0.70);\n"
    "  shape.lineTo(0.12, -0.54);\n"
    "  shape.lineTo(-0.12, -0.54);\n"
    "  shape.closePath();\n"
    "  return shape;\n"
    "}\n\n"
    "function makeDownhillSlalomWarningSign() {\n"
)

source = source.replace(
    "  const post = new THREE.Mesh(new THREE.BoxGeometry(0.38, 4.2, 0.38), postMaterial);\n"
    "  post.position.set(0, 2.1, -0.05);\n",
    "  const post = new THREE.Mesh(new THREE.BoxGeometry(0.38, 4.6, 0.38), postMaterial);\n"
    "  // Keep the support fully behind the plate so it cannot read as part of the symbol.\n"
    "  post.position.set(0, 2.3, -0.30);\n"
)

source = source.replace(
    "  plate.position.set(0, 4.58, -0.09);\n",
    "  plate.position.set(0, MOUNTAIN_WARNING_PLATE_Y, -0.09);\n"
)
source = source.replace(
    "  border.position.set(0, 4.58, 0.101);\n",
    "  border.position.set(0, MOUNTAIN_WARNING_PLATE_Y, 0.105);\n"
)
source = source.replace(
    "  face.position.set(0, 4.58, 0.108);\n",
    "  face.position.set(0, MOUNTAIN_WARNING_PLATE_Y, 0.115);\n"
)

old_symbol = """  const exclamationBar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.42, 0.08), ink);\n  exclamationBar.position.set(0, 4.78, 0.16);\n  exclamationBar.rotation.z = -0.03;\n  exclamationBar.name = 'Mountain warning sign exclamation bar';\n  root.add(exclamationBar);\n\n  const exclamationDot = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 7), ink);\n  exclamationDot.position.set(0, 3.82, 0.16);\n  exclamationDot.name = 'Mountain warning sign exclamation dot';\n  root.add(exclamationDot);\n"""
new_symbol = """  // A flat front graphic keeps the symbol independent of the post and plate depth.\n  const exclamationBar = new THREE.Mesh(new THREE.ShapeGeometry(warningExclamationBarShape()), ink);\n  exclamationBar.position.set(0, MOUNTAIN_WARNING_PLATE_Y + 0.20, 0.14);\n  exclamationBar.name = 'Mountain warning sign exclamation bar';\n  root.add(exclamationBar);\n\n  const exclamationDot = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), ink);\n  exclamationDot.position.set(0, MOUNTAIN_WARNING_PLATE_Y - 0.76, 0.142);\n  exclamationDot.name = 'Mountain warning sign exclamation dot';\n  root.add(exclamationDot);\n"""
if old_symbol not in source:
    raise SystemExit('Expected warning-symbol block not found')
source = source.replace(old_symbol, new_symbol)
world_path.write_text(source)

test_path = Path('turn-tests/mountain-track-production.mjs')
test = test_path.read_text()
marker = "assert.match(baseWorld, /Mountain warning sign exclamation bar/);\n"
insertion = marker + "assert.match(baseWorld, /MOUNTAIN_WARNING_PLATE_Y = 5\\.0/);\nassert.match(baseWorld, /new THREE\\.ShapeGeometry\\(warningExclamationBarShape\\(\\)\\)/,\n  'The warning symbol must use its own flat tapered bar rather than the support post');\nassert.match(baseWorld, /new THREE\\.CircleGeometry\\(0\\.22, 16\\)/,\n  'The warning symbol must keep a visibly separate round dot');\nassert.match(baseWorld, /post\\.position\\.set\\(0, 2\\.3, -0\\.30\\)/,\n  'The sign support must stay behind the plate instead of crossing the front graphic');\n"
if marker not in test:
    raise SystemExit('Expected MOUNTAIN warning test marker not found')
test_path.write_text(test.replace(marker, insertion))

history_path = Path('turn/content/about-history-current.js')
history = history_path.read_text()
placement_end = """const MOUNTAIN_WARNING_PLACEMENT_HISTORY = Object.freeze({\n  period: '13 September',\n  title: 'The MOUNTAIN warning returns to the old sightline',\n  paragraphs: Object.freeze([\n    'TURN 1.19.11 moves the MOUNTAIN warning landmark up to the broad summit bend where the old tree was actually used as a planning cue. Drivers can now see it before committing to the plunge rather than only after reaching the slalom entry.',\n    'This is a world-placement correction only: the minimap is unchanged, the sign remains visual-only, and the lightweight authored sign geometry is otherwise unchanged.'\n  ]),\n  milestones: Object.freeze([\n    'Warning landmark moved to the broad summit bend before the plunge',\n    'No minimap marker or gameplay collision added',\n    'TURN 1.19.11 · 2026.09.13-r225'\n  ])\n});\n"""
readability = placement_end + """\nconst MOUNTAIN_WARNING_READABILITY_HISTORY = Object.freeze({\n  period: '14 September',\n  title: 'The MOUNTAIN warning reads clearly',\n  paragraphs: Object.freeze([\n    'TURN 1.19.12 raises the summit warning plate slightly while keeping its road position exactly where drivers tested it.',\n    'The support now stays behind the plate, and the front graphic uses a tapered bar with a separate round dot so the symbol reads unmistakably as an exclamation mark.'\n  ]),\n  milestones: Object.freeze([\n    'Slightly higher warning plate at the same summit landmark',\n    'Clear exclamation mark separated from the support post',\n    'TURN 1.19.12 · 2026.09.14-r226'\n  ])\n});\n"""
if placement_end not in history:
    raise SystemExit('Expected r225 history block not found')
history = history.replace(placement_end, readability)
history = history.replace(
    "  MOUNTAIN_WARNING_HISTORY,\n  MOUNTAIN_WARNING_PLACEMENT_HISTORY\n]);",
    "  MOUNTAIN_WARNING_HISTORY,\n  MOUNTAIN_WARNING_PLACEMENT_HISTORY,\n  MOUNTAIN_WARNING_READABILITY_HISTORY\n]);"
)
changelog_tail = """      Object.freeze(['1.19.11 r225', 'Moves the MOUNTAIN warning landmark to the broad summit bend where the old tree actually served as a planning cue before the plunge.']),\n      Object.freeze(['Landmark placement correction', 'Leaves the minimap untouched and keeps the warning sign visual-only while restoring the earlier approach sightline.'])\n    ])\n  })\n]);\n\nexport const CURRENT_RELEASE = Object.freeze({\n  version: '1.19.11',\n  build: '2026.09.13-r225',\n  note: 'TURN 1.19.11 moves MOUNTAIN’s warning landmark back to the summit sightline before the plunge.'\n});\n"""
changelog_new = """      Object.freeze(['1.19.11 r225', 'Moves the MOUNTAIN warning landmark to the broad summit bend where the old tree actually served as a planning cue before the plunge.']),\n      Object.freeze(['Landmark placement correction', 'Leaves the minimap untouched and keeps the warning sign visual-only while restoring the earlier approach sightline.'])\n    ])\n  }),\n  Object.freeze({\n    date: '14 September',\n    entries: Object.freeze([\n      Object.freeze(['1.19.12 r226', 'Raises the MOUNTAIN summit warning plate slightly without moving its tested road position.']),\n      Object.freeze(['Clear warning symbol', 'Keeps the support behind the plate and gives the front a tapered exclamation bar with a separate round dot.'])\n    ])\n  })\n]);\n\nexport const CURRENT_RELEASE = Object.freeze({\n  version: '1.19.12',\n  build: '2026.09.14-r226',\n  note: 'TURN 1.19.12 raises and clarifies MOUNTAIN’s summit warning sign while keeping its placement unchanged.'\n});\n"""
if changelog_tail not in history:
    raise SystemExit('Expected changelog tail not found')
history_path.write_text(history.replace(changelog_tail, changelog_new))

release_path = Path('turn/release.json')
release = json.loads(release_path.read_text())
expected_release = {
    'version': '1.19.11',
    'id': '2026.09.13-r225',
    'cacheKey': '20260913-r225'
}
if release != expected_release:
    raise SystemExit(f'Unexpected release base: {release!r}')
release_path.write_text(json.dumps({
    'version': '1.19.12',
    'id': '2026.09.14-r226',
    'cacheKey': '20260914-r226'
}, indent=2) + '\n')

# Current-release assertions should follow the release-bound module URLs.
for root in (Path('turn-tests'), Path('turn-lab/tests')):
    for path in root.rglob('*.mjs'):
        text = path.read_text()
        updated = text.replace('20260913-r225', '20260914-r226')
        if updated != text:
            path.write_text(updated)
