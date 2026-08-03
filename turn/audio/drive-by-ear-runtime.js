let preparationPromise = null;
let installationPromise = null;
let installed = false;

export function prepareDriveByEarRuntime() {
  if (preparationPromise) return preparationPromise;

  preparationPromise = Promise.all([
    import('./organic-ribbon.js'),
    import('./recovery-guidance.js'),
    import('./pace-note-priority.js?revision=r123-final-hold')
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
      import('./driving-soundscape.js'),
      import('./pace-notes.js?revision=r123-final-hold'),
      import('./offroad-ear-direction.js')
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
