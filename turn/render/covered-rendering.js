import * as THREE from 'three';

const INSTALL_FLAG = Symbol.for('turn.covered-rendering-installed');
const TRACK_SELECTOR_CLASS = 'turn-track-select-open';

export function installCoveredRenderingGuard() {
  const prototype = THREE.WebGLRenderer.prototype;
  if (prototype[INSTALL_FLAG]) return prototype[INSTALL_FLAG];

  const originalSetAnimationLoop = prototype.setAnimationLoop;
  const stats = {
    guardedLoops: 0,
    skippedFrames: 0
  };

  prototype.setAnimationLoop = function setCoveredAwareAnimationLoop(callback) {
    if (typeof callback !== 'function') {
      return originalSetAnimationLoop.call(this, callback);
    }

    const renderer = this;
    const guardedCallback = (time, frame) => {
      if (document.body?.classList.contains(TRACK_SELECTOR_CLASS)) {
        stats.skippedFrames += 1;
        return;
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
