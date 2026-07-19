export const GAME_MODE = Object.freeze({
  STAGED: 'staged',
  RACING: 'racing',
  SPECTATING: 'spectating'
});

export function installGameModeState(state) {
  state.mode = GAME_MODE.STAGED;
  state.lapCheckpointIndex = Number.isFinite(state.lapCheckpointIndex) ? state.lapCheckpointIndex : 0;
  state.lapStartedAt = Number.isFinite(state.lapStartedAt) ? state.lapStartedAt : 0;
  state.lapElapsed = Number.isFinite(state.lapElapsed) ? state.lapElapsed : 0;
  state.recording = Array.isArray(state.recording) ? state.recording : [];

  Object.defineProperty(state, 'lapActive', {
    configurable: true,
    enumerable: true,
    get() {
      return state.mode === GAME_MODE.RACING;
    },
    set(active) {
      if (active) {
        state.mode = GAME_MODE.RACING;
      } else if (state.mode === GAME_MODE.RACING) {
        state.mode = GAME_MODE.STAGED;
      }
    }
  });

  return state;
}

export function setGameModeState(state, mode) {
  if (!Object.values(GAME_MODE).includes(mode)) {
    console.warn('TURN: ignored unknown game mode', mode);
    return state.mode;
  }

  state.mode = mode;
  return state.mode;
}

export function resetRaceToStage({
  state,
  samples,
  showFeedback = true,
  showMessage,
  setRacePosition
}) {
  const startIndex = samples.length - 24;
  const start = samples[startIndex];

  state.position.copy(start.point);
  state.position.y = 0.18;
  state.velocity.set(0, 0, 0);
  state.heading = Math.atan2(start.tangent.x, start.tangent.z);
  state.speed = 0;
  state.driftAmount = 0;
  state.progress = startIndex / samples.length;
  state.lastProgress = state.progress;
  state.nearestTrackIndex = startIndex;
  state.lapCheckpointIndex = 0;
  state.lapActive = false;
  state.lapStartedAt = 0;
  state.lapElapsed = 0;
  state.recording = [];

  setRacePosition?.(null, state.competitorLaps.length + 1);
  if (showFeedback) showMessage?.('READY FOR THE LINE');
}

export function prepareRaceStartState(state) {
  state.lapStartedAt = 0;
  state.lapElapsed = 0;
}
