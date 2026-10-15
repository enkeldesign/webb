const REPLAY_FRAME_INTERVAL = 0.045;
const replayFrameCache = new WeakMap();
const tutorialRivalLeads = new WeakMap();
const TUTORIAL_RIVAL_LEAD_METRES = 48;
const TUTORIAL_RIVAL_LEAD_HOLD_SECONDS = 2;

// Only TURN TUTORIAL arms this presentation offset, after creating its session rival.
// Keep it outside the lap object: recording, ranking and storage use the original lap.
export function beginTutorialRivalLead(lap, state) {
  const frames = lap?.frames;
  if (!lap?.sessionOnly || !state || !Number.isFinite(lap.time) || !Array.isArray(frames) || frames.length < 2) return false;
  const start = frames[0];
  const forwardX = Math.sin(start.h);
  const forwardZ = Math.cos(start.h);
  let previous = start;
  let previousAhead = 0;
  for (let i = 1; i < frames.length; i += 1) {
    const frame = frames[i];
    if (frame.t >= lap.time / 4) break;
    const ahead = (frame.x - start.x) * forwardX + (frame.z - start.z) * forwardZ;
    if (ahead >= TUTORIAL_RIVAL_LEAD_METRES) {
      const fraction = (TUTORIAL_RIVAL_LEAD_METRES - previousAhead) / (ahead - previousAhead);
      const seconds = lerp(previous.t, frame.t, fraction);
      const pose = replayFrameAt(lap, seconds);
      // Avoid introducing a rival far to the side after an unusual opening excursion.
      if (!pose || !Number.isFinite(seconds) || seconds <= 0
        || Math.hypot(pose.x - start.x, pose.z - start.z) > TUTORIAL_RIVAL_LEAD_METRES * 1.5) return false;
      // Smoothly lose the lead without ever running the recording backwards.
      const fadeSeconds = Math.max(8, seconds * 2);
      if (TUTORIAL_RIVAL_LEAD_HOLD_SECONDS + fadeSeconds >= lap.time) return false;
      tutorialRivalLeads.set(lap, { state, lapNumber: state.lap + 1, seconds, fadeSeconds, lastTime: 0 });
      return true;
    }
    previous = frame;
    previousAhead = ahead;
  }
  return false;
}

// Used only by car placement. All official replay consumers retain replayFrameAt.
// Race elapsed time freezes on pause/background; leaving/restarting ends the lead.
export function tutorialRivalPlaybackTime(lap, time, state) {
  const lead = tutorialRivalLeads.get(lap);
  if (!lead || lead.state !== state) return time;
  if (!state.running || !state.lapActive || state.lap !== lead.lapNumber
    || time < lead.lastTime || time >= TUTORIAL_RIVAL_LEAD_HOLD_SECONDS + lead.fadeSeconds) {
    tutorialRivalLeads.delete(lap);
    return time;
  }
  lead.lastTime = time;
  const phase = clamp((time - TUTORIAL_RIVAL_LEAD_HOLD_SECONDS) / lead.fadeSeconds, 0, 1);
  return time + lead.seconds * (1 - phase * phase * (3 - 2 * phase));
}

export function replayFrameAt(lap, time) {
  const frames = lap?.frames || [];
  if (frames.length < 2) return null;

  const wrappedTime = Number.isFinite(lap?.time) && lap.time > 0 ? time % lap.time : time;
  const cacheable = lap !== null && typeof lap === 'object';
  if (cacheable) {
    const cached = replayFrameCache.get(lap);
    if (
      cached &&
      cached.frames === frames &&
      cached.frameCount === frames.length &&
      cached.time === wrappedTime
    ) {
      return cached.frame;
    }
  }

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
  const frame = {
    x: lerp(a.x, b.x, alpha),
    z: lerp(a.z, b.z, alpha),
    h: lerpAngle(a.h, b.h, alpha),
    s: lerp(a.s, b.s, alpha),
    d: lerp(a.d, b.d, alpha),
    p: Number.isFinite(a.p) && Number.isFinite(b.p) ? lerp(a.p, b.p, alpha) : null
  };

  if (cacheable) {
    replayFrameCache.set(lap, {
      frames,
      frameCount: frames.length,
      time: wrappedTime,
      frame
    });
  }
  return frame;
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
