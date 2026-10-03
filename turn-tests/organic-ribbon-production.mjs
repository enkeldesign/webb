import assert from 'node:assert/strict';

// The steering ribbon (#1045 ASTRA A3): the game and the music each have an audio
// context, and nodes cannot connect across them. With the ribbon's nodes in the game's
// context and the music's context created after it, decoration must stay in the game's
// context, not throw, and leave the game's audio update running.
class FakeParam {
  constructor(context, value = 0) { this.context = context; this.value = value; }
  setValueAtTime() {} setTargetAtTime() {} cancelScheduledValues() {} cancelAndHoldAtTime() {}
}
class FakeNode {
  constructor(context, fields = {}) { this.context = context; Object.assign(this, fields); context.created += 1; }
  connect(target) {
    if (target.context !== this.context) {
      throw new Error("Failed to execute 'connect' on 'AudioNode': cannot connect to an AudioParam belonging to a different audio context.");
    }
  }
  start() {} setPeriodicWave() {}
}
class FakeContext {
  constructor() { this.created = 0; this.sampleRate = 8000; this.currentTime = 0; }
  createOscillator() { return new FakeNode(this, { frequency: new FakeParam(this, 440), detune: new FakeParam(this), type: 'sine' }); }
  createGain() { return new FakeNode(this, { gain: new FakeParam(this, 1) }); }
  createBiquadFilter() { return new FakeNode(this, { type: 'lowpass', frequency: new FakeParam(this, 350), Q: new FakeParam(this, 1) }); }
  createBufferSource() { return new FakeNode(this, { buffer: null, loop: false }); }
  createConstantSource() { return new FakeNode(this, { offset: new FakeParam(this) }); }
  createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
  createPeriodicWave() { return {}; }
}
globalThis.AudioContext = FakeContext;
globalThis.document = { addEventListener() {} };
const warnings = [];
const originalWarn = console.warn;
console.warn = (...args) => warnings.push(args.map(String).join(' '));

const { prepareOrganicRibbonCapture, installOrganicRibbon } = await import('../turn/audio/organic-ribbon.js');
prepareOrganicRibbonCapture();

// The game's slider voice, as audio-system.js builds it.
const game = new FakeContext();
const tone = game.createOscillator(); tone.frequency.value = 390;
const harmonic = game.createOscillator(); harmonic.frequency.value = 585;
const toneMix = game.createGain(); toneMix.gain.value = 0.78;
const harmonicMix = game.createGain(); harmonicMix.gain.value = 0.14;
const filter = game.createBiquadFilter(); filter.frequency.value = 1050; filter.Q.value = 0.42;
const gameNodesBefore = game.created;

// The music's context, created afterwards, with an oscillator near the slider's pitch.
const music = new FakeContext();
const musicTone = music.createOscillator(); musicTone.frequency.value = 392;
const musicNodesBefore = music.created;

let baseUpdates = 0;
globalThis.__turnAudio = {
  unlock: async () => true, update: () => { baseUpdates += 1; }, cue() {}, silence() {},
  available: true, state: 'running'
};
const audio = installOrganicRibbon();
assert.doesNotThrow(() => audio.update({ sliderRisk: 0.2 }, 1000), 'Decorating across two contexts must not throw');
assert.equal(baseUpdates, 1, 'The game audio update still runs');
assert.ok(game.created > gameNodesBefore, 'The ribbon is decorated in the game context that owns its nodes');
assert.equal(music.created, musicNodesBefore, 'Nothing is built in the music context');
audio.update({ sliderRisk: 0.4 }, 2000);
assert.equal(baseUpdates, 2);
assert.deepEqual(warnings, [], 'No fallback was needed');
console.warn = originalWarn;
console.log('TURN steering ribbon: decorated within the context that owns its nodes, beside a later music context, without breaking the audio update.');
