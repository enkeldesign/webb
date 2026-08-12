let preparationPromise = null;
let installationPromise = null;
let installed = false;

function withBuild(path) {
  const url = new URL(path, import.meta.url);
  const buildKey = globalThis.__TURN_BUILD__?.cacheKey;
  if (buildKey) url.searchParams.set('build', buildKey);
  return url.href;
}

export function prepareDriveByEarRuntime() {
  if (preparationPromise) return preparationPromise;

  preparationPromise = Promise.all([
    import(withBuild('./organic-ribbon.js?revision=r164-long-session-robustness')),
    import(withBuild('./recovery-guidance.js?revision=r164-long-session-robustness')),
    import(withBuild('./pace-note-priority.js?revision=r123-final-hold'))
  ]).then(([organicRibbon, recoveryGuidance, paceNotePriority]) => {
    organicRibbon.prepareOrganicRibbonCapture();
    recoveryGuidance.prepareRecoveryGuidanceCapture();
    paceNotePriority.preparePaceNotePriorityCapture();

    return Object.freeze({
      organicRibbon,
      recoveryGuidance,
      paceNotePriority
    });
  });

  return preparationPromise;
}

export async function ensureDriveByEarRuntime() {
  if (installed) return true;
  if (installationPromise) return installationPromise;

  installationPromise = (async () => {
    const prepared = await prepareDriveByEarRuntime();
    const [drivingSoundscape, paceNotes, offroadEarDirection] = await Promise.all([
      import(withBuild('./driving-soundscape.js')),
      import(withBuild('./pace-notes.js?revision=r123-final-hold')),
      import(withBuild('./offroad-ear-direction.js'))
    ]);

    prepared.organicRibbon.installOrganicRibbon();
    prepared.paceNotePriority.installPaceNotePriority();
    drivingSoundscape.installUniversalDrivingSoundscape();
    paceNotes.installPaceNotes();
    offroadEarDirection.installOffroadEarDirection();
    prepared.recoveryGuidance.installRecoveryGuidance();

    installed = true;
    globalThis.__turnDriveByEarRuntimeReady = true;
    return true;
  })().catch((error) => {
    installationPromise = null;
    console.error('TURN: Drive By Ear could not be started.', error);
    return false;
  });

  return installationPromise;
}
