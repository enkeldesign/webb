export const BASS_VOICES = Object.freeze({
  warm:    { div: 2, body: 'triangle', harmonic: 'sine', harmonicRatio: .5, bodyMix: .64, harmonicMix: .34, gain: .21, attack: .016, length: 1.02, filter: 1050, filterEnd: 280 },
  upright: { div: 1, body: 'triangle', harmonic: 'sine', harmonicRatio: .5, bodyMix: .76, harmonicMix: .18, gain: .15, attack: .004, length: .78, filter: 920, filterEnd: 340 },
  sub:     { div: 1, body: 'sine', harmonic: 'triangle', harmonicRatio: .5, bodyMix: .78, harmonicMix: .18, gain: .19, attack: .008, length: .82, filter: 560, filterEnd: 240 },
  drone:   { div: 1, body: 'sine', harmonic: 'triangle', harmonicRatio: .5, bodyMix: .72, harmonicMix: .20, gain: .16, attack: .055, length: 3.5, filter: 680, filterEnd: 420 },
  drive:   { div: 1, body: 'square', harmonic: 'triangle', harmonicRatio: .5, bodyMix: .42, harmonicMix: .34, gain: .14, attack: .006, length: .72, filter: 760, filterEnd: 310 },
  synth:   { div: 1, body: 'sawtooth', harmonic: 'sine', harmonicRatio: .5, bodyMix: .38, harmonicMix: .48, gain: .145, attack: .008, length: .82, filter: 880, filterEnd: 300 }
});
