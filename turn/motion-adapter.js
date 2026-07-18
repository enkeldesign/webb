// TURN runtime adaptations.
// Keep the main prototype readable while applying experimental control/rendering changes
// before the module is evaluated.

globalThis.__turnAnalogGas = 0;

const response = await fetch('./game.js', { cache: 'no-store' });
if (!response.ok) throw new Error(`Could not load game.js (${response.status})`);
let source = await response.text();

function replaceRequired(search, replacement, label) {
  const next = source.replace(search, replacement);
  if (next === source) console.warn(`TURN patch not applied: ${label}`);
  source = next;
}

// Motion has two separate jobs:
// 1. Horizon roll is absolute and follows gravity in the current screen orientation.
// 2. Steering is relative to the player's chosen neutral steering position.
// DeviceMotion coordinates stay in the phone's natural portrait coordinate system, so
// compensate for the browser's current landscape orientation before using roll.
replaceRequired(
  'function motionPoseFromGravity(event) {',
  `function getScreenOrientationAngle() {
  const degrees = Number.isFinite(screen.orientation?.angle)
    ? screen.orientation.angle
    : Number(window.orientation || 0);
  return THREE.MathUtils.degToRad(degrees);
}

function motionPoseFromGravity(event) {`,
  'screen orientation helper'
);

replaceRequired(
  '    roll: normalizeAngle(Math.atan2(gravity.x, -gravity.y)),',
  '    roll: normalizeAngle(Math.atan2(gravity.x, -gravity.y) - getScreenOrientationAngle()),',
  'landscape-aware absolute roll'
);

// Steering keeps the sensitivity the player liked, but uses the opposite sign from raw roll.
replaceRequired(
  'state.steering = Math.sign(linearSteer) * Math.pow(Math.abs(linearSteer), 0.78);',
  'state.steering = -Math.sign(linearSteer) * Math.pow(Math.abs(linearSteer), 0.78);',
  'motion steering direction'
);

// The horizon must not use the steering calibration reference. A centered steering wheel
// can be held at any physical angle, while the rendered horizon must always stay level with
// the real-world horizon.
replaceRequired(
  `    const horizonRoll = normalizeAngle(state.roll - state.horizonRollReference);
    camera.rotateZ(-horizonRoll);`,
  '    camera.rotateZ(-state.roll);',
  'absolute horizon stabilization'
);

// Return acceleration/braking to direct controls. Pitch is no longer used for driving.
replaceRequired(
  /  const pitchDelta = state\.neutralPitch - state\.pitch;[\s\S]*?  state\.tiltDrive = Math\.sign\(pitchDelta\) \* Math\.pow\(driveMagnitude, 0\.72\);/,
  '  state.tiltDrive = 0;',
  'remove tilt drive input'
);
replaceRequired(
  '  const tiltGas = Math.max(0, state.tiltDrive);',
  '  const tiltGas = Math.max(0, globalThis.__turnAnalogGas || 0);',
  'analog throttle input'
);
replaceRequired(
  '  const tiltBrake = Math.max(0, -state.tiltDrive);',
  '  const tiltBrake = 0;',
  'remove tilt braking'
);
replaceRequired(
  "bindHold(gasButton, 'touchGas');",
  '// Gas is analog and handled by motion-adapter.js.',
  'remove digital gas binding'
);

// Make the road read as one wide asphalt ribbon with flat red/white curbs.
replaceRequired('const TRACK_WIDTH = 18;', 'const TRACK_WIDTH = 24;', 'wider road');

const roadFunction = `function makeRoad() {
  const roadPositions = [];
  const roadIndices = [];

  for (let i = 0; i <= TRACK_SAMPLES; i += 1) {
    const sample = samples[i % TRACK_SAMPLES];
    const left = sample.point.clone().addScaledVector(sample.normal, TRACK_WIDTH / 2);
    const right = sample.point.clone().addScaledVector(sample.normal, -TRACK_WIDTH / 2);
    left.y = 0.12;
    right.y = 0.12;
    roadPositions.push(left.x, left.y, left.z, right.x, right.y, right.z);
  }

  for (let i = 0; i < TRACK_SAMPLES; i += 1) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    roadIndices.push(a, b, c, b, d, c);
  }

  const roadGeometry = new THREE.BufferGeometry();
  roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
  roadGeometry.setIndex(roadIndices);
  roadGeometry.computeVertexNormals();

  const road = new THREE.Mesh(
    roadGeometry,
    new THREE.MeshStandardMaterial({ color: 0x686d73, roughness: 0.96, metalness: 0 })
  );
  road.receiveShadow = true;
  world.add(road);

  const curbWidth = 1.75;
  const curbSegmentLength = 12;
  const curbColors = [new THREE.Color(0xe63946), new THREE.Color(0xfff8e8)];

  for (const side of [-1, 1]) {
    const positions = [];
    const colors = [];

    for (let i = 0; i < TRACK_SAMPLES; i += 1) {
      const current = samples[i];
      const next = samples[(i + 1) % TRACK_SAMPLES];
      const innerOffset = side * (TRACK_WIDTH / 2 - 0.05);
      const outerOffset = side * (TRACK_WIDTH / 2 + curbWidth);

      const a = current.point.clone().addScaledVector(current.normal, innerOffset).setY(0.155);
      const b = current.point.clone().addScaledVector(current.normal, outerOffset).setY(0.155);
      const c = next.point.clone().addScaledVector(next.normal, innerOffset).setY(0.155);
      const d = next.point.clone().addScaledVector(next.normal, outerOffset).setY(0.155);

      positions.push(
        a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z,
        b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z
      );

      const color = curbColors[Math.floor(i / curbSegmentLength) % 2];
      for (let vertex = 0; vertex < 6; vertex += 1) {
        colors.push(color.r, color.g, color.b);
      }
    }

    const curbGeometry = new THREE.BufferGeometry();
    curbGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    curbGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    curbGeometry.computeVertexNormals();

    const curb = new THREE.Mesh(
      curbGeometry,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 })
    );
    curb.receiveShadow = true;
    world.add(curb);
  }
}`;

replaceRequired(
  /function makeRoad\(\) \{[\s\S]*?\n\}\n\nfunction makeScenery\(\) \{/,
  `${roadFunction}\n\nfunction makeScenery() {`,
  'road rendering'
);

const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}

// Analog throttle: touch the pedal for a useful base input, drag upward for more
// and downward for less. Releasing the pedal always returns throttle to zero.
const gasButton = document.querySelector('#gasButton');
let gasPointerId = null;
let gasStartY = 0;
const GAS_BASE = 0.42;
const GAS_DRAG_RANGE = 72;

function setAnalogGas(value) {
  const throttle = Math.max(0, Math.min(1, value));
  globalThis.__turnAnalogGas = throttle;
  gasButton.style.setProperty('--gas-level', throttle.toFixed(3));
  gasButton.textContent = throttle > 0 ? `Gas ${Math.round(throttle * 100)}%` : 'Gas';
  gasButton.setAttribute('aria-label', throttle > 0 ? `Gas ${Math.round(throttle * 100)} percent` : 'Gas');
}

function releaseGas(event) {
  if (gasPointerId === null || (event && event.pointerId !== gasPointerId)) return;
  gasButton.releasePointerCapture?.(gasPointerId);
  gasPointerId = null;
  gasButton.classList.remove('is-dragging');
  setAnalogGas(0);
}

gasButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  gasPointerId = event.pointerId;
  gasStartY = event.clientY;
  gasButton.setPointerCapture?.(event.pointerId);
  gasButton.classList.add('is-dragging');
  setAnalogGas(GAS_BASE);
});

gasButton.addEventListener('pointermove', (event) => {
  if (event.pointerId !== gasPointerId) return;
  event.preventDefault();
  const drag = (gasStartY - event.clientY) / GAS_DRAG_RANGE;
  setAnalogGas(GAS_BASE + drag);
});

gasButton.addEventListener('pointerup', releaseGas);
gasButton.addEventListener('pointercancel', releaseGas);
gasButton.addEventListener('lostpointercapture', () => {
  if (gasPointerId !== null) {
    gasPointerId = null;
    gasButton.classList.remove('is-dragging');
    setAnalogGas(0);
  }
});

setAnalogGas(0);
