import * as THREE from 'three';
import { GAME_MODE } from '/turn/race/game-state.js?build=20260805-r160';
import {
  RIVAL_LIMIT,
  saveRivalsState,
  syncPrimaryRivalState
} from '/turn/race/rival-storage.js?build=20260805-r160';
import { activateTrack } from '/turn/tracks/track-manager.js?build=20260805-r160';
import { getTrackDefinition } from '/turn/tracks/catalog.js?build=20260805-r160';
import { getTrackStorageRevision } from '/turn/tracks/definitions.js?build=20260805-r160';
import {
  getCarDefinition,
  saveVehicleSelection
} from '/turn/vehicle/catalog.js?build=20260805-r160';
import {
  decodeChallenge,
  encodedChallengeFromLocation,
  formatChallengeTime,
  normalizeChallenge,
  normalizeChallengeName
} from '/turn-next/challenge-codec.js?revision=r182-race-my-ghost';
import { createChallengeScene } from '/turn-next/challenge-scene.js?revision=r182-race-my-ghost';
import {
  escapeHtml,
  hideHomeAndRaceUi,
  showRaceUi
} from '/turn-next/challenge-ui.js?revision=r182-race-my-ghost';
import {
  shareGiveUpReply,
  shareWinningReply
} from '/turn-next/challenge-sharing.js?revision=r182-race-my-ghost';

const STEERING_MODE_KEY = 'turn-steering-mode-v1';
const BUILT_IN_CHALLENGES = Object.freeze({
  'sol-countryside-r1': Object.freeze({
    challengerName: 'SOL',
    trackId: 'countryside',
    time: 65,
    carId: 'sedan-sports',
    carColor: '#ff4fa3',
    carSecondaryColor: '#252a35'
  })
});

export function readChallengeRequest(locationRef = globalThis.location) {
  const query = new URLSearchParams(locationRef?.search || '');
  const builtInId = query.get('challenge') || '';
  const encoded = encodedChallengeFromLocation(locationRef);
  return Object.freeze({
    builtInId,
    encoded,
    reply: query.get('reply') === 'give-up' ? 'give-up' : '',
    responder: normalizeChallengeName(query.get('responder'), 'A TURN PLAYER'),
    hasChallenge: Boolean(builtInId || encoded)
  });
}

export function createChallengeSession({ runtime, raceSession, ui, request }) {
  const state = {
    active: false,
    accepted: false,
    phase: 'idle',
    challenge: null,
    challengeLap: null,
    personalRivals: [],
    previousVehicle: null,
    winningLap: null,
    scene: null
  };

  window.addEventListener('pagehide', restorePreviousVehicle, { capture: true });

  async function launch() {
    const challenge = await resolveChallenge();
    state.active = true;
    state.challenge = challenge;
    state.challengeLap = challengeToLap(challenge);
    state.personalRivals = cloneLaps(runtime.state.competitorLaps);
    state.previousVehicle = selectedVehicle();

    await raceSession.selectVehicle(challengeVehicle(challenge));
    useChallengeAsOnlyRival();
    hideHomeAndRaceUi();
    document.body.classList.add('turn-challenge-active', 'turn-challenge-preview');

    runtime.state.running = true;
    runtime.state.lastFrame = performance.now();
    runtime.state.touchGas = false;
    runtime.state.touchBrake = false;
    runtime.state.velocity.set(0, 0, 0);
    runtime.setGameMode(GAME_MODE.STAGED);
    runtime.playerCar.visible = false;

    state.scene = createChallengeScene({
      runtime,
      challengeLap: state.challengeLap,
      onRaceStarted() {
        state.phase = 'racing';
        ui.setAttemptStatus('RACE IN PROGRESS');
      }
    });
    state.phase = request.reply ? 'reply' : 'preview';
    state.scene.setPhase(state.phase);

    ui.ensureBar({
      opponent: challenge.challengerName,
      target: formatChallengeTime(challenge.time),
      onRestart: restartLap,
      onGiveUp: () => void giveUp()
    });
    installEvents();

    if (request.reply === 'give-up') showGiveUpReceivedModal();
    else showChallengeModal();
  }

  async function resolveChallenge() {
    if (request.builtInId) {
      const definition = BUILT_IN_CHALLENGES[request.builtInId];
      if (!definition) throw new Error('This TURN NEXT challenge does not exist.');
      await activateTrack(definition.trackId, runtime);
      return materializeBuiltInChallenge(definition);
    }

    const challenge = await decodeChallenge(request.encoded);
    await activateTrack(challenge.trackId, runtime);
    const currentRevision = getTrackStorageRevision(challenge.trackId);
    if (challenge.trackRevision && challenge.trackRevision !== currentRevision) {
      throw new Error('This challenge was recorded on an older version of the track.');
    }
    return challenge;
  }

  function materializeBuiltInChallenge(definition) {
    const frames = runtime.samples.map((sample, index, samples) => {
      const denominator = Math.max(1, samples.length - 1);
      const previous = samples[(index - 2 + samples.length) % samples.length];
      const next = samples[(index + 2) % samples.length];
      const previousHeading = Math.atan2(previous.tangent.x, previous.tangent.z);
      const nextHeading = Math.atan2(next.tangent.x, next.tangent.z);
      const steering = normalizeAngle(nextHeading - previousHeading) * 3.2;
      return {
        t: definition.time * index / denominator,
        x: sample.point.x,
        z: sample.point.z,
        h: Math.atan2(sample.tangent.x, sample.tangent.z),
        s: THREE.MathUtils.clamp(steering, -1, 1),
        d: Math.min(1, Math.abs(steering) * 0.75),
        p: index / denominator
      };
    });
    const track = getTrackDefinition(definition.trackId);
    return normalizeChallenge({
      v: 1,
      challengerName: definition.challengerName,
      trackId: definition.trackId,
      trackRevision: getTrackStorageRevision(definition.trackId),
      trackName: track.name,
      time: definition.time,
      carId: definition.carId,
      carColor: definition.carColor,
      carSecondaryColor: definition.carSecondaryColor,
      frames
    });
  }

  function installEvents() {
    window.addEventListener('turn:lap-result', handleLapResult);
    window.addEventListener('turn:ui-state-change', (event) => {
      if (!state.active || !state.accepted) return;
      if (event.detail?.reason === 'race-reset') {
        state.phase = 'staged';
        state.scene.setPhase('staged');
        useChallengeAsOnlyRival();
      }
    });
  }

  function showChallengeModal() {
    const challenge = state.challenge;
    const track = getTrackDefinition(challenge.trackId);
    const car = getCarDefinition(challenge.carId);
    const title = challenge.replyTo?.kind === 'win'
      ? `${challenge.challengerName} BEAT YOUR GHOST`
      : `${challenge.challengerName} CHALLENGES YOU`;
    ui.showModal({
      title,
      details: `
        <strong>${escapeHtml(track.name.toUpperCase())}</strong>
        <span>${escapeHtml(car.name)} · ${formatChallengeTime(challenge.time)}</span>`,
      copy: challenge.replyTo?.kind === 'win'
        ? `Beat ${escapeHtml(challenge.challengerName)}’s reply ghost.`
        : `Beat ${escapeHtml(challenge.challengerName)}’s ghost. Race as many laps as you need.`,
      actions: [
        { label: 'ACCEPT CHALLENGE', action: () => void accept(), primary: true },
        { label: 'GIVE UP', action: () => void giveUp() }
      ]
    });
  }

  function showGiveUpReceivedModal() {
    const track = getTrackDefinition(state.challenge.trackId);
    ui.showModal({
      title: `${request.responder} GAVE UP`,
      details: `
        <strong>${escapeHtml(track.name.toUpperCase())}</strong>
        <span>${formatChallengeTime(state.challenge.time)} held the lead</span>`,
      copy: `Your ghost beat ${escapeHtml(request.responder)}.`,
      actions: [
        { label: 'RACE THIS GHOST', action: () => void accept(), primary: true },
        { label: 'RETURN TO TURN NEXT', action: returnToTurnNext }
      ]
    });
  }

  async function accept() {
    if (state.accepted) return;
    state.accepted = true;
    ui.closeModal();
    document.body.classList.remove('turn-challenge-preview');
    document.body.classList.add('turn-challenge-racing');
    state.phase = 'staged';
    state.scene.setPhase('staged');
    useChallengeAsOnlyRival();

    let access;
    try {
      access = loadSteeringMode() === 'motion'
        ? await raceSession.prepareMotionAccess()
        : raceSession.prepareManualAccess();
    } catch (error) {
      console.warn('TURN NEXT: motion challenge start fell back to manual steering.', error);
      access = raceSession.prepareManualAccess();
    }

    document.querySelector('#resetButton')?.click();
    useChallengeAsOnlyRival();
    await raceSession.startGame(access.fullscreenPromise);
    runtime.setGameMode(GAME_MODE.STAGED);
    runtime.state.velocity.set(0, 0, 0);
    const message = document.querySelector('#message');
    message?.classList.remove('show');
    if (message) message.textContent = '';
    ui.showBar();
    ui.setAttemptStatus('READY WHEN YOU ARE', { persist: true });
  }

  function restartLap() {
    document.querySelector('#resetButton')?.click();
    state.phase = 'staged';
    state.scene.setPhase('staged');
    ui.setAttemptStatus('READY WHEN YOU ARE', { persist: true });
  }

  function handleLapResult(event) {
    if (!state.active || !state.accepted || state.phase === 'result') return;
    const time = Number(event.detail?.time);
    const recording = runtime.state.recording;
    if (!Number.isFinite(time) || !Array.isArray(recording) || recording.length < 21) return;
    const candidate = {
      time,
      hitAt: Date.now(),
      carId: state.challenge.carId,
      carColor: state.challenge.carColor,
      carSecondaryColor: state.challenge.carSecondaryColor,
      frames: recording.map((frame) => ({ ...frame }))
    };
    queueMicrotask(() => finishAttempt(candidate));
  }

  function finishAttempt(candidate) {
    mergePersonalRival(candidate);
    if (candidate.time < state.challenge.time) {
      state.winningLap = candidate;
      state.phase = 'result';
      state.scene.setPhase('result');
      stopRaceForModal();
      showWinModal(candidate);
      return;
    }

    useChallengeAsOnlyRival();
    state.phase = runtime.state.lapActive ? 'racing' : 'staged';
    state.scene.setPhase(state.phase);
    ui.setAttemptStatus(`${Math.abs(state.challenge.time - candidate.time).toFixed(3)} TO FIND`);
  }

  function mergePersonalRival(candidate) {
    state.personalRivals = [...state.personalRivals, cloneLaps([candidate])[0]]
      .filter((lap) => Number.isFinite(lap?.time)
        && Array.isArray(lap?.frames)
        && lap.frames.length > 20)
      .sort((a, b) => a.time - b.time)
      .slice(0, RIVAL_LIMIT);
    saveRivalsState({
      trackId: state.challenge.trackId,
      competitorLaps: state.personalRivals
    }, { trackId: state.challenge.trackId });
  }

  function showWinModal(candidate) {
    const difference = state.challenge.time - candidate.time;
    ui.showModal({
      title: `YOU BEAT ${state.challenge.challengerName}`,
      details: `
        <strong>${formatChallengeTime(candidate.time)}</strong>
        <span>${difference.toFixed(3)} seconds ahead</span>`,
      copy: 'Send your winning lap back as a new ghost challenge.',
      requestName: true,
      actions: [
        {
          label: 'SHARE WIN',
          primary: true,
          action: () => void shareWinningReply({
            ui,
            challenge: state.challenge,
            winningLap: state.winningLap,
            responder: ui.playerName()
          })
        },
        { label: 'RACE AGAIN', action: raceAgain },
        { label: 'RETURN TO TURN NEXT', action: returnToTurnNext }
      ]
    });
  }

  function raceAgain() {
    ui.closeModal();
    state.winningLap = null;
    document.body.classList.remove('turn-challenge-preview');
    document.body.classList.add('turn-challenge-racing');
    useChallengeAsOnlyRival();
    showRaceUi(runtime.state.sensorMode);
    restartLap();
    ui.showBar();
  }

  async function giveUp() {
    state.phase = 'reply';
    state.scene.setPhase('reply');
    stopRaceForModal();
    ui.showModal({
      title: 'GIVE UP?',
      details: `
        <strong>${state.challenge.challengerName} WINS</strong>
        <span>Target ${formatChallengeTime(state.challenge.time)}</span>`,
      copy: 'Share a reply link so the challenger knows their ghost held the lead.',
      requestName: true,
      actions: [
        {
          label: 'SHARE GIVE-UP REPLY',
          primary: true,
          action: () => void shareGiveUpReply({
            ui,
            builtInId: request.builtInId,
            encoded: request.encoded,
            challenge: state.challenge,
            responder: ui.playerName()
          })
        },
        { label: 'KEEP RACING', action: state.accepted ? raceAgain : () => void accept() },
        { label: 'RETURN TO TURN NEXT', action: returnToTurnNext }
      ]
    });
  }

  function stopRaceForModal() {
    runtime.setGameMode(GAME_MODE.STAGED);
    runtime.state.velocity.set(0, 0, 0);
    runtime.state.touchGas = false;
    runtime.state.touchBrake = false;
    globalThis.__turnAnalogGas = 0;
    useChallengeAsOnlyRival();
    hideHomeAndRaceUi();
    ui.hideBar();
    document.body.classList.remove('turn-challenge-racing');
    document.body.classList.add('turn-challenge-preview');
  }

  function useChallengeAsOnlyRival() {
    runtime.state.competitorLaps = [state.challengeLap];
    syncPrimaryRivalState(runtime.state);
    runtime.syncCompetitorVisuals?.();
    runtime.setRacePosition?.(null, 2);
  }

  function restorePreviousVehicle() {
    if (state.previousVehicle) saveVehicleSelection(state.previousVehicle);
  }

  function returnToTurnNext() {
    restorePreviousVehicle();
    globalThis.location.href = '/turn-next/';
  }

  function selectedVehicle() {
    return {
      carId: runtime.state.vehicleId,
      color: runtime.state.vehicleColor,
      secondaryColor: runtime.state.vehicleSecondaryColor
    };
  }

  return Object.freeze({
    launch,
    isActive: () => state.active,
    getState: () => state
  });
}

function challengeToLap(challenge) {
  return {
    time: challenge.time,
    hitAt: null,
    challengeId: 'shared-challenge',
    challengerName: challenge.challengerName,
    carId: challenge.carId,
    carColor: challenge.carColor,
    carSecondaryColor: challenge.carSecondaryColor,
    frames: challenge.frames.map((frame) => ({ ...frame }))
  };
}

function challengeVehicle(challenge) {
  return {
    carId: challenge.carId,
    color: challenge.carColor,
    secondaryColor: challenge.carSecondaryColor
  };
}

function cloneLaps(laps) {
  return Array.isArray(laps)
    ? laps.map((lap) => ({
      ...lap,
      frames: Array.isArray(lap.frames) ? lap.frames.map((frame) => ({ ...frame })) : []
    }))
    : [];
}

function loadSteeringMode() {
  try {
    if (localStorage.getItem(STEERING_MODE_KEY) === 'motion'
      && typeof DeviceMotionEvent !== 'undefined') return 'motion';
  } catch (_) {}
  return 'manual';
}

function normalizeAngle(value) {
  let angle = Number(value) || 0;
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}
