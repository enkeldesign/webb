import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js';

// TURN's horizon correction already has the right visual direction, while the
// steering input from the same roll sensor needs the opposite sign. Feed the
// game an inverted roll value, then invert Camera.rotateZ so only the horizon
// correction keeps its existing direction.
const nativeAddEventListener = window.addEventListener;
window.addEventListener = function addEventListenerWithTurnMotion(type, listener, options) {
  if (type !== 'devicemotion' || typeof listener !== 'function') {
    return nativeAddEventListener.call(this, type, listener, options);
  }

  const wrappedListener = (event) => {
    const gravity = event.accelerationIncludingGravity;
    if (!gravity || gravity.x == null) {
      listener.call(window, event);
      return;
    }

    const correctedEvent = Object.create(event);
    Object.defineProperty(correctedEvent, 'accelerationIncludingGravity', {
      configurable: true,
      enumerable: true,
      value: {
        x: -gravity.x,
        y: gravity.y,
        z: gravity.z
      }
    });

    listener.call(window, correctedEvent);
  };

  return nativeAddEventListener.call(this, type, wrappedListener, options);
};

const nativeRotateZ = THREE.Object3D.prototype.rotateZ;
THREE.Camera.prototype.rotateZ = function rotateZWithTurnHorizon(angle) {
  return nativeRotateZ.call(this, -angle);
};

// The procedural wheels are CylinderGeometry objects whose visible geometry is
// rotated so the axle lies on X. Track the immediate spinner parent so the
// legacy Y-axis spin can be transferred to the physically correct X axis.
const wheelSpinners = new Set();
const nativeGroupAdd = THREE.Group.prototype.add;

THREE.Group.prototype.add = function addAndFindTurnWheelSpinners(...objects) {
  const result = nativeGroupAdd.apply(this, objects);

  if (objects.length === 1 && this.children.length === 1) {
    const candidate = objects[0];
    const isOutlinedCylinder =
      candidate?.isGroup &&
      candidate.children?.length === 2 &&
      candidate.children.every(
        (child) => child.isMesh && child.geometry?.type === 'CylinderGeometry'
      );

    if (isOutlinedCylinder) wheelSpinners.add(this);
  }

  return result;
};

await import('./game.js');

const tiltNeedle = document.querySelector('#tiltNeedle');

function applyPostFrameFixes() {
  for (const spinner of wheelSpinners) {
    const ySpin = spinner.rotation.y;
    if (Math.abs(ySpin) > 0.000001) {
      spinner.rotation.x += ySpin;
      spinner.rotation.y = 0;
    }
  }

  // game.js still writes the old horizontal percentage. Reuse that value for
  // the new vertical presentation: gas goes up, brake goes down.
  if (tiltNeedle) {
    const horizontalPercent = Number.parseFloat(tiltNeedle.style.left);
    if (Number.isFinite(horizontalPercent)) {
      tiltNeedle.style.setProperty('--tilt-top', `${100 - horizontalPercent}%`);
    }
  }

  requestAnimationFrame(applyPostFrameFixes);
}

requestAnimationFrame(applyPostFrameFixes);
