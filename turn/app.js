const launchReady = globalThis.__turnLaunchReady;
if (launchReady && typeof launchReady.then === 'function') {
  await launchReady;
}

function installStartupCover() {
  const gate = document.querySelector('#installGate');
  if (!gate) return Object.freeze({ finish() {} });

  let style = document.querySelector('#turn-startup-cover-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'turn-startup-cover-style';
    style.textContent = `
      .install-gate.turn-startup-loading {
        display: grid !important;
      }
      .install-gate.turn-startup-loading .install-shell {
        grid-template-columns: minmax(150px, .7fr) minmax(280px, 1.3fr);
      }
      .install-gate.turn-startup-loading .install-kicker,
      .install-gate.turn-startup-loading .install-actions,
      .install-gate.turn-startup-loading .install-note {
        display: none !important;
      }
      .install-gate.turn-startup-loading .install-copy {
        margin-bottom: 18px;
        font-weight: 900;
        letter-spacing: .04em;
        text-transform: uppercase;
      }
      .turn-startup-spinner {
        width: 42px;
        height: 42px;
        box-sizing: border-box;
        border: 6px solid var(--turn-muted, #d6d0c2);
        border-top-color: var(--turn-action-information, #38d9ff);
        border-radius: 50%;
        animation: turn-startup-spin 800ms linear infinite;
      }
      @keyframes turn-startup-spin {
        to { transform: rotate(360deg); }
      }
      @media (prefers-reduced-motion: reduce) {
        .turn-startup-spinner {
          animation: none;
          border-color: var(--turn-action-information, #38d9ff);
        }
      }
      /* A fixed inset is more reliable than an early 100dvh measurement in
         standalone iOS landscape. The stale dynamic viewport caused the
         black footer until an orientation change forced a remeasurement. */
      .m8-home.m8-home-fixed-layout {
        inset: 0 !important;
        height: auto !important;
        min-height: 0 !important;
      }
    `;
    document.head.appendChild(style);
  }

  const title = gate.querySelector('.install-card h1');
  const copy = gate.querySelector('.install-copy');
  const card = gate.querySelector('.install-card');
  const guide = gate.querySelector('.install-guide');
  guide?.setAttribute('hidden', '');
  if (title) title.textContent = 'TURN';
  if (copy) {
    copy.textContent = 'Loading TURN';
    copy.setAttribute('role', 'status');
    copy.setAttribute('aria-live', 'polite');
  }
  if (card && !card.querySelector('.turn-startup-spinner')) {
    const spinner = document.createElement('div');
    spinner.className = 'turn-startup-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    card.appendChild(spinner);
  }

  gate.hidden = false;
  gate.classList.add('turn-startup-loading');
  gate.style.setProperty('display', 'grid');
  document.documentElement.classList.add('turn-startup-pending');

  return Object.freeze({
    finish() {
      document.documentElement.classList.remove('turn-startup-pending');
      document.documentElement.classList.add('turn-home-ready');
      gate.classList.remove('turn-startup-loading');
      gate.style.removeProperty('display');
      gate.hidden = true;
      document.dispatchEvent(new CustomEvent('turn:home-ready'));
    }
  });
}

const startupCover = installStartupCover();
const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';
const moduleBase = new URL('/turn/', globalThis.location?.href || 'https://enkel.design/turn/');

function withBuild(path) {
  const url = new URL(path, moduleBase);
  if (buildKey) url.searchParams.set('build', buildKey);
  return url.href;
}

function installStylesheet(path, dataAttribute) {
  if (document.querySelector(`link[${dataAttribute}]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = withBuild(path);
  link.setAttribute(dataAttribute, '');
  document.head.appendChild(link);
}

function makeHiddenHook(tagName, id) {
  const element = document.createElement(tagName);
  element.id = id;
  element.hidden = true;
  element.setAttribute('aria-hidden', 'true');
  if (tagName === 'button') element.type = 'button';
  return element;
}

function retireLegacyStartPanel() {
  const intro = document.querySelector('#intro');
  if (!intro) throw new Error('TURN could not find its launch compatibility shell.');
  intro.hidden = true;
  intro.replaceChildren(
    makeHiddenHook('button', 'motionButton'),
    makeHiddenHook('button', 'manualButton'),
    makeHiddenHook('p', 'status')
  );
  document.documentElement.dataset.turnLegacyStart = 'retired';
  return intro;
}

retireLegacyStartPanel();

const { createWebPlatform } = await import(withBuild('./platform/web-platform.js'));
const { installTurnPlatform } = await import(withBuild('./platform/platform-context.js'));
const { installMotionLifecycleBridge } = await import(withBuild('./motion-lifecycle-bridge.js'));
const { installDisplayLifecycleBridge } = await import(withBuild('./display-lifecycle-bridge.js'));
const webPlatform = createWebPlatform();
installTurnPlatform(webPlatform);
const motionLifecycle = installMotionLifecycleBridge({ platform: webPlatform });
const displayLifecycle = installDisplayLifecycleBridge({ platform: webPlatform });
// Historical regression marker for the ordinary-browser fresh-document path:
// motion-permission-cancel-recovery.js?revision=r132-fresh-document
const { installMotionPermissionCancelRecovery } = await import(
  withBuild('./ui/motion-permission-cancel-recovery.js?revision=r134-dialog-event')
);
const motionPermissionCancelRecovery = installMotionPermissionCancelRecovery();
installStylesheet(
  './motion-permission-dialog-r134.css?revision=r134-denied-dialog',
  'data-turn-motion-permission-dialog'
);
const { installMotionPermissionDeniedDialog } = await import(
  withBuild('./ui/motion-permission-denied-dialog.js?revision=r134-denied-dialog')
);
installMotionPermissionDeniedDialog();
globalThis.__turnMotionLifecycle = motionLifecycle;
globalThis.__turnDisplayLifecycle = displayLifecycle;
document.documentElement.dataset.turnPlatform = 'web-adapter';
document.documentElement.dataset.turnMotionLifecycle = 'platform-m5';
document.documentElement.dataset.turnDisplayLifecycle = 'platform-m6';

installStylesheet('./r104-polish.css', 'data-turn-r104-polish');
installStylesheet('./steering-limit-warning.css', 'data-turn-steering-limit-warning');
installStylesheet(
  './garage/lot-layout-r60.css?revision=r121-viewer-r122-fit-r128-super-sedan-notice-r129-race-button-fit',
  'data-turn-lot-layout-r121'
);
// Historical stylesheet bundle marker retained for the Trophy Road regression contract:
// trophy-road-r157.css?revision=r157-paint-monster
installStylesheet(
  './progression/trophy-road-r157.css?revision=r161-car-colour-lock',
  'data-turn-trophy-road'
);
const { prepareTrophyRoadProfile } = await import(
  withBuild('./progression/trophy-road.js?revision=r166-bella-records')
);
prepareTrophyRoadProfile();

const { installPerformanceProfile } = await import(withBuild('./performance-profile.js'));
installPerformanceProfile();

const { installCoveredRenderingGuard } = await import(withBuild('./render/covered-rendering.js'));
installCoveredRenderingGuard();

const { installDriveByEarSetting } = await import(
  withBuild('./ui/drive-by-ear-setting.js')
);
const driveByEarEnabled = installDriveByEarSetting();

const {
  prepareDriveByEarRuntime,
  ensureDriveByEarRuntime
} = await import(
  withBuild('./audio/drive-by-ear-runtime.js?revision=r143-temporary-audio-only')
);
await prepareDriveByEarRuntime();

// Runtime-loader regression markers. These operations now live in drive-by-ear-runtime.js,
// but their ordering relative to the central graph remains a production contract:
// organicRibbon = await import(withBuild('./audio/organic-ribbon.js'))
// organicRibbon.prepareOrganicRibbonCapture();
// recoveryGuidance = await import(withBuild('./audio/recovery-guidance.js'))
// recoveryGuidance.prepareRecoveryGuidanceCapture();
// paceNotePriority = await import(withBuild('./audio/pace-note-priority.js?revision=r123-final-hold'))
// paceNotePriority.preparePaceNotePriorityCapture();

globalThis.__turnDriveByEarEnabled = true;
const { installAudioPreferences } = await import(withBuild('./audio/audio-preferences.js'));
const audioPreferences = installAudioPreferences({ driveByEarGraphAvailable: driveByEarEnabled });

const { installTurnAudio } = await import(withBuild('./audio/audio-system.js'));
installTurnAudio();
audioPreferences.setDriveByEarEnabled(driveByEarEnabled);

// Runtime-loader regression markers for the post-graph wrapper order:
// organicRibbon.installOrganicRibbon();
// paceNotePriority.installPaceNotePriority();
// import(withBuild('./audio/driving-soundscape.js'))
// installUniversalDrivingSoundscape();
// import(withBuild('./audio/pace-notes.js?revision=r123-final-hold'))
// installPaceNotes();
// withBuild('./audio/offroad-ear-direction.js')
// installOffroadEarDirection();
// recoveryGuidance.installRecoveryGuidance();
// if (driveByEarEnabled) {
//   installUniversalDrivingSoundscape();
//   installPaceNotes();
// }

const { installSteeringLimitWarning } = await import(
  withBuild('./ui/steering-limit-warning.js')
);
installSteeringLimitWarning();

globalThis.__turnEnsureDriveByEarRuntime = ensureDriveByEarRuntime;
if (driveByEarEnabled) await ensureDriveByEarRuntime();

const { installAudioPreferenceRuntime } = await import(
  withBuild('./audio/audio-preference-runtime.js')
);
installAudioPreferenceRuntime();

const { installLapResultToast } = await import(withBuild('./ui/lap-result-toast.js'));
installLapResultToast();

const { installRivalOnboarding } = await import(withBuild('./ui/rival-onboarding.js'));
installRivalOnboarding();

// Historical regression marker for the established Super Sedan notice bundle:
// sports-sedan-easter-egg.js?revision=r128-unlock-notice
const { installSportsSedanEasterEggUi } = await import(
  withBuild('./vehicle/sports-sedan-easter-egg.js?revision=r157-hidden-achievements')
);
installSportsSedanEasterEggUi();

const { installHarborHiddenFaceOrientation } = await import(
  withBuild('./tracks/harbor-hidden-face-r89.js?revision=r157-hidden-achievements')
);
installHarborHiddenFaceOrientation();

// Historical regression markers for established Trophy Road Lot enhancement bundles:
// lot-enhancement-runtime.js?revision=r121&trophy-road=r154
// lot-enhancement-runtime.js?revision=r121&trophy-road=r157
const { installLotEnhancementRuntime } = await import(
  withBuild('./garage/lot-enhancement-runtime.js?revision=r121&trophy-road=r159&paint=r161-car-colour-lock&toast=r162-dismiss-unlocked-car')
);
installLotEnhancementRuntime();

await import(withBuild('./input/analog-gas.js'));
await import(withBuild('./ui/gameplay-controls.js'));
const { installRaceSpeech } = await import(withBuild('./ui/race-speech.js'));
installRaceSpeech();
const { installRacePositionLayout } = await import(withBuild('./ui/race-position-layout.js'));
installRacePositionLayout();
await import(withBuild('./main.js'));
document.documentElement.dataset.turnSessionLifecycle = 'orchestrator-m7';
globalThis.__turnRaceSession = globalThis.__turnNextRaceSession;

const { installWideGamutRuntime } = await import(
  withBuild('./vehicle/wide-gamut.js?revision=r157-display-p3')
);
installWideGamutRuntime(globalThis.__turnRuntime);

const { installTrackIntroCamera } = await import(
  withBuild('./render/track-intro-camera.js?revision=r133-midnight-downtown')
);
installTrackIntroCamera();

// Historical Bella world entry retained for the established achievement regression:
// render/world.js?revision=r166-bella-records
await Promise.all([
  import(withBuild('./render/world.js?revision=r174-bella-siren-zone')),
  import(withBuild('./ui/spectate.js')),
  import(withBuild('./ui/back-to-lot.js'))
]);

await import(withBuild('./ui/in-game-menu.js'));
const { installScreenBlanking } = await import(
  withBuild('./ui/screen-blanking.js?revision=r143-temporary-dbe-position')
);
installScreenBlanking(globalThis.__turnRuntime);
installStylesheet('./m8-home.css', 'data-turn-m8-home-styles');
installStylesheet(
  './m8-midnight-city-postcard-r130.css?revision=r130-neon-skyline',
  'data-turn-midnight-city-postcard'
);
installStylesheet(
  './m8-how-to-play-r126.css?revision=r141-form-disclosure',
  'data-turn-m8-how-to-play'
);
installStylesheet(
  './settings-components-r141.css?revision=r141-form-disclosure',
  'data-turn-settings-components'
);
installStylesheet('./rival-reset-context-r127.css', 'data-turn-rival-reset-context');
const { installM8HomeNavigation } = await import(
  withBuild('./m8-home.js?revision=r131-motion-permission-retry&trophy-road=r159')
);
const home = await installM8HomeNavigation();
globalThis.__turnHome = home;
motionPermissionCancelRecovery.resume(home, globalThis.__turnRuntime);
const { installHowToPlayGuide } = await import(
  withBuild('./ui/how-to-play-guide.js?revision=r141-form-disclosure')
);
installHowToPlayGuide();
const { installHomeRivalReset } = await import(
  withBuild('./ui/home-rival-reset.js?revision=r127-contextual')
);
installHomeRivalReset();
const buildLabel = document.querySelector('.m8-home-build');
if (buildLabel) {
  const release = globalThis.__TURN_BUILD__;
  buildLabel.textContent = `TURN V${release?.version || ''} · BUILD ${(release?.id || '').toUpperCase()}`;
}
// Historical regression marker for the paint and Monster Home bundle:
// m8-home-fixed-layout.js?revision=m8.9-track-title-alignment&trophy-road=r157
const { installM8HomeFixedLayout } = await import(
  withBuild('./m8-home-fixed-layout.js?revision=m8.9-track-title-alignment&trophy-road=r159&achievements=r166-bella-records&bella-rescue=r174-siren-zone')
);
await installM8HomeFixedLayout();
installStylesheet(
  './home-feedback-r135.css?revision=r137-feedback-above-fold',
  'data-turn-home-feedback'
);
const { installHomeFeedback } = await import(
  withBuild('./ui/home-feedback.js?revision=r137-feedback-above-fold')
);
installHomeFeedback();
installStylesheet(
  './m8-record-car-scale.css?revision=r124-balanced-crop',
  'data-turn-m8-record-car-scale'
);
document.documentElement.dataset.turnHomeLifecycle = 'home-m8';
await new Promise((resolve) => requestAnimationFrame(resolve));
startupCover.finish();
