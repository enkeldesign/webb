// Which display frames a renderer draws (#1045, Erik's stutter): at most 60 a second,
// as the simulation runs, but never fewer than the display gives on a 60 Hz screen.
//
// The display's refresh period is measured from recent callbacks (their median). At
// about 60 Hz or slower every frame is drawn: the cap has nothing to remove there, and
// browsers' frame timestamps jitter (Safari rounds them to whole milliseconds), so a
// strict 16.07 ms threshold dropped on-time frames, a 33 ms jump every second or two,
// most visible at speed. Faster displays keep a 60 Hz grid with half a refresh of
// tolerance: 120 Hz draws every other frame, 90 Hz two of every three, 72-80 Hz about
// five of six.
// Up to about 65 Hz (a period of 92% of 1/60 s or more) counts as a 60 Hz display:
// enough for its jitter, not enough to let a 72, 75 or 80 Hz display past the cap.
const PASS_THROUGH_SHARE = 0.92;
const SAMPLE_COUNT = 15;
const MIN_SAMPLES = 5;
const MAX_SAMPLE_MS = 100;

export function createFrameCadence({ maxFps = 60 } = {}) {
  const interval = 1000 / maxFps;
  const deltas = [];
  let lastCallbackAt = -Infinity;
  let lastDeliveredAt = -Infinity;

  const displayPeriod = () => {
    if (deltas.length < MIN_SAMPLES) return interval;
    const sorted = [...deltas].sort((a, b) => a - b);
    return sorted[sorted.length >> 1];
  };

  return Object.freeze({
    reset() {
      lastCallbackAt = -Infinity;
      lastDeliveredAt = -Infinity;
      deltas.length = 0;
    },
    get displayPeriod() {
      return displayPeriod();
    },
    /** Whether the frame at `time` (the callback's timestamp, ms) is drawn. */
    shouldDraw(time) {
      if (Number.isFinite(lastCallbackAt)) {
        const delta = time - lastCallbackAt;
        if (delta > 0 && delta < MAX_SAMPLE_MS) {
          deltas.push(delta);
          if (deltas.length > SAMPLE_COUNT) deltas.shift();
        }
      }
      lastCallbackAt = time;

      const period = displayPeriod();
      if (period >= interval * PASS_THROUGH_SHARE || !Number.isFinite(lastDeliveredAt)) {
        lastDeliveredAt = time;
        return true;
      }
      const tolerance = period / 2;
      const elapsed = time - lastDeliveredAt;
      if (elapsed < interval - tolerance) return false;
      // Advance by whole 60 Hz slots, so 90 Hz keeps a two-in-three cadence instead of
      // falling to every other frame; a long gap snaps back to the current time.
      lastDeliveredAt += Math.max(1, Math.floor((elapsed + tolerance) / interval)) * interval;
      if (Math.abs(time - lastDeliveredAt) > interval * 2) lastDeliveredAt = time;
      return true;
    }
  });
}
