import * as THREE from 'three';
import { createYourTurnUi, escapeHtml } from '/yourturn/ui.js?revision=r1';
import { createYourTurnSession, readYourTurnRequest } from '/yourturn/session.js?revision=r1';

if (globalThis.__YOUR_TURN_STORAGE_READY__ === false) {
  throw new Error('YOUR TURN storage isolation failed before startup.');
}

const animation = installAnimationPauseBridge(THREE);
const release = await loadTurnRelease();
globalThis.__TURN_BUILD__ = Object.freeze(release);
document.documentElement.dataset.yourTurnRuntime = 'recipient-r1';

function withBuild(path) {
  const url = new URL(path, globalThis.location?.href || 'https://enkel.design/yourturn/');
  if (release.cacheKey) url.searchParams.set('build', `${release.cacheKey}-yourturn-r1`);
  return url.href;
}

const { createWebPlatform } = await import(withBuild('/turn/platform/web-platform.js'));
const { installTurnPlatform } = await import(withBuild('/turn/platform/platform-context.js'));
const { installMotionLifecycleBridge } = await import(withBuild('/turn/motion-lifecycle-bridge.js'));
const { installDisplayLifecycleBridge } = await import(withBuild('/turn/display-lifecycle-bridge.js'));
const webPlatform = createWebPlatform();
installTurnPlatform(webPlatform);
globalThis.__turnMotionLifecycle = installMotionLifecycleBridge({ platform: webPlatform });
globalThis.__turnDisplayLifecycle = installDisplayLifecycleBridge({ platform: webPlatform });
document.documentElement.dataset.turnPlatform = 'web-adapter';

const { installPerformanceProfile } = await import(withBuild('/turn/performance-profile.js'));
installPerformanceProfile();
const { installCoveredRenderingGuard } = await import(withBuild('/turn/render/covered-rendering.js'));
installCoveredRenderingGuard();

const { installDriveByEarSetting } = await import(withBuild('/turn/ui/drive-by-ear-setting.js'));
const driveByEarEnabled = installDriveByEarSetting();
const {
  prepareDriveByEarRuntime,
  ensureDriveByEarRuntime
} = await import(withBuild('/turn/audio/drive-by-ear-runtime.js?revision=r143-temporary-audio-only'));
await prepareDriveByEarRuntime();
globalThis.__turnDriveByEarEnabled = driveByEarEnabled !== false;

const { installAudioPreferences } = await import(withBuild('/turn/audio/audio-preferences.js'));
const audioPreferences = installAudioPreferences({ driveByEarGraphAvailable: driveByEarEnabled });
const { installTurnAudio } = await import(withBuild('/turn/audio/audio-system.js'));
installTurnAudio();
audioPreferences.setDriveByEarEnabled(driveByEarEnabled !== false);

globalThis.__turnEnsureDriveByEarRuntime = ensureDriveByEarRuntime;
if (driveByEarEnabled !== false) await ensureDriveByEarRuntime();
const { installAudioPreferenceRuntime } = await import(withBuild('/turn/audio/audio-preference-runtime.js'));
installAudioPreferenceRuntime();

const { installSteeringLimitWarning } = await import(withBuild('/turn/ui/steering-limit-warning.js'));
installSteeringLimitWarning();

await import(withBuild('/turn/input/analog-gas.js'));
await import(withBuild('/turn/ui/gameplay-controls.js'));
const { installRaceSpeech } = await import(withBuild('/turn/ui/race-speech.js'));
installRaceSpeech();
const { installRacePositionLayout } = await import(withBuild('/turn/ui/race-position-layout.js'));
installRacePositionLayout();
const { installLapResultToast } = await import(withBuild('/turn/ui/lap-result-toast.js'));
installLapResultToast();

await import(withBuild('/turn/main.js'));
const runtime = globalThis.__turnRuntime;
const raceSession = globalThis.__turnNextRaceSession;
if (!runtime || !raceSession) throw new Error('TURN racing runtime did not become available.');

globalThis.__turnRaceSession = raceSession;
const { installWideGamutRuntime } = await import(withBuild('/turn/vehicle/wide-gamut.js?revision=r157-display-p3'));
installWideGamutRuntime(runtime);
await import(withBuild('/turn/render/world.js?revision=r175-bella-broad-rear-zone'));

const { installScreenBlanking } = await import(withBuild('/turn/ui/screen-blanking.js?revision=r143-temporary-dbe-position'));
installScreenBlanking(runtime);

const ui = createYourTurnUi();
const request = readYourTurnRequest();
const session = createYourTurnSession({ runtime, raceSession, ui, animation, request });
globalThis.__yourTurnSession = session;
document.querySelector('#yourTurnLoading')?.setAttribute('hidden', '');

try {
  await session.launch();
} catch (error) {
  console.error('YOUR TURN could not open the challenge.', error);
  document.body.classList.add('yourturn-active');
  ui.hideRaceChrome();
  ui.hideRotate();
  ui.showModal({
    titleText: 'CHALLENGE UNAVAILABLE',
    copyHtml: escapeHtml(error instanceof Error ? error.message : 'This challenge could not be opened.'),
    className: 'error',
    actionList: [
      { label: 'TRY A MOCK CHALLENGE', primary: true, action: () => { globalThis.location.href = '/yourturn/'; } },
      { label: 'OPEN TURN', navigation: true, action: () => { globalThis.location.href = '/turn/'; } }
    ]
  });
}

async function loadTurnRelease() {
  try {
    const response = await fetch('/turn/release.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`TURN release metadata returned ${response.status}.`);
    const value = await response.json();
    if (!value?.version || !value?.id || !value?.cacheKey) throw new Error('TURN release metadata is incomplete.');
    return value;
  } catch (error) {
    console.warn('YOUR TURN: using bundled TURN release fallback.', error);
    return {
      version: '1.5.2',
      id: '2026.08.06-r161',
      cacheKey: '20260806-r161'
    };
  }
}

function installAnimationPauseBridge(three) {
  const prototype = three.WebGLRenderer.prototype;
  const nativeSetAnimationLoop = prototype.setAnimationLoop;
  let renderer = null;
  let loop = null;
  let paused = false;

  prototype.setAnimationLoop = function setAnimationLoop(callback) {
    renderer = this;
    if (typeof callback === 'function') loop = callback;
    if (callback === null) loop = null;
    return nativeSetAnimationLoop.call(this, paused ? null : callback);
  };

  return Object.freeze({
    pause() {
      paused = true;
      if (renderer) nativeSetAnimationLoop.call(renderer, null);
    },
    resume() {
      if (!paused && renderer && loop) {
        nativeSetAnimationLoop.call(renderer, loop);
        return;
      }
      paused = false;
      if (renderer && loop) nativeSetAnimationLoop.call(renderer, loop);
    },
    isPaused: () => paused
  });
}
