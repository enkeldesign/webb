export function createTieToneController({ getStepSeconds }) {
  const active = new Map();
  function remember(lane, state) { active.set(lane, state); }
  function clear() { active.clear(); }
  function sustain(lane, time, heldSteps) {
    const state = active.get(lane);
    if (!state || heldSteps <= 1) return;
    const stepSeconds = getStepSeconds();
    const end = time + stepSeconds * heldSteps;
    const at = Math.max(time + .001, state.attackEnd + .0005);
    const releaseStart = Math.max(at, end - Math.min(.05, stepSeconds * .35));
    const sustainGain = Math.max(.0002, state.voice.gain);
    const gain = state.amp.gain;
    gain.cancelScheduledValues(at);
    gain.setValueAtTime(sustainGain, at);
    gain.setValueAtTime(sustainGain, releaseStart);
    gain.exponentialRampToValueAtTime(.0001, end);
    try { state.body.stop(end + .01); state.harmonic?.stop(end + .01); } catch (_) {}
    state.end = end;
  }
  return Object.freeze({ remember, sustain, clear });
}
