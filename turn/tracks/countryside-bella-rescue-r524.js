import * as THREE from 'three';
import { installBellaRescueBehavior as installBellaRescueBehaviorR173 } from './countryside-bella-rescue-r173.js?revision=r524-camera-relative-meow';

export function installBellaRescueBehavior({
  root,
  runtime = globalThis.__turnRuntime
} = {}) {
  return installBellaRescueBehaviorR173({
    root,
    runtime: makeScreenRelativeRuntime(runtime)
  });
}

function makeScreenRelativeRuntime(runtime) {
  if (!runtime) return runtime;

  const view = Object.create(runtime);
  const cameraRight = new THREE.Vector3();
  const fallbackRight = new THREE.Vector3();

  Object.defineProperty(view, 'getRight', {
    configurable: true,
    value() {
      // The meow source itself already uses Bella's exact world position. The old
      // directional cue projected that vector onto TURN's physics-right basis, whose
      // handedness is opposite Three.js camera screen-right. Derive local +X from the
      // live camera so the ear the player hears matches where Bella is on screen.
      const camera = runtime.camera;
      if (camera?.quaternion) {
        cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
        cameraRight.y = 0;
        if (cameraRight.lengthSq() > 0.000001) return cameraRight.normalize();
      }

      const physicsRight = runtime.getRight?.();
      if (physicsRight) {
        fallbackRight.set(
          -Number(physicsRight.x || 0),
          0,
          -Number(physicsRight.z || 0)
        );
        if (fallbackRight.lengthSq() > 0.000001) return fallbackRight.normalize();
      }

      return fallbackRight.set(-1, 0, 0);
    }
  });

  return view;
}
