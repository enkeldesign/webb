import { LEAD_VOICES, BASS_VOICES, ARP_VOICES } from './instrument-bank.js?revision=r184-score-v2';

export function createToneRuntime({ context, masterGain, noteToFrequency, getStepSeconds }) {
  const sources = new Set();
  const graphs = new Map();
  const gainNode = (gain = 1) => new GainNode(context, { gain });
  const cleanup = (source) => {
    const nodes = graphs.get(source);
    if (!nodes) return;
    graphs.delete(source);
    for (const node of nodes) { try { node?.disconnect?.(); } catch (_) {} }
  };
  const track = (source) => {
    sources.add(source);
    source.addEventListener?.('ended', () => { sources.delete(source); cleanup(source); }, { once: true });
    return source;
  };
  function stop() {
    for (const source of sources) { try { source.stop(); } catch (_) {} }
    for (const source of [...graphs.keys()]) cleanup(source);
    sources.clear();
  }
  function tone(note, time, voice) {
    if (!note || !voice) return;
    const duration = getStepSeconds() * voice.length;
    const endTime = time + duration;
    const hz = noteToFrequency(note) / voice.div;
    const body = track(context.createOscillator());
    const harmonic = voice.harmonic ? track(context.createOscillator()) : null;
    const bodyGain = gainNode(voice.bodyMix);
    const harmonicGain = harmonic ? gainNode(voice.harmonicMix) : null;
    const amp = gainNode(.0001);
    const filter = context.createBiquadFilter();
    body.type = voice.body;
    const bend = voice.bend || 1;
    body.frequency.setValueAtTime(hz * bend, time);
    if (bend !== 1) body.frequency.exponentialRampToValueAtTime(hz, time + Math.min(.028, duration * .25));
    if (harmonic) {
      harmonic.type = voice.harmonic;
      harmonic.frequency.setValueAtTime(hz * voice.harmonicRatio, time);
    }
    filter.type = 'lowpass';
    filter.Q.value = .65;
    filter.frequency.setValueAtTime(voice.filter, time);
    filter.frequency.exponentialRampToValueAtTime(voice.filterEnd || voice.filter, endTime);
    amp.gain.setValueAtTime(.0001, time);
    amp.gain.exponentialRampToValueAtTime(Math.max(.0002, voice.gain), time + Math.min(voice.attack, duration * .45));
    amp.gain.exponentialRampToValueAtTime(.0001, endTime);
    body.connect(bodyGain); bodyGain.connect(filter);
    if (harmonic) { harmonic.connect(harmonicGain); harmonicGain.connect(filter); }
    filter.connect(amp); amp.connect(masterGain);
    graphs.set(body, [body, harmonic, bodyGain, harmonicGain, filter, amp].filter(Boolean));
    body.start(time); harmonic?.start(time);
    body.stop(endTime + .01); harmonic?.stop(endTime + .01);
  }
  const resolve = (library, voice, fallback) => library[voice] || library[fallback];
  return Object.freeze({
    playLead(note, time, voice = 'lead') { tone(note, time, resolve(LEAD_VOICES, voice === 'flute' ? 'picked' : voice, 'lead')); },
    playBass(note, time, voice = 'warm') { tone(note, time, resolve(BASS_VOICES, voice, 'warm')); },
    playArp(note, time, voice = 'soft') { tone(note, time, resolve(ARP_VOICES, voice, 'soft')); },
    stop,
    sources,
    graphs
  });
}
