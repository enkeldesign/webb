export function createFlightAudio() {
  let context = null;
  let master = null;
  let engineOscillator = null;
  let engineOvertone = null;
  let engineFilter = null;
  let engineGain = null;
  let windSource = null;
  let windFilter = null;
  let windGain = null;
  let enabled = true;

  async function start() {
    if (!enabled) return false;
    ensureGraph();
    if (context.state === 'suspended') await context.resume();
    return true;
  }

  function ensureGraph() {
    if (context) return;
    const AudioContextType = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextType) return;

    context = new AudioContextType();
    master = context.createGain();
    master.gain.value = 0.22;
    master.connect(context.destination);

    engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 620;
    engineFilter.Q.value = 0.7;
    engineGain = context.createGain();
    engineGain.gain.value = 0.055;
    engineFilter.connect(engineGain).connect(master);

    engineOscillator = context.createOscillator();
    engineOscillator.type = 'sawtooth';
    engineOscillator.frequency.value = 56;
    engineOscillator.connect(engineFilter);
    engineOscillator.start();

    engineOvertone = context.createOscillator();
    engineOvertone.type = 'triangle';
    engineOvertone.frequency.value = 112;
    const overtoneGain = context.createGain();
    overtoneGain.gain.value = 0.18;
    engineOvertone.connect(overtoneGain).connect(engineFilter);
    engineOvertone.start();

    windFilter = context.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 900;
    windFilter.Q.value = 0.55;
    windGain = context.createGain();
    windGain.gain.value = 0.012;
    windFilter.connect(windGain).connect(master);
    windSource = context.createBufferSource();
    windSource.buffer = createNoiseBuffer(context);
    windSource.loop = true;
    windSource.connect(windFilter);
    windSource.start();
  }

  function update({ speed = 0, throttle = 0, stalled = false } = {}) {
    if (!context || !enabled) return;
    const now = context.currentTime;
    const speedNormal = clamp((speed - 20) / 70, 0, 1);
    const baseFrequency = 48 + throttle * 54 + speedNormal * 18;
    engineOscillator.frequency.setTargetAtTime(baseFrequency, now, 0.08);
    engineOvertone.frequency.setTargetAtTime(baseFrequency * 2.01, now, 0.08);
    engineFilter.frequency.setTargetAtTime(420 + throttle * 760, now, 0.1);
    engineGain.gain.setTargetAtTime(stalled ? 0.035 : 0.05 + throttle * 0.045, now, 0.08);
    windFilter.frequency.setTargetAtTime(540 + speedNormal * 1450, now, 0.14);
    windGain.gain.setTargetAtTime(0.006 + speedNormal * 0.045, now, 0.12);
  }

  function checkpoint() {
    playNotes([523.25, 659.25, 783.99], 0.075, 0.06, 'square');
  }

  function complete() {
    playNotes([392, 523.25, 659.25, 783.99], 0.12, 0.09, 'triangle');
  }

  function warning() {
    playNotes([196, 164.81], 0.15, 0.07, 'sawtooth');
  }

  function playNotes(frequencies, spacing, volume, type) {
    if (!enabled) return;
    ensureGraph();
    if (!context) return;
    void context.resume();
    const startAt = context.currentTime + 0.01;
    for (let index = 0; index < frequencies.length; index += 1) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const noteAt = startAt + index * spacing;
      oscillator.type = type;
      oscillator.frequency.value = frequencies[index];
      gain.gain.setValueAtTime(0.0001, noteAt);
      gain.gain.exponentialRampToValueAtTime(volume, noteAt + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteAt + spacing * 1.7);
      oscillator.connect(gain).connect(master);
      oscillator.start(noteAt);
      oscillator.stop(noteAt + spacing * 1.8);
    }
  }

  async function setEnabled(nextEnabled) {
    enabled = Boolean(nextEnabled);
    if (!context) {
      if (enabled) await start();
      return enabled;
    }
    const now = context.currentTime;
    master.gain.setTargetAtTime(enabled ? 0.22 : 0.0001, now, 0.025);
    if (enabled && context.state === 'suspended') await context.resume();
    return enabled;
  }

  async function suspend() {
    if (context?.state === 'running') await context.suspend();
  }

  async function resume() {
    if (enabled && context?.state === 'suspended') await context.resume();
  }

  function isEnabled() {
    return enabled;
  }

  return Object.freeze({
    start,
    update,
    checkpoint,
    complete,
    warning,
    setEnabled,
    suspend,
    resume,
    isEnabled
  });
}

function createNoiseBuffer(context) {
  const length = Math.max(1, Math.floor(context.sampleRate * 1.2));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channel = buffer.getChannelData(0);
  let previous = 0;
  for (let index = 0; index < length; index += 1) {
    const white = Math.random() * 2 - 1;
    previous = previous * 0.78 + white * 0.22;
    channel[index] = previous;
  }
  return buffer;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
