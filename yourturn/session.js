import * as THREE from 'three';
import { GAME_MODE } from '/turn/race/game-state.js';
import { syncPrimaryRivalState } from '/turn/race/rival-storage.js?build=20260720-r19';
import { activateTrack } from '/turn/tracks/track-manager.js?source=20260729-r118-m8';
import { getTrackDefinition } from '/turn/tracks/catalog.js?source=20260729-r118-m8';
import { getTrackStorageRevision } from '/turn/tracks/definitions.js';
import { getCarDefinition } from '/turn/vehicle/catalog.js?build=20260720-r19';
import {
  challengeLeader,
  challengeSender,
  challengeWithLap,
  createRacerId,
  decodeChallenge,
  encodeChallenge,
  encodedChallengeFromLocation,
  formatChallengeTime,
  makeMockChallengeUrl,
  normalizeChallenge,
  normalizeChallengeName
} from '/yourturn/protocol.js?revision=r3';
import {
  loadChallengeSnapshot,
  makeShareableChallengeUrl,
  snapshotIdFromLocation
} from '/yourturn/challenge-store.js?revision=r1';
import { getMockChallenge, MOCK_CHALLENGES } from '/yourturn/mock-challenges.js?revision=r1';
import { createChallengeScene } from '/yourturn/scene.js?revision=r1';
import { aboutTurnHtml, escapeHtml, newcomerAssistiveText } from '/yourturn/ui.js?revision=r3';

const RACER_ID_KEY = 'yourturn-racer-id-v1';
const POST_LANDSCAPE_RECALIBRATE_DELAY_MS = 360;

export function readYourTurnRequest(locationRef = globalThis.location) {
  const query = new URLSearchParams(locationRef?.search || '');
  const mockId = query.get('challenge') || '';
  const snapshotId = snapshotIdFromLocation(locationRef);
  const encoded = snapshotId ? '' : encodedChallengeFromLocation(locationRef);
  return Object.freeze({
    mockId,
    snapshotId,
    encoded,
    // Kept only so already-shared r5 give-up links remain understandable.
    reply: query.get('reply') === 'give-up' ? 'give-up' : '',
    responder: normalizeChallengeName(query.get('responder'), 'A TURN PLAYER'),
    hasChallenge: Boolean(mockId || snapshotId || encoded)
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
    challengeLaps: [],
    bestRun: null,
    winningLap: null,
    scene: null,
    pendingAccess: null,
    paused: false,
    backgroundPaused: false,
    ambientPaused: false,
    racerId: loadOrCreateRacerId()
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
    setChallenge(challenge);

    await raceSession.selectVehicle(challengeVehicle(challenge));
    useChallengeField();
    document.body.classList.add('yourturn-active', 'yourturn-preview');

    // The invitation preview needs TURN's render loop, but it is not gameplay.
    // Publish STAGED while running is still false so TURN's orientation guard stays
    // unlocked through the portrait invitation and portrait -> landscape rotation.
    // The canonical race-started event is the first running:true state event and is
    // therefore the only point where TURN locks the gameplay steering orientation.
    runtime.setGameMode(GAME_MODE.STAGED);
    runtime.state.running = true;
    runtime.state.lastFrame = performance.now();
    runtime.state.touchGas = false;
    runtime.state.touchBrake = false;
    runtime.state.velocity.set(0, 0, 0);
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
    syncTarget();

    if (request.reply === 'give-up') showReceivedLegacyGiveUp();
    else showInvitation();
  }

  function setChallenge(challenge) {
    state.challenge = normalizeChallenge(challenge);
    state.challengeLaps = state.challenge.racers.map((racer) => racerToLap(racer, state.challenge));
    state.challengeLap = state.challengeLaps[0] || null;
  }

  function syncTarget() {
    const leader = challengeLeader(state.challenge);
    ui.setTarget({ opponent: leader.name, time: formatChallengeTime(leader.time) });
  }

  async function resolveChallenge() {
    if (request.mockId) {
      const definition = getMockChallenge(request.mockId);
      if (!definition) throw new Error('This mock challenge does not exist.');
      await activateTrack(definition.trackId, runtime);
      return materializeMockChallenge(definition);
    }

    const encoded = request.snapshotId
      ? await loadChallengeSnapshot(request.snapshotId)
      : request.encoded;
    const challenge = await decodeChallenge(encoded);
    await activateTrack(challenge.trackId, runtime);
    const currentRevision = getTrackStorageRevision(challenge.trackId);
    if (challenge.trackRevision && challenge.trackRevision !== currentRevision) {
      throw new Error('This challenge was recorded on an older version of the track.');
    }
    return challenge;
  }

  function materializeMockChallenge(definition) {
    const mockRacers = Array.isArray(definition.racers) && definition.racers.length
      ? definition.racers
      : [{
        id: `mock-${definition.id}`,
        name: definition.challengerName,
        time: definition.time,
        laneOffset: 0
      }];
    const racers = mockRacers.map((racer) => ({
      id: racer.id,
      name: racer.name,
      time: racer.time,
      frames: runtime.samples.map((sample, index, samples) => {
        const denominator = Math.max(1, samples.length - 1);
        const previous = samples[(index - 2 + samples.length) % samples.length];
        const next = samples[(index + 2) % samples.length];
        const previousHeading = Math.atan2(previous.tangent.x, previous.tangent.z);
        const nextHeading = Math.atan2(next.tangent.x, next.tangent.z);
        const steering = normalizeAngle(nextHeading - previousHeading) * 3.2;
        const normal = sample.normal || new THREE.Vector3(-sample.tangent.z, 0, sample.tangent.x).normalize();
        const laneOffset = Number(racer.laneOffset) || 0;
        return {
          t: racer.time * index / denominator,
          x: sample.point.x + normal.x * laneOffset,
          z: sample.point.z + normal.z * laneOffset,
          h: Math.atan2(sample.tangent.x, sample.tangent.z),
          s: THREE.MathUtils.clamp(steering, -1, 1),
          d: Math.min(1, Math.abs(steering) * 0.75),
          p: index / denominator
        };
      })
    }));
    const track = getTrackDefinition(definition.trackId);
    return normalizeChallenge({
      v: 2,
      chainId: `yt-mock-${definition.id}`,
      sharedBy: racers[0].id,
      trackId: definition.trackId,
      trackRevision: getTrackStorageRevision(definition.trackId),
      trackName: track.name,
      carId: definition.carId,
      carColor: definition.carColor,
      carSecondaryColor: definition.carSecondaryColor,
      racers
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
    const leader = challengeLeader(challenge);
    const sender = challengeSender(challenge);
    const count = challenge.racers.length;
    state.phase = 'preview';
    state.scene?.setPhase('preview');
    ui.hideRaceChrome();
    showSessionModal({
      titleText: count === 1 ? `${sender.name} CHALLENGES YOU` : `${count} PLAYERS CHALLENGE YOU`,
      detailsHtml: `
        <strong>${escapeHtml(track.name.toUpperCase())}</strong>
        <span>${escapeHtml(car.name)} · fastest ${escapeHtml(leader.name)} ${formatChallengeTime(leader.time)}</span>`,
      copyHtml: count === 1
        ? `Beat ${escapeHtml(leader.name)}’s car, or add your best lap and share the challenge on.`
        : `Race ${escapeHtml(joinRacerNames(challenge.racers))}. Beat ${escapeHtml(leader.name)} to take the lead, or add your best lap and share the challenge on.`,
      extraHtml: `${racerSummaryHtml(challenge)}${newcomerAssistiveText(sender.name)}`,
      className: 'invitation',
      actionList: [
        { label: 'ACCEPT CHALLENGE', primary: true, action: () => void acceptWithMotion() },
        { label: 'TRY LATER', navigation: true, action: openFullTurn },
        { label: 'SHARE', share: true, action: () => void shareExistingChallenge() },
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
    // Let the landscape viewport paint before handing control to TURN. This is a UI
    // transition only; YOUR TURN does not sample or rewrite motion steering state.
    await nextPaint();
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
    useChallengeField();

    document.querySelector('#resetButton')?.click();
    useChallengeField();
    const access = state.pendingAccess || raceSession.prepareManualAccess();
    await raceSession.startGame(access.fullscreenPromise);

    // TURN's built-in 220 ms start centering can run while YOUR TURN is still
    // completing its portrait -> landscape fullscreen/orientation handoff. Keep the
    // staged scene paused, let fresh landscape motion readings arrive, then invoke
    // TURN's existing RECALIBRATE control once before the player can start driving.
    if (access.mode === 'motion' && runtime.state.sensorMode) {
      await new Promise((resolve) => setTimeout(resolve, POST_LANDSCAPE_RECALIBRATE_DELAY_MS));
      document.querySelector('#calibrateButton')?.click();
    }

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
    useChallengeField();
    if (!state.bestRun || candidate.time < state.bestRun.time) state.bestRun = candidate;
    const leader = challengeLeader(state.challenge);
    if (candidate.time < leader.time) {
      state.winningLap = candidate;
      state.phase = 'result';
      stopRaceForModal('result');
      showShareResult(candidate);
      return;
    }
    state.phase = runtime.state.lapActive ? 'racing' : 'staged';
    state.scene.setPhase(state.phase);
  }

  function showShareResult(candidate = state.bestRun) {
    if (!candidate) {
      showNoLapYet();
      return;
    }
    const leader = challengeLeader(state.challenge);
    const ahead = leader.time - candidate.time;
    const won = ahead > 0;
    const previousSelf = state.challenge.racers.find((racer) => racer.id === state.racerId);
    const keepingPrevious = previousSelf && previousSelf.time <= candidate.time;
    showSessionModal({
      titleText: won ? `YOU BEAT ${leader.name}` : 'YOUR BEST LAP',
      detailsHtml: `
        <strong>${formatChallengeTime(candidate.time)}</strong>
        <span>${won ? `${ahead.toFixed(3)} seconds ahead` : `${Math.abs(ahead).toFixed(3)} seconds behind ${escapeHtml(leader.name)}`}</span>`,
      copyHtml: keepingPrevious
        ? `Your earlier ${formatChallengeTime(previousSelf.time)} car is still faster, so that run will stay in the challenge when you share.`
        : 'Add your car to this challenge and send it on. If you are already in the challenge, this faster run replaces your earlier car.',
      requestName: true,
      className: 'result',
      actionList: [
        { label: 'SHARE YOUR TURN', share: true, action: () => void shareContribution(candidate) },
        { label: 'RACE AGAIN', action: raceAgain },
        { label: 'GET THE GAME', game: true, action: openFullTurn },
        { label: 'ABOUT TURN', kind: 'quiet', action: () => showAbout(() => showShareResult(candidate)) }
      ]
    });
  }

  function showNoLapYet() {
    showSessionModal({
      titleText: 'NO LAP YET',
      copyHtml: 'Finish a valid lap to add your own car to this challenge. You can also pass the current challenge on unchanged.',
      className: 'share-empty',
      actionList: [
        { label: 'KEEP RACING', primary: true, action: resumeRace },
        { label: 'SHARE ORIGINAL', share: true, action: () => void shareExistingChallenge() },
        { label: 'ABOUT TURN', kind: 'quiet', action: () => showAbout(showNoLapYet) }
      ]
    });
  }

  async function shareContribution(candidate) {
    const racerName = ui.playerName();
    const nextChallenge = challengeWithLap({
      challenge: state.challenge,
      racerId: state.racerId,
      racerName,
      lap: candidate
    });
    const encoded = await encodeChallenge(nextChallenge);
    ui.setStatus('Preparing challenge link…');
    const prepared = await makeShareableChallengeUrl(encoded);
    const url = prepared.url;
    ui.setStatus('');
    const leader = challengeLeader(nextChallenge);
    const text = nextChallenge.racers.length === 1
      ? `${racerName} challenges you with ${formatChallengeTime(candidate.time)}. Your turn.`
      : `${racerName} joined a ${nextChallenge.racers.length}-car YOUR TURN challenge. Fastest: ${leader.name} ${formatChallengeTime(leader.time)}. Your turn.`;
    return shareUrl({
      title: `${racerName} sends you YOUR TURN`,
      text,
      url,
      success: 'Your growing challenge is ready to send.'
    });
  }

  async function shareExistingChallenge() {
    const encoded = await encodeChallenge(state.challenge);
    ui.setStatus('Preparing challenge link…');
    const prepared = await makeShareableChallengeUrl(encoded);
    const url = prepared.url;
    ui.setStatus('');
    const leader = challengeLeader(state.challenge);
    return shareUrl({
      title: 'YOUR TURN — a TURN challenge',
      text: `Race ${state.challenge.racers.length === 1 ? leader.name : `${state.challenge.racers.length} players`}. Fastest: ${leader.name} ${formatChallengeTime(leader.time)}. Your turn.`,
      url,
      success: 'Challenge ready to send.'
    });
  }

  function showReceivedLegacyGiveUp() {
    showSessionModal({
      titleText: `${request.responder} PASSED IT ON`,
      detailsHtml: `<strong>YOUR TURN</strong><span>${formatChallengeTime(challengeLeader(state.challenge).time)} is still the time to beat</span>`,
      copyHtml: 'This is an older challenge reply. You can race it or send the challenge on.',
      className: 'result',
      actionList: [
        { label: 'RACE THIS CHALLENGE', primary: true, action: () => void acceptWithMotion() },
        { label: 'SHARE', share: true, action: () => void shareExistingChallenge() },
        { label: 'GET THE GAME', game: true, action: openFullTurn },
        { label: 'ABOUT TURN', kind: 'quiet', action: () => showAbout(showReceivedLegacyGiveUp) }
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
      titleText: 'THE CHALLENGE',
      copyHtml: state.bestRun
        ? `Your best lap so far is ${formatChallengeTime(state.bestRun.time)}. Keep racing or add it to the challenge and share.`
        : escapeHtml(reason),
      extraHtml: racerSummaryHtml(state.challenge),
      className: 'paused',
      actionList: [
        { label: 'RESUME', primary: true, action: resumeRace },
        { label: 'RESTART LAP', action: restartFromPause },
        { label: 'SHARE', share: true, action: shareFromChallengeMenu },
        { label: 'ABOUT TURN', kind: 'quiet', action: () => showAbout(() => showChallengeMenuView(reason)) }
      ]
    });
  }

  function shareFromChallengeMenu() {
    if (!state.bestRun) {
      showNoLapYet();
      return;
    }
    state.phase = 'result';
    state.scene?.setPhase('result');
    hideRaceUi();
    ui.hideRaceChrome();
    document.body.classList.remove('yourturn-racing');
    document.body.classList.add('yourturn-preview');
    // Opening THE CHALLENGE deliberately hard-paused the race. Carry that paused
    // state into the result preview so the top-right control truthfully shows Play.
    state.ambientPaused = true;
    state.paused = false;
    ui.setMotionPaused(true);
    showShareResult(state.bestRun);
  }

  function resumeRace() {
    ui.closeModal();
    state.paused = false;
    state.backgroundPaused = false;
    runtime.state.lastFrame = performance.now();
    animation.resume();
    showRaceUi(runtime.state.sensorMode);
    ui.showRaceChrome();
  }

  function restartFromPause() {
    document.querySelector('#resetButton')?.click();
    useChallengeField();
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
    useChallengeField();
    showRaceUi(runtime.state.sensorMode);
    document.querySelector('#resetButton')?.click();
    useChallengeField();
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
    useChallengeField();
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
        { label: 'BACK', back: true, action: returnAction },
        { label: 'GET THE GAME', game: true, action: openFullTurn }
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
      useChallengeField();
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

  function useChallengeField() {
    runtime.state.competitorLaps = state.challengeLaps.map((lap) => ({
      ...lap,
      frames: lap.frames.map((frame) => ({ ...frame }))
    }));
    syncPrimaryRivalState(runtime.state);
    runtime.syncCompetitorVisuals?.();
    runtime.setRacePosition?.(null, state.challengeLaps.length + 1);
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

function racerToLap(racer, challenge) {
  return {
    time: racer.time,
    hitAt: null,
    challengeId: `yourturn-${racer.id}`,
    racerId: racer.id,
    challengerName: racer.name,
    carId: challenge.carId,
    carColor: challenge.carColor,
    carSecondaryColor: challenge.carSecondaryColor,
    frames: racer.frames.map((frame) => ({ ...frame }))
  };
}

function challengeVehicle(challenge) {
  return {
    carId: challenge.carId,
    color: challenge.carColor,
    secondaryColor: challenge.carSecondaryColor
  };
}

function racerSummaryHtml(challenge) {
  if (!challenge?.racers?.length) return '';
  return `<div class="yourturn-racer-summary" aria-label="Cars in this challenge">${challenge.racers.map((racer, index) => `
    <span${index === 0 ? ' data-leader="true"' : ''}>
      <b>${escapeHtml(racer.name)}</b>
      <small>${formatChallengeTime(racer.time)}</small>
    </span>`).join('')}</div>`;
}

function joinRacerNames(racers) {
  const names = racers.map((racer) => racer.name);
  if (names.length <= 1) return names[0] || '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

function loadOrCreateRacerId() {
  try {
    const existing = localStorage.getItem(RACER_ID_KEY);
    if (existing) return existing;
    const created = createRacerId();
    localStorage.setItem(RACER_ID_KEY, created);
    return created;
  } catch (_) {
    return createRacerId();
  }
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