from pathlib import Path
import json

catalog_path = Path('turn/achievements/catalog-production.js')
catalog = catalog_path.read_text()
old_icons = """export const ICONS = Object.freeze({
  ...base.ICONS,
  drift: AUTHORED_DRIFT_ICON,
  safety: AUTHORED_SAFETY_ICON
});
"""
new_icons = """export const HEAD_START_ICON = `<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 800 800\" aria-hidden=\"true\">
  <g fill=\"currentColor\" stroke=\"none\">
    <!-- Flying car -->
    <g transform=\"rotate(24 400 300)\">
      <path
        fill-rule=\"evenodd\"
        clip-rule=\"evenodd\"
        d=\"
          M 320 82
          H 480
          Q 520 82 520 122
          V 454
          Q 520 494 480 494
          H 320
          Q 280 494 280 454
          V 122
          Q 280 82 320 82
          Z

          M 326 142
          H 474
          Q 490 142 490 158
          V 220
          H 310
          V 158
          Q 310 142 326 142
          Z

          M 310 372
          H 490
          V 434
          Q 490 450 474 450
          H 326
          Q 310 450 310 434
          Z
        \"
      />
    </g>

    <!-- Launch streaks -->
    <path d=\"M 290 500 L 332 520 L 268 636 Z\" />
    <path d=\"M 386 520 L 430 542 L 362 650 Z\" />

    <!-- Checkered finish -->
    <rect x=\"80\" y=\"642\" width=\"80\" height=\"68\" />
    <rect x=\"240\" y=\"642\" width=\"80\" height=\"68\" />
    <rect x=\"400\" y=\"642\" width=\"80\" height=\"68\" />
    <rect x=\"560\" y=\"642\" width=\"80\" height=\"68\" />
    <rect x=\"160\" y=\"710\" width=\"80\" height=\"68\" />
    <rect x=\"320\" y=\"710\" width=\"80\" height=\"68\" />
    <rect x=\"480\" y=\"710\" width=\"80\" height=\"68\" />
    <rect x=\"640\" y=\"710\" width=\"80\" height=\"68\" />
  </g>
</svg>`;

export const ICONS = Object.freeze({
  ...base.ICONS,
  drift: AUTHORED_DRIFT_ICON,
  safety: AUTHORED_SAFETY_ICON,
  headStart: HEAD_START_ICON
});
"""
if old_icons not in catalog:
    raise SystemExit('catalog icon block anchor not found')
catalog = catalog.replace(old_icons, new_icons, 1)
old_head = """  recommendation: 'Build OVERCHARGE before the line, catch it with GAS, then BOOST after crossing for a flying start.',
  icon: 'charge'
});
"""
new_head = """  recommendation: 'Build OVERCHARGE before the line, catch it with GAS, then BOOST after crossing for a flying start.',
  icon: 'headStart'
});
"""
if old_head not in catalog:
    raise SystemExit('HEAD START icon assignment anchor not found')
catalog_path.write_text(catalog.replace(old_head, new_head, 1))

test_path = Path('turn-lab/tests/achievements-production.mjs')
test = test_path.read_text()
old_import = "import { TRACK_IDS } from '../../turn/achievements/catalog.js';"
new_import = "import { ICONS, TRACK_IDS } from '../../turn/achievements/catalog.js';"
if old_import not in test:
    raise SystemExit('achievement catalog import anchor not found')
test = test.replace(old_import, new_import, 1)
old_assert = """assert.equal(byId('head-start')?.recommendation,
  'Build OVERCHARGE before the line, catch it with GAS, then BOOST after crossing for a flying start.');
assert.equal(ONBOARDING_ACHIEVEMENT_IDS.includes('head-start'), true);
"""
new_assert = """assert.equal(byId('head-start')?.recommendation,
  'Build OVERCHARGE before the line, catch it with GAS, then BOOST after crossing for a flying start.');
assert.equal(byId('head-start')?.icon, 'headStart');
assert.match(ICONS.headStart || '', /rotate\\(24 400 300\\)/,
  'HEAD START must keep the tilted top-down flying car from the supplied artwork');
assert.match(ICONS.headStart || '', /Checkered finish/,
  'HEAD START must keep its authored two-row finish-line motif');
assert.match(ICONS.headStart || '', /Launch streaks/,
  'HEAD START must keep the two launch streaks under the car');
assert.equal(ONBOARDING_ACHIEVEMENT_IDS.includes('head-start'), true);
"""
if old_assert not in test:
    raise SystemExit('HEAD START test anchor not found')
test_path.write_text(test.replace(old_assert, new_assert, 1))

history_path = Path('turn/content/about-history-current.js')
history = history_path.read_text()
insert_after = """const HEAD_START_FLYING_LAP_HISTORY = Object.freeze({
  period: '14 September',
  title: 'HEAD START rewards the flying lap',
  paragraphs: Object.freeze([
    'TURN 1.19.14 corrects HEAD START so its setup and payoff happen on consecutive laps. The first valid lap must cross with OVERCHARGE remaining; the next valid lap must actually spend carried OVERCHARGE with BOOST and beat the setup time.',
    'An invalid next lap breaks the attempt. The lesson now directly teaches the build-up lap and flying-start technique used to reach Time Trial targets.'
  ]),
  milestones: Object.freeze([
    'Setup lap crosses with OVERCHARGE greater than zero',
    'Next lap spends carried OVERCHARGE with BOOST and beats the setup lap',
    'TURN 1.19.14 · 2026.09.14-r229'
  ])
});
"""
icon_history = insert_after + """

const HEAD_START_ICON_HISTORY = Object.freeze({
  period: '14 September',
  title: 'HEAD START gets its own flying-start symbol',
  paragraphs: Object.freeze([
    'TURN 1.19.14 gives HEAD START a dedicated monochrome icon based on the supplied sketch: a tilted top-down car launching over a checkered finish line.',
    'Only the pictogram changes. The existing achievement icon box, locked/unlocked styling and surrounding card design remain owned by TURN.'
  ]),
  milestones: Object.freeze([
    'Tilted top-down car with two launch streaks',
    'Two-row checkered finish motif inside the existing achievement icon box',
    'TURN 1.19.14 · 2026.09.14-r230'
  ])
});
"""
if insert_after not in history:
    raise SystemExit('HEAD START history anchor not found')
history = history.replace(insert_after, icon_history, 1)
old_dev_tail = """  HEAD_START_HISTORY,
  HEAD_START_FLYING_LAP_HISTORY
]);
"""
new_dev_tail = """  HEAD_START_HISTORY,
  HEAD_START_FLYING_LAP_HISTORY,
  HEAD_START_ICON_HISTORY
]);
"""
if old_dev_tail not in history:
    raise SystemExit('development history tail anchor not found')
history = history.replace(old_dev_tail, new_dev_tail, 1)
old_changelog_tail = """      Object.freeze(['1.19.14 r229', 'Corrects HEAD START: cross the setup lap with OVERCHARGE, spend that carried OVERCHARGE with BOOST on the next lap, and beat the setup time.']),
      Object.freeze(['Two-lap flying-start sequence', 'An invalid next lap breaks the attempt, so the achievement now directly teaches the build-up lap used before Time Trial runs.'])
"""
new_changelog_tail = """      Object.freeze(['1.19.14 r229', 'Corrects HEAD START: cross the setup lap with OVERCHARGE, spend that carried OVERCHARGE with BOOST on the next lap, and beat the setup time.']),
      Object.freeze(['Two-lap flying-start sequence', 'An invalid next lap breaks the attempt, so the achievement now directly teaches the build-up lap used before Time Trial runs.']),
      Object.freeze(['1.19.14 r230', 'Gives HEAD START its own flying-start icon: a tilted top-down car launching over a checkered finish line.']),
      Object.freeze(['Achievement pictogram only', 'Keeps the existing achievement icon box and state styling unchanged while replacing the reused charge symbol.'])
"""
if old_changelog_tail not in history:
    raise SystemExit('14 September changelog tail anchor not found')
history = history.replace(old_changelog_tail, new_changelog_tail, 1)
old_current = """export const CURRENT_RELEASE = Object.freeze({
  version: '1.19.14',
  build: '2026.09.14-r229',
  note: 'TURN 1.19.14 corrects HEAD START to reward a setup lap followed by a boosted flying lap.'
});
"""
new_current = """export const CURRENT_RELEASE = Object.freeze({
  version: '1.19.14',
  build: '2026.09.14-r230',
  note: 'TURN 1.19.14 gives HEAD START a dedicated flying-start achievement icon.'
});
"""
if old_current not in history:
    raise SystemExit('CURRENT_RELEASE anchor not found')
history_path.write_text(history.replace(old_current, new_current, 1))

release_path = Path('turn/release.json')
release = json.loads(release_path.read_text())
if release != {'version': '1.19.14', 'id': '2026.09.14-r229', 'cacheKey': '20260914-r229'}:
    raise SystemExit(f'unexpected release base: {release}')
release_path.write_text(json.dumps({
    'version': '1.19.14',
    'id': '2026.09.14-r230',
    'cacheKey': '20260914-r230'
}, indent=2) + '\n')
