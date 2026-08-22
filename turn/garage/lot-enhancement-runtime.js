// Historical regression marker: lot-perk-disclosure.js?revision=r164-vintage-rally-perks
// Historical regression marker: lot-trophy-gate.js?revision=r164-vintage-rally-perks
// Historical regression marker: lot-paint-reward.js?revision=r164-perks
// Historical regression marker: lot-paint-reward.js?revision=r203-color-label
// Historical regression marker: lot-paint-reward.js?revision=r204-color-control-rebuild
// Historical regression marker: lot-accessibility-r118.js?build=20260729-r118

// Historical regression markers for the established enhancement layers:
// ENHANCEMENT_ID = 'enhanced-lot-r121'
// TROPHY_ROAD_ENHANCEMENT_ID = 'enhanced-lot-r154-trophy-road-feedback'
const ENHANCEMENT_ID = 'enhanced-lot-r164-vintage-rally-perks';
const TROPHY_ROAD_ENHANCEMENT_ID = 'enhanced-lot-r164-vintage-rally-perks';
const LOT_ENTRY_CLICK_GUARD_MS = 600;
const activeEnhancements = new WeakMap();
let enhancementBundle = null;
let enhancementPreparation = null;

export function prepareLotEnhancements() {
  if (enhancementBundle) return Promise.resolve(enhancementBundle);
  if (enhancementPreparation) return enhancementPreparation;

  enhancementPreparation = Promise.all([
    import('./lot-stat-legend.js?build=20260724-r59'),
    import('./lot-layout-r60.js?build=20260729-r116'),
    import('./lot-accessibility-r118.js?build=20260729-r118&revision=r588-canonical-attributes'),
    import('./lot-perk-disclosure.js?revision=r203-idempotent'),
    import('../progression/lot-trophy-gate.js?revision=r585-visible-locks'),
    import('../progression/lot-paint-reward.js?revision=r205-color-baseline')
  ]).then(([
    statLegend,
    layout,
    accessibility,
    perkDisclosure,
    trophyGate,
    paintGate
  ]) => {
    enhancementBundle = Object.freeze({
      installLotStatLegend: statLegend.installLotStatLegend,
      installLotLayout: layout.installLotLayout,
      installLotAccessibility: accessibility.installLotAccessibility,
      installLotPerkDisclosure: perkDisclosure.installLotPerkDisclosure,
      gateLotNow: trophyGate.gateLotNow,
      gateLotPaintNow: paintGate.gateLotPaintNow
    });
    return enhancementBundle;
  }).catch((error) => {
    enhancementPreparation = null;
    throw error;
  });

  return enhancementPreparation;
}

function findLotScreen(root) {
  if (root?.matches?.('.lot-screen')) return root;
  return root?.querySelector?.('.lot-screen') || null;
}

function installLotEntryClickGuard(screen) {
  const card = screen.querySelector('.lot-card');
  if (!card) return () => {};

  const startedAt = globalThis.performance?.now?.() ?? Date.now();
  const now = () => globalThis.performance?.now?.() ?? Date.now();
  let active = true;

  const blockCarryOverRaceClick = (event) => {
    if (!active || now() - startedAt >= LOT_ENTRY_CLICK_GUARD_MS) return;
    const raceButton = event.target?.closest?.('.lot-race');
    if (!raceButton || !card.contains(raceButton)) return;

    // A VoiceOver double-tap that opens a full-screen route can leave a second
    // hit-test activation behind in standalone iOS landscape. Race This Car is
    // mounted in almost the same screen region as Home RACE, so keep only this
    // newly mounted action out of that finishing gesture. The paint picker is a
    // sibling of .lot-card and therefore has no click-listener ancestor added.
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  card.addEventListener('click', blockCarryOverRaceClick, true);
  const timer = globalThis.setTimeout?.(() => {
    active = false;
    card.removeEventListener('click', blockCarryOverRaceClick, true);
  }, LOT_ENTRY_CLICK_GUARD_MS);

  return () => {
    active = false;
    if (timer != null) globalThis.clearTimeout?.(timer);
    card.removeEventListener('click', blockCarryOverRaceClick, true);
  };
}

export function enhanceLotNow(root = document.body) {
  const screen = findLotScreen(root);
  if (!screen) return () => {};

  const active = activeEnhancements.get(screen);
  if (active) return active.release;

  if (!enhancementBundle) {
    let cancelled = false;
    let releasePrepared = () => {};
    void prepareLotEnhancements().then(() => {
      if (!cancelled) releasePrepared = enhanceLotNow(root);
    }).catch((error) => {
      console.warn('TURN: Lot enhancements could not be prepared.', error);
    });
    return () => {
      cancelled = true;
      releasePrepared();
    };
  }

  const {
    gateLotNow,
    gateLotPaintNow,
    installLotPerkDisclosure,
    installLotStatLegend,
    installLotLayout,
    installLotAccessibility
  } = enhancementBundle;
  const scope = screen.parentElement || document.body;
  const removeEntryClickGuard = installLotEntryClickGuard(screen);
  const removeTrophyGate = gateLotNow(scope);
  const removePaintGate = gateLotPaintNow(scope);
  const removePerkDisclosure = installLotPerkDisclosure(scope);
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
    removePerkDisclosure();
    removePaintGate();
    removeTrophyGate();
    removeEntryClickGuard();
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
  let preparationGeneration = 0;

  const sync = () => {
    const nextScreen = findLotScreen(root);
    if (nextScreen === currentScreen) return;

    preparationGeneration += 1;
    const generation = preparationGeneration;
    releaseCurrent();
    currentScreen = nextScreen;
    releaseCurrent = () => {};
    if (!nextScreen) return;

    if (enhancementBundle) {
      releaseCurrent = enhanceLotNow(nextScreen);
      return;
    }

    void prepareLotEnhancements().then(() => {
      if (generation !== preparationGeneration || currentScreen !== nextScreen) return;
      releaseCurrent = enhanceLotNow(nextScreen);
    }).catch((error) => {
      console.warn('TURN: Lot enhancement warmup failed.', error);
    });
  };

  const observer = new MutationObserver(sync);
  observer.observe(root, { childList: true, subtree: true });
  sync();

  const runtime = Object.freeze({
    id: ENHANCEMENT_ID,
    trophyRoadId: TROPHY_ROAD_ENHANCEMENT_ID,
    prepare: prepareLotEnhancements,
    sync,
    disconnect() {
      preparationGeneration += 1;
      observer.disconnect();
      releaseCurrent();
      currentScreen = null;
      releaseCurrent = () => {};
    }
  });

  globalThis.__turnLotEnhancements = runtime;
  document.documentElement.dataset.turnLotEnhancements = ENHANCEMENT_ID;
  document.documentElement.dataset.turnTrophyRoadLot = TROPHY_ROAD_ENHANCEMENT_ID;
  return runtime;
}
