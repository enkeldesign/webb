import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  animateWheelRig,
  collectAssetWheelRig,
  installAssetWheelRig
} from '../turn/vehicle/wheel-animation-rig.js';

class FakeVector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.set(x, y, z);
  }

  set(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  copy(other) {
    return this.set(other.x, other.y, other.z);
  }

  clone() {
    return new FakeVector3(this.x, this.y, this.z);
  }
}

class FakeQuaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.set(x, y, z, w);
  }

  set(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }

  copy(other) {
    return this.set(other.x, other.y, other.z, other.w);
  }

  clone() {
    return new FakeQuaternion(this.x, this.y, this.z, this.w);
  }

  identity() {
    return this.set(0, 0, 0, 1);
  }
}

class FakeObject3D {
  constructor() {
    this.name = '';
    this.parent = null;
    this.children = [];
    this.position = new FakeVector3();
    this.quaternion = new FakeQuaternion();
    this.scale = new FakeVector3(1, 1, 1);
    this.rotation = { x: 0, y: 0, z: 0 };
    this.userData = {};
  }

  add(...children) {
    for (const child of children) {
      child.parent?.remove(child);
      child.parent = this;
      this.children.push(child);
    }
    return this;
  }

  remove(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    if (child.parent === this) child.parent = null;
    return this;
  }

  traverse(visitor) {
    visitor(this);
    for (const child of [...this.children]) child.traverse(visitor);
  }

  clone(recursive = true) {
    const clone = new this.constructor();
    clone.name = this.name;
    clone.position.copy(this.position);
    clone.quaternion.copy(this.quaternion);
    clone.scale.copy(this.scale);
    clone.rotation = { ...this.rotation };
    clone.userData = { ...this.userData };
    clone.geometry = this.geometry;
    if (recursive) {
      for (const child of this.children) clone.add(child.clone(true));
    }
    return clone;
  }
}

class FakeMesh extends FakeObject3D {
  constructor() {
    super();
    this.isMesh = true;
    this.geometry = null;
  }
}

function createSupercarWheel(name, x, z, quaternionX) {
  const wheel = new FakeMesh();
  wheel.name = name;
  wheel.position.set(x, 0.3, z);
  wheel.quaternion.set(quaternionX, 0, 0, Math.sqrt(1 - quaternionX * quaternionX));

  const assembly = new FakeObject3D();
  assembly.name = `kenney-${name}-assembly`;
  assembly.userData.turnWheelSource = 'Kenney Car Kit 3.1';
  const tire = new FakeMesh();
  tire.name = `supercar-dark-foot-${name}`;
  tire.geometry = { id: `${name}-authored-tire` };
  const rim = new FakeMesh();
  rim.name = `supercar-rim-${name}`;
  rim.geometry = { id: `${name}-authored-rim` };
  assembly.add(tire, rim);
  wheel.add(assembly);
  return wheel;
}

const model = new FakeObject3D();
model.name = 'supercar-model';
const wheels = [
  createSupercarWheel('wheel-front-left', -0.8, 2.36, 0.1),
  createSupercarWheel('wheel-front-right', 0.8, 2.36, -0.1),
  createSupercarWheel('wheel-back-left', -0.8, -0.5, 0.08),
  createSupercarWheel('wheel-back-right', 0.8, -0.5, -0.08)
];
const spare = createSupercarWheel('wheel-back', 0, -1.1, 0);
model.add(...wheels, spare);

const originalGeometry = new Map();
const originalQuaternions = new Map();
for (const wheel of wheels) {
  originalQuaternions.set(wheel.name, wheel.quaternion.clone());
  wheel.traverse((node) => {
    if (node.geometry) originalGeometry.set(node.name, node.geometry);
  });
}

const rig = installAssetWheelRig({
  model,
  frontRole: 'front',
  createGroup: () => new FakeObject3D()
});

assert.equal(rig.frontWheelPivots.length, 2,
  'Exactly the authored front axle should receive steering pivots');
assert.equal(rig.wheelSpinners.length, 4,
  'Exactly the four drivable authored wheel assemblies should be registered as spinners');
assert.equal(spare.parent, model,
  'AWD-style rear spare wheels must not be mistaken for a drivable axle wheel');

for (const wheel of wheels) {
  const spinner = wheel.parent;
  const authoredTransform = spinner.parent;
  const mount = authoredTransform.parent;
  assert.equal(spinner.name, `${wheel.name}-spin-pivot`);
  assert.equal(spinner.userData.turnWheelSpinAxis, 'x',
    'Authored Kenney wheels must rotate around their local axle');
  assert.equal(authoredTransform.name, `${wheel.name}-authored-transform`);
  assert.deepEqual(authoredTransform.quaternion, originalQuaternions.get(wheel.name),
    'The wrapper must preserve the wheel node’s authored orientation separately from animation');
  assert.deepEqual(wheel.quaternion, new FakeQuaternion(),
    'The authored wheel transform should move to its stable wrapper');
  assert.equal(
    mount.name,
    wheel.name.includes('front') ? `${wheel.name}-steer-pivot` : `${wheel.name}-wheel-mount`
  );
  wheel.traverse((node) => {
    if (node.geometry) {
      assert.equal(node.geometry, originalGeometry.get(node.name),
        'Rigging must preserve the exact authored tire and rim geometry objects');
    }
  });
}

const car = {
  userData: {
    frontWheelPivots: rig.frontWheelPivots,
    wheelSpinners: rig.wheelSpinners
  }
};
animateWheelRig(car, { steerAngle: 0.5, speed: 20, dt: 0.1 });
for (const pivot of rig.frontWheelPivots) {
  assert.equal(pivot.rotation.y, 0.4,
    'Front steering must continue easing independently on its Y pivot');
}
for (const spinner of rig.wheelSpinners) {
  assert.equal(spinner.rotation.x, -2.7,
    'Speed must advance every authored wheel around local X');
  assert.equal(spinner.rotation.y, 0,
    'Wheel spin must not overwrite the separate steering transform');
}

const clone = model.clone(true);
const clonedRig = collectAssetWheelRig(clone, { reset: true });
assert.equal(clonedRig.frontWheelPivots.length, 2);
assert.equal(clonedRig.wheelSpinners.length, 4,
  'Fast rival clones must rediscover all four of their own spinner nodes');
assert.notEqual(clonedRig.wheelSpinners[0], rig.wheelSpinners[0]);
for (const pivot of clonedRig.frontWheelPivots) assert.equal(pivot.rotation.y, 0);
for (const spinner of clonedRig.wheelSpinners) assert.equal(spinner.rotation.x, 0);

const cloneCar = {
  userData: {
    frontWheelPivots: clonedRig.frontWheelPivots,
    wheelSpinners: clonedRig.wheelSpinners
  }
};
animateWheelRig(cloneCar, { steerAngle: -0.25, speed: 10, dt: 0.2 });
for (const spinner of clonedRig.wheelSpinners) assert.equal(spinner.rotation.x, -2.7);
for (const spinner of rig.wheelSpinners) assert.equal(spinner.rotation.x, -2.7,
  'Animating a rival clone must not mutate the template or player rig');

const proceduralSpinner = new FakeObject3D();
const proceduralCar = {
  userData: {
    frontWheelPivots: [],
    wheelSpinners: [proceduralSpinner]
  }
};
animateWheelRig(proceduralCar, { steerAngle: 0, speed: 10, dt: 0.2 });
assert.equal(proceduralSpinner.rotation.y, -2.7,
  'Unmarked procedural wheel spinners must preserve TURN’s existing Y-axis contract');
assert.equal(proceduralSpinner.rotation.x, 0);

const [carModelsSource, mainSource] = await Promise.all([
  fs.readFile(new URL('../turn/vehicle/car-models.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8')
]);
assert.match(carModelsSource, /installAssetWheelRig\(/);
assert.match(carModelsSource, /root\.userData\.wheelSpinners = wheelSpinners/);
assert.match(carModelsSource, /collectAssetWheelRig\(clone, \{ reset: true \}\)/);
assert.doesNotMatch(carModelsSource, /userData\.wheelSpinners = \[\]/,
  'Asset-backed visuals and fast rival clones must never publish empty spinner lists');
assert.match(mainSource, /animateWheelRig\(car, \{ steerAngle, speed, dt \}\)/,
  'Gameplay must advance the shared behavior-tested wheel rig');

console.log('TURN asset wheel rigs preserve authored geometry and combine steering with player/rival spin.');
