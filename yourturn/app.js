import * as THREE from 'three';
import { trackPitch, trackSurfaceY } from '/turn/tracks/elevation.js?build=20260725-r67';
import { createYourTurnUi, escapeHtml } from '/yourturn/ui.js?revision=r3';
import { createYourTurnSession, readYourTurnRequest } from '/yourturn/session.js?revision=r3';

const PLAYER_START_LANE_OFFSET = 4.1;

if (globalThis.__YOUR_TURN_STORAGE_READY__ === false) {
  throw new Error('YOUR TURN storage isolation failed before startup.');
}

const release = await loadTurnRelease();
globalThis.__TURN_BUILD__ = Object.freeze(release);
document.documentElement.dataset.yourTurnRuntime = 'recipient-r5-canonical-motion';

function withBuild(path) {
  const url = new URL(path, globalThis.location?.href || 'https://enkel.design/yourturn/');
  if (release.cacheKey) url.searchParams.set('build', `${release.cacheKey}-yourturn-r593-canonical-motion`);
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

// Keep TURN's production motion lifecycle installed. YOUR TURN may orchestrate the
// challenge flow, but TURN alone owns the sensor subscription and steering state.
globalThis.__turnRaceSession = raceSession;
const { installWideGamutRuntime } = await import(withBuild('/turn/vehicle/wide-gamut.js?revision=r157-display-p3'));
installWideGamutRuntime(runtime);
await import(withBuild('/turn/render/world.js?revision=r175-bella-broad-rear-zone'));

const { installScreenBlanking } = await import(withBuild('/turn/ui/screen-blanking.js?revision=r143-temporary-dbe-position'));
installScreenBlanking(runtime);

const ui = createYourTurnUi();
const request = readYourTurnRequest();
const session = createYourTurnSession({ runtime, raceSession, ui, animation, request });
installStartLineFormationAdapter(runtime, () => session.getState());
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
      version: '1.10.4',
      id: '2026.08.23-r183',
      cacheKey: '20260823-r183'
    };
  }
}

function installStartLineFormationAdapter(runtime, getSessionState) {
  const downstreamSetSceneOverride = runtime.setSceneOverride.bind(runtime);
  let formation = null;

  window.addEventListener('turn:ui-state-change', (event) => {
    if (event.detail?.reason === 'race-reset') formation = null;
  });

  runtime.setSceneOverride = (override) => {
    if (typeof override !== 'function') {
      formation = null;
      downstreamSetSceneOverride(override);
      return;
    }

    downstreamSetSceneOverride((dt) => {
      const sessionState = getSessionState?.();
      const staged = sessionState?.phase === 'staged'
        && !runtime.state.lapActive
        && document.body.classList.contains('yourturn-racing');

      if (staged) {
        formation = ensureStartFormation(runtime, sessionState.challengeLap, formation);
        preparePlayerStartLane(runtime, formation);
      }

      const handled = override(dt);
      if (staged && handled && formation) placeOpponentBeforeStart(runtime, formation, dt);
      return handled;
    });
  };
}

function ensureStartFormation(runtime, challengeLap, previous) {
  if (!challengeLap?.frames?.length) return null;
  if (previous?.challengeLap === challengeLap) return previous;

  return {
    challengeLap,
    startFrame: challengeLap.frames[0],
    distanceToStart: buildDistanceToStart(runtime.samples),
    playerSide: preferredPlayerSide(runtime.samples),
    playerPlaced: false,
    rivalDistance: Infinity
  };
}

function preparePlayerStartLane(runtime, formation) {
  if (!formation || formation.playerPlaced) return;
  const { state, samples } = runtime;
  const nearest = runtime.findNearestTrack(state.position);
  const normal = nearest.sample.normal || normalFromTangent(nearest.sample.tangent);

  // The recorded lap begins exactly on the canonical start line. Give that line to
  // the challenger and put the recipient beside it so the two cars do not overlap.
  state.position.addScaledVector(normal, PLAYER_START_LANE_OFFSET * formation.playerSide);
  const settled = runtime.findNearestTrack(state.position);
  state.position.y = trackSurfaceY(settled.sample);
  state.surfacePitch = trackPitch(settled.sample);
  state.nearestTrackIndex = settled.index;
  state.trackDistance = settled.distance;
  state.progress = settled.index / Math.max(1, samples.length);
  state.lastProgress = state.progress;
  state.lapPreviousPosition = { x: state.position.x, z: state.position.z };

  formation.rivalDistance = distanceToStartAtPosition(
    runtime,
    formation.distanceToStart,
    state.position
  );
  formation.playerPlaced = true;
}

function placeOpponentBeforeStart(runtime, formation, dt) {
  const opponentCar = runtime.competitorCars[0];
  if (!opponentCar) return;

  const playerDistance = distanceToStartAtPosition(
    runtime,
    formation.distanceToStart,
    runtime.state.position
  );

  // Ratchet toward the line: backing away never drags the challenger backwards.
  // Once the player gets closer than the challenger, both keep the same remaining
  // distance so the challenger arrives exactly at its recorded t=0 pose.
  formation.rivalDistance = Math.min(formation.rivalDistance, playerDistance);
  const pose = poseBeforeStart(
    runtime.samples,
    formation.distanceToStart,
    formation.rivalDistance,
    formation.startFrame
  );
  const surfaceSample = runtime.findNearestTrack(pose).sample;

  opponentCar.visible = true;
  opponentCar.position.set(pose.x, trackSurfaceY(surfaceSample), pose.z);
  opponentCar.rotation.x = trackPitch(surfaceSample);
  opponentCar.rotation.y = pose.h + Math.PI;
  opponentCar.rotation.z = 0;
  runtime.animateWheels(opponentCar, 0, Math.max(0, runtime.state.speed), dt);
}

function buildDistanceToStart(samples) {
  const distances = new Array(samples.length).fill(0);
  let distance = 0;
  for (let index = samples.length - 1; index >= 1; index -= 1) {
    const current = samples[index].point;
    const next = samples[(index + 1) % samples.length].point;
    distance += current.distanceTo(next);
    distances[index] = distance;
  }
  return distances;
}

function distanceToStartAtPosition(runtime, distances, position) {
  const nearest = runtime.findNearestTrack(position);
  const index = nearest.index;
  if (index === 0) return 0;

  const sample = nearest.sample;
  const dx = position.x - sample.point.x;
  const dz = position.z - sample.point.z;
  const alongTrack = dx * sample.tangent.x + dz * sample.tangent.z;
  return Math.max(0, (distances[index] || 0) - alongTrack);
}

function poseBeforeStart(samples, distances, requestedDistance, startFrame) {
  const distance = Math.max(0, Number(requestedDistance) || 0);
  const startHeading = Number.isFinite(startFrame?.h)
    ? startFrame.h
    : Math.atan2(samples[0].tangent.x, samples[0].tangent.z);

  if (distance <= 0.01) {
    return {
      x: Number.isFinite(startFrame?.x) ? startFrame.x : samples[0].point.x,
      z: Number.isFinite(startFrame?.z) ? startFrame.z : samples[0].point.z,
      h: startHeading
    };
  }

  let behindIndex = samples.length - 1;
  while (behindIndex > 1 && distances[behindIndex] < distance) behindIndex -= 1;
  const aheadIndex = (behindIndex + 1) % samples.length;
  const behindDistance = distances[behindIndex] || distance;
  const aheadDistance = aheadIndex === 0 ? 0 : (distances[aheadIndex] || 0);
  const span = Math.max(0.001, behindDistance - aheadDistance);
  const alpha = clamp((behindDistance - distance) / span, 0, 1);
  const behind = samples[behindIndex];
  const ahead = samples[aheadIndex];
  const aheadX = aheadIndex === 0 && Number.isFinite(startFrame?.x)
    ? startFrame.x
    : ahead.point.x;
  const aheadZ = aheadIndex === 0 && Number.isFinite(startFrame?.z)
    ? startFrame.z
    : ahead.point.z;
  const behindHeading = Math.atan2(behind.tangent.x, behind.tangent.z);
  const aheadHeading = aheadIndex === 0
    ? startHeading
    : Math.atan2(ahead.tangent.x, ahead.tangent.z);

  return {
    x: lerp(behind.point.x, aheadX, alpha),
    z: lerp(behind.point.z, aheadZ, alpha),
    h: lerpAngle(behindHeading, aheadHeading, alpha)
  };
}

function preferredPlayerSide(samples) {
  if (samples.length < 2) return 1;
  const start = samples[0].tangent;
  const ahead = samples[Math.min(samples.length - 1, 24)].tangent;
  const signedTurn = start.x * ahead.z - start.z * ahead.x;
  if (Math.abs(signedTurn) < 0.001) return 1;

  // Use the outside of the first bend when there is a clear choice.
  return signedTurn < 0 ? 1 : -1;
}

function normalFromTangent(tangent) {
  return new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpAngle(a, b, t) {
  let delta = b - a;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * t;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function installHardPauseController() {
  let paused = false;
  let pausedAt = 0;

  function pause() {
    if (paused) return;
    paused = true;
    pausedAt = performance.now();

    // The canonical TURN loop already has a hard occlusion path for The Lot.
    // YOUR TURN has no Lot UI, so reusing that class gives us a tested frame-level
    // stop: no physics, replay movement or rendering advances behind our modal.
    document.body.classList.add('turn-lot-open', 'yourturn-runtime-paused');
    globalThis.__turnAudio?.silence?.();
  }

  function resume() {
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
  }

  return Object.freeze({
    pause,
    resume,
    isPaused: () => paused
  });
}
