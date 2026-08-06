import * as THREE from 'three';
import { signalSecretAchievement } from '../achievements/secret-events.js?revision=r166-bella-records';

const SAVE_BELLA_ID = 'save-bella';
const REQUIRED_VEHICLE_ID = 'firetruck';
const MEOW_RANGE_METERS = 108;
const MEOW_CLOSE_METERS = 24;
const MEOW_MIN_INTERVAL_MS = 2400;
const MEOW_MAX_INTERVAL_MS = 5600;
const UPDATE_INTERVAL_MS = 160;
const RESCUE_SIREN_HOLD_MS = 320;

// Bella's root is rotated so local +Z points back towards the road. The rescue area
// therefore occupies only negative local Z: the broad clearing behind the tree shown
// to the player. It is approximately seven Fire-Truck lengths wide and six long.
const RESCUE_ZONE = Object.freeze({
  halfWidth: 22,
  nearZ: -1.5,
  farZ: -36
});

// Local to the dedicated rescue-tree group, beside the trunk and on the same protected
// scenery patch as the rescue zone. Bella remains stationary because the source has no
// walking animation.
const SAFE_GROUND_POSITION = Object.freeze({ x: 4.8, y: 0.08, z: -3.2 });

const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
let meowContext = null;

function activeTrackId(runtime) {
  return String(
    runtime?.state?.trackId
    || runtime?.trackId
    || globalThis.__turnGetTrackId?.()
    || ''
  ).toLowerCase();
}

function savedInProfile() {
  return globalThis.__turnAchievements?.store?.isUnlocked?.(SAVE_BELLA_ID) === true;
}

function playerPosition(runtime) {
  return runtime?.playerCar?.position || runtime?.state?.position || null;
}

function horizontalDistance(a, b) {
  return Math.hypot(
    Number(a?.x || 0) - Number(b?.x || 0),
    Number(a?.z || 0) - Number(b?.z || 0)
  );
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function spatialPan(runtime, player, target) {
  const dx = Number(target?.x || 0) - Number(player?.x || 0);
  const dz = Number(target?.z || 0) - Number(player?.z || 0);
  const length = Math.hypot(dx, dz);
  if (length < 0.001) return 0;

  const right = runtime?.getRight?.();
  if (right) {
    return clamp((dx / length) * Number(right.x || 0) + (dz / length) * Number(right.z || 0), -1, 1);
  }

  const heading = Number(runtime?.state?.heading) || 0;
  return clamp((dx / length) * Math.cos(heading) - (dz / length) * Math.sin(heading), -1, 1);
}

function otherSoundPreference() {
  const settings = globalThis.__turnAudioPreferences?.getSettings?.();
  if (settings?.audioEnabled === false) return 0;
  const balance = Number.isFinite(Number(settings?.balance)) ? Number(settings.balance) : 0.5;
  return balance > 0.5 ? clamp((1 - balance) / 0.5, 0, 1) : 1;
}

function ensureMeowContext() {
  if (!AudioContextClass) return null;
  if (!meowContext) {
    try {
      meowContext = new AudioContextClass({ latencyHint: 'interactive' });
    } catch (_) {
      meowContext = new AudioContextClass();
    }
  }
  if (meowContext.state === 'suspended') void meowContext.resume().catch(() => {});
  return meowContext;
}

function unlockMeowContext() {
  ensureMeowContext();
}

function scheduleMeow({ pan = 0, intensity = 0.5, rescued = false } = {}) {
  const preference = otherSoundPreference();
  const context = ensureMeowContext();
  if (!context || context.state !== 'running' || preference <= 0.001) return false;

  const now = context.currentTime + 0.012;
  const level = (0.018 + clamp(intensity, 0, 1) * 0.022) * preference;
  const duration = rescued ? 0.46 : 0.54;
  const panner = typeof context.createStereoPanner === 'function'
    ? context.createStereoPanner()
    : context.createGain();
  if (panner.pan) panner.pan.setValueAtTime(clamp(pan, -1, 1), now);

  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(level, now + 0.035);
  gain.gain.setValueAtTime(level * 0.86, now + 0.16);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  const voice = context.createOscillator();
  voice.type = 'sine';
  voice.frequency.setValueAtTime(rescued ? 570 : 520, now);
  voice.frequency.exponentialRampToValueAtTime(rescued ? 820 : 760, now + 0.13);
  voice.frequency.exponentialRampToValueAtTime(rescued ? 490 : 405, now + duration);

  const formant = context.createOscillator();
  const formantGain = context.createGain();
  formant.type = 'triangle';
  formant.frequency.setValueAtTime(rescued ? 1140 : 1040, now);
  formant.frequency.exponentialRampToValueAtTime(rescued ? 1640 : 1520, now + 0.13);
  formant.frequency.exponentialRampToValueAtTime(rescued ? 980 : 810, now + duration);
  formantGain.gain.value = 0.22;

  voice.connect(gain);
  formant.connect(formantGain);
  formantGain.connect(gain);
  gain.connect(panner);
  panner.connect(context.destination);

  const stopAt = now + duration + 0.03;
  voice.start(now);
  formant.start(now);
  voice.stop(stopAt);
  formant.stop(stopAt);
  voice.addEventListener('ended', () => {
    voice.disconnect();
    formant.disconnect();
    formantGain.disconnect();
    gain.disconnect();
    panner.disconnect();
  }, { once: true });
  return true;
}

function moveBellaToGround(root, { announce = false } = {}) {
  if (!root || root.userData.turnBellaRescued) return false;
  const cat = root.userData.turnBellaFocus;
  if (!cat) return false;

  cat.position.set(SAFE_GROUND_POSITION.x, SAFE_GROUND_POSITION.y, SAFE_GROUND_POSITION.z);
  cat.name = 'Bella safe on the ground';
  cat.userData.turnBellaState = 'rescued-stationary';
  root.userData.turnBellaRescued = true;
  root.userData.turnBellaRescueState = Object.freeze({
    position: 'protected ground beside the rescue tree',
    movement: 'stationary',
    sourceAnimationClips: 0,
    reason: 'The pinned Kenney Cube Pets cat contains no animation section or walking clip.',
    trackSafety: 'Fixed scenery-local position inside the rescue patch; Bella cannot enter the road.'
  });
  cat.updateMatrixWorld(true);
  root.updateMatrixWorld(true);

  if (announce) scheduleMeow({ pan: 0, intensity: 0.72, rescued: true });
  return true;
}

function insideRescueZone(root, player, localPosition) {
  root.updateWorldMatrix(true, false);
  localPosition.copy(player);
  root.worldToLocal(localPosition);
  return Math.abs(localPosition.x) <= RESCUE_ZONE.halfWidth
    && localPosition.z <= RESCUE_ZONE.nearZ
    && localPosition.z >= RESCUE_ZONE.farZ;
}

export function installBellaRescueBehavior({ root, runtime = globalThis.__turnRuntime } = {}) {
  if (!root || root.userData.turnBellaRescueBehaviorInstalled) return root || null;
  const cat = root.userData.turnBellaFocus;
  if (!cat) return root;
  root.userData.turnBellaRescueBehaviorInstalled = true;

  document.addEventListener('pointerdown', unlockMeowContext, { capture: true, passive: true });
  document.addEventListener('keydown', unlockMeowContext, { capture: true });

  let lastMeowAt = -Infinity;
  let wasInRange = false;
  let rescueSirenStartedAt = null;
  let disposed = false;
  const bellaWorldPosition = new THREE.Vector3();
  const rescueLocalPosition = new THREE.Vector3();

  function rescueFromStoredAchievement({ announce = false } = {}) {
    moveBellaToGround(root, { announce });
  }

  function completeInteractiveRescue(player) {
    // Move Bella first. The achievement signal is emitted only after the visual state is
    // already correct, so the toast and the cat can never disagree again.
    if (!moveBellaToGround(root, { announce: true })) return false;
    root.userData.turnSecretAchievementFound = true;
    signalSecretAchievement(SAVE_BELLA_ID, {
      trackId: 'countryside',
      vehicleId: REQUIRED_VEHICLE_ID,
      rescueConfirmed: true,
      rescueMethod: 'fire-truck-siren-zone',
      rescuePosition: {
        x: Number(player?.x || 0),
        z: Number(player?.z || 0)
      }
    });
    return true;
  }

  function handleSecretAchievement(event) {
    if (event.detail?.achievementId === SAVE_BELLA_ID) rescueFromStoredAchievement({ announce: true });
  }

  function handleAchievementUpdate(event) {
    if (event.detail?.unlocked?.includes?.(SAVE_BELLA_ID)) rescueFromStoredAchievement({ announce: true });
  }

  function sample() {
    if (disposed) return;
    if (savedInProfile()) rescueFromStoredAchievement();
    if (root.userData.turnBellaRescued) return;

    const state = runtime?.state;
    const player = playerPosition(runtime);
    const eligible = state?.running === true
      && activeTrackId(runtime) === 'countryside'
      && state.vehicleId === REQUIRED_VEHICLE_ID
      && player;
    if (!eligible || document.hidden) {
      wasInRange = false;
      rescueSirenStartedAt = null;
      return;
    }

    const now = performance.now();
    const inRescueZone = insideRescueZone(root, player, rescueLocalPosition);
    const sirenActive = globalThis.__turnBoostActive === true;
    if (inRescueZone && sirenActive) {
      if (rescueSirenStartedAt == null) rescueSirenStartedAt = now;
      if (now - rescueSirenStartedAt >= RESCUE_SIREN_HOLD_MS) {
        completeInteractiveRescue(player);
        return;
      }
    } else {
      rescueSirenStartedAt = null;
    }

    cat.getWorldPosition(bellaWorldPosition);
    const distance = horizontalDistance(player, bellaWorldPosition);
    const inRange = distance <= MEOW_RANGE_METERS;
    if (!inRange) {
      wasInRange = false;
      return;
    }

    const proximity = clamp(
      1 - (distance - MEOW_CLOSE_METERS) / (MEOW_RANGE_METERS - MEOW_CLOSE_METERS),
      0,
      1
    );
    const interval = MEOW_MAX_INTERVAL_MS
      - proximity * (MEOW_MAX_INTERVAL_MS - MEOW_MIN_INTERVAL_MS);
    const enteringRange = !wasInRange;
    wasInRange = true;
    if (!enteringRange && now - lastMeowAt < interval) return;

    const played = scheduleMeow({
      pan: spatialPan(runtime, player, bellaWorldPosition),
      intensity: 0.35 + proximity * 0.65
    });
    if (played) lastMeowAt = now;
  }

  globalThis.addEventListener('turn:secret-achievement', handleSecretAchievement);
  globalThis.addEventListener('turn:achievements-updated', handleAchievementUpdate);
  const timer = window.setInterval(sample, UPDATE_INTERVAL_MS);

  root.userData.turnBellaRescueZone = Object.freeze({
    shape: 'rear clearing rectangle',
    widthMeters: RESCUE_ZONE.halfWidth * 2,
    lengthMeters: Math.abs(RESCUE_ZONE.farZ - RESCUE_ZONE.nearZ),
    localBounds: Object.freeze({
      minX: -RESCUE_ZONE.halfWidth,
      maxX: RESCUE_ZONE.halfWidth,
      nearZ: RESCUE_ZONE.nearZ,
      farZ: RESCUE_ZONE.farZ
    }),
    requiredVehicle: 'Fire Truck',
    requiredAction: 'Hold Boost to sound the siren',
    sirenHoldMs: RESCUE_SIREN_HOLD_MS,
    trackSafety: 'Only negative local Z is eligible; the track-facing side of the tree is excluded.'
  });
  root.userData.turnBellaMeowAccessibility = Object.freeze({
    vehicle: 'Fire Truck',
    rangeMeters: MEOW_RANGE_METERS,
    directional: true,
    cadence: 'Meows repeat more often as the Fire Truck approaches.',
    availability: 'Other-sounds preference and global audio setting are respected.'
  });
  root.userData.turnBellaDisposeRescueBehavior = () => {
    if (disposed) return;
    disposed = true;
    window.clearInterval(timer);
    globalThis.removeEventListener('turn:secret-achievement', handleSecretAchievement);
    globalThis.removeEventListener('turn:achievements-updated', handleAchievementUpdate);
    document.removeEventListener('pointerdown', unlockMeowContext, { capture: true });
    document.removeEventListener('keydown', unlockMeowContext, { capture: true });
  };

  sample();
  return root;
}
