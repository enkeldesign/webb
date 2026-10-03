import * as THREE from 'three';

const INSTALL_FLAG = Symbol.for('turn.covered-rendering-installed');
const MAX_RENDER_FPS = 60;
const RENDER_INTERVAL_MS = 1000 / MAX_RENDER_FPS;
const FRAME_TOLERANCE_MS = 0.6;
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

      let lastDeliveredAt = -Infinity;
      const guardedCallback = (time, frame) => {
        const mainRendererCovered = renderer === globalThis.__turnRuntime?.renderer
          && MAIN_RENDERER_PAUSE_CLASSES.some((className) => document.body?.classList.contains(className));
        if (mainRendererCovered) {
          stats.skippedCoveredMainFrames += 1;
          // Reset the delivery clock so returning from Home does not inherit a
          // stale accumulated cadence from minutes of intentionally skipped work.
          lastDeliveredAt = -Infinity;
          return;
        }

        if (Number.isFinite(lastDeliveredAt)) {
          const elapsed = time - lastDeliveredAt;
          if (elapsed < RENDER_INTERVAL_MS - FRAME_TOLERANCE_MS) {
            stats.skippedHighRefreshFrames += 1;
            return;
          }

          // Advance by fixed 60 Hz slots instead of assigning `time`. On 90 Hz
          // displays this produces a 60-ish Hz 2/3 cadence rather than collapsing
          // to 45 Hz, while a long pause snaps back to the current timestamp.
          const slots = Math.max(1, Math.floor((elapsed + FRAME_TOLERANCE_MS) / RENDER_INTERVAL_MS));
          lastDeliveredAt += slots * RENDER_INTERVAL_MS;
          if (time - lastDeliveredAt > RENDER_INTERVAL_MS * 2) lastDeliveredAt = time;
        } else {
          lastDeliveredAt = time;
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
