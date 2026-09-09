const ASSET_WHEEL_SPIN_AXIS = 'x';
const DEFAULT_WHEEL_SPIN_AXIS = 'y';
const WHEEL_SPIN_RATE = 1.35;
const STEERING_RESPONSE = 8;

export function installAssetWheelRig({
  model,
  frontRole = 'front',
  createGroup
} = {}) {
  const frontWheelPivots = [];
  const wheelSpinners = [];
  if (!model?.traverse || typeof createGroup !== 'function') {
    return { frontWheelPivots, wheelSpinners };
  }

  const authoredWheels = [];
  model.traverse((node) => {
    const role = authoredWheelRole(node?.name);
    if (role && node?.parent) authoredWheels.push({ wheel: node, role });
  });

  for (const { wheel, role } of authoredWheels) {
    const parent = wheel.parent;
    const label = wheel.name || 'wheel';
    const localPosition = wheel.position.clone();
    const localQuaternion = wheel.quaternion.clone();
    parent.remove(wheel);

    const mount = createGroup();
    mount.name = role === frontRole
      ? `${label}-steer-pivot`
      : `${label}-wheel-mount`;
    mount.position.copy(localPosition);
    parent.add(mount);
    if (role === frontRole) frontWheelPivots.push(mount);

    const authoredTransform = createGroup();
    authoredTransform.name = `${label}-authored-transform`;
    authoredTransform.quaternion.copy(localQuaternion);
    mount.add(authoredTransform);

    const spinPivot = createGroup();
    spinPivot.name = `${label}-spin-pivot`;
    spinPivot.userData.turnWheelSpinAxis = ASSET_WHEEL_SPIN_AXIS;
    spinPivot.userData.turnWheelRole = role;
    authoredTransform.add(spinPivot);

    wheel.position.set(0, 0, 0);
    wheel.quaternion.identity();
    spinPivot.add(wheel);
    wheelSpinners.push(spinPivot);
  }

  return { frontWheelPivots, wheelSpinners };
}

export function collectAssetWheelRig(model, { reset = false } = {}) {
  const frontWheelPivots = [];
  const wheelSpinners = [];
  model?.traverse?.((node) => {
    const name = String(node?.name || '');
    if (name.endsWith('-steer-pivot')) {
      if (reset && node.rotation) node.rotation.y = 0;
      frontWheelPivots.push(node);
    }
    if (name.endsWith('-spin-pivot')) {
      const axis = wheelSpinAxis(node);
      if (reset && node.rotation) node.rotation[axis] = 0;
      wheelSpinners.push(node);
    }
  });
  return { frontWheelPivots, wheelSpinners };
}

export function animateWheelRig(car, { steerAngle, speed, dt } = {}) {
  const steeringBlend = Math.min(1, dt * STEERING_RESPONSE);
  for (const pivot of car?.userData?.frontWheelPivots || []) {
    pivot.rotation.y = lerpAngle(pivot.rotation.y, steerAngle, steeringBlend);
  }

  const spinStep = speed * dt * WHEEL_SPIN_RATE;
  for (const spinner of car?.userData?.wheelSpinners || []) {
    const axis = wheelSpinAxis(spinner);
    spinner.rotation[axis] -= spinStep;
  }
}

function authoredWheelRole(name = '') {
  const label = String(name).toLowerCase();
  if (/^wheel-(?:front-(?:left|right)|f[lr])(?:-|$)/.test(label)) return 'front';
  if (/^wheel-(?:back-(?:left|right)|b[lr])(?:-|$)/.test(label)) return 'back';
  return null;
}

function wheelSpinAxis(spinner) {
  const axis = spinner?.userData?.turnWheelSpinAxis;
  return axis === 'x' || axis === 'z' ? axis : DEFAULT_WHEEL_SPIN_AXIS;
}

function lerpAngle(from, to, amount) {
  let difference = to - from;
  while (difference > Math.PI) difference -= Math.PI * 2;
  while (difference < -Math.PI) difference += Math.PI * 2;
  return from + difference * amount;
}
