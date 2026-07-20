export const LAP_CHECKPOINTS = Object.freeze([
  0.08,
  0.16,
  0.24,
  0.32,
  0.40,
  0.48,
  0.56,
  0.64,
  0.72,
  0.80,
  0.88,
  0.94
]);

const CHECKPOINT_GATE_RADIUS_FACTOR = 0.62;

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

export function updateLapProgressState({
  state,
  nearestAfter,
  samples,
  trackWidth,
  checkpoints = LAP_CHECKPOINTS,
  now,
  beginTimedLap,
  completeLap,
  recordGhostFrame
}) {
  const nextCheckpoint = checkpoints[state.lapCheckpointIndex];

  if (state.lapActive && nextCheckpoint != null) {
    const checkpointSample = checkpointSampleAt(samples, nextCheckpoint);
    const movingForwardThroughGate = state.velocity.dot(checkpointSample.tangent) > 2;
    const gateRadius = trackWidth * CHECKPOINT_GATE_RADIUS_FACTOR;
    const dx = state.position.x - checkpointSample.point.x;
    const dz = state.position.z - checkpointSample.point.z;
    const insideCheckpointGate = dx * dx + dz * dz <= gateRadius * gateRadius;

    // A checkpoint is a physical gate on the racing line, not merely a percentage of
    // whichever bit of track happens to be nearest. This prevents lake/house shortcuts.
    if (movingForwardThroughGate && insideCheckpointGate) {
      state.lapCheckpointIndex += 1;
    }
  }

  const crossedStart = state.lastProgress > 0.82 && state.progress < 0.18;
  const movingForwardAtStart = state.velocity.dot(samples[0].tangent) > 5;
  const crossedStartOnTrack = crossedStart
    && movingForwardAtStart
    && state.trackDistance < trackWidth * CHECKPOINT_GATE_RADIUS_FACTOR;

  if (crossedStartOnTrack) {
    if (!state.lapActive) {
      beginTimedLap(now);
    } else if (state.lapCheckpointIndex >= checkpoints.length) {
      completeLap(now);
    } else {
      // Crossing the line without every physical gate starts a fresh timed attempt, never a lap.
      beginTimedLap(now);
    }
  }

  if (state.lapActive) {
    state.lapElapsed = (now - state.lapStartedAt) / 1000;
    recordGhostFrame();
  } else {
    state.lapElapsed = 0;
  }
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
        carId: state.vehicleId || 'sedan',
        carColor: state.vehicleColor || '#ffd43b',
        carSecondaryColor: state.vehicleSecondaryColor || '#f8f9fa',
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

function checkpointSampleAt(samples, progress) {
  const index = Math.round(progress * samples.length) % samples.length;
  return samples[index];
}

function formatLapTime(seconds) {
  if (!Number.isFinite(seconds)) return '--:--.---';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
  return `${minutes}:${secs}.${ms}`;
}
