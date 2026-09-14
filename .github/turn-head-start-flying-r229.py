from pathlib import Path
import json


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'{label}: anchor not found in {path}')
    p.write_text(text.replace(old, new, 1))

# Correct the achievement copy: lap A carries OVERCHARGE across the line;
# lap B spends that carried OVERCHARGE with BOOST and beats lap A.
replace_once(
    'turn/achievements/catalog-production.js',
    "  description: 'Beat your previous valid lap and cross the line with OVERCHARGE built up.',\n  recommendation: 'Keep racing after the finish. Time Trial targets are set for flying starts.',",
    "  description: 'Finish a valid lap with OVERCHARGE, then use that carried OVERCHARGE with BOOST to beat it on the next lap.',\n  recommendation: 'Build OVERCHARGE before the line, catch it with GAS, then BOOST after crossing for a flying start.',",
    'correct HEAD START copy'
)

challenge = Path('turn/achievements/challenge-expansion-r166.js')
source = challenge.read_text()
source = source.replace(
"""const HEAD_START_ID = 'head-start';
const OVERCHARGE_CATCH_EVENT = 'turn:overcharge-catch';
""",
"""const HEAD_START_ID = 'head-start';
const OVERCHARGE_CATCH_EVENT = 'turn:overcharge-catch';
const BOOST_OUTCOME_EVENT = 'turn:boost-outcome';
""",
1)
source = source.replace(
"""export function qualifiesForHeadStart({
  previousTime = null,
  currentTime = null,
  overcharge = 0,
  valid = false
} = {}) {
  const previous = Number(previousTime);
  const current = Number(currentTime);
  return valid === true
    && Number.isFinite(previous)
    && previous > 5
    && Number.isFinite(current)
    && current > 5
    && current < previous
    && Number(overcharge) >= CATCH_GAS_MIN_OVERCHARGE;
}
""",
"""export function qualifiesForHeadStart({
  setupTime = null,
  currentTime = null,
  setupOvercharge = 0,
  carriedOverchargeAtStart = 0,
  carriedOverchargeSpent = 0,
  valid = false
} = {}) {
  const setup = Number(setupTime);
  const current = Number(currentTime);
  return valid === true
    && Number.isFinite(setup)
    && setup > 5
    && Number.isFinite(current)
    && current > 5
    && current < setup
    && Number(setupOvercharge) > 0
    && Number(carriedOverchargeAtStart) > 0
    && Number(carriedOverchargeSpent) > 0;
}
""",
1)
source = source.replace(
"""  const progress = loadProgress(storage);
  let currentLap = null;
  let previousValidLap = null;
""",
"""  const progress = loadProgress(storage);
  let currentLap = null;
  let headStartSetup = null;
""",
1)
source = source.replace(
"""  function beginLap() {
    const state = runtime.state;
    const trackId = state.trackId || globalThis.__turnGetTrackId?.() || '';
    if (previousValidLap?.trackId && previousValidLap.trackId !== trackId) previousValidLap = null;
    currentLap = {
      trackId,
      vehicleId: state.vehicleId || '',
      rivalCountAtStart: Array.isArray(state.competitorLaps) ? state.competitorLaps.length : 0
    };
  }
""",
"""  function beginLap() {
    const state = runtime.state;
    const trackId = state.trackId || globalThis.__turnGetTrackId?.() || '';
    if (headStartSetup?.trackId && headStartSetup.trackId !== trackId) headStartSetup = null;
    currentLap = {
      trackId,
      vehicleId: state.vehicleId || '',
      rivalCountAtStart: Array.isArray(state.competitorLaps) ? state.competitorLaps.length : 0,
      headStartSetup: headStartSetup ? { ...headStartSetup } : null,
      overchargeAtStart: Math.max(0, Number(globalThis.__turnBoostOvercharge) || 0),
      carriedOverchargeSpent: 0
    };
  }
""",
1)
source = source.replace(
"""  function resetLap() {
    currentLap = null;
  }

  function completeLap(detail) {
""",
"""  function sampleBoostOutcome(detail = {}) {
    if (!currentLap?.headStartSetup) return 0;
    const overchargeSpent = Math.max(0, Number(detail?.overchargeSpent) || 0);
    if (overchargeSpent <= 0) return currentLap.carriedOverchargeSpent;
    const currentOvercharge = Math.max(0, Number(globalThis.__turnBoostOvercharge) || 0);
    currentLap.carriedOverchargeSpent = Math.max(
      currentLap.carriedOverchargeSpent,
      Math.max(0, currentLap.overchargeAtStart - currentOvercharge)
    );
    return currentLap.carriedOverchargeSpent;
  }

  function resetLap() {
    currentLap = null;
  }

  function completeLap(detail) {
""",
1)
source = source.replace(
"""    const context = achievementContext(attempt.trackId, attempt.vehicleId, detail?.time);
    const currentTime = Number(detail?.time);
    const validLap = detail?.valid !== false && Number.isFinite(currentTime) && currentTime > 5;
    const previousTime = previousValidLap?.trackId === attempt.trackId
      ? previousValidLap.time
      : null;
    if (qualifiesForHeadStart({
      previousTime,
      currentTime,
      overcharge: globalThis.__turnBoostOvercharge,
      valid: validLap
    })) {
      achievements.unlock(HEAD_START_ID, context);
    }
    if (validLap) previousValidLap = { trackId: attempt.trackId, time: currentTime };

    let changed = false;
""",
"""    const context = achievementContext(attempt.trackId, attempt.vehicleId, detail?.time);
    const currentTime = Number(detail?.time);
    const validLap = detail?.valid !== false && Number.isFinite(currentTime) && currentTime > 5;
    const finishOvercharge = Math.max(0, Number(globalThis.__turnBoostOvercharge) || 0);
    const activeBoostSpent = globalThis.__turnBoostActive === true
      ? Math.max(0, attempt.overchargeAtStart - finishOvercharge)
      : 0;
    const carriedOverchargeSpent = Math.max(
      Math.max(0, Number(attempt.carriedOverchargeSpent) || 0),
      activeBoostSpent
    );
    if (qualifiesForHeadStart({
      setupTime: attempt.headStartSetup?.time,
      currentTime,
      setupOvercharge: attempt.headStartSetup?.overcharge,
      carriedOverchargeAtStart: attempt.overchargeAtStart,
      carriedOverchargeSpent,
      valid: validLap
    })) {
      achievements.unlock(HEAD_START_ID, context);
    }
    headStartSetup = validLap && finishOvercharge > 0
      ? { trackId: attempt.trackId, time: currentTime, overcharge: finishOvercharge }
      : null;

    let changed = false;
""",
1)
source = source.replace(
"""    if (reason === 'race-reset') {
      resetLap();
      previousValidLap = null;
    }
    if (Object.prototype.hasOwnProperty.call(event.detail || {}, 'running')
        && event.detail.running === false) {
      resetLap();
      previousValidLap = null;
    }
  };
  const handleLapResult = (event) => completeLap(event.detail || {});
  const handleLapInvalid = () => resetLap();
  const handleOverchargeCatch = (event) => sampleCatchGas({
""",
"""    if (reason === 'race-reset') {
      resetLap();
      headStartSetup = null;
    }
    if (Object.prototype.hasOwnProperty.call(event.detail || {}, 'running')
        && event.detail.running === false) {
      resetLap();
      headStartSetup = null;
    }
  };
  const handleLapResult = (event) => completeLap(event.detail || {});
  const handleLapInvalid = () => {
    resetLap();
    headStartSetup = null;
  };
  const handleBoostOutcome = (event) => sampleBoostOutcome(event.detail || {});
  const handleOverchargeCatch = (event) => sampleCatchGas({
""",
1)
source = source.replace(
"""  globalThis.addEventListener?.('turn:lap-result', handleLapResult);
  globalThis.addEventListener?.('turn:lap-invalid', handleLapInvalid);
  globalThis.addEventListener?.('turn:achievements-updated', handleAchievementsUpdated);
""",
"""  globalThis.addEventListener?.('turn:lap-result', handleLapResult);
  globalThis.addEventListener?.('turn:lap-invalid', handleLapInvalid);
  globalThis.addEventListener?.(BOOST_OUTCOME_EVENT, handleBoostOutcome);
  globalThis.addEventListener?.('turn:achievements-updated', handleAchievementsUpdated);
""",
1)
source = source.replace(
"""      globalThis.removeEventListener?.('turn:lap-result', handleLapResult);
      globalThis.removeEventListener?.('turn:lap-invalid', handleLapInvalid);
      globalThis.removeEventListener?.('turn:achievements-updated', handleAchievementsUpdated);
""",
"""      globalThis.removeEventListener?.('turn:lap-result', handleLapResult);
      globalThis.removeEventListener?.('turn:lap-invalid', handleLapInvalid);
      globalThis.removeEventListener?.(BOOST_OUTCOME_EVENT, handleBoostOutcome);
      globalThis.removeEventListener?.('turn:achievements-updated', handleAchievementsUpdated);
""",
1)
if 'previousValidLap' in source:
    raise SystemExit('stale HEAD START previousValidLap state remains')
challenge.write_text(source)

# Catalog regression copy.
replace_once(
    'turn-lab/tests/achievements-production.mjs',
    "assert.equal(byId('head-start')?.description,\n  'Beat your previous valid lap and cross the line with OVERCHARGE built up.');\nassert.equal(byId('head-start')?.recommendation,\n  'Keep racing after the finish. Time Trial targets are set for flying starts.');",
    "assert.equal(byId('head-start')?.description,\n  'Finish a valid lap with OVERCHARGE, then use that carried OVERCHARGE with BOOST to beat it on the next lap.');\nassert.equal(byId('head-start')?.recommendation,\n  'Build OVERCHARGE before the line, catch it with GAS, then BOOST after crossing for a flying start.');",
    'update HEAD START catalog regression copy'
)
replace_once(
    'turn-lab/tests/achievements-production.mjs',
    "assert.match(challengeSource, /OVERCHARGE_CATCH_EVENT = 'turn:overcharge-catch'/);",
    "assert.match(challengeSource, /OVERCHARGE_CATCH_EVENT = 'turn:overcharge-catch'/);\nassert.match(challengeSource, /BOOST_OUTCOME_EVENT = 'turn:boost-outcome'/);\nassert.match(challengeSource, /carriedOverchargeSpent/);",
    'assert HEAD START boost-outcome contract'
)

replace_once(
    'turn-lab/tests/chromatic-camouflage-production.mjs',
    "assert.match(headStart?.description || '', /previous valid lap/);",
    "assert.match(headStart?.description || '', /carried OVERCHARGE/);\nassert.match(headStart?.description || '', /next lap/);",
    'update presentation catalog HEAD START assertion'
)

# Replace the earlier mistaken qualification/lifecycle regression with the two-lap contract.
poll_path = Path('turn-tests/achievement-polling-production.mjs')
poll = poll_path.read_text()
start = poll.index("assert.equal(qualifiesForHeadStart(")
end = poll.index("\n\nfunction listenerRegistry", start)
poll = poll[:start] + """assert.equal(qualifiesForHeadStart({
  setupTime: 20,
  currentTime: 19,
  setupOvercharge: 0.2,
  carriedOverchargeAtStart: 0.2,
  carriedOverchargeSpent: 0.1,
  valid: true
}), true);
assert.equal(qualifiesForHeadStart({
  setupTime: 20,
  currentTime: 20,
  setupOvercharge: 0.2,
  carriedOverchargeAtStart: 0.2,
  carriedOverchargeSpent: 0.1,
  valid: true
}), false, 'HEAD START requires the flying lap to beat the setup lap');
assert.equal(qualifiesForHeadStart({
  setupTime: 20,
  currentTime: 19,
  setupOvercharge: 0,
  carriedOverchargeAtStart: 0.2,
  carriedOverchargeSpent: 0.1,
  valid: true
}), false, 'The setup lap must cross the line with OVERCHARGE');
assert.equal(qualifiesForHeadStart({
  setupTime: 20,
  currentTime: 19,
  setupOvercharge: 0.2,
  carriedOverchargeAtStart: 0.2,
  carriedOverchargeSpent: 0,
  valid: true
}), false, 'The flying lap must actually spend carried OVERCHARGE with BOOST');
assert.equal(qualifiesForHeadStart({
  setupTime: 20,
  currentTime: 19,
  setupOvercharge: 0.2,
  carriedOverchargeAtStart: 0.2,
  carriedOverchargeSpent: 0.1,
  valid: false
}), false, 'HEAD START must not accept an invalid flying lap');
""" + poll[end:]
old_lifecycle = """  globalThis.__turnBoostOvercharge = 0.25;
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
"""
new_lifecycle = """  assert.equal(events.count('turn:boost-outcome'), 1,
    'HEAD START should consume semantic BOOST outcomes rather than poll controls');

  globalThis.__turnBoostOvercharge = 0.25;
  api.beginLap();
  api.completeLap({ time: 20, valid: true, onCourseThroughout: false });
  assert.equal(unlocked['head-start'], undefined,
    'Crossing with OVERCHARGE arms the next lap but does not unlock HEAD START itself');

  api.beginLap();
  events.emit('turn:lap-invalid');
  globalThis.__turnBoostOvercharge = 0.1;
  api.beginLap();
  globalThis.__turnBoostOvercharge = 0;
  events.emit('turn:boost-outcome', { useful: true, overchargeSpent: 0.1 });
  api.completeLap({ time: 19, valid: true, onCourseThroughout: false });
  assert.equal(unlocked['head-start'], undefined,
    'An invalid next lap must break the setup-to-flying-lap attempt');

  globalThis.__turnBoostOvercharge = 0.3;
  api.beginLap();
  api.completeLap({ time: 21, valid: true, onCourseThroughout: false });
  globalThis.__turnBoostOvercharge = 0.3;
  api.beginLap();
  api.completeLap({ time: 20, valid: true, onCourseThroughout: false });
  assert.equal(unlocked['head-start'], undefined,
    'Beating a setup lap without spending carried OVERCHARGE must not unlock HEAD START');

  globalThis.__turnBoostOvercharge = 0.3;
  api.beginLap();
  globalThis.__turnBoostOvercharge = 0;
  events.emit('turn:boost-outcome', { useful: true, overchargeSpent: 0.3 });
  api.completeLap({ time: 19, valid: true, onCourseThroughout: false });
  assert.ok(unlocked['head-start'],
    'HEAD START unlocks when the next lap spends carried OVERCHARGE with BOOST and beats the setup lap');
"""
if old_lifecycle not in poll:
    raise SystemExit('HEAD START lifecycle test anchor not found')
poll = poll.replace(old_lifecycle, new_lifecycle, 1)
poll = poll.replace(
    "  assert.equal(events.count('turn:lap-invalid'), 0);\n  assert.equal(events.count('turn:achievements-updated'), 0);",
    "  assert.equal(events.count('turn:lap-invalid'), 0);\n  assert.equal(events.count('turn:boost-outcome'), 0);\n  assert.equal(events.count('turn:achievements-updated'), 0);",
    1
)
poll_path.write_text(poll)

# New patch release. r228 remains in history as the originally shipped interpretation;
# r229 records the corrected two-lap behavior.
release_path = Path('turn/release.json')
release = json.loads(release_path.read_text())
if release != {
    'version': '1.19.13',
    'id': '2026.09.14-r228',
    'cacheKey': '20260914-r228'
}:
    raise SystemExit(f'unexpected release baseline: {release}')
release_path.write_text(json.dumps({
    'version': '1.19.14',
    'id': '2026.09.14-r229',
    'cacheKey': '20260914-r229'
}, indent=2) + '\n')

history = Path('turn/content/about-history-current.js')
h = history.read_text()
anchor = """const previousLatest = BASE_CHANGELOG.at(-1);
"""
new_history = """const HEAD_START_FLYING_LAP_HISTORY = Object.freeze({
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
if anchor not in h:
    raise SystemExit('history insertion anchor not found')
h = h.replace(anchor, new_history + anchor, 1)
h = h.replace(
    "  MOUNTAIN_WARNING_READABILITY_HISTORY,\n  HEAD_START_HISTORY\n]);",
    "  MOUNTAIN_WARNING_READABILITY_HISTORY,\n  HEAD_START_HISTORY,\n  HEAD_START_FLYING_LAP_HISTORY\n]);",
    1
)
h = h.replace(
    "      Object.freeze(['Flying-start lesson', 'Encourages continuous laps and prepares drivers for Time Trial targets set for flying starts.'])",
    "      Object.freeze(['Flying-start lesson', 'Encourages continuous laps and prepares drivers for Time Trial targets set for flying starts.']),\n      Object.freeze(['1.19.14 r229', 'Corrects HEAD START: cross the setup lap with OVERCHARGE, spend that carried OVERCHARGE with BOOST on the next lap, and beat the setup time.']),\n      Object.freeze(['Two-lap flying-start sequence', 'An invalid next lap breaks the attempt, so the achievement now directly teaches the build-up lap used before Time Trial runs.'])",
    1
)
h = h.replace(
    "  version: '1.19.13',\n  build: '2026.09.14-r228',\n  note: 'TURN 1.19.13 adds HEAD START to Getting Started as preparation for flying-lap Time Trials.'",
    "  version: '1.19.14',\n  build: '2026.09.14-r229',\n  note: 'TURN 1.19.14 corrects HEAD START to reward a setup lap followed by a boosted flying lap.'",
    1
)
history.write_text(h)
