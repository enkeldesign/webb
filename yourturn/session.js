import * as THREE from 'three';
import { GAME_MODE } from '/turn/race/game-state.js';
import { syncPrimaryRivalState } from '/turn/race/rival-storage.js?build=20260720-r19';
import { activateTrack } from '/turn/tracks/track-manager.js?source=20260729-r118-m8';
import { getTrackDefinition } from '/turn/tracks/catalog.js?source=20260729-r118-m8';
import { getTrackStorageRevision } from '/turn/tracks/definitions.js';
import { getCarDefinition } from '/turn/vehicle/catalog.js?build=20260720-r19';
import {
  challengeFromLap,
  decodeChallenge,
  encodeChallenge,
  encodedChallengeFromLocation,
  formatChallengeTime,
  makeChallengeUrl,
  makeMockChallengeUrl,
  normalizeChallenge,
  normalizeChallengeName
} from '/yourturn/protocol.js?revision=r2';
import { getMockChallenge, MOCK_CHALLENGES } from '/yourturn/mock-challenges.js?revision=r1';
import { createChallengeScene } from '/yourturn/scene.js?revision=r1';
import { aboutTurnHtml, escapeHtml, newcomerAssistiveText } from '/yourturn/ui.js?revision=r2';

export function readYourTurnRequest(locationRef = globalThis.location) {
  const query = new URLSearchParams(locationRef?.search || '');
  const mockId = query.get('challenge') || '';
  const encoded = encodedChallengeFromLocation(locationRef);
  return Object.freeze({
    mockId,
    encoded,
    reply: query.get('reply') === 'give-up' ? 'give-up' : '',
    responder: normalizeChallengeName(query.get('responder'), 'A TURN PLAYER'),
    hasChallenge: Boolean(mockId || encoded)
  });
}

export function createYourTurnSession({ runtime, raceSession, ui, animation, request }) {
  const state = {
    active: false,
    accepted: false,
    authorizing: false,
    phase: 'idle',
    challenge: null,
    challengeLap: null,
    winningLap: null,
    scene: null,
    pendingAccess: null,
    paused: false,
    backgroundPaused: false,
    ambientPaused: false
  };

  ui.bindChallengeMenu(() => openChallengeMenu('Race paused.'));
  ui.bindMotionToggle(toggleAmbientMotion);
  ui.setMotionPaused(false);
  window.addEventListener('turn:lap-result', handleLapResult);
  window.addEventListener('turn:ui-state-change', handleUiState);
  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('pagehide', stopDrivingInputs, { capture: true });

  async function launch() {
    if (!request.hasChallenge) {
      state.active = true;
      document.body.classList.add('yourturn-active', 'yourturn-preview');
      showMockPicker();
      return;
    }

    const challenge = await resolveChallenge();
    state.active = true;
    state.challenge = challenge;
    state.challengeLap = challengeToLap(challenge);

    await raceSession.selectVehicle(challengeVehicle(challenge));
    useChallengeAsOnlyOpponent();
    document.body.classList.add('yourturn-active', 'yourturn-preview');

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
      }
    });
    state.phase = request.reply ? 'reply' : 'preview';
    state.scene.setPhase(state.phase);
    ui.setTarget({
      opponent: challenge.challengerName,
      time: formatChallengeTime(challenge.time)
    });

    if (request.reply === 'give-up') showReceivedGiveUp();
    else showInvitation();
  }

  async function resolveChallenge() {
    if (request.mockId) {
      const definition = getMockChallenge(request.mockId);
      if (!definition) throw new Error('This mock challenge does not exist.');
      await activateTrack(definition.trackId, runtime);
      return materializeMockChallenge(definition);
    }

    const challenge = await decodeChallenge(request.encoded);
    await activateTrack(challenge.trackId, runtime);
    const currentRevision = getTrackStorageRevision(challenge.trackId);
    if (challenge.trackRevision && challenge.trackRevision !== currentRevision) {
      throw new Error('This challenge was recorded on an older version of the track.');
    }
    return challenge;
  }

  function materializeMockChallenge(definition) {
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

  function showSessionModal(config) {
    const motionControl = Boolean(state.scene && document.body.classList.contains('yourturn-preview'));
    ui.setMotionPaused(state.ambientPaused);
    ui.showModal({ ...config, motionControl });
  }

  function showInvitation() {
    const challenge = state.challenge;
    const track = getTrackDefinition(challenge.trackId);
    const car = getCarDefinition(challenge.carId);
    state.phase = 'preview';
    state.scene?.setPhase('preview');
    ui.hideRaceChrome();
    showSessionModal({
      titleText: `${challenge.challengerName} CHALLENGES YOU`,
      detailsHtml: `
        <strong>${escapeHtml(track.name.toUpperCase())}</strong>
        <span>${escapeHtml(car.name)} · ${formatChallengeTime(challenge.time)}</span>`,
      copyHtml: `Beat ${escapeHtml(challenge.challengerName)}’s car. Race as many laps as you need.`,
      extraHtml: newcomerAssistiveText(challenge.challengerName),
      className: 'invitation',
      actionList: [
        { label: 'ACCEPT CHALLENGE', primary: true, action: () => void acceptWithMotion() },
        { label: 'TRY LATER', navigation: true, action: openFullTurn },
        { label: 'GIVE UP', destructive: true, action: showGiveUpConfirm },
        { label: 'ABOUT TURN', kind: 'quiet', action: () => showAbout(showInvitation) }
      ]
    });
  }

  async function acceptWithMotion() {
    if (state.authorizing) return;
    state.authorizing = true;
    ui.setStatus('Requesting motion access…');
    try {
      state.pendingAccess = await raceSession.prepareMotionAccess();
      state.authorizing = false;
      await awaitLandscapeAndStart();
    } catch (error) {
      state.authorizing = false;
      showMotionProblem(error);
    }
  }

  function showMotionProblem(error) {
    const message = error instanceof Error ? error.message : 'Motion steering could not be enabled.';
    showSessionModal({
      titleText: 'MOTION STEERING NEEDED',
      copyHtml: `${escapeHtml(message)} TURN is designed around rotating the phone like a steering wheel.`,
      extraHtml: '<p class="yourturn-small-note">If this browser cannot provide motion access, on-screen steering is available as a fallback.</p>',
      className: 'motion-error',
      actionList: [
        { label: 'TRY MOTION AGAIN', primary: true, action: () => void acceptWithMotion() },
        { label: 'USE ON-SCREEN STEERING', action: () => void acceptWithManual() },
        { label: 'TRY LATER', navigation: true, action: openFullTurn },
        { label: 'ABOUT TURN', kind: 'quiet', action: () => showAbout(showMotionProblem.bind(null, error)) }
      ]
    });
  }

  async function acceptWithManual() {
    state.pendingAccess = raceSession.prepareManualAccess();
    await awaitLandscapeAndStart();
  }

  async function awaitLandscapeAndStart() {
    ui.closeModal();
    ui.showRotate();
    if (isLandscape()) {
      await nextPaint();
      return startAcceptedRace();
    }

    await new Promise((resolve) => {
      let settled = false;
      const check = () => {
        if (settled || !isLandscape()) return;
        settled = true;
        window.removeEventListener('resize', check);
        window.removeEventListener('orientationchange', check);
        resolve();
      };
      window.addEventListener('resize', check, { passive: true });
      window.addEventListener('orientationchange', check, { passive: true });
    });
    return startAcceptedRace();
  }

  async function startAcceptedRace() {
    state.accepted = true;
    state.paused = false;
    animation.pause();
    ui.hideRotate();
    document.body.classList.remove('yourturn-preview');
    document.body.classList.add('yourturn-racing');
    state.phase = 'staged';
    state.scene.setPhase('staged');
    useChallengeAsOnlyOpponent();

    document.querySelector('#resetButton')?.click();
    useChallengeAsOnlyOpponent();
    const access = state.pendingAccess || raceSession.prepareManualAccess();
    await centerMotionAfterLandscape();
    await raceSession.startGame(access.fullscreenPromise);
    runtime.setGameMode(GAME_MODE.STAGED);
    runtime.state.velocity.set(0, 0, 0);
    stopDrivingInputs();
    const message = document.querySelector('#message');
    message?.classList.remove('show');
    if (message) message.textContent = '';
    runtime.state.lastFrame = performance.now();
    ui.showRaceChrome();
    animation.resume();
  }

  async function centerMotionAfterLandscape() {
    if (!runtime.state.sensorMode) return;
    await new Promise((resolve) => {
      let samples = 0;
      let finished = false;
      let timer = 0;
      const finish = () => {
        if (finished) return;
        finished = true;
        window.removeEventListener('devicemotion', onMotion);
        window.clearTimeout(timer);
        resolve();
      };
      const onMotion = () => {
        samples += 1;
        if (samples >= 2) finish();
      };
      window.addEventListener('devicemotion', onMotion, { passive: true });
      timer = window.setTimeout(finish, 320);
    });

    runtime.state.neutralRoll = runtime.state.targetRoll;
    runtime.state.horizonRollReference = runtime.state.targetRoll;
    runtime.state.roll = runtime.state.targetRoll;
    runtime.state.neutralPitch = runtime.state.targetPitch;
    runtime.state.pitch = runtime.state.targetPitch;
    runtime.state.steering = 0;
    runtime.state.steeringEngaged = false;
    runtime.state.tiltDrive = 0;
  }

  function handleLapResult(event) {
    if (!state.active || !state.accepted || state.phase === 'result' || state.paused) return;
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
    useChallengeAsOnlyOpponent();
    if (candidate.time < state.challenge.time) {
      state.winningLap = candidate;
      state.phase = 'result';
      stopRaceForModal('result');
      showWin(candidate);
      return;
    }
    state.phase = runtime.state.lapActive ? 'racing' : 'staged';
    state.scene.setPhase(state.phase);
  }

  function showWin(candidate) {
    const difference = state.challenge.time - candidate.time;
    showSessionModal({
      titleText: `YOU BEAT ${state.challenge.challengerName}`,
      detailsHtml: `
        <strong>${formatChallengeTime(candidate.time)}</strong>
        <span>${difference.toFixed(3)} seconds ahead</span>`,
      copyHtml: 'Send your winning lap back as a new YOUR TURN challenge.',
      requestName: true,
      className: 'result',
      actionList: [
        { label: 'SHARE YOUR TURN', primary: true, action: () => void shareWinningReply() },
        { label: 'RACE AGAIN', action: raceAgain },
        { label: 'GET FULL TURN', navigation: true, action: openFullTurn },
        { label: 'ABOUT TURN', kind: 'quiet', action: () => showAbout(() => showWin(candidate)) }
      ]
    });
  }

  async function shareWinningReply() {
    const responder = ui.playerName();
    const replyChallenge = challengeFromLap({
      challengerName: responder,
      trackId: state.challenge.trackId,
      trackRevision: getTrackStorageRevision(state.challenge.trackId),
      trackName: getTrackDefinition(state.challenge.trackId).name,
      lap: state.winningLap,
      replyTo: {
        kind: 'win',
        opponent: state.challenge.challengerName,
        previousTime: state.challenge.time
      }
    });
    const encoded = await encodeChallenge(replyChallenge);
    const url = makeChallengeUrl(encoded);
    return shareUrl({
      title: `${responder} sends you YOUR TURN`,
      text: `${responder} beat ${state.challenge.challengerName} with ${formatChallengeTime(state.winningLap.time)}. Your turn.`,
      url,
      success: 'Your challenge is ready to send.'
    });
  }

  function showGiveUpConfirm() {
    const wasAccepted = state.accepted;
    if (wasAccepted) stopRaceForModal('reply');
    showSessionModal({
      titleText: 'GIVE UP?',
      detailsHtml: `<strong>${escapeHtml(state.challenge.challengerName)} WINS</strong><span>Target ${formatChallengeTime(state.challenge.time)}</span>`,
      copyHtml: `You can keep racing ${escapeHtml(state.challenge.challengerName)}’s car for as many laps as you want.`,
      className: 'give-up',
      actionList: [
        { label: 'KEEP RACING', primary: true, action: wasAccepted ? raceAgain : showInvitation },
        { label: 'YES, GIVE UP', destructive: true, action: finishGiveUp }
      ]
    });
  }

  function finishGiveUp() {
    state.phase = 'reply';
    state.scene?.setPhase('reply');
    showSessionModal({
      titleText: `${state.challenge.challengerName} WINS`,
      detailsHtml: `<strong>${formatChallengeTime(state.challenge.time)}</strong><span>Challenge held</span>`,
      copyHtml: 'Send the result back, try again, or open the full TURN game.',
      requestName: true,
      className: 'result',
      actionList: [
        { label: 'SHARE RESULT', primary: true, action: () => void shareGiveUpReply() },
        { label: 'TRY AGAIN', action: state.accepted ? raceAgain : showInvitation },
        { label: 'GET FULL TURN', navigation: true, action: openFullTurn },
        { label: 'ABOUT TURN', kind: 'quiet', action: () => showAbout(finishGiveUp) }
      ]
    });
  }

  async function shareGiveUpReply() {
    const responder = ui.playerName();
    const url = request.mockId
      ? makeMockChallengeUrl(request.mockId, { reply: 'give-up', responder })
      : makeChallengeUrl(request.encoded, { reply: 'give-up', responder });
    return shareUrl({
      title: `${responder} answered your YOUR TURN challenge`,
      text: `${responder} gave up. ${state.challenge.challengerName} wins this round.`,
      url,
      success: 'Result ready to send.'
    });
  }

  function showReceivedGiveUp() {
    showSessionModal({
      titleText: `${request.responder} GAVE UP`,
      detailsHtml: `<strong>YOU WIN</strong><span>${formatChallengeTime(state.challenge.time)} held the lead</span>`,
      copyHtml: `Your car beat ${escapeHtml(request.responder)}.`,
      className: 'result',
      actionList: [
        { label: 'RACE THIS CHALLENGE', primary: true, action: () => void acceptWithMotion() },
        { label: 'GET FULL TURN', navigation: true, action: openFullTurn },
        { label: 'ABOUT TURN', kind: 'quiet', action: () => showAbout(showReceivedGiveUp) }
      ]
    });
  }

  function openChallengeMenu(reason = 'Race paused.') {
    if (!state.accepted || state.paused || !['racing', 'staged'].includes(state.phase)) return;
    state.paused = true;
    stopDrivingInputs();
    animation.pause();
    showChallengeMenuView(reason);
  }

  function showChallengeMenuView(reason) {
    showSessionModal({
      titleText: 'CHALLENGE',
      copyHtml: escapeHtml(reason),
      className: 'paused',
      actionList: [
        { label: 'RESUME', primary: true, action: resumeRace },
        { label: 'RESTART LAP', action: restartFromPause },
        { label: 'GIVE UP', destructive: true, action: showGiveUpConfirm },
        { label: 'ABOUT TURN', kind: 'quiet', action: () => showAbout(() => showChallengeMenuView(reason)) }
      ]
    });
  }

  function resumeRace() {
    ui.closeModal();
    state.paused = false;
    state.backgroundPaused = false;
    runtime.state.lastFrame = performance.now();
    animation.resume();
    ui.showRaceChrome();
  }

  function restartFromPause() {
    document.querySelector('#resetButton')?.click();
    useChallengeAsOnlyOpponent();
    state.phase = 'staged';
    state.scene.setPhase('staged');
    resumeRace();
  }

  function raceAgain() {
    ui.closeModal();
    state.winningLap = null;
    state.paused = false;
    document.body.classList.remove('yourturn-preview');
    document.body.classList.add('yourturn-racing');
    useChallengeAsOnlyOpponent();
    showRaceUi(runtime.state.sensorMode);
    document.querySelector('#resetButton')?.click();
    useChallengeAsOnlyOpponent();
    state.phase = 'staged';
    state.scene.setPhase('staged');
    runtime.state.lastFrame = performance.now();
    animation.resume();
    ui.showRaceChrome();
  }

  function stopRaceForModal(scenePhase) {
    runtime.setGameMode(GAME_MODE.STAGED);
    runtime.state.velocity.set(0, 0, 0);
    stopDrivingInputs();
    useChallengeAsOnlyOpponent();
    state.scene?.setPhase(scenePhase);
    hideRaceUi();
    ui.hideRaceChrome();
    document.body.classList.remove('yourturn-racing');
    document.body.classList.add('yourturn-preview');
    state.paused = false;
    runtime.state.running = true;
    runtime.state.lastFrame = performance.now();
    if (state.ambientPaused) animation.pause();
    else animation.resume();
  }

  function toggleAmbientMotion() {
    if (!state.scene || !document.body.classList.contains('yourturn-preview')) return;
    state.ambientPaused = !state.ambientPaused;
    if (state.ambientPaused) {
      animation.pause();
    } else {
      runtime.state.lastFrame = performance.now();
      animation.resume();
    }
    ui.setMotionPaused(state.ambientPaused);
  }

  function showAbout(returnAction) {
    showSessionModal({
      titleText: 'ABOUT TURN',
      extraHtml: aboutTurnHtml(),
      className: 'about',
      actionList: [
        { label: 'BACK', primary: true, action: returnAction },
        { label: 'GET FULL TURN', navigation: true, action: openFullTurn }
      ]
    });
  }

  function showMockPicker() {
    const buttons = Object.values(MOCK_CHALLENGES).map((mock) => ({
      label: mock.label,
      action: () => { globalThis.location.href = makeMockChallengeUrl(mock.id); }
    }));
    showSessionModal({
      titleText: 'TEST CHALLENGES',
      copyHtml: 'Choose a stable mock link while the recipient experience is under development.',
      className: 'picker',
      actionList: [
        ...buttons,
        { label: 'ABOUT TURN', kind: 'quiet', action: () => showAbout(showMockPicker) }
      ]
    });
  }

  function handleUiState(event) {
    if (!state.active || !state.accepted) return;
    if (event.detail?.reason === 'race-reset') {
      state.phase = 'staged';
      state.scene?.setPhase('staged');
      useChallengeAsOnlyOpponent();
    }
  }

  function handleVisibility() {
    if (!state.accepted) return;
    if (document.hidden && !state.paused && ['racing', 'staged'].includes(state.phase)) {
      state.paused = true;
      state.backgroundPaused = true;
      stopDrivingInputs();
      animation.pause();
      return;
    }
    if (!document.hidden && state.backgroundPaused) {
      state.backgroundPaused = false;
      showChallengeMenuView('Race paused while YOUR TURN was in the background.');
    }
  }

  function useChallengeAsOnlyOpponent() {
    runtime.state.competitorLaps = state.challengeLap ? [state.challengeLap] : [];
    syncPrimaryRivalState(runtime.state);
    runtime.syncCompetitorVisuals?.();
    runtime.setRacePosition?.(null, state.challengeLap ? 2 : 1);
  }

  function stopDrivingInputs() {
    runtime.state.touchGas = false;
    runtime.state.touchBrake = false;
    runtime.state.manualSteering = 0;
    globalThis.__turnAnalogGas = 0;
    globalThis.__turnBoostActive = false;
    globalThis.__turnDriftHeld = false;
  }

  async function shareUrl({ title, text, url, success }) {
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        ui.setStatus(success);
        return true;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        ui.setStatus('Link copied.');
        return true;
      }
    } catch (error) {
      if (error?.name === 'AbortError') return false;
    }
    ui.setStatus(url);
    return false;
  }

  function openFullTurn() {
    globalThis.location.href = '/turn/';
  }

  return Object.freeze({ launch, getState: () => state });
}

function challengeToLap(challenge) {
  return {
    time: challenge.time,
    hitAt: null,
    challengeId: 'yourturn-opponent',
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

function showRaceUi(sensorMode) {
  document.querySelector('#hud')?.removeAttribute('hidden');
  document.querySelector('#controls')?.removeAttribute('hidden');
  if (!sensorMode) document.querySelector('#manualSteer')?.removeAttribute('hidden');
}

function hideRaceUi() {
  document.querySelector('#hud')?.setAttribute('hidden', '');
  document.querySelector('#controls')?.setAttribute('hidden', '');
  document.querySelector('#manualSteer')?.setAttribute('hidden', '');
}

function isLandscape() {
  return globalThis.matchMedia?.('(orientation: landscape)').matches
    || globalThis.innerWidth > globalThis.innerHeight;
}

function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}