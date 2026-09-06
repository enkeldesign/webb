import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  DRIFT_LOCK_ENGAGE_SECONDS,
  DRIFT_LOCK_RELEASE_SECONDS,
  DRIFT_LOCK_RECHARGE_MULTIPLIER,
  REGULAR_DRIFT_RECHARGE_BLEND,
  advanceDriftLockAmount,
  driftThrottleForLock,
  pointerUsesDriftLock,
  resolveDriftBoostRechargeMultiplier
} from '../../turn/input/drift-lock.js';
import {
  BOOST_OVERCHARGE_MAX_WIDTH,
  BOOST_OVERCHARGE_PHASE,
  advanceBoostOvercharge,
  boostOverchargeVisualWidth,
  qualifiesForBoostOvercharge,
  resolveBoostSlipAngle
} from '../../turn/input/boost-overcharge.js';
import { updateVehiclePhysicsState } from '../../turn/vehicle/physics.js';
import { spokenRivalCount } from '../../turn/ui/race-announcements.js';
import { lapAnnouncementPriorityMs } from '../../turn/ui/race-speech.js';

assert.equal(spokenRivalCount(1), 'one rival');
assert.equal(spokenRivalCount(4), 'four rivals');
assert.ok(
  lapAnnouncementPriorityMs('Lap. First. One minute, fifteen point three four six seconds.') >= 5000,
  'A full lap summary needs a conservative uninterrupted VoiceOver window'
);
assert.ok(
  lapAnnouncementPriorityMs('Lap void. Stay on the track.') >= 3200,
  'A void-lap summary also needs priority over live race updates'
);

const driftLockGeometry = {
  driftActive: true,
  padLeft: 100,
  padTop: 50,
  padHeight: 200,
  bubbleWidth: 60
};
assert.equal(pointerUsesDriftLock({ ...driftLockGeometry, pointerX: 50, pointerY: 80 }), true);
assert.equal(pointerUsesDriftLock({ ...driftLockGeometry, pointerX: 104, pointerY: 80 }), true);
assert.equal(pointerUsesDriftLock({ ...driftLockGeometry, pointerX: 105, pointerY: 80 }), false);
assert.equal(pointerUsesDriftLock({ ...driftLockGeometry, pointerX: 21, pointerY: 80 }), false);
assert.equal(pointerUsesDriftLock({ ...driftLockGeometry, pointerX: 50, pointerY: 37 }), false);
assert.equal(pointerUsesDriftLock({ ...driftLockGeometry, pointerX: 50, pointerY: 127 }), false);
assert.equal(pointerUsesDriftLock({ ...driftLockGeometry, pointerX: 50, pointerY: 80, driftActive: false }), false);
const rightDriftLockGeometry = {
  ...driftLockGeometry,
  padRight: 300,
  lockSide: 'right'
};
assert.equal(pointerUsesDriftLock({ ...rightDriftLockGeometry, pointerX: 296, pointerY: 80 }), true);
assert.equal(pointerUsesDriftLock({ ...rightDriftLockGeometry, pointerX: 350, pointerY: 80 }), true);
assert.equal(pointerUsesDriftLock({ ...rightDriftLockGeometry, pointerX: 295, pointerY: 80 }), false);
assert.equal(pointerUsesDriftLock({ ...rightDriftLockGeometry, pointerX: 379, pointerY: 80 }), false);
assert.equal(advanceDriftLockAmount(0, true, DRIFT_LOCK_ENGAGE_SECONDS / 2), 0.5);
assert.equal(advanceDriftLockAmount(0.5, true, DRIFT_LOCK_ENGAGE_SECONDS / 2), 1);
assert.equal(advanceDriftLockAmount(1, false, DRIFT_LOCK_RELEASE_SECONDS / 2), 0.5);
assert.equal(advanceDriftLockAmount(0.5, false, DRIFT_LOCK_RELEASE_SECONDS / 2), 0);
assert.equal(driftThrottleForLock(0), 1);
assert.equal(driftThrottleForLock(0.5), 0.5);
assert.equal(driftThrottleForLock(1), 0);
assert.equal(REGULAR_DRIFT_RECHARGE_BLEND, 0.5);
assert.equal(DRIFT_LOCK_RECHARGE_MULTIPLIER, 3.6);
assert.equal(resolveDriftBoostRechargeMultiplier({ driftHeld: false, driftLockAmount: 1, lockedMultiplier: 2.4 }), 0);
// Legacy helper calls remain deterministic for older callers.
assert.ok(Math.abs(resolveDriftBoostRechargeMultiplier({ driftHeld: true, driftLockAmount: 0, lockedMultiplier: 2.4 }) - 1.7) < 1e-12);
assert.ok(Math.abs(resolveDriftBoostRechargeMultiplier({ driftHeld: true, driftLockAmount: 0.5, lockedMultiplier: 2.4 }) - 2.05) < 1e-12);
assert.ok(Math.abs(resolveDriftBoostRechargeMultiplier({ driftHeld: true, driftLockAmount: 1, lockedMultiplier: 2.4 }) - 2.4) < 1e-12);
// Production balance restores the old ordinary DRIFT rate and makes LOCK use the former Rally perk rate.
assert.ok(Math.abs(resolveDriftBoostRechargeMultiplier({
  driftHeld: true,
  driftLockAmount: 0,
  lockedMultiplier: 2.4,
  lockCeilingMultiplier: 3.6
}) - 2.4) < 1e-12);
assert.ok(Math.abs(resolveDriftBoostRechargeMultiplier({
  driftHeld: true,
  driftLockAmount: 0.5,
  lockedMultiplier: 2.4,
  lockCeilingMultiplier: 3.6
}) - 3.0) < 1e-12);
assert.ok(Math.abs(resolveDriftBoostRechargeMultiplier({
  driftHeld: true,
  driftLockAmount: 1,
  lockedMultiplier: 2.4,
  lockCeilingMultiplier: 3.6
}) - 3.6) < 1e-12);
assert.ok(Math.abs(resolveDriftBoostRechargeMultiplier({
  driftHeld: true,
  driftLockAmount: 0,
  lockedMultiplier: 3.6,
  lockCeilingMultiplier: 3.6
}) - 3.6) < 1e-12);
assert.ok(Math.abs(resolveDriftBoostRechargeMultiplier({
  driftHeld: true,
  driftLockAmount: 1,
  lockedMultiplier: 3.6,
  lockCeilingMultiplier: 3.6
}) - 3.6) < 1e-12);

assert.equal(resolveBoostSlipAngle({ heading: 0, velocity: { x: 0, z: 20 } }), 0);
assert.ok(Math.abs(resolveBoostSlipAngle({ heading: 0, velocity: { x: 20, z: 0 } }) - Math.PI / 2) < 1e-12);
assert.ok(Math.abs(resolveBoostSlipAngle({ heading: 0, velocity: { x: 0, z: -20 } }) - Math.PI) < 1e-12,
  'A backwards spin must retain its full slip angle instead of folding back toward zero');
assert.equal(qualifiesForBoostOvercharge({
  driftHeld: true,
  speed: 14,
  slipAngle: 10 * Math.PI / 180
}), true, 'Overcharge should engage at the documented speed and slip thresholds');
assert.equal(qualifiesForBoostOvercharge({ driftHeld: false, speed: 40, slipAngle: Math.PI / 2 }), false);

const halfBuiltOvercharge = advanceBoostOvercharge({
  dt: 0.9,
  zone: 'drift',
  qualifyingDrift: true
});
assert.ok(Math.abs(halfBuiltOvercharge.amount - 0.5) < 1e-12);
assert.equal(halfBuiltOvercharge.phase, BOOST_OVERCHARGE_PHASE.BUILDING);
const caughtOvercharge = advanceBoostOvercharge({
  ...halfBuiltOvercharge,
  dt: 4,
  zone: 'gas'
});
assert.equal(caughtOvercharge.amount, halfBuiltOvercharge.amount,
  'GAS must freeze caught Overcharge without silently draining it');
const peakedOvercharge = advanceBoostOvercharge({
  ...caughtOvercharge,
  dt: 0.9,
  zone: 'drift',
  qualifyingDrift: true
});
assert.equal(peakedOvercharge.amount, 1);
assert.equal(peakedOvercharge.phase, BOOST_OVERCHARGE_PHASE.DECAYING);
assert.equal(peakedOvercharge.peaked, true);
const consumedOvercharge = advanceBoostOvercharge({
  ...peakedOvercharge,
  dt: 0.6,
  zone: 'boost',
  consuming: true
});
assert.equal(consumedOvercharge.amount, 0);
assert.equal(consumedOvercharge.phase, BOOST_OVERCHARGE_PHASE.READY);
assert.equal(boostOverchargeVisualWidth(1), BOOST_OVERCHARGE_MAX_WIDTH);

class Vec3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  clone() { return new Vec3(this.x, this.y, this.z); }
  dot(other) { return this.x * other.x + this.y * other.y + this.z * other.z; }
  addScaledVector(other, scale) { this.x += other.x * scale; this.y += other.y * scale; this.z += other.z * scale; return this; }
  multiplyScalar(scale) { this.x *= scale; this.y *= scale; this.z *= scale; return this; }
  length() { return Math.hypot(this.x, this.y, this.z); }
}

const [
  index,
  nextIndex,
  releaseSource,
  app,
  controls,
  positionLayout,
  raceSpeech,
  css,
  gameplayCss,
  semanticCss,
  positionCss,
  analogGas,
  spectate,
  mainSource
] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn-next/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/gameplay-controls.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/race-position-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/race-speech.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/drive-pad.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/gameplay-v2.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/design-semantic.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/position-hud-r83.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/input/analog-gas.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/spectate.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/main.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));
assert.match(index, new RegExp(`drive-pad\\.css\\?build=${release.cacheKey}`));
assert.match(index, new RegExp(`gameplay-v2\\.css\\?build=${release.cacheKey}`));
assert.match(index, new RegExp(`gameplay-v2\\.css\\?build=${release.cacheKey}&revision=r217-drift-lock-design`),
  'The Boost gradient fix must bypass stale production CSS caches');
assert.match(index, new RegExp(`drive-pad\\.css\\?build=${release.cacheKey}&revision=r217-drift-lock-design`),
  'The connected LOCK geometry must bypass stale production CSS caches');
assert.match(nextIndex, new RegExp(`gameplay-v2\\.css\\?build=${release.cacheKey}&revision=r217-drift-lock-design`));
assert.match(nextIndex, new RegExp(`drive-pad\\.css\\?build=${release.cacheKey}&revision=r217-drift-lock-design`));
assert.match(index, new RegExp(`position-hud-r83\\.css\\?build=${release.cacheKey}`));
assert.ok(
  index.indexOf('gameplay-v2.css') < index.indexOf('position-hud-r83.css'),
  'The topbar position override must load after the legacy gameplay HUD rules'
);
assert.match(app, /race-position-layout\.js/, 'The production module graph must install the position layout after gameplay controls');
assert.match(app, /gameplay-controls\.js\?revision=r245-separate-reverse/,
  'The attached REVERSE control must bypass stale production module caches');
assert.match(app, /installRaceSpeech\(\)/, 'The production graph must install concise race speech before the runtime starts');
assert.ok(
  app.indexOf('./ui/gameplay-controls.js') < app.indexOf('./ui/race-speech.js')
    && app.indexOf('./ui/race-speech.js') < app.indexOf('./main.js'),
  'Race speech must wrap the position setter after controls create it and before the runtime publishes positions'
);
assert.match(positionLayout, /positionHud\.classList\.add\('chip'\)/, 'Race position must use the same chip component as the other topbar stats');
assert.match(positionLayout, /lapChip\.after\(positionHud\)/, 'Race position must sit immediately after LAP');
assert.doesNotMatch(positionLayout, /innerHTML|replaceChildren/, 'Moving the HUD must preserve the live position value node captured by gameplay controls');
assert.match(positionCss, /\.stats \.race-position-hud \{[\s\S]*position: relative;/, 'Race position must no longer float over the car');
assert.match(positionCss, /\.race-position-hud\[hidden\][\s\S]*visibility: hidden;/, 'The top row must reserve the position slot before a lap starts');
assert.match(positionCss, /\.stats \.chip:nth-child\(3\)/, 'The third compact chip slot must belong to POSITION');
assert.match(positionCss, /\.stats \.chip:nth-child\(5\)/, 'TIME and BEST must remain sized after inserting POSITION');
assert.match(positionCss, /\.turn-sr-only \{[\s\S]*clip: rect\(0 0 0 0\)/, 'Dedicated announcers must stay visually hidden without leaving the accessibility tree');
assert.match(positionCss, /prefers-reduced-motion: reduce/, 'Position-change feedback must respect reduced motion');
assert.match(raceSpeech, /const positionAnnouncer = createAnnouncer\('race-position-announcer', 'assertive'\)/, 'Passing updates must use one fast assertive ordinal channel outside lap summaries');
assert.match(raceSpeech, /const contextAnnouncer = createAnnouncer\('race-context-announcer', 'polite'\)/, 'Start-line rival context must use a separate polite channel');
assert.match(raceSpeech, /positionLabel\?\.setAttribute\('aria-hidden', 'true'\)/, 'The visual POSITION label must not be repeated beside its spoken value');
assert.match(raceSpeech, /`Position, \$\{spokenPosition\(normalizedPosition, normalizedTotal\)\}`/, 'The visible 1/5 value must remain inspectable as first of five');
assert.match(raceSpeech, /lastPosition !== null && normalizedPosition !== lastPosition/, 'Initial placement must stay quiet outside lap-summary handoffs');
assert.match(raceSpeech, /pendingPositionAnnouncement = normalizedPosition/, 'Position changes during a lap summary must collapse to the latest ordinal');
assert.match(raceSpeech, /window\.setTimeout\(flushPendingPosition, priorityMs\)/, 'The newest position must be released only after the lap-priority window');
assert.match(raceSpeech, /setLiveAnnouncement\(positionAnnouncer, ordinalWord\(lastPosition\)\)/, 'The deferred handoff must announce only the latest ordinal');
assert.match(raceSpeech, /beginLapPriority\(lapResultAnnouncement\(event\.detail\)\)/, 'A valid lap result must start the speech priority window');
assert.match(raceSpeech, /beginLapPriority\(lapVoidAnnouncement\(event\.detail\?\.reason\)\)/, 'A void lap must receive the same priority over live position changes');
assert.match(raceSpeech, /if \(!lapPriorityActive\(\)\) \{[\s\S]*spokenRivalCount\(rivalCount\)/, 'Next-lap rival context must not slip into an active lap summary');
assert.doesNotMatch(raceSpeech, /LAP_RESULT_HANDOFF_MS|suppressPositionUntil/, 'The retired 450 ms suppression must not return');
assert.match(raceSpeech, /reason === 'lap-started'/, 'Rival count must remain tied to crossing the start line');
assert.doesNotMatch(raceSpeech, /VoiceOver|screenReader|blindMode|userAgent/i, 'The same race information must remain available without detecting disability');
assert.match(controls, /className = 'drive-pad'/, 'Gameplay controls must create one unified drive pad');
assert.match(controls, /Double tap and hold, then slide between GAS, DRIFT, BOOST, and BRAKE/, 'The drive group must explain its continuous VoiceOver gesture');
assert.match(controls, /While holding BRAKE, slide outward into REVERSE/,
  'The drive group must explain the separate attached REVERSE gesture');
assert.match(controls, /DRIFT charges BOOST and builds OVERCHARGE after the bar is full/);
assert.match(controls, /GAS catches and holds OVERCHARGE/);
assert.match(controls, /BOOST spends OVERCHARGE before normal BOOST/);
assert.match(controls, /caught and held with GAS/,
  'The accessible meter must use the same catch-and-hold vocabulary as the guide');
assert.match(controls, /drivePad\.append\(driveTop, gasButton, brakeButton\)/, 'BRAKE must remain inside the same continuous drive surface');
assert.match(controls, /driveStack\.append\(driftLockBubble, drivePad, reverseBubble, shiftBubble, shiftStatus\)/,
  'REVERSE must attach outside the drive surface alongside its contextual controls');
assert.match(controls, /topDriveZoneAt\(x, controlHandedness\)/,
  'Top drive pad must split into Drift and Boost according to the selected handedness');
assert.match(controls, /y >= BRAKE_ZONE_START\) return 'brake'/, 'Bottom drive pad must map to stopping-only BRAKE');
assert.match(controls, /return 'gas'/, 'Middle drive pad must map to Gas');
assert.match(controls, /const forwardDrive = nextZone === 'gas' \|\| nextZone === 'drift' \|\| nextZone === 'boost'/, 'Only forward-driving zones may keep gas engaged');
assert.match(controls, /globalThis\.__turnAnalogGas = forwardDrive \? forwardThrottle : 0/,
  'Brake must release gas while the smooth binary LOCK transition may reduce it');
assert.match(controls, /globalThis\.__turnDriftHeld = nextZone === 'drift'/, 'Drift zone must add drift to gas');
assert.match(controls, /pointerUsesDriftLock\(\{/,
  'The external bubble must own a dedicated forgiving hit target');
assert.match(controls, /driftActive: driveZone === 'drift'/,
  'LOCK must only become available after the player has engaged DRIFT');
assert.match(controls, /if \(lockRequested\) return \{ zone: 'drift', lockRequested: true, shiftRequested: false, reverseRequested: false \}/,
  'Entering the bubble must keep DRIFT held while switching binary LOCK on');
assert.match(controls, /advanceDriftLockAmount\(/,
  'The binary target must use a short mechanical transition instead of snapping');
assert.match(controls, /globalThis\.__turnDriftLockAmount = lockCanRun \? driftLockAmount : 0/,
  'The smoothed LOCK amount must be published for vehicle physics');
assert.match(controls, /driftThrottleForLock\(driftLockAmount\)/,
  'Gas must fade out over the same short LOCK transition');
assert.match(controls, /resolveDriftBoostRechargeMultiplier\(\{/,
  'Boost recharge must be owned by the standard-versus-LOCK DRIFT balance rule');
assert.match(controls, /BOOST_TANK_DURATION_MULTIPLIER = 1\.5/,
  'Every Boost tank must last 50 percent longer after passive recharge removal');
assert.match(controls, /DRIFT_RECHARGE_MULTIPLIER = 2\.4/,
  'Ordinary DRIFT must restore the former default recharge rate');
assert.match(controls, /lockCeilingMultiplier: DRIFT_LOCK_RECHARGE_MULTIPLIER/,
  'LOCK recharge must use the shared 3.6x ceiling');
assert.doesNotMatch(controls, /__turnDriftHeld \? getDriftRechargeMultiplier\(\) : 1/,
  'Boost must no longer refill passively outside DRIFT');
assert.doesNotMatch(controls, /Advanced DRIFT|turn:advanced-drift-change/,
  'Binary LOCK must be standard behavior without an experimental setting');
assert.match(controls, /boostRequested = nextZone === 'boost'/, 'Boost zone must add boost to gas');
assert.match(controls, /runtimeState\.touchBrake = Boolean\(active\)/, 'The unified BRAKE zone must drive stopping physics');
assert.match(controls, /runtimeState\.touchReverse = Boolean\(active\)/, 'The attached R control must own explicit reverse input');
assert.match(controls, /brakeButton\.classList\.toggle\('is-active', nextZone === 'brake'\)/, 'Brake must receive the same active-state treatment as every other zone');
assert.match(controls, /pointerdown'[\s\S]*capture: true/, 'The unified pad must own the gesture before the legacy standalone brake listener');
assert.match(controls, /event\.stopPropagation\(\)/, 'The continuous pad gesture must not leak into the old per-button pointer handler');
assert.match(controls, /boostRequested && !boostExhausted/, 'Boost must stay locked while the thumb remains in Boost after exhaustion');
assert.match(controls, /boostOvercharge > 0 \|\| boostCharge > 0\.001/,
  'Tiny Overcharge remainders must keep flowing through the state machine until they reach zero');
assert.match(controls, /previousZone === 'boost' && nextZone !== 'boost'\) boostExhausted = false/, 'Leaving Boost for any other drive zone must re-arm Boost without requiring pointer release');
assert.match(controls, /brakeButton\.textContent = 'Brake'/, 'The integrated BRAKE control must no longer imply automatic reverse');
assert.match(controls, /function refillBoost\(\)/, 'Gameplay controls must expose one reset-safe boost refill path');
assert.match(controls, /let boostCharge = 1;/, 'Boost must still begin full even though passive recharge is removed');
assert.match(controls, /boostCharge = 1;\s*previousBoostCharge = 1;\s*boostExhausted = false;/s, 'Restarting must fully refill and unlock boost without creating a recharge transition');
assert.match(controls, /const reason = event\.detail\?\.reason;[\s\S]*if \(reason === 'race-reset'\) refillBoost\(\)/,
  'The race reset event must refill boost');
assert.match(controls, /globalThis\.__turnRefillBoost = refillBoost/, 'Boost refill must remain reusable by the runtime');
assert.match(controls, /becameEmpty = previousBoostCharge > 0\.001 && boostCharge <= 0\.001/, 'Empty feedback must trigger on the actual depletion transition');
assert.match(controls, /becameFull = previousBoostCharge < 0\.999 && boostCharge >= 0\.999/, 'Full feedback must trigger only when recharge crosses the full threshold');
assert.match(controls, /flashBoostHud\('is-boost-empty-flash'\)/, 'Empty boost must trigger its distinct HUD feedback class');
assert.match(controls, /flashBoostHud\('is-boost-full-flash'\)/, 'Full boost must trigger its distinct HUD feedback class');
assert.match(css, /grid-template-rows: 32% 44% 24%/, 'The integrated surface must preserve a large Gas zone and a reachable bottom Brake zone');
assert.match(css, /place-items: center/, 'Drive-zone labels must be vertically and horizontally centered');
assert.match(css, /content: "LEAVE"/, 'Boost lock hint must explain that leaving the Boost zone re-arms it');
assert.match(css, /\.drive-pad \.drive-brake-zone \{/, 'BRAKE must be styled as an internal drive-pad zone');
assert.match(css, /\.drive-brake-zone\.is-active/, 'Brake must have visible active feedback');
assert.match(css, /\.drive-lock-bubble \{[\s\S]*right: calc\(100% - 4px\);[\s\S]*background: #748ffc/,
  'LOCK must be a separate bubble attached outside the left edge of the pad');
assert.match(css, /\.drive-stack\.is-drift-ready \.drive-lock-bubble \{[\s\S]*opacity: 1;[\s\S]*scaleX\(1\)/,
  'The LOCK bubble must animate quickly into view while DRIFT is held');
assert.match(css, /\.drive-lock-bubble \{[\s\S]*height: calc\(32% \+ 5\.44px\)/,
  'The LOCK bubble bottom border must share the lower edge of the DRIFT row divider');
assert.doesNotMatch(css, /drift-lock-row-offset/,
  'LOCK and SHIFT must use the exact grid seams instead of overlapping row offsets');
assert.match(css, /\.drive-stack\.is-drift-ready \.drive-pad \{[\s\S]*border-top-left-radius: 0;/,
  'The pad must drop its upper-left radius while LOCK is attached');
assert.match(css, /\.drive-stack\.is-drift-locking \.drive-lock-bubble \{[\s\S]*#8b5cf6/,
  'The bubble must visibly confirm the binary LOCK state in purple');
assert.match(css, /prefers-reduced-motion: reduce[\s\S]*\.drive-lock-bubble/,
  'The bubble reveal must respect reduced-motion preferences');
assert.match(gameplayCss, /\.boost-hud i \{[\s\S]*box-shadow: 3px 0 0 var\(--ink\);/, 'Boost charge must have a high-contrast ink edge at the live fill level');
assert.match(gameplayCss, /\.boost-hud\.is-drift-charging i \{[\s\S]*linear-gradient\(90deg, #38d9ff, #8ce99a\)/,
  'Ordinary DRIFT recharge must show the Boost gradient from blue to green');
assert.match(gameplayCss, /\.boost-hud\.is-drift-locking i \{[\s\S]*linear-gradient\(90deg, #8b5cf6, #8ce99a\)/,
  'LOCK must change the existing Boost gradient from purple to green');
assert.match(semanticCss, /\.boost-hud\.is-drift-locking i \{[\s\S]*#8b5cf6[\s\S]*!important/,
  'The semantic !important layer must define LOCK after ordinary DRIFT so it cannot mask the purple state');
assert.match(controls, /setProperty\('background', DRIFT_LOCK_BOOST_GRADIENT, 'important'\)/,
  'Runtime LOCK feedback must also survive stale semantic CSS precedence');
assert.match(controls, /boostHud\.innerHTML = '<span>BOOST<\/span>/,
  'The Boost HUD label must stay BOOST instead of becoming a second LOCK meter');
assert.match(mainSource, /driftLock: globalThis\.__turnDriftLockAmount \|\| 0/,
  'The production runtime must pass the smoothed binary LOCK value into vehicle physics');
assert.match(gameplayCss, /\.boost-hud\.is-boost-full-flash/, 'Boost HUD must visibly react when recharge reaches full capacity');
assert.match(gameplayCss, /\.boost-hud\.is-boost-empty-flash/, 'Boost HUD must react distinctly when the tank becomes empty');
assert.match(gameplayCss, /@keyframes turn-boost-full-flash/, 'Full boost feedback must have its own animation');
assert.match(gameplayCss, /@keyframes turn-boost-empty-flash/, 'Empty boost feedback must have a distinct animation');
assert.match(gameplayCss, /prefers-reduced-motion: reduce/, 'Boost feedback must respect reduced-motion preferences');
assert.match(controls, /boostHud\.setAttribute\('role', 'meter'\)/,
  'The visual Boost and Overcharge bar must expose meter semantics');
assert.match(controls, /boostHud\.setAttribute\('aria-valuemax', '120'\)/,
  'The accessible meter range must include the visible 20 percent Overcharge extension');
assert.match(controls, /boostHud\.setAttribute\('aria-valuetext', ariaValueText\)/,
  'The meter must expose whether Overcharge is building, leaking, caught or being used');
assert.doesNotMatch(analogGas, /pointerdown/, 'Legacy analog gas pointer handling must stay retired');
assert.doesNotMatch(spectate, /updateBoostZoneHaptic/, 'Spectator UI must not own obsolete gas-zone pointer state');

const forward = new Vec3(0, 0, 1);
const right = new Vec3(1, 0, 0);
const trackSample = { point: new Vec3(), tangent: forward.clone(), normal: right.clone() };
const state = {
  position: new Vec3(), velocity: new Vec3(0, 0, 5), touchGas: true, touchBrake: true, touchReverse: false,
  throttle: 0, brake: 0, reverse: 0, steering: 0, driftAmount: 0, heading: 0, progress: 0,
  lastProgress: 0, nearestTrackIndex: 0, trackDistance: 0, offRoad: false, speed: 5
};
const physicsArgs = {
  state, dt: 0.1, updateMotionInput: () => {},
  findNearestTrack: () => ({ index: 0, distance: 0, sample: trackSample }),
  getForward: () => forward.clone(), getRight: () => right.clone(),
  trackWidth: 27, trackSampleCount: 100, maxSpeed: 80, analogGas: 1, boostActive: true, driftHeld: false,
  vehicleTuning: { accelerationMultiplier: 1, controlMultiplier: 1, driftEngineMultiplier: 0.93, driftDragAdd: 0.085, boostPowerMultiplier: 1, boostSpeedMultiplier: 1.32 }
};

updateVehiclePhysicsState(physicsArgs);
assert.equal(state.velocity.z, 0, 'BRAKE must stop forward motion at zero');
updateVehiclePhysicsState(physicsArgs);
assert.equal(state.velocity.z, 0, 'Holding BRAKE after stopping must not engage reverse');
state.touchReverse = true;
updateVehiclePhysicsState(physicsArgs);
assert.ok(state.velocity.z < -0.1, 'The explicit R control must engage reverse');
for (let i = 0; i < 100; i += 1) updateVehiclePhysicsState(physicsArgs);
assert.ok(state.velocity.z >= -(80 * 0.32 + 0.5), 'Reverse must stay capped well below forward top speed');

function runDriftLock(lockAmount) {
  const driftState = {
    position: new Vec3(), velocity: new Vec3(0, 0, 30), touchGas: false, touchBrake: false,
    throttle: 0, brake: 0, steering: 1, driftAmount: 0.7, heading: 0, progress: 0,
    lastProgress: 0, nearestTrackIndex: 0, trackDistance: 0, offRoad: false, speed: 30
  };
  updateVehiclePhysicsState({
    ...physicsArgs,
    state: driftState,
    analogGas: driftThrottleForLock(lockAmount),
    boostActive: false,
    driftHeld: true,
    driftLock: lockAmount
  });
  return driftState;
}

const ordinaryDrift = runDriftLock(0);
const fullLockDrift = runDriftLock(1);
assert.equal(ordinaryDrift.driftLockAmount, 0);
assert.equal(fullLockDrift.driftLockAmount, 1);
assert.ok(
  Math.abs(fullLockDrift.heading) > Math.abs(ordinaryDrift.heading),
  'LOCK must increase yaw authority for a larger slip angle'
);
assert.ok(
  Math.abs(fullLockDrift.velocity.x) > Math.abs(ordinaryDrift.velocity.x),
  'LOCK must preserve and strengthen the lateral slide'
);
assert.ok(
  fullLockDrift.speed < ordinaryDrift.speed,
  'Full LOCK must release gas and add modest handbrake drag'
);

console.log(`TURN ${release.id} connected DRIFT LOCK, 50% larger Boost tanks, 2.4x→3.6x recharge balance, reliable LOCK gradient, restart refill and separate reverse passed.`);
