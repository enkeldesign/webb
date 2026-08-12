import * as THREE from 'three';

const INSTALL_FLAG = Symbol.for('turn.covered-rendering-installed');
const MAX_RENDER_FPS = 60;
const RENDER_INTERVAL_MS = 1000 / MAX_RENDER_FPS;
const FRAME_TOLERANCE_MS = 0.6;
const PAUSE_CLASSES = Object.freeze([
  'turn-track-select-open',
  'turn-runtime-paused'
]);

export function installCoveredRenderingGuard() {
  const prototype = THREE.WebGLRenderer.prototype;
  if (prototype[INSTALL_FLAG]) return prototype[INSTALL_FLAG];

  const originalSetAnimationLoop = prototype.setAnimationLoop;
  const stats = {
    guardedLoops: 0,
    skippedFrames: 0,
    skippedHighRefreshFrames: 0
  };

  prototype.setAnimationLoop = function setCoveredAwareAnimationLoop(callback) {
    if (typeof callback !== 'function') {
      return originalSetAnimationLoop.call(this, callback);
    }

    const renderer = this;
    let lastDeliveredAt = -Infinity;
    const guardedCallback = (time, frame) => {
      if (PAUSE_CLASSES.some((className) => document.body?.classList.contains(className))) {
        stats.skippedFrames += 1;
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

  const diagnostics = Object.freeze({
    snapshot() {
      return { ...stats };
    }
  });
  Object.defineProperty(prototype, INSTALL_FLAG, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: diagnostics
  });
  globalThis.__turnCoveredRendering = diagnostics;
  return diagnostics;
}
