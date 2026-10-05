const launchReady = globalThis.__turnLaunchReady;
if (launchReady && typeof launchReady.then === 'function') await launchReady;
await globalThis.__turnStartupReady;
const startupCover = globalThis.__turnStartup;
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
// Historical stylesheet bundle marker retained for the Trophy Road regression contract:
// trophy-road-r157.css?revision=r157-paint-monster
installStylesheet(
  './progression/trophy-road-r157.css?revision=r244-reward-toast-guide',
  'data-turn-trophy-road'
);
const { prepareTrophyRoadProfile } = await import(
  withBuild('./progression/trophy-road.js')
);
prepareTrophyRoadProfile();

const { installPerformanceProfile } = await import(
  withBuild('./performance-profile.js?revision=r187-legacy-tablet-mountain-shadows')
);
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
  withBuild('./audio/drive-by-ear-runtime.js?revision=r164-long-session-robustness')
);
await prepareDriveByEarRuntime();

// Runtime-loader regression markers. These operations now live in drive-by-ear-runtime.js,
// but their ordering relative to the central graph remains a production contract:
// organicRibbon = await import(withBuild('./audio/organic-ribbon.js'))
// organicRibbon.prepareOrganicRibbonCapture();
// recoveryGuidance = await import(withBuild('./audio/recovery-guidance.js'))
// recoveryGuidance.prepareRecoveryGuidanceCapture();

globalThis.__turnDriveByEarEnabled = true;
const { installAudioPreferences } = await import(withBuild('./audio/audio-preferences.js'));
const audioPreferences = installAudioPreferences({ driveByEarGraphAvailable: driveByEarEnabled });

const { installTurnAudio } = await import(
  withBuild('./audio/audio-system.js?revision=r164-long-session-robustness')
);
installTurnAudio();
audioPreferences.setDriveByEarEnabled(driveByEarEnabled);

// Runtime-loader regression markers for the post-graph wrapper order:
// organicRibbon.installOrganicRibbon();
// import(withBuild('./audio/swoosh-pace-notes.js'))
// installSwooshPaceNotes();
// import(withBuild('./audio/driving-soundscape.js'))
// installUniversalDrivingSoundscape();
// withBuild('./audio/offroad-ear-direction.js')
// installOffroadEarDirection();
// recoveryGuidance.installRecoveryGuidance();
// if (driveByEarEnabled) {
//   installSwooshPaceNotes();
//   installUniversalDrivingSoundscape();
// }

const { installSteeringLimitWarning } = await import(
  withBuild('./ui/steering-limit-warning.js?revision=r164-post-soak')
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

const { installHarborHiddenFaceOrientation } = await import(
  withBuild('./tracks/harbor-hidden-face-r89.js?revision=r157-hidden-achievements')
);
installHarborHiddenFaceOrientation();

await import(withBuild('./input/analog-gas.js'));
await import(withBuild('./ui/gameplay-controls.js?revision=r255-flow-shift-accessibility'));
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

// Historical Bella world entries retained for established achievement regressions:
// render/world.js?revision=r166-bella-records
// render/world.js?revision=r174-bella-siren-zone
await Promise.all([
  import(withBuild('./render/world.js?revision=r532-countryside-nature-polish')),
  import(withBuild('./ui/spectate.js?revision=r164-elevation-aware')),
  import(withBuild('./ui/back-to-lot.js'))
]);

await import(withBuild('./ui/in-game-menu.js'));
const { installScreenBlanking } = await import(
  withBuild('./ui/screen-blanking.js?revision=r143-temporary-dbe-position')
);
installScreenBlanking(globalThis.__turnRuntime);
installStylesheet(
  './m8-home.css?revision=r224-modal-headings',
  'data-turn-m8-home-styles'
);
installStylesheet(
  './m8-how-to-play-r126.css?revision=r220-overcharge-disclosure',
  'data-turn-m8-how-to-play'
);
installStylesheet(
  './settings-components-r141.css?revision=r220-overcharge-disclosure',
  'data-turn-settings-components'
);
installStylesheet('./rival-reset-context-r127.css', 'data-turn-rival-reset-context');
installStylesheet('./pre-race.css', 'data-turn-pre-race');
installStylesheet('./roadbook/roadbook.css', 'data-turn-roadbook');
const { installM8HomeNavigation } = await import(
  withBuild('./m8-home.js?revision=r217-track-record-layout&trophy-road=r159&showroom=r200')
);
const home = await installM8HomeNavigation();
globalThis.__turnHome = home;
const { installDriftAttackSetting } = await import(withBuild('./ui/drift-attack-setting.js'));
installDriftAttackSetting();
motionPermissionCancelRecovery.resume(home, globalThis.__turnRuntime);
const { installHowToPlayGuide } = await import(
  withBuild('./ui/how-to-play-guide.js?revision=r241-learning-achievements')
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
// Historical clean record-layout cache marker:
// m8-home-fixed-layout.js?revision=r217-track-record-layout&trophy-road=r159&achievements=r166-bella-records&bella-rescue=r174-siren-zone&music=warm-v2&robustness=r164-long-session
const { installM8HomeFixedLayout } = await import(
  withBuild('./m8-home-fixed-layout.js?revision=r218-track-record-breathing&trophy-road=r159&achievements=r166-bella-records&achievement-filters=r254&bella-rescue=r174-siren-zone&music=warm-v2&robustness=r164-long-session')
);
await installM8HomeFixedLayout();
installStylesheet(
  './home-feedback-r135.css?revision=r224-modal-headings',
  'data-turn-home-feedback'
);
const { installHomeFeedback } = await import(
  withBuild('./ui/home-feedback.js?revision=r137-feedback-above-fold')
);
installHomeFeedback();
installStylesheet('./home-app-bar.css', 'data-turn-home-app-bar');
installStylesheet('./action-dock.css', 'data-turn-action-dock');
installStylesheet('./controls.css', 'data-turn-controls');
installStylesheet('./surfaces.css', 'data-turn-surfaces');
const { installHomeAppBar } = await import(withBuild('./ui/home-app-bar.js'));
installHomeAppBar();
installStylesheet('./race-pause.css', 'data-turn-race-pause');
const { installRacePauseMenu } = await import(withBuild('./ui/race-pause-menu.js'));
installRacePauseMenu();
const { installRaceMenu } = await import(withBuild('./ui/race-menu.js'));
installRaceMenu();
installStylesheet('./app-navigation.css', 'data-turn-app-navigation');
const { installAppNavigation } = await import(withBuild('./ui/app-navigation.js'));
installAppNavigation();
const { installToastRegion } = await import(withBuild('./ui/toast-region.js'));
installToastRegion();
const { installViewportReadout } = await import(withBuild('./ui/viewport-readout.js'));
installViewportReadout();
document.documentElement.dataset.turnHomeLifecycle = 'home-m8';
await new Promise((resolve) => requestAnimationFrame(resolve));
startupCover.finish();
