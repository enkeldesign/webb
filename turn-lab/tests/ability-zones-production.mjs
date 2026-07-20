import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  ABILITY_ZONES,
  ABILITY_ZONE_TYPE,
  findAbilityZoneAt,
  zoneSampleIndices
} from '../../turn/race/ability-zones.js';
import {
  NITROUS_POWER_MULTIPLIER,
  createBoostReservoir,
  updateBoostReservoir
} from '../../turn/race/boost-reservoir.js';
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

const driftZones = ABILITY_ZONES.filter((zone) => zone.type === ABILITY_ZONE_TYPE.DRIFT);
const boostZones = ABILITY_ZONES.filter((zone) => zone.type === ABILITY_ZONE_TYPE.BOOST);

assert.equal(driftZones.length, 3, 'The permanent circuit must have three authored Drift Zones');
assert.equal(boostZones.length, 2, 'The permanent circuit must have two authored Boost Zones');
assert.ok(Object.isFrozen(ABILITY_ZONES), 'Ability Zone placement must be immutable');

for (const zone of ABILITY_ZONES) {
  assert.ok(zone.laneWidth < 0.4, `${zone.id} must cover only a lane, not the full road`);
  assert.ok(zone.start >= 0 && zone.start < 1 && zone.end >= 0 && zone.end < 1);
  assert.ok(zoneSampleIndices(zone, 720).length > 10, `${zone.id} must have a playable length`);
}

for (const zone of driftZones) {
  assert.equal(zone.edge, 'outer', `${zone.id} must be authored on a curve's outer edge`);
  assert.ok(Math.abs(zone.laneCenter) >= 0.3, `${zone.id} must stay near that outer edge`);
}

for (const zone of boostZones) {
  assert.equal(zone.straightAfter[0], zone.end, `${zone.id} must lead directly into its straight`);
  assert.ok(zone.straightAfter[1] - zone.straightAfter[0] >= 0.1, `${zone.id} needs useful road after it`);
}

const samples = Array.from({ length: 720 }, (_, index) => ({
  point: new Vec3(index, 0, 0),
  tangent: new Vec3(1, 0, 0),
  normal: new Vec3(0, 0, 1)
}));
const firstDriftZone = driftZones[0];
const driftIndex = zoneSampleIndices(firstDriftZone, samples.length)[10];
const driftLane = firstDriftZone.laneCenter * 27;
const detectedDriftZone = findAbilityZoneAt({
  position: new Vec3(driftIndex, 0, driftLane),
  nearestTrackIndex: driftIndex,
  samples,
  trackWidth: 27
});

assert.equal(detectedDriftZone?.id, firstDriftZone.id, 'Driving through the authored outer lane must enter the Drift Zone');
assert.equal(
  findAbilityZoneAt({
    position: new Vec3(driftIndex, 0, 0),
    nearestTrackIndex: driftIndex,
    samples,
    trackWidth: 27
  }),
  null,
  'The road centre must remain outside a narrow outer-edge Drift Zone'
);

let fullReservoir = createBoostReservoir(1, 0);
for (let step = 0; step < 20; step += 1) {
  fullReservoir = updateBoostReservoir(fullReservoir, {
    dt: 0.1,
    requested: true,
    inBoostZone: true,
    drainSeconds: 2
  });
}
assert.equal(fullReservoir.charge, 1, 'Using a full bar in a red zone must not create empty space');
assert.ok(fullReservoir.nitrousCharge > 0.999, 'A well-used full bar must become a full nitrous bar');
assert.equal(fullReservoir.boostPowerMultiplier, NITROUS_POWER_MULTIPLIER);

let lowReservoir = createBoostReservoir(0.2, 0);
for (let step = 0; step < 20; step += 1) {
  lowReservoir = updateBoostReservoir(lowReservoir, {
    dt: 0.1,
    requested: true,
    inBoostZone: true,
    drainSeconds: 2
  });
}
assert.equal(lowReservoir.charge, 0.2, 'A red zone must preserve existing empty capacity');
assert.equal(lowReservoir.nitrousCharge, 0.2, 'Only carried charge may be converted to nitrous');

const spentOutside = updateBoostReservoir(lowReservoir, {
  dt: 0.1,
  requested: true,
  inBoostZone: false,
  drainSeconds: 2
});
assert.ok(spentOutside.charge < lowReservoir.charge, 'Stored nitrous must drain normally outside the red zone');
assert.ok(spentOutside.nitrousCharge < lowReservoir.nitrousCharge, 'Stored nitrous must be spent before ordinary boost');
assert.ok(spentOutside.nitrousActive, 'Stored nitrous must retain its stronger output outside the zone');

const rechargedOutside = updateBoostReservoir(spentOutside, {
  dt: 0.1,
  requested: false,
  inBoostZone: false,
  rechargeSeconds: 4.2
});
assert.equal(rechargedOutside.nitrousCharge, spentOutside.nitrousCharge, 'Ordinary recharge must not overwrite stored nitrous');
assert.ok(rechargedOutside.normalCharge > spentOutside.normalCharge, 'Recharge outside the red zone must add ordinary boost');

const normalDrift = makePhysicsState();
const rewardedDrift = makePhysicsState();
runPhysics(normalDrift, { driftHeld: true });
runPhysics(rewardedDrift, {
  driftHeld: true,
  driftAssist: {
    laneError: 3,
    sample: {
      tangent: new Vec3(0, 0, 1),
      normal: new Vec3(1, 0, 0)
    }
  }
});
assert.ok(rewardedDrift.speed > normalDrift.speed, 'Active blue zones must remove the normal drift speed penalty');
assert.ok(rewardedDrift.velocity.x > normalDrift.velocity.x, 'Active blue zones must add a light lane-centering pull');

const normalBoost = makePhysicsState();
const nitrousBoost = makePhysicsState();
runPhysics(normalBoost, { boostActive: true });
runPhysics(nitrousBoost, {
  boostActive: true,
  boostPowerMultiplier: NITROUS_POWER_MULTIPLIER,
  boostSpeedMultiplier: 1.12
});
assert.ok(nitrousBoost.speed > normalBoost.speed, 'Nitrous must accelerate harder than ordinary boost');

const [index, main, controls, visuals, driveCss, hudCss] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/gameplay-controls.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/render/ability-zones.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/drive-pad.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/gameplay-v2.css', import.meta.url), 'utf8')
]);

assert.match(index, /TURN v1\.4\.0 · Build 2026\.07\.20-r16/);
assert.match(main, /installAbilityZoneVisuals/);
assert.match(main, /findAbilityZoneAt/);
assert.match(main, /driftAssist/);
assert.match(controls, /updateBoostReservoir/);
assert.match(controls, /__turnNitrousCharge/);
assert.match(visuals, /ZONE_COLORS/);
assert.match(visuals, /InstancedMesh/, 'Ability Zones need a distinct non-colour road pattern');
assert.match(driveCss, /--boost-normal/);
assert.match(driveCss, /#ef3340/);
assert.match(hudCss, /\.boost-nitrous/);

console.log('TURN Ability Zones and persistent nitrous regression passed.');

function makePhysicsState() {
  return {
    position: new Vec3(),
    velocity: new Vec3(0, 0, 30),
    touchGas: true,
    touchBrake: false,
    throttle: 0,
    brake: 0,
    steering: 0.25,
    driftAmount: 0.4,
    heading: 0,
    progress: 0,
    lastProgress: 0,
    nearestTrackIndex: 0,
    trackDistance: 0,
    offRoad: false,
    speed: 30
  };
}

function runPhysics(state, overrides = {}) {
  const trackSample = {
    point: new Vec3(),
    tangent: new Vec3(0, 0, 1),
    normal: new Vec3(1, 0, 0)
  };
  return updateVehiclePhysicsState({
    state,
    dt: 0.1,
    updateMotionInput: () => {},
    findNearestTrack: () => ({ index: 0, distance: 0, sample: trackSample }),
    getForward: () => new Vec3(Math.sin(state.heading), 0, Math.cos(state.heading)),
    getRight: () => new Vec3(Math.cos(state.heading), 0, -Math.sin(state.heading)),
    trackWidth: 27,
    trackSampleCount: 100,
    maxSpeed: 88,
    analogGas: 1,
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
