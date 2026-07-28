import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
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
  releaseSource,
  app,
  controls,
  positionLayout,
  raceSpeech,
  css,
  gameplayCss,
  positionCss,
  analogGas,
  spectate
] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/gameplay-controls.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/race-position-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/race-speech.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/drive-pad.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/gameplay-v2.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/position-hud-r83.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/input/analog-gas.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/spectate.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));
assert.match(index, new RegExp(`drive-pad\\.css\\?build=${release.cacheKey}`));
assert.match(index, new RegExp(`gameplay-v2\\.css\\?build=${release.cacheKey}`));
assert.match(index, new RegExp(`position-hud-r83\\.css\\?build=${release.cacheKey}`));
assert.ok(
  index.indexOf('gameplay-v2.css') < index.indexOf('position-hud-r83.css'),
  'The topbar position override must load after the legacy gameplay HUD rules'
);
assert.match(app, /race-position-layout\.js/, 'The production module graph must install the position layout after gameplay controls');
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
assert.match(controls, /Double tap and hold, then slide between Drift, Boost, Gas, and Brake or Reverse/, 'The drive group must explain its continuous VoiceOver gesture');
assert.match(controls, /drivePad\.append\(driveTop, gasButton, brakeButton\)/, 'Brake and Reverse must live inside the same continuous drive surface');
assert.match(controls, /return x < 0\.5 \? 'drift' : 'boost'/, 'Top drive pad must split into Drift and Boost');
assert.match(controls, /y >= BRAKE_ZONE_START\) return 'brake'/, 'Bottom drive pad must map to Brake and Reverse');
assert.match(controls, /return 'gas'/, 'Middle drive pad must map to Gas');
assert.match(controls, /const forwardDrive = nextZone === 'gas' \|\| nextZone === 'drift' \|\| nextZone === 'boost'/, 'Only forward-driving zones may keep gas engaged');
assert.match(controls, /globalThis\.__turnAnalogGas = forwardDrive \? 1 : 0/, 'Brake must immediately release gas');
assert.match(controls, /globalThis\.__turnDriftHeld = nextZone === 'drift'/, 'Drift zone must add drift to gas');
assert.match(controls, /boostRequested = nextZone === 'boost'/, 'Boost zone must add boost to gas');
assert.match(controls, /runtimeState\.touchBrake = Boolean\(active\)/, 'The unified Brake zone must drive the existing brake and reverse physics');
assert.match(controls, /brakeButton\.classList\.toggle\('is-active', nextZone === 'brake'\)/, 'Brake must receive the same active-state treatment as every other zone');
assert.match(controls, /pointerdown'[\s\S]*capture: true/, 'The unified pad must own the gesture before the legacy standalone brake listener');
assert.match(controls, /event\.stopPropagation\(\)/, 'The continuous pad gesture must not leak into the old per-button pointer handler');
assert.match(controls, /boostRequested && !boostExhausted/, 'Boost must stay locked while the thumb remains in Boost after exhaustion');
assert.match(controls, /previousZone === 'boost' && nextZone !== 'boost'\) boostExhausted = false/, 'Leaving Boost for any other drive zone must re-arm Boost without requiring pointer release');
assert.match(controls, /Brake · Reverse/, 'The integrated brake control must advertise reverse');
assert.match(controls, /function refillBoost\(\)/, 'Gameplay controls must expose one reset-safe boost refill path');
assert.match(controls, /boostCharge = 1;\s*previousBoostCharge = 1;\s*boostExhausted = false;/s, 'Restarting must fully refill and unlock boost without creating a recharge transition');
assert.match(controls, /event\.detail\?\.reason === 'race-reset'\) refillBoost\(\)/, 'The race reset event must refill boost');
assert.match(controls, /globalThis\.__turnRefillBoost = refillBoost/, 'Boost refill must remain reusable by the runtime');
assert.match(controls, /becameEmpty = previousBoostCharge > 0\.001 && boostCharge <= 0\.001/, 'Empty feedback must trigger on the actual depletion transition');
assert.match(controls, /becameFull = previousBoostCharge < 0\.999 && boostCharge >= 0\.999/, 'Full feedback must trigger only when recharge crosses the full threshold');
assert.match(controls, /flashBoostHud\('is-boost-empty-flash'\)/, 'Empty boost must trigger its distinct HUD feedback class');
assert.match(controls, /flashBoostHud\('is-boost-full-flash'\)/, 'Full boost must trigger its distinct HUD feedback class');
assert.match(css, /grid-template-rows: 32% 44% 24%/, 'The integrated surface must preserve a large Gas zone and a reachable bottom Brake zone');
assert.match(css, /place-items: center/, 'Drive-zone labels must be vertically and horizontally centered');
assert.match(css, /content: "LEAVE"/, 'Boost lock hint must explain that leaving the Boost zone re-arms it');
assert.match(css, /\.drive-pad \.drive-brake-zone \{/, 'Brake and Reverse must be styled as an internal drive-pad zone');
assert.match(css, /\.drive-brake-zone\.is-active/, 'Brake must have visible active feedback');
assert.match(gameplayCss, /\.boost-hud\.is-boost-full-flash/, 'Boost HUD must visibly react when recharge reaches full capacity');
assert.match(gameplayCss, /\.boost-hud\.is-boost-empty-flash/, 'Boost HUD must react distinctly when the tank becomes empty');
assert.match(gameplayCss, /@keyframes turn-boost-full-flash/, 'Full boost feedback must have its own animation');
assert.match(gameplayCss, /@keyframes turn-boost-empty-flash/, 'Empty boost feedback must have a distinct animation');
assert.match(gameplayCss, /prefers-reduced-motion: reduce/, 'Boost feedback must respect reduced-motion preferences');
assert.doesNotMatch(analogGas, /pointerdown/, 'Legacy analog gas pointer handling must stay retired');
assert.doesNotMatch(spectate, /updateBoostZoneHaptic/, 'Spectator UI must not own obsolete gas-zone pointer state');

const forward = new Vec3(0, 0, 1);
const right = new Vec3(1, 0, 0);
const trackSample = { point: new Vec3(), tangent: forward.clone(), normal: right.clone() };
const state = {
  position: new Vec3(), velocity: new Vec3(0, 0, 5), touchGas: true, touchBrake: true,
  throttle: 0, brake: 0, steering: 0, driftAmount: 0, heading: 0, progress: 0,
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
assert.ok(state.velocity.z <= 0.001, 'Brake must stop forward motion before reverse begins');
updateVehiclePhysicsState(physicsArgs);
assert.ok(state.velocity.z < -0.1, 'Holding Brake after stopping must engage reverse');
for (let i = 0; i < 100; i += 1) updateVehiclePhysicsState(physicsArgs);
assert.ok(state.velocity.z >= -(80 * 0.32 + 0.5), 'Reverse must stay capped well below forward top speed');

console.log(`TURN ${release.id} four-zone drive pad, lap-priority race speech, topbar position HUD, restart boost refill and reverse passed.`);
