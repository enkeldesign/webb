import { installBellaRescueBehavior } from './countryside-bella-rescue-r173.js?revision=r164-long-session-robustness';

const RETRY_DELAYS_MS = Object.freeze([250, 350, 500, 700, 900, 1200, 1600, 2200, 3000, 4000]);

function bellaRoot(runtime) {
  return runtime?.world?.children?.find?.(
    (child) => child?.userData?.turnEasterEgg === 'save-bella'
  ) || null;
}

function reinstall(runtime) {
  const root = bellaRoot(runtime);
  if (!root) return false;

  root.userData.turnBellaDisposeRescueBehavior?.();
  root.userData.turnBellaRescueBehaviorInstalled = false;
  installBellaRescueBehavior({ root, runtime });
  root.userData.turnBellaRescueBootstrap = 'r164-long-session-robustness';
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
