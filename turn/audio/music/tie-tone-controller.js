export function createTieToneController({ context, getStepSeconds }) {
  const active = new Map();

  function remember(lane, state) { active.set(lane, state); }
  function clear() { active.clear(); }

  function sustain(lane, time, heldSteps) {
    const state = active.get(lane);
    if (!state || heldSteps <= 1) return;
    const stepSeconds = getStepSeconds();
    const end = time + stepSeconds * heldSteps;
    const at = Math.max(time + .001, state.attackEnd + .0005);
    const release = Math.min(.05, stepSeconds * .35);
    const releaseStart = Math.max(at, end - release);
    const sustainGain = Math.max(.0002, state.voice.gain);
    const gain = state.amp.gain;

    // Replace the voice's normal short decay with an explicit gate: attack, hold, release.
    gain.cancelScheduledValues(at);
    gain.setValueAtTime(sustainGain, at);
    gain.setValueAtTime(sustainGain, releaseStart);
    gain.exponentialRampToValueAtTime(.0001, end);

    // AudioScheduledSourceNode applies the latest scheduled stop call while still active.
    try { state.body.stop(end + .01); state.harmonic?.stop(end + .01); } catch (_) {}
    state.end = end;
  }

  return Object.freeze({ remember, sustain, clear });
}
