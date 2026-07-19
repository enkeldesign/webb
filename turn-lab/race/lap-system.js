export function beginTimedLapState({ state, samples, now, showMessage }) {
  const start = samples[0];

  state.lapActive = true;
  state.lapCheckpointIndex = 0;
  state.lapStartedAt = now;
  state.lapElapsed = 0;
  state.recording = [{
    t: 0,
    x: start.point.x,
    z: start.point.z,
    h: Math.atan2(start.tangent.x, start.tangent.z),
    s: state.steering,
    d: state.driftAmount,
    p: 0
  }];

  showMessage?.('GO!');
}

export function completeLapState({
  state,
  samples,
  now,
  competitorLimit,
  saveGhost,
  showMessage,
  onError
}) {
  const finishedTime = (now - state.lapStartedAt) / 1000;
  const validLap = finishedTime > 5 && state.recording.length > 20;

  if (validLap) {
    const previousBest = state.bestTime;
    let message = 'LAP ' + formatLapTime(finishedTime);

    try {
      const candidateFrames = state.recording.map((frame) => ({ ...frame }));
      if (candidateFrames.length) {
        const start = samples[0];
        candidateFrames[0] = {
          ...candidateFrames[0],
          t: 0,
          x: start.point.x,
          z: start.point.z,
          h: Math.atan2(start.tangent.x, start.tangent.z),
          p: 0
        };
      }

      const candidate = {
        time: finishedTime,
        hitAt: Date.now(),
        frames: candidateFrames
      };

      const nextLaps = [...state.competitorLaps, candidate]
        .filter((lap) => Number.isFinite(lap?.time) && Array.isArray(lap?.frames) && lap.frames.length > 20)
        .sort((a, b) => a.time - b.time)
        .slice(0, competitorLimit);

      const rank = nextLaps.indexOf(candidate);
      state.competitorLaps = nextLaps;
      state.bestTime = state.competitorLaps[0]?.time ?? Infinity;
      state.ghostFrames = state.competitorLaps[0]?.frames ?? [];
      state.ghostVisible = state.competitorLaps.length > 0;
      saveGhost?.();

      if (finishedTime < previousBest) {
        message = 'NEW BEST ' + formatLapTime(finishedTime);
      } else if (rank >= 0) {
        message = 'TOP ' + (rank + 1) + ' LAP ' + formatLapTime(finishedTime);
      }
    } catch (error) {
      onError?.(error);
    }

    showMessage?.(message);
  }

  state.lapCheckpointIndex = 0;
  state.lapActive = true;
  state.lap += 1;
  state.lapStartedAt = now;
  state.lapElapsed = 0;
  state.recording = [];

  return { finishedTime, validLap };
}

function formatLapTime(seconds) {
  if (!Number.isFinite(seconds)) return '--:--.---';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
  return `${minutes}:${secs}.${ms}`;
}
