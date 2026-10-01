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
    import(withBuild('./recovery-guidance.js?revision=r164-long-session-robustness'))
  ]).then(([organicRibbon, recoveryGuidance]) => {
    organicRibbon.prepareOrganicRibbonCapture();
    recoveryGuidance.prepareRecoveryGuidanceCapture();

    return Object.freeze({
      organicRibbon,
      recoveryGuidance
    });
  });

  return preparationPromise;
}

export async function ensureDriveByEarRuntime() {
  if (installed) return true;
  if (installationPromise) return installationPromise;

  installationPromise = (async () => {
    const prepared = await prepareDriveByEarRuntime();
    const [drivingSoundscape, swooshPaceNotes, offroadEarDirection] = await Promise.all([
      import(withBuild('./driving-soundscape.js')),
      import(withBuild('./swoosh-pace-notes.js')),
      import(withBuild('./offroad-ear-direction.js'))
    ]);

    // SWOOSH pace notes sit inside the soundscape, so they see the same off-road and
    // wrong-way state as the mix.
    prepared.organicRibbon.installOrganicRibbon();
    swooshPaceNotes.installSwooshPaceNotes();
    drivingSoundscape.installUniversalDrivingSoundscape();
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
