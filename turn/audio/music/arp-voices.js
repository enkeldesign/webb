export const ARP_VOICES = Object.freeze({
  soft:     { div: 1, body: 'triangle', harmonic: null,   harmonicRatio: 2,    bodyMix: 1, harmonicMix: 0,   gain: .036, attack: .012, length: .92, filter: 2300, filterEnd: 1700 },
  mandolin: { div: 1, body: 'triangle', harmonic: 'sine', harmonicRatio: 2,    bodyMix: .78, harmonicMix: .12, gain: .033, attack: .002, length: .42, filter: 3900, filterEnd: 1200 },
  glass:    { div: 1, body: 'sine',     harmonic: 'sine', harmonicRatio: 3,    bodyMix: .78, harmonicMix: .18, gain: .027, attack: .003, length: .72, filter: 5800, filterEnd: 3300 },
  organ:    { div: 1, body: 'triangle', harmonic: 'sine', harmonicRatio: 2,    bodyMix: .68, harmonicMix: .18, gain: .022, attack: .035, length: 1.75, filter: 1650, filterEnd: 1250 },
  metal:    { div: 1, body: 'sine',     harmonic: 'triangle', harmonicRatio: 2.67, bodyMix: .64, harmonicMix: .22, gain: .026, attack: .002, length: .34, filter: 6000, filterEnd: 2600 },
  neon:     { div: 1, body: 'square',   harmonic: 'sawtooth', harmonicRatio: 2, bodyMix: .38, harmonicMix: .18, gain: .021, attack: .004, length: .58, filter: 2650, filterEnd: 1050 }
});
