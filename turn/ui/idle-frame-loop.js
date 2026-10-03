// A frame loop for something drawn only in a race (#1045). While there is nothing to
// draw (ROADBOOK, GARAGE, PAUSED settings, no rival nearby) it checks four times a
// second instead of every frame, and wakes at once when the race state changes.
// `render(now)` returns false when there is nothing to draw.

const IDLE_CHECK_MS = 250;

export function createIdleFrameLoop(render, { windowRef = window } = {}) {
  let frame = 0;
  let timer = 0;
  let stopped = false;

  function tick(now) {
    frame = 0;
    if (stopped) return;
    if (render(now) === false) timer = windowRef.setTimeout(wake, IDLE_CHECK_MS);
    else frame = windowRef.requestAnimationFrame(tick);
  }

  function wake() {
    if (stopped) return;
    windowRef.clearTimeout(timer);
    timer = 0;
    if (!frame) frame = windowRef.requestAnimationFrame(tick);
  }

  windowRef.addEventListener('turn:ui-state-change', wake);
  wake();

  return Object.freeze({
    wake,
    get idle() {
      return !frame;
    },
    stop() {
      stopped = true;
      windowRef.cancelAnimationFrame(frame);
      windowRef.clearTimeout(timer);
      windowRef.removeEventListener('turn:ui-state-change', wake);
    }
  });
}
