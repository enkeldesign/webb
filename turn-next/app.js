// Generated from turn/app.js for TURN 2026.07.29-r118. Do not edit by hand.
const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';
const productionModuleBase = new URL('/turn/', globalThis.location?.href || 'https://enkel.design/turn-next/');
const platformModuleBase = new URL('/turn/platform/', globalThis.location?.href || 'https://enkel.design/turn-next/');
const stagingModuleBase = new URL('/turn-next/', globalThis.location?.href || 'https://enkel.design/turn-next/');

function withBuild(path) {
  const url = new URL(path, productionModuleBase);
  if (buildKey) url.searchParams.set('build', buildKey);
  return url.href;
}

const { createWebPlatform } = await import(new URL('./web-platform.js', platformModuleBase).href);
const { installTurnPlatform } = await import(new URL('./platform-context.js', platformModuleBase).href);
const { installMotionLifecycleBridge } = await import(
  new URL(`./motion-lifecycle-bridge.js?source=${buildKey}-m5.1`, stagingModuleBase).href
);
const { installDisplayLifecycleBridge } = await import(
  new URL(`./display-lifecycle-bridge.js?source=${buildKey}-m6`, stagingModuleBase).href
);
const webPlatform = createWebPlatform();
installTurnPlatform(webPlatform);
const motionLifecycle = installMotionLifecycleBridge({ platform: webPlatform });
const displayLifecycle = installDisplayLifecycleBridge({ platform: webPlatform });
globalThis.__turnNextMotionLifecycle = motionLifecycle;
globalThis.__turnNextDisplayLifecycle = displayLifecycle;
document.documentElement.dataset.turnPlatform = 'web-adapter';
document.documentElement.dataset.turnMotionLifecycle = 'platform-m5';
document.documentElement.dataset.turnDisplayLifecycle = 'platform-m6';
const turnNextBadgeDetail = document.querySelector('.turn-next-badge span');
if (turnNextBadgeDetail) turnNextBadgeDetail.textContent += ' · Platform M5–M8 · Motion + Display + Session + Home';

function installStylesheet(path, dataAttribute) {
  if (document.querySelector(`link[${dataAttribute}]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = withBuild(path);
  link.setAttribute(dataAttribute, '');
  document.head.appendChild(link);
}

installStylesheet('./r104-polish.css', 'data-turn-r104-polish');
installStylesheet('./steering-limit-warning.css', 'data-turn-steering-limit-warning');

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
  paceNotePriority = await import(withBuild('./audio/pace-note-priority.js'));
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

  const { installPaceNotes } = await import(withBuild('./audio/pace-notes.js'));
  installPaceNotes();

  const { installOffroadEarDirection } = await import(
    withBuild('./audio/offroad-ear-direction.js')
  );
  installOffroadEarDirection();

  // Recovery remains the outer wrapper. Its candidate frame is then checked against
  // the physical side of the nearest road point before reaching the central mixer.
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

const { installSportsSedanEasterEggUi } = await import(withBuild('./vehicle/sports-sedan-easter-egg.js'));
installSportsSedanEasterEggUi();

const { installHarborHiddenFaceOrientation } = await import(withBuild('./tracks/harbor-hidden-face-r89.js'));
installHarborHiddenFaceOrientation();

await import(withBuild('./input/analog-gas.js'));
await import(withBuild('./ui/gameplay-controls.js'));
const { installRaceSpeech } = await import(withBuild('./ui/race-speech.js'));
installRaceSpeech();
const { installRacePositionLayout } = await import(withBuild('./ui/race-position-layout.js'));
installRacePositionLayout();
await import(new URL(`./main.js?source=${buildKey}-m8`, stagingModuleBase).href);
document.documentElement.dataset.turnSessionLifecycle = 'orchestrator-m7';

await Promise.all([
  import(withBuild('./render/world.js')),
  import(withBuild('./ui/spectate.js')),
  import(withBuild('./ui/back-to-lot.js'))
]);

await import(withBuild('./ui/in-game-menu.js'));
const m8StyleAttribute = 'data-turn-m8-home-styles';
if (!document.querySelector(`link[${m8StyleAttribute}]`)) {
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL(`./m8-home.css?source=${buildKey}-m8`, stagingModuleBase).href;
  stylesheet.setAttribute(m8StyleAttribute, '');
  document.head.appendChild(stylesheet);
}
const { installM8HomeNavigation } = await import(
  new URL(`./m8-home.js?source=${buildKey}-m8`, stagingModuleBase).href
);
await installM8HomeNavigation();
const { installM8HomeFixedLayout } = await import(
  new URL(`./m8-home-fixed-layout.js?source=${buildKey}-m8.1`, stagingModuleBase).href
);
await installM8HomeFixedLayout();
document.documentElement.dataset.turnHomeLifecycle = 'home-m8';

console.info(`TURN NEXT: ${globalThis.__TURN_BUILD__?.id || 'development'} loaded through the isolated M8 staging bootstrap.`);