const launchReady = globalThis.__turnLaunchReady;
if (launchReady && typeof launchReady.then === 'function') {
  await launchReady;
}

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
const { installMotionPermissionCancelRecovery } = await import(
  withBuild('./ui/motion-permission-cancel-recovery.js?revision=r132-fresh-document')
);
const motionPermissionCancelRecovery = installMotionPermissionCancelRecovery();
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

const { installPerformanceProfile } = await import(withBuild('./performance-profile.js'));
installPerformanceProfile();

const { installCoveredRenderingGuard } = await import(withBuild('./render/covered-rendering.js'));
installCoveredRenderingGuard();

const { installDriveByEarSetting } = await import(
  withBuild('./ui/drive-by-ear-setting.js')
);
const driveByEarEnabled = installDriveByEarSetting();

let organicRibbon = null;
let recoveryGuidance = null;
if (driveByEarEnabled) {
  organicRibbon = await import(withBuild('./audio/organic-ribbon.js'));
  organicRibbon.prepareOrganicRibbonCapture();

  recoveryGuidance = await import(withBuild('./audio/recovery-guidance.js'));
  recoveryGuidance.prepareRecoveryGuidanceCapture();
}

let paceNotePriority = null;
if (driveByEarEnabled) {
  paceNotePriority = await import(
    withBuild('./audio/pace-note-priority.js?revision=r123-final-hold')
  );
  paceNotePriority.preparePaceNotePriorityCapture();
}

const { installAudioPreferences } = await import(withBuild('./audio/audio-preferences.js'));
installAudioPreferences({ driveByEarGraphAvailable: driveByEarEnabled });

const { installTurnAudio } = await import(withBuild('./audio/audio-system.js'));
installTurnAudio();

const { installSteeringLimitWarning } = await import(
  withBuild('./ui/steering-limit-warning.js')
);
installSteeringLimitWarning();

if (driveByEarEnabled) {
  organicRibbon.installOrganicRibbon();
  paceNotePriority.installPaceNotePriority();

  const { installUniversalDrivingSoundscape } = await import(
    withBuild('./audio/driving-soundscape.js')
  );
  installUniversalDrivingSoundscape();

  const { installPaceNotes } = await import(
    withBuild('./audio/pace-notes.js?revision=r123-final-hold')
  );
  installPaceNotes();

  const { installOffroadEarDirection } = await import(
    withBuild('./audio/offroad-ear-direction.js')
  );
  installOffroadEarDirection();

  recoveryGuidance.installRecoveryGuidance();
}

const { installAudioPreferenceRuntime } = await import(
  withBuild('./audio/audio-preference-runtime.js')
);
installAudioPreferenceRuntime();

const { installLapResultToast } = await import(withBuild('./ui/lap-result-toast.js'));
installLapResultToast();

const { installRivalOnboarding } = await import(withBuild('./ui/rival-onboarding.js'));
installRivalOnboarding();

const { installSportsSedanEasterEggUi } = await import(
  withBuild('./vehicle/sports-sedan-easter-egg.js?revision=r128-unlock-notice')
);
installSportsSedanEasterEggUi();

const { installHarborHiddenFaceOrientation } = await import(withBuild('./tracks/harbor-hidden-face-r89.js'));
installHarborHiddenFaceOrientation();

const { installLotEnhancementRuntime } = await import(
  withBuild('./garage/lot-enhancement-runtime.js?revision=r121')
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

const { installTrackIntroCamera } = await import(
  withBuild('./render/track-intro-camera.js?revision=r133-midnight-downtown')
);
installTrackIntroCamera();

await Promise.all([
  import(withBuild('./render/world.js')),
  import(withBuild('./ui/spectate.js')),
  import(withBuild('./ui/back-to-lot.js'))
]);

await import(withBuild('./ui/in-game-menu.js'));
installStylesheet('./m8-home.css', 'data-turn-m8-home-styles');
installStylesheet(
  './m8-midnight-city-postcard-r130.css?revision=r130-neon-skyline',
  'data-turn-midnight-city-postcard'
);
installStylesheet('./m8-how-to-play-r126.css', 'data-turn-m8-how-to-play');
installStylesheet('./rival-reset-context-r127.css', 'data-turn-rival-reset-context');
const { installM8HomeNavigation } = await import(
  withBuild('./m8-home.js?revision=r131-motion-permission-retry')
);
const home = await installM8HomeNavigation();
globalThis.__turnHome = home;
motionPermissionCancelRecovery.resume(home, globalThis.__turnRuntime);
const { installHowToPlayGuide } = await import(
  withBuild('./ui/how-to-play-guide.js?revision=r127-full-name')
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
const { installM8HomeFixedLayout } = await import(
  withBuild('./m8-home-fixed-layout.js?revision=m8.9-track-title-alignment')
);
await installM8HomeFixedLayout();
installStylesheet(
  './m8-record-car-scale.css?revision=r124-balanced-crop',
  'data-turn-m8-record-car-scale'
);
document.documentElement.dataset.turnHomeLifecycle = 'home-m8';
