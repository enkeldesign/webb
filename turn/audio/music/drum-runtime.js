import { DRUM_KITS } from './instrument-bank.js?revision=r184-score-v2';

export function createDrumRuntime({ context, masterGain, noiseBuffer }) {
  const sources = new Set();
  const graphs = new Map();
  const gainNode = (gain = 1) => new GainNode(context, { gain });
  const cleanup = (source) => {
    const nodes = graphs.get(source); if (!nodes) return;
    graphs.delete(source); for (const node of nodes) { try { node?.disconnect?.(); } catch (_) {} }
  };
  const track = (source) => {
    sources.add(source);
    source.addEventListener?.('ended', () => { sources.delete(source); cleanup(source); }, { once: true });
    return source;
  };
  const kit = (name) => DRUM_KITS[name] || DRUM_KITS.classic;
  function stop() {
    for (const source of sources) { try { source.stop(); } catch (_) {} }
    for (const source of [...graphs.keys()]) cleanup(source);
    sources.clear();
  }
  function kick(time, name) {
    const k = kit(name), osc = track(context.createOscillator()), amp = gainNode(k.kickGain);
    osc.type = 'sine'; osc.frequency.setValueAtTime(k.kickStart, time);
    osc.frequency.exponentialRampToValueAtTime(k.kickEnd, time + k.kickLength * .88);
    amp.gain.setValueAtTime(k.kickGain, time); amp.gain.exponentialRampToValueAtTime(.0001, time + k.kickLength);
    osc.connect(amp); amp.connect(masterGain); graphs.set(osc, [osc, amp]); osc.start(time); osc.stop(time + k.kickLength + .01);
  }
  function noise(time, { type = 'bandpass', frequency = 1400, gain = .12, duration = .12, q = .55 } = {}) {
    const source = track(context.createBufferSource()), filter = context.createBiquadFilter(), amp = gainNode(gain);
    source.buffer = noiseBuffer; filter.type = type; filter.frequency.value = frequency; filter.Q.value = q;
    amp.gain.setValueAtTime(gain, time); amp.gain.exponentialRampToValueAtTime(.0001, time + duration);
    source.connect(filter); filter.connect(amp); amp.connect(masterGain); graphs.set(source, [source, filter, amp]);
    source.start(time); source.stop(time + duration + .01);
  }
  function tom(time, name) {
    const k = kit(name), osc = track(context.createOscillator()), amp = gainNode(k.tomGain);
    osc.type = 'triangle'; osc.frequency.setValueAtTime(150, time); osc.frequency.exponentialRampToValueAtTime(82, time + .16);
    amp.gain.setValueAtTime(k.tomGain, time); amp.gain.exponentialRampToValueAtTime(.0001, time + .19);
    osc.connect(amp); amp.connect(masterGain); graphs.set(osc, [osc, amp]); osc.start(time); osc.stop(time + .20);
  }
  function metal(time, name) {
    const k = kit(name), a = track(context.createOscillator()), b = track(context.createOscillator()), amp = gainNode(.0001);
    a.type = 'triangle'; b.type = 'sine'; a.frequency.value = 1180; b.frequency.value = 1733;
    amp.gain.setValueAtTime(k.metalGain, time); amp.gain.exponentialRampToValueAtTime(.0001, time + .07);
    a.connect(amp); b.connect(amp); amp.connect(masterGain); graphs.set(a, [a, b, amp]); a.start(time); b.start(time); a.stop(time + .08); b.stop(time + .08);
  }
  function play(pattern, time, name = 'classic') {
    if (!pattern) return; const k = kit(name);
    if (pattern.includes('K')) kick(time, name);
    if (pattern.includes('S')) noise(time, { frequency: k.snareFreq, gain: k.snareGain, duration: .13 });
    if (pattern.includes('C')) { noise(time, { frequency: 1900, gain: k.clapGain, duration: .085 }); noise(time + .018, { frequency: 2400, gain: k.clapGain * .55, duration: .06 }); }
    if (pattern.includes('T')) tom(time, name);
    if (pattern.includes('M')) metal(time, name);
    if (pattern.includes('R')) noise(time, { type: 'highpass', frequency: 3600, gain: k.shakerGain, duration: .07, q: .15 });
    if (pattern.includes('O')) noise(time, { type: 'highpass', frequency: Math.max(3400, k.hatFreq - 700), gain: k.openHatGain, duration: .18, q: .2 });
    else if (pattern.includes('H')) noise(time, { type: 'highpass', frequency: k.hatFreq, gain: k.hatGain, duration: .055, q: .2 });
  }
  return Object.freeze({ play, stop, sources, graphs });
}
