import { createToneRuntime } from './tone-runtime-ties.js?revision=r186-note-ties';
import { createDrumRuntime } from './drum-runtime.js?revision=r184-score-v2';
import { model, buildSong, C, HITS, VOICES } from './tracker-core.js?revision=r187-music-tracker';

let audio = null;
let play = null;
let demo = { key: '', i: 0, t: 0, timer: 0 };

const DEMO_OCT = {
  lead: { lead: 5, picked: 5, pluck: 5, whistle: 5, pulse: 5, brass: 4, organ: 4, reed: 4, bell: 5, neon: 5 },
  bass: { warm: 2, upright: 2, sub: 1, drone: 2, drive: 2, synth: 2 },
  arp: { soft: 4, mandolin: 4, glass: 5, organ: 4, metal: 4, neon: 4 }
};
const DEMO_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'];
const DEMO_SOLFEGE = ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'TI', 'DO'];
const DRUM_LABELS = Object.freeze({
  K: 'KICK',
  S: 'SNARE',
  H: 'HIHAT',
  O: 'OPEN HIHAT',
  C: 'CLAP',
  T: 'TOM',
  M: 'METAL',
  R: 'SHAKER'
});

function graph() {
  if (audio) return audio;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) throw Error('Web Audio is not available.');
  const ctx = new AC({ latencyHint: 'interactive' });
  const gain = new GainNode(ctx, { gain: .46 });
  const comp = ctx.createDynamicsCompressor();
  gain.connect(comp);
  comp.connect(ctx.destination);
  const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = nb.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  let ss = .125;
  const PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  const freq = (note) => {
    const match = /^([A-G](?:#|b)?)(-?\d+)$/.exec(note || '');
    if (!match) return 440;
    const midi = PC[match[1]] + (+match[2] + 1) * 12;
    return 440 * 2 ** ((midi - 69) / 12);
  };
  audio = {
    ctx,
    tones: createToneRuntime({ context: ctx, masterGain: gain, noteToFrequency: freq, getStepSeconds: () => ss }),
    drums: createDrumRuntime({ context: ctx, masterGain: gain, noiseBuffer: nb }),
    step: (value) => { ss = value; }
  };
  return audio;
}

async function resume() {
  const g = graph();
  if (g.ctx.state !== 'running') await g.ctx.resume();
  return g;
}

export function stopPlayback() {
  if (play) clearTimeout(play.timer);
  play = null;
  if (audio) {
    audio.tones.stop();
    audio.drums.stop();
  }
  document.getElementById('playStatus').textContent = 'Stopped';
}

function stopForDemo() {
  const canonicalStop = document.getElementById('stopButton');
  if (typeof canonicalStop?.onclick === 'function') canonicalStop.click();
  else stopPlayback();
  if (audio) {
    audio.tones.stop();
    audio.drums.stop();
  }
}

export async function startPlayback(mode, part = model.state.part, bar = 0) {
  stopPlayback();
  const so = buildSong();
  const g = await resume();
  const ss = (60 / so.bpm) / 4;
  g.step(ss);
  const seq = mode === 'song' ? [...so.arrangement] : [so.sections.find((section) => section.name === part)];
  play = { mode, part, so, seq, si: 0, st: mode === 'part' ? bar * 16 : 0, t: g.ctx.currentTime + .05, ss, timer: 0 };
  document.getElementById('playStatus').textContent = mode === 'song' ? `Playing ${so.name}` : `Playing ${C[part]}`;
  tick();
}

function tick() {
  if (!play) return;
  const g = audio;
  const state = model.state;
  while (play && play.t < g.ctx.currentTime + .12) {
    const sec = play.seq[play.si];
    const i = play.st;
    const t = play.t;
    if (state.channels.lead) g.tones.playLead(sec.lead[i], t, sec.leadVoice);
    if (state.channels.bass) g.tones.playBass(sec.bass[i], t, sec.bassVoice);
    if (state.channels.arp) g.tones.playArp(sec.arp[i], t, sec.arpVoice);
    if (state.channels.drums) g.drums.play(sec.drums[i], t, sec.drumKit);
    const swing = +play.so.swing || 0;
    play.t += play.ss * (i % 2 === 0 ? 1 + swing : 1 - swing);
    play.st += 1;
    if (play.st >= sec.lead.length) {
      play.st = 0;
      play.si += 1;
      if (play.si >= play.seq.length) {
        if (state.loop) play.si = 0;
        else {
          play = null;
          document.getElementById('playStatus').textContent = 'Stopped';
          return;
        }
      }
    }
  }
  if (play) play.timer = setTimeout(tick, 25);
}

export function isPlaying() {
  return Boolean(play);
}

function groupFeedback(group) {
  return document.querySelector(`[data-demo-feedback="${group}"]`);
}

function clearDemoFeedback() {
  document.querySelectorAll('.demo-feedback').forEach((feedback) => feedback.replaceChildren());
}

function setDemoFeedback(group, current, next) {
  clearDemoFeedback();
  const feedback = groupFeedback(group);
  if (!feedback) return;
  const strong = document.createElement('strong');
  strong.textContent = current;
  const followUp = document.createElement('span');
  followUp.textContent = `(Tap again: ${next})`;
  feedback.replaceChildren(strong, document.createTextNode(' '), followUp);
}

function scheduleDemoReset(key) {
  clearTimeout(demo.timer);
  demo.timer = setTimeout(() => {
    if (demo.key !== key) return;
    demo.key = '';
    demo.i = 0;
    demo.t = 0;
    document.querySelectorAll('.demo-button').forEach((button) => button.classList.remove('active'));
    clearDemoFeedback();
  }, 3000);
}

function pitchedDemoLabel(group, name, index) {
  const octave = DEMO_OCT[group]?.[name] ?? (group === 'bass' ? 2 : 4);
  const note = `${DEMO_NOTES[index]}${octave + (index === 7 ? 1 : 0)}`;
  return { note, label: `${DEMO_SOLFEGE[index]} · ${note}` };
}

export async function demoInstrument(group, name, button) {
  stopForDemo();
  const g = await resume();
  g.step(.16);
  const now = performance.now();
  const key = `${group}:${name}`;
  demo.i = demo.key !== key || now - demo.t > 3000 ? 0 : (demo.i + 1) % 8;
  demo.key = key;
  demo.t = now;

  document.querySelectorAll('.demo-button').forEach((candidate) => candidate.classList.toggle('active', candidate === button));

  const nextIndex = (demo.i + 1) % 8;
  if (group === 'drums') {
    const hit = HITS[demo.i];
    const nextHit = HITS[nextIndex];
    g.drums.play(hit, g.ctx.currentTime + .02, name);
    setDemoFeedback(group, DRUM_LABELS[hit] || hit, DRUM_LABELS[nextHit] || nextHit);
    scheduleDemoReset(key);
    return;
  }

  const current = pitchedDemoLabel(group, name, demo.i);
  const next = pitchedDemoLabel(group, name, nextIndex);
  g.tones[`play${group[0].toUpperCase() + group.slice(1)}`](current.note, g.ctx.currentTime + .02, name);
  setDemoFeedback(group, current.label, next.label);
  scheduleDemoReset(key);
}

export function renderDemos() {
  const root = document.getElementById('instrumentDemos');
  for (const [group, lib] of Object.entries(VOICES)) {
    const wrapper = document.createElement('div');
    wrapper.className = 'demo-group';

    const head = document.createElement('div');
    head.className = 'demo-group-head';
    const heading = document.createElement('h3');
    heading.textContent = group === 'arp' ? 'ARP / TEXTURE' : group.toUpperCase();
    const feedback = document.createElement('p');
    feedback.className = 'demo-feedback';
    feedback.dataset.demoFeedback = group;
    feedback.setAttribute('aria-live', 'polite');
    feedback.setAttribute('aria-atomic', 'true');
    head.append(heading, feedback);

    const buttons = document.createElement('div');
    buttons.className = 'demo-buttons';
    Object.keys(lib).forEach((name) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'demo-button';
      button.textContent = name;
      button.onclick = () => demoInstrument(group, name, button);
      buttons.append(button);
    });

    wrapper.append(head, buttons);
    root.append(wrapper);
  }
}
