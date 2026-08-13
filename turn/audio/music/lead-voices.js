export const LEAD_VOICES = Object.freeze({
  lead:    { div: 4, body: 'triangle', harmonic: 'sine',     harmonicRatio: 2,    bodyMix: .82, harmonicMix: .12, gain: .18,  attack: .022, length: 1.05, filter: 3200, filterEnd: 2200 },
  picked:  { div: 2, body: 'triangle', harmonic: 'triangle', harmonicRatio: 2,    bodyMix: .75, harmonicMix: .16, gain: .078, attack: .008, length: .88, filter: 2000, filterEnd: 1000, bend: 1.018 },
  pluck:   { div: 2, body: 'triangle', harmonic: 'sine',     harmonicRatio: 2,    bodyMix: .78, harmonicMix: .14, gain: .115, attack: .004, length: .72, filter: 3300, filterEnd: 720, bend: 1.012 },
  whistle: { div: 2, body: 'sine',     harmonic: 'triangle', harmonicRatio: 2,    bodyMix: .88, harmonicMix: .08, gain: .082, attack: .028, length: 1.45, filter: 4300, filterEnd: 3000 },
  pulse:   { div: 4, body: 'square',   harmonic: 'triangle', harmonicRatio: 2,    bodyMix: .62, harmonicMix: .22, gain: .105, attack: .006, length: .54, filter: 1850, filterEnd: 720 },
  brass:   { div: 4, body: 'sawtooth', harmonic: 'triangle', harmonicRatio: 2,    bodyMix: .46, harmonicMix: .28, gain: .092, attack: .026, length: .96, filter: 1550, filterEnd: 900 },
  organ:   { div: 4, body: 'sine',     harmonic: 'triangle', harmonicRatio: 2,    bodyMix: .68, harmonicMix: .24, gain: .085, attack: .075, length: 3.25, filter: 1800, filterEnd: 1450 },
  reed:    { div: 4, body: 'square',   harmonic: 'sine',     harmonicRatio: 2,    bodyMix: .42, harmonicMix: .32, gain: .072, attack: .035, length: 1.75, filter: 1350, filterEnd: 950 },
  bell:    { div: 2, body: 'sine',     harmonic: 'sine',     harmonicRatio: 2.99, bodyMix: .72, harmonicMix: .22, gain: .072, attack: .003, length: 1.15, filter: 5200, filterEnd: 2600 },
  neon:    { div: 4, body: 'sawtooth', harmonic: 'square',   harmonicRatio: 2,    bodyMix: .42, harmonicMix: .20, gain: .078, attack: .012, length: .82, filter: 2450, filterEnd: 920 }
});
