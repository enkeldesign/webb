const SCALE = Object.freeze([0, 3, 5, 7, 10, 12, 15, 17]);

export class NoTiltAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.droneGain = null;
    this.tensionGain = null;
    this.filter = null;
    this.started = false;
    this.muted = false;
    this.paused = true;
    this.stage = 0;
    this.beat = 0;
    this.nextBeatAt = 0;
  }

  async start() {
    if (this.started) {
      await this.resume();
      return true;
    }
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext) return false;

    this.context = new AudioContext({ latencyHint: 'interactive' });
    this.master = this.context.createGain();
    this.master.gain.value = 0.0001;
    this.master.connect(this.context.destination);

    this.filter = this.context.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 420;
    this.filter.Q.value = 0.8;
    this.filter.connect(this.master);

    this.droneGain = this.context.createGain();
    this.droneGain.gain.value = 0.018;
    this.droneGain.connect(this.filter);
    this.createDrone(55, 'sine', -5);
    this.createDrone(82.5, 'triangle', 5);

    this.tensionGain = this.context.createGain();
    this.tensionGain.gain.value = 0.0001;
    this.tensionGain.connect(this.filter);
    const tension = this.context.createOscillator();
    tension.type = 'sawtooth';
    tension.frequency.value = 110;
    tension.connect(this.tensionGain);
    tension.start();

    this.started = true;
    this.paused = false;
    this.nextBeatAt = this.context.currentTime + 0.15;
    this.setMasterTarget();
    return true;
  }

  async resume() {
    if (!this.context) return false;
    if (this.context.state === 'suspended') await this.context.resume();
    this.paused = false;
    this.nextBeatAt = Math.max(this.context.currentTime + 0.08, this.nextBeatAt);
    this.setMasterTarget();
    return true;
  }

  pause() {
    this.paused = true;
    this.setMasterTarget();
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    this.setMasterTarget();
    return this.muted;
  }

  toggleMuted() {
    return this.setMuted(!this.muted);
  }

  update({ stage = 0, stability = 1, danger = 0 } = {}) {
    if (!this.context || !this.started) return;
    this.stage = clamp(Math.round(stage), 0, 4);
    const now = this.context.currentTime;
    const timeConstant = 0.08;
    this.filter.frequency.setTargetAtTime(360 + this.stage * 190 + stability * 170, now, 0.12);
    this.droneGain.gain.setTargetAtTime(0.016 + this.stage * 0.0045, now, 0.15);
    this.tensionGain.gain.setTargetAtTime(
      this.paused || this.muted ? 0.0001 : 0.003 + danger * 0.026,
      now,
      timeConstant
    );

    if (this.paused || this.muted) return;
    const bpm = 90 + this.stage * 11;
    const beatDuration = 60 / bpm / 2;
    let guard = 0;
    while (now >= this.nextBeatAt && guard < 4) {
      this.scheduleBeat(this.nextBeatAt, this.beat, this.stage);
      this.nextBeatAt += beatDuration;
      this.beat += 1;
      guard += 1;
    }
  }

  stageUp(stage) {
    const level = clamp(Number(stage) || 0, 1, 4);
    const root = 220 * 2 ** (level / 12);
    this.playTone(root, 0.16, 0.06, 0, 'square', root * 1.5);
    this.playTone(root * 1.5, 0.22, 0.045, 0, 'triangle', root * 2);
  }

  warning(side = 1) {
    this.playTone(196, 0.11, 0.045, side * 0.72, 'square', 146);
  }

  jump() {
    this.playTone(220, 0.18, 0.055, 0, 'triangle', 520);
  }

  land() {
    this.noise(0.07, 0.035, 0);
  }

  dodge(side = 1) {
    this.playTone(523.25, 0.13, 0.06, -side * 0.35, 'square', 783.99);
    this.playTone(783.99, 0.2, 0.04, side * 0.35, 'triangle', 1046.5);
  }

  save() {
    this.playTone(392, 0.12, 0.04, 0, 'triangle', 587.33);
  }

  hit(side = 1) {
    this.noise(0.13, 0.085, -side * 0.5);
    this.playTone(92, 0.22, 0.07, -side * 0.35, 'sawtooth', 58);
  }

  fall() {
    this.playTone(174.61, 0.5, 0.075, 0, 'sawtooth', 48);
  }

  setMasterTarget() {
    if (!this.context || !this.master) return;
    const target = this.muted || this.paused ? 0.0001 : 0.38;
    this.master.gain.setTargetAtTime(target, this.context.currentTime, 0.06);
  }

  createDrone(frequency, type, detune) {
    const oscillator = this.context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    oscillator.detune.value = detune;
    oscillator.connect(this.droneGain);
    oscillator.start();
  }

  scheduleBeat(at, beat, stage) {
    if (!this.context || at < this.context.currentTime - 0.05) at = this.context.currentTime;
    const root = 55;
    if (beat % 4 === 0) this.kick(at, 0.038 + stage * 0.004);

    if (stage >= 1 && beat % 2 === 0) {
      const bassSteps = [0, 0, 5, 3, 0, 7, 5, 3];
      const frequency = root * 2 ** (bassSteps[Math.floor(beat / 2) % bassSteps.length] / 12);
      this.scheduleTone(frequency, at, 0.12, 0.026, 0, 'square');
    }

    if (stage >= 2) {
      const note = SCALE[beat % (stage >= 4 ? SCALE.length : 5)];
      const frequency = 220 * 2 ** (note / 12);
      this.scheduleTone(frequency, at, stage >= 4 ? 0.08 : 0.12, 0.018 + stage * 0.003, 0, 'triangle');
    }

    if (stage >= 4 && beat % 2 === 1) {
      this.scheduleTone(880 * 2 ** (SCALE[(beat + 3) % SCALE.length] / 12), at, 0.045, 0.012, 0, 'sine');
    }
  }

  kick(at, gain) {
    if (!this.context || !this.master) return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(120, at);
    oscillator.frequency.exponentialRampToValueAtTime(46, at + 0.095);
    envelope.gain.setValueAtTime(Math.max(0.0001, gain), at);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.11);
    oscillator.connect(envelope).connect(this.master);
    oscillator.start(at);
    oscillator.stop(at + 0.12);
  }

  playTone(frequency, duration, gain, pan, type, glideTo = frequency) {
    if (!this.context || this.muted) return;
    const at = this.context.currentTime;
    this.scheduleTone(frequency, at, duration, gain, pan, type, glideTo);
  }

  scheduleTone(frequency, at, duration, gain, pan = 0, type = 'sine', glideTo = frequency) {
    if (!this.context || !this.master) return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(24, frequency), at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(24, glideTo), at + duration);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), at + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);

    if (typeof this.context.createStereoPanner === 'function') {
      const panner = this.context.createStereoPanner();
      panner.pan.value = clamp(pan, -1, 1);
      oscillator.connect(envelope).connect(panner).connect(this.master);
    } else {
      oscillator.connect(envelope).connect(this.master);
    }
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
  }

  noise(duration, gain, pan) {
    if (!this.context || !this.master || this.muted) return;
    const sampleCount = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, sampleCount, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
    }
    const source = this.context.createBufferSource();
    const envelope = this.context.createGain();
    envelope.gain.value = gain;
    source.buffer = buffer;
    if (typeof this.context.createStereoPanner === 'function') {
      const panner = this.context.createStereoPanner();
      panner.pan.value = clamp(pan, -1, 1);
      source.connect(envelope).connect(panner).connect(this.master);
    } else {
      source.connect(envelope).connect(this.master);
    }
    source.start();
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
