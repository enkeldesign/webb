const LAYOUT_ID = 'roadbook';
const MUSIC_VOLUME_STORAGE_KEY = 'turn-racing-music-volume-v1';
const MUSIC_LAST_VOLUME_STORAGE_KEY = 'turn-racing-music-last-volume-v1';
const POST_HOME_IDLE_TIMEOUT_MS = 900;

function storageSnapshot(key) {
  try {
    return Object.freeze({ available: true, value: globalThis.localStorage?.getItem(key) ?? null });
  } catch (_) {
    return Object.freeze({ available: false, value: null });
  }
}

function restoreStorage(key, snapshot) {
  if (!snapshot?.available) return;
  try {
    if (snapshot.value == null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, snapshot.value);
  } catch (_) {}
}

function installDriveByEarTrainingMusicSilence(training, racingMusic) {
  if (!training || !racingMusic || globalThis.__turnDbeTrainingMusicSilence) {
    return globalThis.__turnDbeTrainingMusicSilence || null;
  }

  let temporary = null;

  const restorePersistentMusicChoice = (snapshot) => {
    restoreStorage(MUSIC_VOLUME_STORAGE_KEY, snapshot?.storedVolume);
    restoreStorage(MUSIC_LAST_VOLUME_STORAGE_KEY, snapshot?.storedLastVolume);
  };

  const silence = () => {
    if (temporary) return;
    temporary = Object.freeze({
      volume: Number.isFinite(Number(racingMusic.volume)) ? Number(racingMusic.volume) : 0,
      storedVolume: storageSnapshot(MUSIC_VOLUME_STORAGE_KEY),
      storedLastVolume: storageSnapshot(MUSIC_LAST_VOLUME_STORAGE_KEY)
    });
    racingMusic.setVolume?.(0);
    // setVolume(0) intentionally updates the normal preference. DBE 101 is different:
    // silence is temporary, so immediately put the player's persisted choice back.
    restorePersistentMusicChoice(temporary);
  };

  const restore = () => {
    if (!temporary) return;
    const snapshot = temporary;
    temporary = null;
    racingMusic.setVolume?.(snapshot.volume);
    restorePersistentMusicChoice(snapshot);
  };

  const entryButtons = [
    training.entryPoints?.homeButton,
    training.entryPoints?.howCallout?.querySelector?.('[data-turn-dbe-training-entry]'),
    training.entryPoints?.settingsCallout?.querySelector?.('[data-turn-dbe-training-entry]'),
    training.blankSuggestion?.dialog?.querySelector?.('[data-blank-training]')
  ].filter(Boolean);

  for (const button of entryButtons) {
    button.addEventListener('click', silence, { capture: true });
  }

  training.introDialog?.addEventListener('close', () => {
    queueMicrotask(() => {
      if (training.getState?.().active !== true) restore();
    });
  });

  globalThis.addEventListener('turn:dbe-training-stage-started', silence);
  globalThis.addEventListener('turn:track-changed', (event) => {
    if (event.detail?.training === true) silence();
    else if (temporary) restore();
  });

  const api = Object.freeze({
    silence,
    restore,
    get active() { return Boolean(temporary); }
  });
  globalThis.__turnDbeTrainingMusicSilence = api;
  return api;
}

function waitForHome() {
  const existing = document.querySelector('.m8-home');
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const home = document.querySelector('.m8-home');
      if (!home) return;
      observer.disconnect();
      resolve(home);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

function waitForPostHomeIdle() {
  return new Promise((resolve) => {
    const scheduleIdle = () => {
      if (typeof globalThis.requestIdleCallback === 'function') {
        globalThis.requestIdleCallback(() => resolve(), { timeout: POST_HOME_IDLE_TIMEOUT_MS });
        return;
      }
      globalThis.setTimeout(resolve, 80);
    };

    if (document.documentElement.classList.contains('turn-home-ready')) {
      scheduleIdle();
      return;
    }
    document.addEventListener('turn:home-ready', scheduleIdle, { once: true });
  });
}

function installDriveByEarSpokenLabels(training) {
  const spokenName = 'Drive By Ear one oh one';
  training.entryPoints?.homeButton?.setAttribute('aria-label', spokenName);
  training.entryPoints?.howCallout
    ?.querySelector('[data-turn-dbe-training-entry]')
    ?.setAttribute('aria-label', `Start ${spokenName}`);
  training.entryPoints?.settingsCallout
    ?.querySelector('[data-turn-dbe-training-entry]')
    ?.setAttribute('aria-label', `Try ${spokenName}`);
  training.introDialog
    ?.querySelector('#turnDbeTrainingTitle')
    ?.setAttribute('aria-label', spokenName);
  training.introDialog
    ?.querySelector('[data-training-cancel]')
    ?.setAttribute('aria-label', `Close ${spokenName}`);
  training.partDialog
    ?.querySelector('[data-training-leave]')
    ?.setAttribute('aria-label', `Leave ${spokenName}`);
}

// Home's runtime modules: achievements, Trophy Road feedback, Drive By Ear 101 and the
// racing music. ROADBOOK (roadbook/roadbook.js) owns the Home layout itself.
export async function installM8HomeFixedLayout() {
  const home = await waitForHome();
  if (home.dataset.m8HomeLayout === LAYOUT_ID) return globalThis.__turnHomeLayout;
  home.dataset.m8HomeLayout = LAYOUT_ID;
  document.documentElement.dataset.turnHomeLayout = LAYOUT_ID;

  const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';

  // These modules are required before the first race, but there is no dependency reason
  // to fetch them one after another. Download the Home/race-critical graph in parallel,
  // then preserve the established installation order below.
  const [
    shortViewportModule,
    achievementsModule,
    unreadMarkersModule,
    secretAchievementsModule,
    challengeExpansionModule,
    trophyRoadFeedbackModule,
    driveByEarTrainingModule
  ] = await Promise.all([
    import(`/turn/pwa-short-viewport-repair-r184.js?build=${buildKey}&revision=r184-start-settle-first-activation`),
    import(`/turn/achievements.js?build=${buildKey}-r166-bella-records&robustness=r164-long-session`),
    import(`/turn/achievements/unread-markers.js?build=${buildKey}-r219-unified-filters`),
    import(`/turn/achievements/secret-achievements.js?build=${buildKey}-r174-bella-siren-zone`),
    import(`/turn/achievements/challenge-expansion-r166.js?build=${buildKey}-r166-bella-records`),
    import(`/turn/achievements/trophy-road-feedback.js?build=${buildKey}-r254-achievement-filter-rows&robustness=r164-long-session`),
    import(`/turn/training/drive-by-ear-training.js?build=${buildKey}-r151-dbe-training-device-fixes`)
  ]);

  const shortViewportAutoRepair = shortViewportModule.installShortViewportAutoRepair({ home });
  const achievements = achievementsModule.installAchievements(globalThis.__turnRuntime);
  const achievementUnreadMarkers = unreadMarkersModule.installAchievementUnreadMarkers(achievements);
  const secretAchievements = secretAchievementsModule.installSecretAchievements(achievements);
  const achievementChallengeExpansion = challengeExpansionModule.installAchievementChallengeExpansion({
    runtime: globalThis.__turnRuntime,
    achievements
  });
  const trophyRoadFeedback = trophyRoadFeedbackModule.installTrophyRoadFeedback(achievements);
  const driveByEarTraining = await driveByEarTrainingModule.installDriveByEarTraining(globalThis.__turnRuntime);
  installDriveByEarSpokenLabels(driveByEarTraining);

  let racingMusic = null;
  let dbeTrainingMusicSilence = null;
  let racingMusicHealth = null;

  // The score engine statically imports the menu score, six track scores, instrument
  // banks and synth/drum runtimes. Start fetching/compiling that graph while TURN's startup
  // cover is still up; installation and playback still wait for post-Home idle.
  const musicModulesPromise = Promise.all([
    import(`/turn/audio/racing-music-v2.js?build=${buildKey}-racing-music-warm-v2`),
    import(`/turn/audio/racing-music-health.js?build=${buildKey}&revision=r164-long-session-robustness`)
  ]);
  const musicReady = (async () => {
    await waitForPostHomeIdle();
    const [musicModule, musicHealthModule] = await musicModulesPromise;
    racingMusic = musicModule.installRacingMusic({ home });
    const dbeTrainingMusicSilence = installDriveByEarTrainingMusicSilence(driveByEarTraining, racingMusic);
    // If the player entered DBE 101 in the brief interval before music finished warming,
    // never let the newly installed menu score start underneath training.
    if (driveByEarTraining.getState?.().active === true || driveByEarTraining.introDialog?.open) {
      dbeTrainingMusicSilence?.silence?.();
    }
    racingMusicHealth = musicHealthModule.installRacingMusicHealth(racingMusic);
    globalThis.__turnDbeTrainingMusicSilence = dbeTrainingMusicSilence;
    document.dispatchEvent(new CustomEvent('turn:home-music-ready'));
    return Object.freeze({ racingMusic, dbeTrainingMusicSilence, racingMusicHealth });
  })().then((result) => {
    dbeTrainingMusicSilence = result.dbeTrainingMusicSilence;
    return result;
  }).catch((error) => {
    console.warn('TURN: post-Home music warmup failed; racing remains available.', error);
    return null;
  });

  globalThis.__turnHomeLayout = Object.freeze({
    id: LAYOUT_ID,
    home,
    shortViewportAutoRepair,
    achievements,
    achievementUnreadMarkers,
    secretAchievements,
    achievementChallengeExpansion,
    trophyRoadFeedback,
    driveByEarTraining,
    get racingMusic() { return racingMusic; },
    get dbeTrainingMusicSilence() { return dbeTrainingMusicSilence; },
    get racingMusicHealth() { return racingMusicHealth; },
    musicReady
  });
  return globalThis.__turnHomeLayout;
}
