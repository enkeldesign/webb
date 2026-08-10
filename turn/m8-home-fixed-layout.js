const STYLE_ATTRIBUTE = 'data-turn-m8-fixed-home-styles';
const SHORT_VIEWPORT_STYLE_ID = 'turn-m8-short-viewport-race-dock';
const LAYOUT_ID = 'fixed-grid-v7';

function installStylesheet() {
  if (document.querySelector(`link[${STYLE_ATTRIBUTE}]`)) return;
  const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = `/turn/m8-home-fixed-layout.css?build=${buildKey}-m8.7-home-polish`;
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
  const { installShortViewportAutoRepair } = await import(
    `/turn/pwa-short-viewport-repair-r184.js?build=${buildKey}&revision=r184-start-settle-first-activation`
  );
  const shortViewportAutoRepair = installShortViewportAutoRepair({ home });

  const { installM8HomeCardScrollFixes } = await import(
    `/turn/m8-home-card-scroll-fixes.js?build=${buildKey}-m8.9-track-title-alignment`
  );
  const cardScrollFixes = await installM8HomeCardScrollFixes();

  const { installM8TrophyGate } = await import(
    `/turn/progression/m8-trophy-gate.js?build=${buildKey}-r157-paint-monster`
  );
  const trophyGate = installM8TrophyGate(globalThis.__turnNextHome);

  const { installAchievements } = await import(
    `/turn/achievements.js?build=${buildKey}-r166-bella-records`
  );
  const achievements = installAchievements(globalThis.__turnRuntime);
  const { installAchievementUnreadMarkers } = await import(
    `/turn/achievements/unread-markers.js?build=${buildKey}-r159-unread-cards`
  );
  const achievementUnreadMarkers = installAchievementUnreadMarkers(achievements);
  const { installSecretAchievements } = await import(
    `/turn/achievements/secret-achievements.js?build=${buildKey}-r174-bella-siren-zone`
  );
  const secretAchievements = installSecretAchievements(achievements);
  const { installAchievementChallengeExpansion } = await import(
    `/turn/achievements/challenge-expansion-r166.js?build=${buildKey}-r166-bella-records`
  );
  const achievementChallengeExpansion = installAchievementChallengeExpansion({
    runtime: globalThis.__turnRuntime,
    achievements
  });
  const { installTrophyRoadFeedback } = await import(
    `/turn/achievements/trophy-road-feedback.js?build=${buildKey}-r166-bella-records`
  );
  const trophyRoadFeedback = installTrophyRoadFeedback(achievements);

  const { installDriveByEarTraining } = await import(
    `/turn/training/drive-by-ear-training.js?build=${buildKey}-r151-dbe-training-device-fixes`
  );
  const driveByEarTraining = await installDriveByEarTraining(globalThis.__turnRuntime);
  installDriveByEarSpokenLabels(driveByEarTraining);

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
    driveByEarTraining
  });
  return globalThis.__turnHomeLayout;
}
