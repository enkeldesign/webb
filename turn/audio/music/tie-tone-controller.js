export function createTieToneController({ context, getStepSeconds }) {
  const active = new Map();

  function remember(lane, state) { active.set(lane, state); }
  function clear() { active.clear(); }

  function extend(lane, time) {
    const state = active.get(lane);
    if (!state) return;
    const end = time + getStepSeconds();
    if (end <= state.end) return;
    const at = Math.min(time, Math.max(context.currentTime + .002, state.attackEnd));
    const gain = state.amp.gain;
    if (typeof gain.cancelAndHoldAtTime === 'function') gain.cancelAndHoldAtTime(at);
    else {
      gain.cancelScheduledValues(at);
      gain.setValueAtTime(Math.max(.0002, state.voice.gain * .65), at);
    }
    gain.exponentialRampToValueAtTime(.0001, end);
    try { state.body.stop(end + .01); state.harmonic?.stop(end + .01); } catch (_) {}
    state.end = end;
  }

  return Object.freeze({ remember, extend, clear });
}
