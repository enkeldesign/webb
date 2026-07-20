import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { updateVehiclePhysicsState } from '../../turn/vehicle/physics.js';

class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  clone() {
    return new Vec3(this.x, this.y, this.z);
  }

  dot(other) {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }

  addScaledVector(other, scale) {
    this.x += other.x * scale;
    this.y += other.y * scale;
    this.z += other.z * scale;
    return this;
  }

  multiplyScalar(scale) {
    this.x *= scale;
    this.y *= scale;
    this.z *= scale;
    return this;
  }

  length() {
    return Math.hypot(this.x, this.y, this.z);
  }
}

const [index, controls, css, gameplayCss, analogGas, spectate] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/gameplay-controls.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/drive-pad.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/gameplay-v2.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/input/analog-gas.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/spectate.js', import.meta.url), 'utf8')
]);

assert.match(index, /TURN v1\.3\.4 · Build 2026\.07\.20-r20/);
assert.match(index, /drive-pad\.css\?build=20260720-r20/);
assert.match(index, /gameplay-v2\.css\?build=20260720-r20/);
assert.match(controls, /className = 'drive-pad'/, 'Gameplay controls must create one unified drive pad');
assert.match(controls, /return x < 0\.5 \? 'drift' : 'boost'/, 'Top drive pad must split into Drift and Boost');
assert.match(controls, /return 'gas'/, 'Bottom drive pad must map to Gas');
assert.match(controls, /globalThis\.__turnAnalogGas = nextZone \? 1 : 0/, 'All three drive zones must keep normal gas engaged');
assert.match(controls, /globalThis\.__turnDriftHeld = nextZone === 'drift'/, 'Drift zone must add drift to gas');
assert.match(controls, /boostRequested = nextZone === 'boost'/, 'Boost zone must add boost to gas');
assert.match(controls, /boostRequested && !boostExhausted/, 'Boost must stay locked while the thumb remains in Boost after exhaustion');
assert.match(controls, /previousZone === 'boost' && nextZone !== 'boost'\) boostExhausted = false/, 'Leaving Boost for Gas or Drift must re-arm Boost without requiring pointer release');
assert.match(controls, /Brake · Reverse/, 'Separate brake control must advertise reverse');
assert.match(controls, /becameEmpty = previousBoostCharge > 0\.001 && boostCharge <= 0\.001/, 'Empty feedback must trigger on the actual depletion transition');
assert.match(controls, /becameFull = previousBoostCharge < 0\.999 && boostCharge >= 0\.999/, 'Full feedback must trigger only when recharge crosses the full threshold');
assert.match(controls, /flashBoostHud\('is-boost-empty-flash'\)/, 'Empty boost must trigger its distinct HUD feedback class');
assert.match(controls, /flashBoostHud\('is-boost-full-flash'\)/, 'Full boost must trigger its distinct HUD feedback class');
assert.match(css, /\.drive-pad \{/);
assert.match(css, /place-items: center/, 'Gas label must be vertically and horizontally centered');
assert.match(css, /content: "LEAVE"/, 'Boost lock hint must explain that leaving the Boost zone re-arms it');
assert.match(css, /\.brake-reverse \{/);
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
  position: new Vec3(),
  velocity: new Vec3(0, 0, 5),
  touchGas: true,
  touchBrake: true,
  throttle: 0,
  brake: 0,
  steering: 0,
  driftAmount: 0,
  heading: 0,
  progress: 0,
  lastProgress: 0,
  nearestTrackIndex: 0,
  trackDistance: 0,
  offRoad: false,
  speed: 5
};

const physicsArgs = {
  state,
  dt: 0.1,
  updateMotionInput: () => {},
  findNearestTrack: () => ({ index: 0, distance: 0, sample: trackSample }),
  getForward: () => forward.clone(),
  getRight: () => right.clone(),
  trackWidth: 27,
  trackSampleCount: 100,
  maxSpeed: 80,
  analogGas: 1,
  boostActive: true,
  driftHeld: false,
  vehicleTuning: {
    accelerationMultiplier: 1,
    controlMultiplier: 1,
    driftEngineMultiplier: 0.93,
    driftDragAdd: 0.085,
    boostPowerMultiplier: 1,
    boostSpeedMultiplier: 1.32
  }
};

updateVehiclePhysicsState(physicsArgs);
assert.ok(state.velocity.z <= 0.001, 'Brake must stop forward motion before reverse begins');

updateVehiclePhysicsState(physicsArgs);
assert.ok(state.velocity.z < -0.1, 'Holding Brake after stopping must engage reverse');

for (let i = 0; i < 100; i += 1) updateVehiclePhysicsState(physicsArgs);
assert.ok(state.velocity.z >= -(80 * 0.32 + 0.5), 'Reverse must stay capped well below forward top speed');

console.log('TURN unified drive pad and reverse regression passed.');
