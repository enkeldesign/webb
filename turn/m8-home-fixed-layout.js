const STYLE_ATTRIBUTE = 'data-turn-m8-fixed-home-styles';
const SHORT_VIEWPORT_STYLE_ID = 'turn-m8-short-viewport-race-dock';
const LAYOUT_ID = 'fixed-grid-v8-shared-track-bests';
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

function installStylesheet() {
  if (document.querySelector(`link[${STYLE_ATTRIBUTE}]`)) return;
  const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = `/turn/m8-home-fixed-layout.css?build=${buildKey}-r206-shared-track-bests`;
  stylesheet.setAttribute(STYLE_ATTRIBUTE, '');
  document.head.appendChild(stylesheet);
}

function installShortViewportRaceDock() {
  if (document.getElementById(SHORT_VIEWPORT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SHORT_VIEWPORT_STYLE_ID;
  style.textContent = `
    @media (max-height: 430px) and (orientation: landscape) {
      html.turn-standalone .m8-home-fixed-layout .m8-home-menu {
        overflow-y: auto;
        overflow-x: hidden;
        overscroll-behavior-y: contain;
        overscroll-behavior-x: none;
        touch-action: pan-y;
        box-sizing: border-box;
        padding-right: 8px;
        padding-bottom: 76px;
        scroll-padding-bottom: 76px;
      }

      html.turn-standalone .m8-home-fixed-layout .m8-track-continue {
        position: fixed;
        z-index: 70;
        right: max(14px, env(safe-area-inset-right));
        bottom: max(12px, env(safe-area-inset-bottom));
        width: clamp(150px, 20vw, 205px);
        max-width: calc(100vw - 28px - env(safe-area-inset-left) - env(safe-area-inset-right));
      }
    }
  `;
  document.head.appendChild(style);
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

function spokenTrackName(rawName) {
  return rawName
    .toLocaleLowerCase('en')
    .replace(/(^|\s)\p{L}/gu, (character) => character.toLocaleUpperCase('en'));
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

export async function installM8HomeFixedLayout() {
  installStylesheet();
  installShortViewportRaceDock();
  const home = await waitForHome();
  if (home.dataset.m8HomeLayout === LAYOUT_ID) return globalThis.__turnHomeLayout;

  const header = home.querySelector('.m8-home-head');
  const main = home.querySelector('.m8-home-main');
  const headingRow = home.querySelector('.m8-track-heading-row');
  const rail = home.querySelector('.m8-track-rail');
  const howButton = home.querySelector('.m8-how-button');
  const settingsButton = home.querySelector('.m8-home-settings');
  const raceButton = home.querySelector('.m8-track-continue');
  const status = home.querySelector('.m8-home-status');
  const oldScrollButtons = home.querySelector('.m8-track-scroll-buttons');

  if (!header || !main || !headingRow || !rail || !howButton || !settingsButton || !raceButton || !status) {
    throw new Error('TURN M8 fixed Home layout could not find the complete Home interface.');
  }

  const trackBrowser = document.createElement('section');
  trackBrowser.className = 'm8-home-tracks';
  trackBrowser.setAttribute('aria-labelledby', 'm8HomeTitle');
  main.insertBefore(trackBrowser, headingRow);
  trackBrowser.append(headingRow, rail);

  const menu = document.createElement('aside');
  menu.className = 'm8-home-menu';
  menu.setAttribute('aria-labelledby', 'm8MenuTitle');
  menu.innerHTML = '<h2 id="m8MenuTitle">MENU</h2>';
  main.appendChild(menu);

  settingsButton.querySelector('[aria-hidden="true"]')?.remove();
  settingsButton.textContent = 'SETTINGS';
  howButton.textContent = 'HOW TO PLAY';
  raceButton.classList.add('m8-race-button');
  menu.append(settingsButton, howButton, status, raceButton);

  if (oldScrollButtons) {
    oldScrollButtons.hidden = true;
    oldScrollButtons.setAttribute('aria-hidden', 'true');
  }

  let selectedTrackName = '';
  const syncRaceLabel = () => {
    const visibleLabel = raceButton.textContent.trim();
    const trackMatch = visibleLabel.match(/^CONTINUE(?: TO)?\s+(.+)$/i);
    if (trackMatch) selectedTrackName = trackMatch[1].trim();
    if (raceButton.textContent !== 'RACE') raceButton.textContent = 'RACE';
    raceButton.setAttribute(
      'aria-label',
      selectedTrackName ? `Race on ${spokenTrackName(selectedTrackName)}` : 'Race on the selected track'
    );
  };

  const raceLabelObserver = new MutationObserver(syncRaceLabel);
  raceLabelObserver.observe(raceButton, { childList: true, characterData: true, subtree: true });
  syncRaceLabel();

  home.classList.add('m8-home-fixed-layout');
  home.dataset.m8HomeLayout = LAYOUT_ID;
  document.documentElement.dataset.turnHomeLayout = LAYOUT_ID;

  const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';

  // These modules are required before the first race, but there is no dependency reason
  // to fetch them one after another. Download the Home/race-critical graph in parallel,
  // then preserve the established installation order below.
  const [
    shortViewportModule,
    cardScrollModule,
    trophyGateModule,
    achievementsModule,
    unreadMarkersModule,
    secretAchievementsModule,
    challengeExpansionModule,
    trophyRoadFeedbackModule,
    driveByEarTrainingModule
  ] = await Promise.all([
    import(`/turn/pwa-short-viewport-repair-r184.js?build=${buildKey}&revision=r184-start-settle-first-activation`),
    // Historical regression markers for the previous aligned-title bundles:
    // /turn/m8-home-card-scroll-fixes.js?build=${buildKey}-m8.9-track-title-alignment
    // /turn/m8-home-card-scroll-fixes.js?build=${buildKey}-m8.10-card-gap-rim
    // import(`/turn/m8-home-card-scroll-fixes.js?build=${buildKey}-r217-track-record-layout`)
    import(`/turn/m8-home-card-scroll-fixes.js?build=${buildKey}-r218-track-record-breathing`),
    import(`/turn/progression/m8-trophy-gate.js?build=${buildKey}-r157-paint-monster`),
    import(`/turn/achievements.js?build=${buildKey}-r166-bella-records&robustness=r164-long-session`),
    import(`/turn/achievements/unread-markers.js?build=${buildKey}-r219-unified-filters`),
    import(`/turn/achievements/secret-achievements.js?build=${buildKey}-r174-bella-siren-zone`),
    import(`/turn/achievements/challenge-expansion-r166.js?build=${buildKey}-r166-bella-records`),
    import(`/turn/achievements/trophy-road-feedback.js?build=${buildKey}-r244-reward-toast-guide&robustness=r164-long-session`),
    import(`/turn/training/drive-by-ear-training.js?build=${buildKey}-r151-dbe-training-device-fixes`)
  ]);

  const shortViewportAutoRepair = shortViewportModule.installShortViewportAutoRepair({ home });
  const cardScrollFixes = await cardScrollModule.installM8HomeCardScrollFixes();
  const trophyGate = trophyGateModule.installM8TrophyGate(globalThis.__turnNextHome);
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
    trackBrowser,
    menu,
    raceButton,
    shortViewportAutoRepair,
    cardScrollFixes,
    trophyGate,
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
