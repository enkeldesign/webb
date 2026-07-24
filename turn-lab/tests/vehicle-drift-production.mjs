import assert from 'node:assert/strict';

import { CAR_CATALOG, deriveVehicleTuning } from '../../turn/vehicle/catalog.js';
import { updateVehiclePhysicsState } from '../../turn/vehicle/physics.js';

assert.deepEqual(
  [1, 2, 3, 4, 5].map((drift) => deriveVehicleTuning({
    speed: 3,
    acceleration: 3,
    control: 3,
    drift,
    boostPower: 3,
    boostDuration: 3
  }).driftSpeedMultiplier),
  [0.76, 0.8, 0.84, 0.88, 0.92],
  'DRIFT ratings must retain the agreed 24% to 8% speed-penalty curve'
);

for (const car of CAR_CATALOG) {
  const gasSpeed = simulateStraightLine(car, false);
  const driftSpeed = simulateStraightLine(car, true);
  const normalTopSpeed = 88 * car.tuning.topSpeedMultiplier;
  const driftCeiling = normalTopSpeed * car.tuning.driftSpeedMultiplier;

  assert.ok(
    car.tuning.driftSpeedMultiplier < 1,
    `${car.name} must have a DRIFT speed multiplier below GAS`
  );
  assert.ok(
    driftSpeed <= driftCeiling + 0.001,
    `${car.name} must obey its DRIFT speed ceiling`
  );
  assert.ok(
    driftSpeed < gasSpeed - 0.1,
    `${car.name} must be measurably slower in sustained DRIFT than sustained GAS`
  );
}

console.log('TURN mandatory sustained DRIFT speed penalty passed for all 15 cars.');

function simulateStraightLine(car, driftHeld) {
  const state = {
    steering: 0,
    touchGas: true,
    touchBrake: false,
    throttle: 0,
    brake: 0,
    driftAmount: 0,
    position: new Vec3(0, 0.18, 0),
    velocity: new Vec3(0, 0, 0),
    heading: 0,
    trackId: 'countryside',
    progress: 0,
    lastProgress: 0,
    nearestTrackIndex: 0,
    trackDistance: 0,
    offRoad: false,
    speed: 0
  };
  const maxSpeed = 88 * car.tuning.topSpeedMultiplier;

  for (let frame = 0; frame < 720; frame += 1) {
    updateVehiclePhysicsState({
      state,
      dt: 1 / 60,
      updateMotionInput: () => {},
      findNearestTrack: (position) => ({
        index: 0,
        distance: 0,
        sample: { point: { x: position.x, z: position.z } }
      }),
      getForward: () => FORWARD,
      getRight: () => RIGHT,
      trackWidth: 27,
      trackSampleCount: 1,
      maxSpeed,
      boostActive: false,
      driftHeld,
      vehicleTuning: car.tuning
    });
  }

  return state.speed;
}

class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  dot(other) {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }

  length() {
    return Math.hypot(this.x, this.y, this.z);
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
}

const FORWARD = Object.freeze(new Vec3(1, 0, 0));
const RIGHT = Object.freeze(new Vec3(0, 0, 1));
