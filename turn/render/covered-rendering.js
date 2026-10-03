import * as THREE from 'three';
import { createFrameCadence } from './frame-cadence.js';

const INSTALL_FLAG = Symbol.for('turn.covered-rendering-installed');
const MAX_RENDER_FPS = 60;
// The race's own PAUSE is not skipped here: main.js keeps the paused frame and redraws
// it after a viewport change (race/race-pause.js).
const MAIN_RENDERER_PAUSE_CLASSES = Object.freeze([
  'turn-home-open'
]);

export function installCoveredRenderingGuard() {
  if (globalThis[INSTALL_FLAG]) return globalThis[INSTALL_FLAG];

  const stats = {
    guardedLoops: 0,
    skippedFrames: 0,
    skippedCoveredMainFrames: 0,
    skippedHighRefreshFrames: 0
  };

  // three.js gives each renderer its own setAnimationLoop, so the policy wraps every
  // renderer as it is created (three-runtime.js), not the shared prototype (#1045).
  THREE.onWebGLRendererCreated((renderer) => {
    const originalSetAnimationLoop = renderer.setAnimationLoop;
    renderer.setAnimationLoop = function setCoveredAwareAnimationLoop(callback) {
      if (typeof callback !== 'function') {
        return originalSetAnimationLoop.call(renderer, callback);
      }

      // No more than 60 frames a second on a faster display, every frame on a 60 Hz one
      // (render/frame-cadence.js).
      const cadence = createFrameCadence({ maxFps: MAX_RENDER_FPS });
      const guardedCallback = (time, frame) => {
        const mainRendererCovered = renderer === globalThis.__turnRuntime?.renderer
          && MAIN_RENDERER_PAUSE_CLASSES.some((className) => document.body?.classList.contains(className));
        if (mainRendererCovered) {
          stats.skippedCoveredMainFrames += 1;
          // Start the cadence afresh on return, not from minutes of skipped frames.
          cadence.reset();
          return;
        }

        if (!cadence.shouldDraw(time)) {
          stats.skippedHighRefreshFrames += 1;
          return;
        }

        callback.call(renderer, time, frame);
      };

      stats.guardedLoops += 1;
      return originalSetAnimationLoop.call(renderer, guardedCallback);
    };
  });

  const diagnostics = Object.freeze({
    snapshot() {
      return { ...stats };
    }
  });
  Object.defineProperty(globalThis, INSTALL_FLAG, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: diagnostics
  });
  globalThis.__turnCoveredRendering = diagnostics;
  return diagnostics;
}
