import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { resetRaceToStage } from '../turn/race/game-state.js';
import { updateRaceCameraState } from '../turn/render/camera.js';
import {
  trackPitch,
  trackSampleAtProgress,
  trackSurfaceY,
  VEHICLE_SURFACE_OFFSET
} from '../turn/tracks/elevation.js';
import { updateVehiclePhysicsState } from '../turn/vehicle/physics.js';

const uphillSample = {
  point: { x: 12, y: 8.5, z: -4 },
  tangent: normalized({ x: 0, y: 0.2, z: 1 })
};
const flatSample = {
  point: { x: 0, y: 0, z: 0 },
  tangent: { x: 0, y: 0, z: 1 }
};

assert.equal(VEHICLE_SURFACE_OFFSET, 0.18);
assert.equal(trackSurfaceY(flatSample), 0.18, 'Flat tracks must preserve TURN’s historical vehicle height');
assert.equal(trackPitch(flatSample), 0, 'Flat tracks must preserve zero vehicle pitch');
assert.ok(trackPitch(uphillSample) > 0, 'An uphill tangent must produce positive visual pitch');
assert.equal(trackSurfaceY(uphillSample), 8.68, 'Vehicle height must follow road elevation plus the established offset');

const progressSamples = [0, 1, 2, 3].map((value) => ({ point: { x: value, y: value, z: 0 } }));
assert.equal(trackSampleAtProgress(progressSamples, 0.5), progressSamples[2]);
assert.equal(trackSampleAtProgress(progressSamples, 1), progressSamples[0], 'Replay progress must wrap at the finish line');
assert.equal(trackSampleAtProgress(progressSamples, -0.25), progressSamples[3], 'Replay progress must wrap backwards safely');

const resetSamples = Array.from({ length: 30 }, (_, index) => ({
  point: new Vec3(index, index === 6 ? 12 : 0, -index),
  tangent: index === 6 ? uphillSample.tangent : flatSample.tangent
}));
const resetState = {
  position: new Vec3(),
  velocity: new Vec3(),
  competitorLaps: [],
  lapActive: false
};
resetRaceToStage({ state: resetState, samples: resetSamples });
assert.equal(resetState.position.y, 12.18, 'Restart must place the car on the selected track surface');
assert.equal(resetState.surfacePitch, trackPitch(resetSamples[6]), 'Restart must publish the road pitch immediately');

const physicsState = {
  position: new Vec3(0, 99, 0),
  velocity: new Vec3(),
  trackId: 'countryside',
  touchGas: false,
  touchBrake: false,
  steering: 0,
  driftAmount: 0,
  throttle: 0,
  brake: 0,
  progress: 0,
  lastProgress: 0,
  nearestTrackIndex: 0,
  speed: 0
};
const nearest = { index: 3, distance: 0, sample: uphillSample };
updateVehiclePhysicsState({
  state: physicsState,
  dt: 1 / 60,
  updateMotionInput() {},
  findNearestTrack() {
    return nearest;
  },
  getForward() {
    return new Vec3(0, 0, 1);
  },
  getRight() {
    return new Vec3(1, 0, 0);
  },
  trackWidth: 27,
  trackSampleCount: 720,
  maxSpeed: 88
});
assert.equal(physicsState.position.y, 8.68, 'Physics must snap only the vertical coordinate to the road surface');
assert.equal(physicsState.velocity.y, 0, 'Elevation support must not introduce vertical velocity or gravity');
assert.equal(physicsState.surfacePitch, trackPitch(uphillSample));

const cameraPosition = new Vec3(0, 0, 0);
const cameraTarget = new Vec3(0, 0, 0);
const camera = {
  position: new Vec3(),
  up: new Vec3(),
  fov: 68,
  lookAt(target) {
    this.lastTarget = { x: target.x, y: target.y, z: target.z };
  },
  rotateZ() {},
  updateProjectionMatrix() {}
};
const cameraSamples = Array.from({ length: 40 }, (_, index) => ({
  point: { x: index, y: index >= 18 ? 30 : 20, z: 0 }
}));
updateRaceCameraState({
  state: {
    position: new Vec3(0, 20, 0),
    velocity: new Vec3(),
    speed: 0,
    nearestTrackIndex: 0,
    sensorMode: false
  },
  camera,
  cameraPosition,
  cameraTarget,
  getForward() {
    return new Vec3(0, 0, 1);
  },
  getRight() {
    return new Vec3(1, 0, 0);
  },
  samples: cameraSamples,
  maxSpeed: 88,
  dt: 1
});
assert.ok(cameraPosition.y > 27, 'Race camera height must be relative to an elevated vehicle');
assert.ok(cameraTarget.y > 22, 'Race camera must anticipate an upcoming climb instead of staring into the road');

const [mainSource, replaySource, spatialSource] = await Promise.all([
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/race/replay-system.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/race/track-spatial-index.js', import.meta.url), 'utf8')
]);
assert.match(mainSource, /trackSampleAtProgress\(samples, frame\.p\)/, 'Rival visuals must derive elevation from saved track progress');
assert.match(mainSource, /car\.position\.set\(frame\.x, trackSurfaceY\(surfaceSample\), frame\.z\)/);
assert.match(mainSource, /playerCar\.rotation\.x = trackPitch\(surfaceSample\)/);
assert.match(mainSource, /effectRear\.y \+= 0\.54/);
assert.match(mainSource, /skidLeftWheel\.y = state\.position\.y \+ 0\.05/);
assert.doesNotMatch(mainSource, /car\.position\.set\(frame\.x, 0\.18, frame\.z\)/, 'Rivals may no longer be pinned to world zero');
assert.doesNotMatch(mainSource, /playerCar\.position\.y = 0\.18/, 'Preview cars may no longer be pinned to world zero');
assert.match(replaySource, /p: state\.progress/, 'The existing replay progress field remains the elevation source of truth');
assert.doesNotMatch(replaySource, /y: state\.position\.y/, 'Elevation must not require a replay storage migration');
assert.match(spatialSource, /const dx = x - point\.x;\s*const dz = z - point\.z;/, 'Track lookup intentionally remains exact in X/Z');

console.log('TURN r67 elevation-aware runtime regression passed.');

class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  copy(other) {
    this.x = Number(other?.x) || 0;
    this.y = Number(other?.y) || 0;
    this.z = Number(other?.z) || 0;
    return this;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  addScaledVector(other, scale) {
    this.x += (Number(other?.x) || 0) * scale;
    this.y += (Number(other?.y) || 0) * scale;
    this.z += (Number(other?.z) || 0) * scale;
    return this;
  }

  dot(other) {
    return this.x * (Number(other?.x) || 0)
      + this.y * (Number(other?.y) || 0)
      + this.z * (Number(other?.z) || 0);
  }

  length() {
    return Math.hypot(this.x, this.y, this.z);
  }

  multiplyScalar(scale) {
    this.x *= scale;
    this.y *= scale;
    this.z *= scale;
    return this;
  }
}

function normalized(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length
  };
}
