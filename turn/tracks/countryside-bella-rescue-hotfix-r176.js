import { installBellaRescueBehavior } from './countryside-bella-rescue-r173.js?revision=r164-long-session-robustness';

const RETRY_DELAYS_MS = Object.freeze([250, 350, 500, 700, 900, 1200, 1600, 2200, 3000, 4000]);
const spatialRuntimeCache = new WeakMap();

function bellaRoot(runtime) {
  return runtime?.world?.children?.find?.(
    (child) => child?.userData?.turnEasterEgg === 'save-bella'
  ) || null;
}

function correctedSpatialRuntime(runtime) {
  if (!runtime || typeof Proxy !== 'function') return runtime;
  const cached = spatialRuntimeCache.get(runtime);
  if (cached) return cached;

  // Bella's meow uses Web Audio's stereo panner, where negative is left and positive
  // is right. TURN's existing rescue behavior receives the opposite sign from the
  // runtime right-vector convention, so the cue was exactly mirrored. Keep the fix
  // local to Bella instead of changing the shared vehicle/camera coordinate system.
  const proxy = new Proxy(runtime, {
    get(target, property) {
      if (property === 'getRight') {
        return () => {
          const right = typeof target.getRight === 'function' ? target.getRight() : null;
          if (right) {
            return {
              x: -Number(right.x || 0),
              y: -Number(right.y || 0),
              z: -Number(right.z || 0)
            };
          }

          const heading = Number(target.state?.heading) || 0;
          return {
            x: -Math.cos(heading),
            y: 0,
            z: Math.sin(heading)
          };
        };
      }

      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
  spatialRuntimeCache.set(runtime, proxy);
  return proxy;
}

function reinstall(runtime) {
  const root = bellaRoot(runtime);
  if (!root) return false;

  root.userData.turnBellaDisposeRescueBehavior?.();
  root.userData.turnBellaRescueBehaviorInstalled = false;
  installBellaRescueBehavior({ root, runtime: correctedSpatialRuntime(runtime) });
  root.userData.turnBellaRescueBootstrap = 'r172-screen-reader-quality';
  return true;
}

function start(runtime = globalThis.__turnRuntime) {
  if (reinstall(runtime)) return;

  let attempt = 0;
  const retry = () => {
    if (reinstall(globalThis.__turnRuntime)) return;
    if (attempt >= RETRY_DELAYS_MS.length) return;
    const delay = RETRY_DELAYS_MS[attempt];
    attempt += 1;
    window.setTimeout(retry, delay);
  };

  retry();
}

if (globalThis.__turnRuntime) start(globalThis.__turnRuntime);
else window.addEventListener('turn:runtime-ready', (event) => start(event.detail), { once: true });
