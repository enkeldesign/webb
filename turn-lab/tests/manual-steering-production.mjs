import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { updateMotionInputState } from '../../turn/input/motion.js';

function manualStep(manualSteering) {
  const state = {
    sensorMode: false,
    manualSteering,
    steering: 0,
    tiltDrive: 0
  };

  updateMotionInputState({ state, dt: 1, maxSteerRoll: 1 });
  return state.steering;
}

// TURN's vehicle yaw convention is opposite to screen-space manual input.
// A touch/keyboard input on the left must therefore produce positive vehicle steering,
// while a right input must produce negative vehicle steering.
assert.equal(manualStep(-1), 1, 'manual left should steer the car left');
assert.equal(manualStep(1), -1, 'manual right should steer the car right');
assert.equal(manualStep(0), 0, 'centered manual steering should stay centered');

const index = await fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8');
const css = await fs.readFile(new URL('../../turn/manual-steering.css', import.meta.url), 'utf8');

assert.match(index, /role="slider"/);
assert.match(index, /manual-steer-knob/);
assert.match(index, /manual-steering\.css\?build=20260719-r10/);
assert.match(css, /--manual-steer-left/);
assert.match(css, /content: "←"/);
assert.match(css, /content: "→"/);

console.log('TURN manual steering regression passed.');
