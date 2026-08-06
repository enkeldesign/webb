import { installBellaRescueBehavior } from './countryside-bella-rescue-r173.js?revision=r176-road-derived-rescue-zone';

const RETRY_INTERVAL_MS = 120;
const RETRY_LIMIT = 100;

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
  root.userData.turnBellaRescueBootstrap = 'r176-road-derived-zone';
  return true;
}

function start(runtime = globalThis.__turnRuntime) {
  if (reinstall(runtime)) return;
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (reinstall(globalThis.__turnRuntime) || attempts >= RETRY_LIMIT) {
      window.clearInterval(timer);
    }
  }, RETRY_INTERVAL_MS);
}

if (globalThis.__turnRuntime) start(globalThis.__turnRuntime);
else window.addEventListener('turn:runtime-ready', (event) => start(event.detail), { once: true });
