const REPLAY_FRAME_INTERVAL = 0.045;

export function replayFrameAt(lap, time) {
  const frames = lap?.frames || [];
  if (frames.length < 2) return null;

  const wrappedTime = Number.isFinite(lap?.time) && lap.time > 0 ? time % lap.time : time;
  let low = 0;
  let high = frames.length - 1;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (frames[mid].t < wrappedTime) low = mid + 1;
    else high = mid;
  }

  const b = frames[low];
  const a = frames[Math.max(0, low - 1)];
  const span = Math.max(0.001, b.t - a.t);
  const alpha = clamp((wrappedTime - a.t) / span, 0, 1);

  return {
    x: lerp(a.x, b.x, alpha),
    z: lerp(a.z, b.z, alpha),
    h: lerpAngle(a.h, b.h, alpha),
    s: lerp(a.s, b.s, alpha),
    d: lerp(a.d, b.d, alpha),
    p: Number.isFinite(a.p) && Number.isFinite(b.p) ? lerp(a.p, b.p, alpha) : null
  };
}

export function recordReplayFrame(state, interval = REPLAY_FRAME_INTERVAL) {
  const previous = state.recording.at(-1);
  if (previous && state.lapElapsed - previous.t < interval) return false;

  state.recording.push({
    t: state.lapElapsed,
    x: state.position.x,
    z: state.position.z,
    h: state.heading,
    s: state.steering,
    d: state.driftAmount,
    p: state.progress
  });
  return true;
}

export function normalizeReplayFrames(frames, { startSample, findProgress } = {}) {
  const normalized = Array.isArray(frames)
    ? frames.map((frame) => {
        const copy = { ...frame };
        if (!Number.isFinite(copy.p) && Number.isFinite(copy.x) && Number.isFinite(copy.z) && findProgress) {
          copy.p = findProgress(copy);
        }
        return copy;
      })
    : [];

  if (normalized.length && startSample) {
    normalized[0] = {
      ...normalized[0],
      t: 0,
      x: startSample.point.x,
      z: startSample.point.z,
      h: Math.atan2(startSample.tangent.x, startSample.tangent.z),
      p: 0
    };
  }

  return normalized;
}

function lerp(a = 0, b = 0, t = 0) {
  return a + (b - a) * t;
}

function normalizeAngle(angle) {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

function lerpAngle(a = 0, b = 0, t = 0) {
  return normalizeAngle(a + normalizeAngle(b - a) * t);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
