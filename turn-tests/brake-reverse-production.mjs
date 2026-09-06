import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  REVERSE_BRAKE_ZONE_START,
  pointerUsesReverse
} from '../turn/input/brake-reverse.js';
import { updateVehiclePhysicsState } from '../turn/vehicle/physics.js';

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

const leftGeometry = {
  brakeActive: true,
  padLeft: 100,
  padRight: 300,
  padTop: 50,
  padHeight: 200,
  bubbleWidth: 60,
  reverseSide: 'left'
};
assert.equal(pointerUsesReverse({ ...leftGeometry, pointerX: 50, pointerY: 220 }), true,
  'Sliding left from BRAKE must enter the attached REVERSE target');
assert.equal(pointerUsesReverse({ ...leftGeometry, pointerX: 104, pointerY: 220 }), true,
  'The REVERSE seam must forgive a small overlap with the pad');
assert.equal(pointerUsesReverse({ ...leftGeometry, pointerX: 50, pointerY: 180 }), false,
  'The REVERSE target must remain confined to the BRAKE row');
assert.equal(pointerUsesReverse({ ...leftGeometry, pointerX: 50, pointerY: 220, brakeActive: false }), false,
  'REVERSE must not engage before BRAKE is active');

const rightGeometry = { ...leftGeometry, reverseSide: 'right' };
assert.equal(pointerUsesReverse({ ...rightGeometry, pointerX: 350, pointerY: 220 }), true,
  'Left-handed controls must mirror REVERSE to the right edge');
assert.equal(pointerUsesReverse({ ...rightGeometry, pointerX: 296, pointerY: 220 }), true,
  'The mirrored seam must retain the same forgiving overlap');
assert.equal(pointerUsesReverse({ ...rightGeometry, pointerX: 380, pointerY: 220 }), false);

const forward = new Vec3(0, 0, 1);
const right = new Vec3(1, 0, 0);
const trackSample = { point: new Vec3(), tangent: forward.clone(), normal: right.clone() };

function createState(forwardSpeed = 0) {
  return {
    position: new Vec3(),
    velocity: new Vec3(0, 0, forwardSpeed),
    touchGas: false,
    touchBrake: false,
    touchReverse: false,
    throttle: 0,
    brake: 0,
    reverse: 0,
    steering: 0,
    driftAmount: 0,
    heading: 0,
    progress: 0,
    lastProgress: 0,
    nearestTrackIndex: 0,
    trackDistance: 0,
    offRoad: false,
    speed: Math.abs(forwardSpeed)
  };
}

function advance(state, overrides = {}) {
  return updateVehiclePhysicsState({
    state,
    dt: 0.1,
    updateMotionInput() {},
    findNearestTrack: () => ({ index: 0, distance: 0, sample: trackSample }),
    getForward: () => forward.clone(),
    getRight: () => right.clone(),
    trackWidth: 27,
    trackSampleCount: 100,
    maxSpeed: 80,
    vehicleTuning: {
      accelerationMultiplier: 1,
      controlMultiplier: 1,
      driftEngineMultiplier: 0.93,
      driftDragAdd: 0.085,
      boostPowerMultiplier: 1,
      boostSpeedMultiplier: 1.32
    },
    ...overrides
  });
}

const braking = createState(5);
braking.touchBrake = true;
advance(braking, { analogGas: 1, boostActive: true });
assert.equal(braking.velocity.z, 0, 'BRAKE must stop forward movement at zero');
for (let index = 0; index < 8; index += 1) advance(braking, { analogGas: 1, boostActive: true });
assert.equal(braking.velocity.z, 0, 'Holding BRAKE at zero must never begin reversing');
assert.equal(braking.reverse, 0, 'BRAKE must not synthesize a REVERSE input');

const reversing = createState(5);
reversing.touchReverse = true;
advance(reversing);
assert.equal(reversing.velocity.z, 0, 'REVERSE must brake forward movement before backing up');
advance(reversing);
assert.ok(reversing.velocity.z < -0.1, 'Explicit REVERSE must supply backward power after stopping');
assert.equal(reversing.reverse, 1);
for (let index = 0; index < 100; index += 1) advance(reversing);
assert.ok(reversing.velocity.z >= -(80 * 0.32 + 0.5), 'Explicit REVERSE must retain the existing safe speed cap');

reversing.touchReverse = false;
reversing.touchBrake = true;
for (let index = 0; index < 8; index += 1) advance(reversing);
assert.equal(reversing.velocity.z, 0, 'BRAKE must also stop an already reversing car at zero');

const [controls, css, main, session, guide, hud, workflow] = await Promise.all([
  fs.readFile(new URL('../turn/ui/gameplay-controls.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/drive-pad.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/race/session-orchestrator.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/how-to-play-guide.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/hud.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../.github/workflows/turn-lab-tests.yml', import.meta.url), 'utf8')
]);

assert.match(controls, /className = 'drive-reverse-bubble'/);
assert.match(controls, /textContent = 'R'/);
assert.match(controls, /REVERSE\. Hold to drive backward\./,
  'The momentary REVERSE control must expose its action and hold behavior');
assert.match(controls, /brakeButton\.textContent = 'Brake'/);
assert.match(controls, /BRAKE\. Stops the car without reversing/);
assert.match(controls, /pointerUsesReverse\(\{/,
  'The attached control must reuse the captured one-thumb drive-pad gesture');
assert.match(controls, /brakeActive: driveZone === 'brake'/,
  'Sliding into REVERSE must require BRAKE first');
assert.match(controls, /runtimeState\.touchReverse = Boolean\(active\)/);
assert.match(controls, /const BRAKE_ZONE_START = REVERSE_BRAKE_ZONE_START/,
  'BRAKE row routing and the attached REVERSE hit target must share one boundary');
assert.match(controls, /setDriveZone\(input\.zone, input\.lockRequested, \{ reverse: input\.reverseRequested \}\)/);
assert.match(controls, /reverseBubble\.addEventListener\('keydown'/,
  'The real REVERSE button must support keyboard press-and-hold');
assert.match(controls, /reverseBubble\.addEventListener\('keyup'/,
  'Keyboard release must release REVERSE');

assert.match(css, /\.controls \.drive-reverse-bubble \{[\s\S]*height: calc\(24% \+ 2\.08px\)/,
  'REVERSE must attach to exactly the BRAKE row');
assert.match(css, /--drive-brake-color: var\(--turn-control-brake, #ff7b54\)/,
  'BRAKE and REVERSE must share the production-safe semantic orange');
assert.match(css, /\.drive-pad \.drive-brake-zone \{[\s\S]*background: var\(--drive-brake-color\)/,
  'The BRAKE face must use the same colour as its attached REVERSE control');
assert.match(css, /\.drive-stack\.is-brake-ready \.drive-reverse-bubble[\s\S]*opacity: 1/,
  'Holding BRAKE must reveal REVERSE');
assert.match(css, /turn-left-handed-controls \.drive-reverse-bubble \{[\s\S]*left: calc\(100% - 4px\)/,
  'REVERSE must mirror with the rest of the handed drive controls');
assert.match(css, /prefers-reduced-motion: reduce[\s\S]*\.controls \.drive-reverse-bubble/,
  'The fast reveal must still respect reduced motion');
assert.doesNotMatch(controls, /requestAnimationFrame\([^)]*reverse/i,
  'REVERSE must not introduce an animation or monitoring loop');

assert.match(main, /touchReverse: false/);
assert.match(main, /reverse: 0/);
assert.match(session, /state\.touchReverse = false/,
  'Route changes and interrupted starts must release REVERSE');
assert.match(guide, /BRAKE stops at zero without reversing/);
assert.match(guide, /slide outward into <strong>REVERSE<\/strong>/);
assert.match(hud, /Number\(state\.reverse\) > 0 \? 'reverse' : 'brake'/,
  'The nonvisual drive readout must distinguish explicit REVERSE from BRAKE');
assert.match(workflow, /node turn-tests\/brake-reverse-production\.mjs/,
  'The full TURN suite must protect the separate control and physics contract');
assert.equal(REVERSE_BRAKE_ZONE_START, 0.76,
  'The explicit shared boundary must continue to match the 24% BRAKE row');

console.log('TURN stopping-only BRAKE and attached explicit REVERSE regressions passed.');
