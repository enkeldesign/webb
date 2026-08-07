import * as THREE from 'three';
import { createYourTurnUi, escapeHtml } from '/yourturn/ui.js?revision=r3';
import { createYourTurnSession, readYourTurnRequest } from '/yourturn/session.js?revision=r3';

if (globalThis.__YOUR_TURN_STORAGE_READY__ === false) {
  throw new Error('YOUR TURN storage isolation failed before startup.');
}

const release = await loadTurnRelease();
globalThis.__TURN_BUILD__ = Object.freeze(release);
document.documentElement.dataset.yourTurnRuntime = 'recipient-r3';

function withBuild(path) {
  const url = new URL(path, globalThis.location?.href || 'https://enkel.design/yourturn/');
  if (release.cacheKey) url.searchParams.set('build', `${release.cacheKey}-yourturn-r3`);
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
const animation = installHardPauseController();

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

// TURN's production lifecycle bridge intentionally owns a single devicemotion
// subscription. YOUR TURN also samples motion briefly after the portrait → landscape
// transition before centering. Restore normal browser multi-listener semantics here so
// that sampling cannot replace the racing listener (which caused steering to disappear).
globalThis.__turnMotionLifecycle?.uninstall?.();

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

function installHardPauseController() {
  let paused = false;
  let pausedAt = 0;

  return Object.freeze({
    pause() {
      if (paused) return;
      paused = true;
      pausedAt = performance.now();

      // The canonical TURN loop already has a hard occlusion path for The Lot.
      // YOUR TURN has no Lot UI, so reusing that class gives us a tested frame-level
      // stop: no physics, replay movement or rendering advances behind our modal.
      document.body.classList.add('turn-lot-open', 'yourturn-runtime-paused');
      globalThis.__turnAudio?.silence?.();
    },

    resume() {
      if (!paused) return;
      const now = performance.now();
      const state = globalThis.__turnRuntime?.state;
      const pausedFor = Math.max(0, now - pausedAt);

      // A menu pause must not count against an active lap.
      if (state?.lapActive && Number.isFinite(state.lapStartedAt)) {
        state.lapStartedAt += pausedFor;
      }
      if (state) state.lastFrame = now;

      document.body.classList.remove('turn-lot-open', 'yourturn-runtime-paused');
      paused = false;
      pausedAt = 0;
    },

    isPaused: () => paused
  });
}
