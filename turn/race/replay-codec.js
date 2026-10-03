// Stored replays (#1045): a rival lap is kept on the device as compact integer
// columns instead of one JSON object per frame. Each field is rounded to a fixed
// step (finer than the replay can show) and stored as the change from the frame
// before, which is a small number. A 75-second lap takes about a fifth of the space.
// Laps saved before this keep their plain frames; both read back the same way.

const CODEC = 'q1';
const FIELD_STEPS = Object.freeze({
  t: 0.001,
  x: 0.01,
  y: 0.01,
  z: 0.01,
  h: 0.0001,
  s: 0.001,
  d: 0.001,
  p: 0.00001
});
const DEFAULT_STEP = 0.0001;

const stepFor = (key) => FIELD_STEPS[key] ?? DEFAULT_STEP;
const decimalsFor = (step) => Math.max(0, Math.ceil(-Math.log10(step)));

export function isEncodedReplay(frames) {
  return frames?.codec === CODEC && Array.isArray(frames.keys) && frames.columns && typeof frames.columns === 'object';
}

// The number of frames, stored either way.
export function storedReplayFrameCount(frames) {
  if (Array.isArray(frames)) return frames.length;
  return isEncodedReplay(frames) ? Number(frames.count) || 0 : 0;
}

// Frames whose fields are all finite numbers are encoded; anything else is kept plain.
export function encodeReplayFrames(frames) {
  if (!Array.isArray(frames) || !frames.length || isEncodedReplay(frames)) return frames;
  const keys = [...new Set(frames.flatMap((frame) => Object.keys(frame || {})))];
  if (!frames.every((frame) => keys.every((key) => Number.isFinite(frame?.[key])))) return frames;
  const columns = {};
  for (const key of keys) {
    const step = stepFor(key);
    let previous = 0;
    columns[key] = frames.map((frame) => {
      const value = Math.round(frame[key] / step);
      const delta = value - previous;
      previous = value;
      return delta;
    });
  }
  return { codec: CODEC, count: frames.length, keys, columns };
}

export function decodeReplayFrames(frames) {
  if (!isEncodedReplay(frames)) return Array.isArray(frames) ? frames : [];
  const count = Number(frames.count) || 0;
  const decoded = Array.from({ length: count }, () => ({}));
  for (const key of frames.keys) {
    const column = frames.columns[key];
    if (!Array.isArray(column) || column.length !== count) return [];
    const step = stepFor(key);
    const decimals = decimalsFor(step);
    let value = 0;
    for (let index = 0; index < count; index += 1) {
      value += Number(column[index]) || 0;
      decoded[index][key] = Number((value * step).toFixed(decimals));
    }
  }
  return decoded;
}
