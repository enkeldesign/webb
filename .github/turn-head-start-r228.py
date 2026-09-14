from pathlib import Path
import json


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'{label}: anchor not found in {path}')
    p.write_text(text.replace(old, new, 1))

# Achievement catalog: add HEAD START after CATCH THE CHARGE and before GOT STARTED.
replace_once(
    'turn/achievements/catalog-production.js',
    "export const GOT_STARTED_ACHIEVEMENT = Object.freeze({\n",
    "export const HEAD_START_ACHIEVEMENT = Object.freeze({\n"
    "  id: 'head-start',\n"
    "  category: base.CATEGORY.ONBOARDING,\n"
    "  trophies: 50,\n"
    "  title: 'HEAD START',\n"
    "  description: 'Beat your previous valid lap and cross the line with OVERCHARGE built up.',\n"
    "  recommendation: 'Keep racing after the finish. Time Trial targets are set for flying starts.',\n"
    "  icon: 'charge'\n"
    "});\n\n"
    "export const GOT_STARTED_ACHIEVEMENT = Object.freeze({\n",
    'insert HEAD START catalog entry'
)
replace_once(
    'turn/achievements/catalog-production.js',
    "  ...base.ONBOARDING_ACHIEVEMENT_IDS,\n  CATCH_THE_CHARGE_ACHIEVEMENT.id\n]);",
    "  ...base.ONBOARDING_ACHIEVEMENT_IDS,\n  CATCH_THE_CHARGE_ACHIEVEMENT.id,\n  HEAD_START_ACHIEVEMENT.id\n]);",
    'add HEAD START to onboarding prerequisites'
)
replace_once(
    'turn/achievements/catalog-production.js',
    "  CATCH_THE_CHARGE_ACHIEVEMENT,\n  GOT_STARTED_ACHIEVEMENT,",
    "  CATCH_THE_CHARGE_ACHIEVEMENT,\n  HEAD_START_ACHIEVEMENT,\n  GOT_STARTED_ACHIEVEMENT,",
    'place HEAD START before GOT STARTED'
)

# Challenge runtime: pure qualification contract plus session-local previous valid lap.
replace_once(
    'turn/achievements/challenge-expansion-r166.js',
    "const CATCH_THE_CHARGE_ID = 'catch-the-charge';\nconst OVERCHARGE_CATCH_EVENT = 'turn:overcharge-catch';",
    "const CATCH_THE_CHARGE_ID = 'catch-the-charge';\nconst HEAD_START_ID = 'head-start';\nconst OVERCHARGE_CATCH_EVENT = 'turn:overcharge-catch';",
    'add HEAD START runtime id'
)
replace_once(
    'turn/achievements/challenge-expansion-r166.js',
    "function winnerAchievementId(trackId) {",
    "export function qualifiesForHeadStart({\n"
    "  previousTime = null,\n"
    "  currentTime = null,\n"
    "  overcharge = 0,\n"
    "  valid = false\n"
    "} = {}) {\n"
    "  const previous = Number(previousTime);\n"
    "  const current = Number(currentTime);\n"
    "  return valid === true\n"
    "    && Number.isFinite(previous)\n"
    "    && previous > 5\n"
    "    && Number.isFinite(current)\n"
    "    && current > 5\n"
    "    && current < previous\n"
    "    && Number(overcharge) >= CATCH_GAS_MIN_OVERCHARGE;\n"
    "}\n\n"
    "function winnerAchievementId(trackId) {",
    'add HEAD START qualification helper'
)
replace_once(
    'turn/achievements/challenge-expansion-r166.js',
    "  const progress = loadProgress(storage);\n  let currentLap = null;",
    "  const progress = loadProgress(storage);\n  let currentLap = null;\n  let previousValidLap = null;",
    'add previous valid lap state'
)
replace_once(
    'turn/achievements/challenge-expansion-r166.js',
    "  function beginLap() {\n    const state = runtime.state;\n    currentLap = {\n      trackId: state.trackId || globalThis.__turnGetTrackId?.() || '',",
    "  function beginLap() {\n    const state = runtime.state;\n    const trackId = state.trackId || globalThis.__turnGetTrackId?.() || '';\n    if (previousValidLap?.trackId && previousValidLap.trackId !== trackId) previousValidLap = null;\n    currentLap = {\n      trackId,",
    'scope previous lap to current track'
)
replace_once(
    'turn/achievements/challenge-expansion-r166.js',
    "    const context = achievementContext(attempt.trackId, attempt.vehicleId, detail?.time);\n    let changed = false;",
    "    const context = achievementContext(attempt.trackId, attempt.vehicleId, detail?.time);\n"
    "    const currentTime = Number(detail?.time);\n"
    "    const validLap = detail?.valid !== false && Number.isFinite(currentTime) && currentTime > 5;\n"
    "    const previousTime = previousValidLap?.trackId === attempt.trackId\n"
    "      ? previousValidLap.time\n"
    "      : null;\n"
    "    if (qualifiesForHeadStart({\n"
    "      previousTime,\n"
    "      currentTime,\n"
    "      overcharge: globalThis.__turnBoostOvercharge,\n"
    "      valid: validLap\n"
    "    })) {\n"
    "      achievements.unlock(HEAD_START_ID, context);\n"
    "    }\n"
    "    if (validLap) previousValidLap = { trackId: attempt.trackId, time: currentTime };\n\n"
    "    let changed = false;",
    'unlock HEAD START on faster valid lap with overcharge'
)
replace_once(
    'turn/achievements/challenge-expansion-r166.js',
    "    if (reason === 'race-reset') resetLap();\n    if (Object.prototype.hasOwnProperty.call(event.detail || {}, 'running')\n        && event.detail.running === false) {\n      resetLap();\n    }",
    "    if (reason === 'race-reset') {\n      resetLap();\n      previousValidLap = null;\n    }\n    if (Object.prototype.hasOwnProperty.call(event.detail || {}, 'running')\n        && event.detail.running === false) {\n      resetLap();\n      previousValidLap = null;\n    }",
    'reset HEAD START comparison with race session'
)

# Keep the public aggregate helper surface aligned with the challenge module.
replace_once(
    'turn/achievements.js',
    "  qualifiesForCatchGas,\n  qualifiesForCleanLap,",
    "  qualifiesForCatchGas,\n  qualifiesForCleanLap,\n  qualifiesForHeadStart,",
    'export HEAD START helper'
)

# Release generator: bind changed progression modules to the current build without new revision names.
release_path = Path('turn/scripts/release.mjs')
release_source = release_path.read_text()
anchor = "function synchronizeGraphicsRuntimeTarget(importMap, release) {"
helper = """function synchronizeAchievementProgressionTargets(importMap, release) {
  const imports = importMap.imports ||= {};
  const challengeTarget = `/turn/achievements/challenge-expansion-r166.js?revision=r256-achievement-polling&build=${release.cacheKey}`;
  for (const specifier of [
    '/turn/achievements/challenge-expansion-r166.js?revision=r166-bella-records',
    '/turn/achievements/challenge-expansion-r166.js?revision=r241-learning-achievements',
    '/turn/achievements/challenge-expansion-r166.js?revision=r256-achievement-polling'
  ]) {
    imports[specifier] = challengeTarget;
  }
  imports['/turn/achievements/catalog-production.js?revision=r241-learning-achievements-base']
    = `/turn/achievements/catalog-production.js?build=${release.cacheKey}`;
}

"""
if anchor not in release_source:
    raise SystemExit('release achievement helper anchor not found')
release_source = release_source.replace(anchor, helper + anchor, 1)
release_source = release_source.replace(
    "    synchronizeVisualResourceTargets(importMap, release);\n    synchronizeGraphicsRuntimeTarget(importMap, release);",
    "    synchronizeVisualResourceTargets(importMap, release);\n    synchronizeAchievementProgressionTargets(importMap, release);\n    synchronizeGraphicsRuntimeTarget(importMap, release);",
    1
)
# The same sequence appears again in the production runtime synchronizer.
release_source = release_source.replace(
    "  synchronizeVisualResourceTargets(importMap, release);\n  synchronizeGraphicsRuntimeTarget(importMap, release);",
    "  synchronizeVisualResourceTargets(importMap, release);\n  synchronizeAchievementProgressionTargets(importMap, release);\n  synchronizeGraphicsRuntimeTarget(importMap, release);",
    1
)
release_path.write_text(release_source)

# Release composition must make both changed progression modules current-build identities.
comp_path = Path('turn-tests/release-composition-production.mjs')
comp = comp_path.read_text()
old_challenge = """  '/turn/achievements/challenge-expansion-r166.js?revision=r166-bella-records': '/turn/achievements/challenge-expansion-r166.js?revision=r256-achievement-polling',
  '/turn/achievements/challenge-expansion-r166.js?revision=r241-learning-achievements': '/turn/achievements/challenge-expansion-r166.js?revision=r256-achievement-polling',
"""
new_challenge = """  '/turn/achievements/challenge-expansion-r166.js?revision=r166-bella-records': `/turn/achievements/challenge-expansion-r166.js?revision=r256-achievement-polling&build=${currentRelease.cacheKey}`,
  '/turn/achievements/challenge-expansion-r166.js?revision=r241-learning-achievements': `/turn/achievements/challenge-expansion-r166.js?revision=r256-achievement-polling&build=${currentRelease.cacheKey}`,
  '/turn/achievements/challenge-expansion-r166.js?revision=r256-achievement-polling': `/turn/achievements/challenge-expansion-r166.js?revision=r256-achievement-polling&build=${currentRelease.cacheKey}`,
"""
if old_challenge not in comp:
    raise SystemExit('release composition challenge routes anchor not found')
comp = comp.replace(old_challenge, new_challenge, 1)
prod_route_anchor = "    '/turn/achievements/catalog-production.js?revision=r241-learning-achievements': '/turn/achievements/catalog-track-icons.js?revision=r1-track-reward-icons',\n"
if prod_route_anchor not in comp:
    raise SystemExit('release composition catalog route anchor not found')
comp = comp.replace(
    prod_route_anchor,
    prod_route_anchor + "    '/turn/achievements/catalog-production.js?revision=r241-learning-achievements-base': `/turn/achievements/catalog-production.js?build=${release.cacheKey}`,\n",
    1
)
comp = comp.replace(
    "  'turn/achievements/catalog-track-icons.js',\n",
    "  'turn/achievements/catalog-track-icons.js',\n  'turn/achievements/catalog-production.js',\n  'turn/achievements/challenge-expansion-r166.js',\n",
    1
)
comp_path.write_text(comp)

# Achievement catalog regression counts and HEAD START contract.
ach_path = Path('turn-lab/tests/achievements-production.mjs')
ach = ach_path.read_text()
ach = ach.replace("assert.equal(ACHIEVEMENTS.length, 60,\n  'Production TURN must expose 47 core achievements plus 13 scoring achievements');", "assert.equal(ACHIEVEMENTS.length, 61,\n  'Production TURN must expose 48 core achievements plus 13 scoring achievements');")
ach = ach.replace("assert.equal(new Set(ACHIEVEMENTS.map((achievement) => achievement.id)).size, 60,", "assert.equal(new Set(ACHIEVEMENTS.map((achievement) => achievement.id)).size, 61,")
ach = ach.replace("assert.equal(ONBOARDING_ACHIEVEMENT_IDS.length, 11,\n  'GOT STARTED must remain the master of the eleven prerequisite Getting Started achievements, not recursively require itself');", "assert.equal(ONBOARDING_ACHIEVEMENT_IDS.length, 12,\n  'GOT STARTED must remain the master of the twelve prerequisite Getting Started achievements, not recursively require itself');")
ach = ach.replace("assert.equal(totalAvailableTrophies(), 4575,\n  'The learning and balance pass must expose the complete 4,575-trophy supply');", "assert.equal(totalAvailableTrophies(), 4625,\n  'The learning and balance pass must expose the complete 4,625-trophy supply');")
ach = ach.replace("  4575\n);", "  4625\n);", 1)
catch_assert = """assert.equal(
  byId('catch-the-charge')?.description,
  'With BOOST full, keep using DRIFT to build purple OVERCHARGE. Slide to GAS to catch it before it leaks away.'
);
"""
head_assert = catch_assert + """assert.equal(byId('head-start')?.title, 'HEAD START');
assert.equal(byId('head-start')?.trophies, 50);
assert.equal(byId('head-start')?.category, 'onboarding');
assert.equal(byId('head-start')?.description,
  'Beat your previous valid lap and cross the line with OVERCHARGE built up.');
assert.equal(byId('head-start')?.recommendation,
  'Keep racing after the finish. Time Trial targets are set for flying starts.');
assert.equal(ONBOARDING_ACHIEVEMENT_IDS.includes('head-start'), true);
"""
if catch_assert not in ach:
    raise SystemExit('achievement HEAD START assertion anchor not found')
ach = ach.replace(catch_assert, head_assert, 1)
ach_path.write_text(ach)

# Legacy/presentation catalog regression follows the same production totals.
chrom_path = Path('turn-lab/tests/chromatic-camouflage-production.mjs')
chrom = chrom_path.read_text()
chrom = chrom.replace("const catchTheCharge = getAchievement('catch-the-charge');\nconst gotStarted", "const catchTheCharge = getAchievement('catch-the-charge');\nconst headStart = getAchievement('head-start');\nconst gotStarted", 1)
chrom = chrom.replace('assert.equal(ACHIEVEMENTS.length, 60,', 'assert.equal(ACHIEVEMENTS.length, 61,', 1)
chrom = chrom.replace("assert.equal(ONBOARDING_ACHIEVEMENT_IDS.length, 11,\n  'GOT STARTED must require every Getting Started lesson, including CATCH THE CHARGE, without requiring itself');", "assert.equal(ONBOARDING_ACHIEVEMENT_IDS.length, 12,\n  'GOT STARTED must require every Getting Started lesson, including HEAD START, without requiring itself');")
chrom = chrom.replace("assert.equal(ONBOARDING_ACHIEVEMENT_IDS.includes('catch-the-charge'), true);", "assert.equal(ONBOARDING_ACHIEVEMENT_IDS.includes('catch-the-charge'), true);\nassert.equal(ONBOARDING_ACHIEVEMENT_IDS.includes('head-start'), true);\nassert.equal(headStart?.title, 'HEAD START');\nassert.equal(headStart?.trophies, 50);\nassert.match(headStart?.description || '', /previous valid lap/);", 1)
chrom = chrom.replace('  4575,\n  \'The learning and balance pass must expose the complete trophy supply\'', '  4625,\n  \'The learning and balance pass must expose the complete trophy supply\'', 1)
chrom_path.write_text(chrom)

# Trophy Road's reward catalog still tops out at 2300, but the available trophy supply grows by 50.
trophy_path = Path('turn-lab/tests/trophy-road-production.mjs')
trophy = trophy_path.read_text().replace('productionRewardIdsForTrophies(4575)', 'productionRewardIdsForTrophies(4625)')
trophy_path.write_text(trophy)

# Event-driven qualification and real lifecycle regression.
poll_path = Path('turn-tests/achievement-polling-production.mjs')
poll = poll_path.read_text()
poll = poll.replace(
    "  CHALLENGE_PROGRESS_STORAGE_KEY,\n  installAchievementChallengeExpansion",
    "  CHALLENGE_PROGRESS_STORAGE_KEY,\n  installAchievementChallengeExpansion,\n  qualifiesForHeadStart",
    1
)
insert_after_import = "} from '../turn/achievements/challenge-expansion-r166.js';\n\n"
head_unit = """} from '../turn/achievements/challenge-expansion-r166.js';

assert.equal(qualifiesForHeadStart({ previousTime: 20, currentTime: 19, overcharge: 0.2, valid: true }), true);
assert.equal(qualifiesForHeadStart({ previousTime: 20, currentTime: 20, overcharge: 0.2, valid: true }), false,
  'HEAD START requires an actual improvement over the previous valid lap');
assert.equal(qualifiesForHeadStart({ previousTime: 20, currentTime: 19, overcharge: 0, valid: true }), false,
  'HEAD START requires OVERCHARGE at the finish line');
assert.equal(qualifiesForHeadStart({ previousTime: 20, currentTime: 19, overcharge: 0.2, valid: false }), false,
  'HEAD START must not accept an invalid lap');

"""
if insert_after_import not in poll:
    raise SystemExit('achievement polling import anchor not found')
poll = poll.replace(insert_after_import, head_unit, 1)
poll = poll.replace("  replaceGlobal('document', documentRef);", "  replaceGlobal('document', documentRef);\n  replaceGlobal('__turnBoostOvercharge', 0);", 1)
lifecycle_anchor = """  assert.ok(unlocked['countryside-safety'],
    'The clean-lap achievement must consume the canonical result instead of polling offRoad');
  assert.equal(intervalStarts, 0);
"""
lifecycle_insert = """  assert.ok(unlocked['countryside-safety'],
    'The clean-lap achievement must consume the canonical result instead of polling offRoad');

  globalThis.__turnBoostOvercharge = 0.25;
  api.beginLap();
  api.completeLap({ time: 20, valid: true, onCourseThroughout: false });
  assert.equal(unlocked['head-start'], undefined,
    'HEAD START needs a previous valid lap before it can unlock');

  globalThis.__turnBoostOvercharge = 0;
  api.beginLap();
  api.completeLap({ time: 19, valid: true, onCourseThroughout: false });
  assert.equal(unlocked['head-start'], undefined,
    'A faster lap without OVERCHARGE must not unlock HEAD START');

  globalThis.__turnBoostOvercharge = 0.2;
  api.beginLap();
  api.completeLap({ time: 18, valid: true, onCourseThroughout: false });
  assert.ok(unlocked['head-start'],
    'A faster valid lap with OVERCHARGE at the line must unlock HEAD START');

  assert.equal(intervalStarts, 0);
"""
if lifecycle_anchor not in poll:
    raise SystemExit('achievement polling lifecycle anchor not found')
poll = poll.replace(lifecycle_anchor, lifecycle_insert, 1)
poll_path.write_text(poll)

# Release history/changelog.
history_path = Path('turn/content/about-history-current.js')
history = history_path.read_text()
history_anchor = "const previousLatest = BASE_CHANGELOG.at(-1);"
head_history = """const HEAD_START_HISTORY = Object.freeze({
  period: '14 September',
  title: 'HEAD START teaches the flying lap',
  paragraphs: Object.freeze([
    'TURN 1.19.13 adds HEAD START to Getting Started. It awards 50 trophies for beating the previous valid lap while crossing the line with OVERCHARGE built up.',
    'The lesson encourages drivers to keep racing through start/finish and prepare the next lap with momentum and charge before taking on Time Trial targets set for flying starts.'
  ]),
  milestones: Object.freeze([
    '50-trophy HEAD START lesson in Getting Started',
    'Faster consecutive valid lap with OVERCHARGE at the line',
    'TURN 1.19.13 · 2026.09.14-r228'
  ])
});

"""
if history_anchor not in history:
    raise SystemExit('history insertion anchor not found')
history = history.replace(history_anchor, head_history + history_anchor, 1)
history = history.replace(
    "  MOUNTAIN_WARNING_READABILITY_HISTORY\n]);",
    "  MOUNTAIN_WARNING_READABILITY_HISTORY,\n  HEAD_START_HISTORY\n]);",
    1
)
changelog_anchor = """      Object.freeze(['Clear warning symbol', 'Keeps the support behind the plate and gives the front a tapered exclamation bar with a separate round dot.'])
"""
if changelog_anchor not in history:
    raise SystemExit('14 September changelog anchor not found')
history = history.replace(
    changelog_anchor,
    changelog_anchor.rstrip('\n') + ",\n      Object.freeze(['1.19.13 r228', 'Adds HEAD START to Getting Started for 50 trophies: beat the previous valid lap while carrying OVERCHARGE across the line.']),\n      Object.freeze(['Flying-start lesson', 'Encourages continuous laps and prepares drivers for Time Trial targets set for flying starts.'])\n",
    1
)
history = history.replace(
    "  note: 'TURN 1.19.12 raises and clarifies MOUNTAIN’s summit warning sign while keeping its placement unchanged.'",
    "  note: 'TURN 1.19.13 adds HEAD START to Getting Started as preparation for flying-lap Time Trials.'",
    1
)
history_path.write_text(history)

# Release definition: feature addition => patch version bump and same-merge build increment.
release_json = Path('turn/release.json')
release = json.loads(release_json.read_text())
expected = {'version': '1.19.12', 'id': '2026.09.14-r227', 'cacheKey': '20260914-r227'}
if release != expected:
    raise SystemExit(f'Unexpected release base: {release!r}')
release_json.write_text(json.dumps({
    'version': '1.19.13',
    'id': '2026.09.14-r228',
    'cacheKey': '20260914-r228'
}, indent=2) + '\n')

# Current-release URL assertions in test sources should advance with this build.
for root in (Path('turn-tests'), Path('turn-lab/tests')):
    for path in root.rglob('*.mjs'):
        text = path.read_text()
        updated = text.replace('20260914-r227', '20260914-r228').replace('2026.09.14-r227', '2026.09.14-r228')
        if updated != text:
            path.write_text(updated)
