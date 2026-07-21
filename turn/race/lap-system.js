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

// The gate spans the whole road, both curbs and a modest amount of verge. The
// ordered twelve-gate chain still prevents major shortcuts, while a legitimate
// lap is no longer invalidated by briefly putting two wheels beyond a curb.
const LAP_GATE_HALF_WIDTH_FACTOR = 0.82;
const GATE_EPSILON = 1e-6;

export function beginTimedLapState({ state, samples, now, showMessage }) {
  const start = samples[0];

  state.lapActive = true;
  state.lapCheckpointIndex = 0;
  state.lapStartedAt = now;
  state.lapElapsed = 0;
  state.lapPreviousPosition = snapshotPosition(state.position);
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
  const currentPosition = snapshotPosition(state.position);
  const previousPosition = state.lapPreviousPosition || currentPosition;
  const gateHalfWidth = trackWidth * LAP_GATE_HALF_WIDTH_FACTOR;
  const nextCheckpoint = checkpoints[state.lapCheckpointIndex];

  if (state.lapActive && nextCheckpoint != null) {
    const checkpointSample = checkpointSampleAt(samples, nextCheckpoint);
    const movingForwardThroughGate = state.velocity.dot(checkpointSample.tangent) > 2;
    const crossedCheckpointGate = crossedForwardGate(
      previousPosition,
      currentPosition,
      checkpointSample,
      gateHalfWidth
    );

    // Keep a close-range fallback for the first frame after legacy/restored state,
    // but normal play uses the swept crossing above so a gate cannot fall between
    // two physics samples.
    const insideCheckpointGate = !state.lapPreviousPosition
      && distanceSquared(currentPosition, checkpointSample.point) <= gateHalfWidth * gateHalfWidth;

    if (movingForwardThroughGate && (crossedCheckpointGate || insideCheckpointGate)) {
      state.lapCheckpointIndex += 1;
    }
  }

  const startSample = samples[0];
  const movingForwardAtStart = state.velocity.dot(startSample.tangent) > 5;
  const crossedPhysicalStartGate = crossedForwardGate(
    previousPosition,
    currentPosition,
    startSample,
    gateHalfWidth
  );

  // Retain the old progress-wrap signal as a compatibility fallback, but require
  // the car to actually be near the physical start gate. The physical swept gate
  // is now the primary source of truth.
  const crossedStartByProgress = state.lastProgress > 0.82 && state.progress < 0.18;
  const nearPhysicalStart = distanceSquared(currentPosition, startSample.point)
    <= gateHalfWidth * gateHalfWidth;
  const crossedStartOnTrack = movingForwardAtStart
    && (crossedPhysicalStartGate || (crossedStartByProgress && nearPhysicalStart));

  if (crossedStartOnTrack) {
    if (!state.lapActive) {
      beginTimedLap(now);
    } else if (state.lapCheckpointIndex >= checkpoints.length) {
      completeLap(now);
    } else {
      // Crossing the line without every ordered physical gate starts a fresh timed
      // attempt. This preserves the anti-shortcut contract while avoiding false
      // misses caused by point-sampled gates.
      beginTimedLap(now);
    }
  }

  if (state.lapActive) {
    state.lapElapsed = (now - state.lapStartedAt) / 1000;
    recordGhostFrame();
  } else {
    state.lapElapsed = 0;
  }

  state.lapPreviousPosition = currentPosition;
}

export function completeLapState({
  state,
  samples,
  now,
  competitorLimit,
  saveGhost,
  onError
}) {
  const finishedTime = (now - state.lapStartedAt) / 1000;
  const completedLap = finishedTime > 5;
  const validLap = completedLap && state.recording.length > 20;
  let finishingPosition = null;
  let finishingTotal = null;

  if (completedLap) {
    // Freeze the race result before the saved top-four rival list is updated. The last-lap
    // result is meaningful even when this run is too slow to become a saved rival.
    const raceRivals = state.competitorLaps
      .filter((lap) => Number.isFinite(lap?.time))
      .slice(0, competitorLimit);
    finishingPosition = 1 + raceRivals.filter((lap) => lap.time < finishedTime).length;
    finishingTotal = raceRivals.length + 1;
  }

  if (validLap) {
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

      state.competitorLaps = [...state.competitorLaps, candidate]
        .filter((lap) => Number.isFinite(lap?.time) && Array.isArray(lap?.frames) && lap.frames.length > 20)
        .sort((a, b) => a.time - b.time)
        .slice(0, competitorLimit);
      state.bestTime = state.competitorLaps[0]?.time ?? Infinity;
      state.ghostFrames = state.competitorLaps[0]?.frames ?? [];
      state.ghostVisible = state.competitorLaps.length > 0;
      saveGhost?.();
    } catch (error) {
      onError?.(error);
    }
  }

  if (completedLap) {
    publishLapResult({
      position: finishingPosition,
      total: finishingTotal,
      time: finishedTime
    });
  }

  state.lapCheckpointIndex = 0;
  state.lapActive = true;
  state.lap += 1;
  state.lapStartedAt = now;
  state.lapElapsed = 0;
  state.recording = [];

  return {
    finishedTime,
    completedLap,
    validLap,
    position: finishingPosition,
    total: finishingTotal
  };
}

export function crossedForwardGate(previousPosition, currentPosition, gateSample, halfWidth) {
  if (!previousPosition || !currentPosition || !gateSample?.point || !gateSample?.tangent) return false;

  const tangentX = Number(gateSample.tangent.x) || 0;
  const tangentZ = Number(gateSample.tangent.z) || 0;
  const tangentLength = Math.hypot(tangentX, tangentZ);
  if (tangentLength <= GATE_EPSILON) return false;

  const tx = tangentX / tangentLength;
  const tz = tangentZ / tangentLength;
  const nx = -tz;
  const nz = tx;
  const centerX = Number(gateSample.point.x) || 0;
  const centerZ = Number(gateSample.point.z) || 0;

  const previousLongitudinal = (previousPosition.x - centerX) * tx
    + (previousPosition.z - centerZ) * tz;
  const currentLongitudinal = (currentPosition.x - centerX) * tx
    + (currentPosition.z - centerZ) * tz;

  if (!(previousLongitudinal <= 0 && currentLongitudinal > 0)) return false;

  const longitudinalStep = currentLongitudinal - previousLongitudinal;
  if (longitudinalStep <= GATE_EPSILON) return false;

  const crossingT = Math.min(1, Math.max(0, -previousLongitudinal / longitudinalStep));
  const crossingX = previousPosition.x + (currentPosition.x - previousPosition.x) * crossingT;
  const crossingZ = previousPosition.z + (currentPosition.z - previousPosition.z) * crossingT;
  const lateralDistance = Math.abs((crossingX - centerX) * nx + (crossingZ - centerZ) * nz);

  return lateralDistance <= halfWidth;
}

function publishLapResult(detail) {
  if (typeof globalThis.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') return;
  globalThis.dispatchEvent(new globalThis.CustomEvent('turn:lap-result', { detail }));
}

function checkpointSampleAt(samples, progress) {
  const index = Math.round(progress * samples.length) % samples.length;
  return samples[index];
}

function snapshotPosition(position) {
  return {
    x: Number(position?.x) || 0,
    z: Number(position?.z) || 0
  };
}

function distanceSquared(a, b) {
  const dx = (Number(a?.x) || 0) - (Number(b?.x) || 0);
  const dz = (Number(a?.z) || 0) - (Number(b?.z) || 0);
  return dx * dx + dz * dz;
}
