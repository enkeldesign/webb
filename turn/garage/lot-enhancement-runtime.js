import { installLotStatLegend } from './lot-stat-legend.js?build=20260724-r59';
import { installLotLayout } from './lot-layout-r60.js?build=20260729-r116';
import { installLotAccessibility } from './lot-accessibility-r118.js?build=20260729-r118';

const ENHANCEMENT_ID = 'enhanced-lot-r121';
const activeEnhancements = new WeakMap();

function findLotScreen(root) {
  if (root?.matches?.('.lot-screen')) return root;
  return root?.querySelector?.('.lot-screen') || null;
}

export function enhanceLotNow(root = document.body) {
  const screen = findLotScreen(root);
  if (!screen) return () => {};

  const active = activeEnhancements.get(screen);
  if (active) return active.release;

  const scope = screen.parentElement || document.body;
  const removeStatLegend = installLotStatLegend(scope);
  const removeLayout = installLotLayout(scope);
  const removeAccessibility = installLotAccessibility(scope);
  let released = false;

  const release = () => {
    if (released) return;
    released = true;
    removeAccessibility();
    removeLayout();
    removeStatLegend();
    activeEnhancements.delete(screen);
    delete screen.dataset.lotEnhancements;
  };

  screen.dataset.lotEnhancements = ENHANCEMENT_ID;
  activeEnhancements.set(screen, { release });
  return release;
}

export function installLotEnhancementRuntime(root = document.body) {
  let currentScreen = null;
  let releaseCurrent = () => {};

  const sync = () => {
    const nextScreen = findLotScreen(root);
    if (nextScreen === currentScreen) return;

    releaseCurrent();
    currentScreen = nextScreen;
    releaseCurrent = nextScreen ? enhanceLotNow(nextScreen) : () => {};
  };

  const observer = new MutationObserver(sync);
  observer.observe(root, { childList: true, subtree: true });
  sync();

  const runtime = Object.freeze({
    id: ENHANCEMENT_ID,
    sync,
    disconnect() {
      observer.disconnect();
      releaseCurrent();
      currentScreen = null;
      releaseCurrent = () => {};
    }
  });

  globalThis.__turnLotEnhancements = runtime;
  document.documentElement.dataset.turnLotEnhancements = ENHANCEMENT_ID;
  return runtime;
}
