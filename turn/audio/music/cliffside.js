import { bars, makeSection, makeSong } from './song-tools.js?revision=r186-note-ties';

const TUNE = makeSection({
  name: 'tune', harmony: ['Bm7', 'G', 'D', 'A7'],
  leadVoice: 'bell', bassVoice: 'sub', arpVoice: 'glass', drumKit: 'brush',
  lead: bars(
    'B4 - D5 F#5 - A5 - F#5 E5 - D5 - F#5 - E5 -',
    'G4 - B4 D5 - E5 - D5 B4 - A4 - B4 - G4 -',
    'D5 - F#5 A5 - F#5 E5 D5 - C#5 B4 - A4 - F#4 -',
    'E5 - F#5 A5 - G5 F#5 E5 - C#5 - B4 A4 - - -'
  ),
  bass: bars(
    'B1 = F#2 - A2 - F#2 - D2 - F#2 - B2 - A2 -',
    'G1 = - - B2 - G2 - D2 - G2 - B1 = D2 -',
    'D2 = A2 - F#2 - A2 - D3 - A2 - F#2 - D2 -',
    'A1 = E2 - G2 - E2 - C#2 - E2 - A1 = G2 -'
  ),
  arp: bars(
    'D4 - F#4 - A4 - F#4 - D5 - A4 - F#4 - E4 -',
    'B3 - D4 - G4 - D4 - B4 - G4 - D4 - G3 -',
    'F#3 - A3 - D4 - A3 - F#4 - D4 - A3 - F#3 -',
    'G3 - A3 - C#4 - E4 - C#4 - A3 - G3 - E3 -'
  ),
  drums: bars(
    'K - H H S - H - K - H H S - OT -',
    'K - H H S - H - K H - H S - OT -',
    'K - H - S H H - K - H H S - OT -',
    'KH - H H S - H - K H H - ST H OT -'
  )
});

const BRIDGE = makeSection({
  name: 'bridge', harmony: ['G', 'A', 'Bm7', 'F#7'],
  leadVoice: 'bell', bassVoice: 'sub', arpVoice: 'organ', drumKit: 'brush',
  lead: bars(
    'D5 - D5 G5 - A5 B5 - A5 - G5 A5 B5 - D6 -',
    'E5 - E5 A5 - B5 C#6 - B5 - A5 B5 C#6 - E6 -',
    'F#5 - F#5 B5 - D6 F#6 - D6 - B5 A5 F#5 - D5 -',
    'F#5 F#5 A#5 C#6 - B5 A#5 - F#5 - E5 C#5 A#4 - F#4 -'
  ),
  bass: bars(
    'G1 = D2 - G2 - B2 - D2 = B2 - A2 - G2 -',
    'A1 = E2 - A2 - C#3 - E2 = C#3 - B2 - A2 -',
    'B1 = F#2 - B2 - D3 - F#2 = D3 - C#3 - B2 -',
    'F#1 = C#2 - F#2 - A#2 - C#2 = A#2 - F#2 - C#2 -'
  ),
  arp: bars(
    '- B3 D4 - G4 D4 - B4 - D4 G4 - A4 G4 D4 -',
    '- C#4 E4 - A4 E4 - C#5 - E4 A4 - B4 A4 E4 -',
    '- D4 F#4 - B4 F#4 - D5 - F#4 B4 - A4 F#4 D4 -',
    '- A#3 C#4 - F#4 C#4 - A#4 - C#4 F#4 - E4 C#4 A#3 -'
  ),
  drums: bars(
    'K - H - S - H - K H H - ST - OT -',
    'K - H H S - H - K H H - ST - OT -',
    'KH H H - S H H - K H H - ST H OT -',
    'KH H H - S H H - K H H H ST HT OT -'
  )
});

const CHORUS = makeSection({
  name: 'chorus', harmony: ['D', 'A', 'Bm7', 'G'],
  leadVoice: 'whistle', bassVoice: 'sub', arpVoice: 'organ', drumKit: 'brush',
  lead: bars(
    'A5 A5 B5 A5 - F#5 - D5 - F#5 A5 B5 - A5 - -',
    'A5 A5 B5 A5 - E5 - C#5 - E5 A5 B5 - C#6 - -',
    'B5 B5 D6 B5 - F#5 - D5 - F#5 A5 B5 - D6 - -',
    'B5 A5 G5 F#5 - D5 - G5 - A5 B5 A5 G5 - F#5 -'
  ),
  bass: bars(
    'D2 = A2 - F#2 = F#3 - A1 = F#3 - E2 = D3 -',
    'A1 = E2 - C#2 = C#3 - E2 = C#3 - B1 = A2 -',
    'B1 = F#2 - E2 = D3 - F#2 = D3 - C#2 = B2 -',
    'G1 = D2 - F2 = B2 - D2 = B2 - A1 = G2 -'
  ),
  arp: bars(
    'F#4 A4 D5 - A4 D5 F#5 - D5 A4 F#4 - A4 D5 A4 -',
    'E4 A4 C#5 - A4 C#5 E5 - C#5 A4 E4 - A4 C#5 A4 -',
    'F#4 B4 D5 - B4 D5 F#5 - D5 B4 F#4 - B4 D5 B4 -',
    'D4 G4 B4 - G4 B4 D5 - B4 G4 D4 - G4 B4 G4 -'
  ),
  drums: bars(
    'KH H H - S H H - KH H H - S H HOT T',
    'KH H H - S H H - KH H H - S H HOT T',
    'KH H H - S H H - KH H H - S H HOT T',
    'KH H H - S H H - KH H KOH H ST HT OT CT'
  )
});

export const CLIFFSIDE_SONG = makeSong({
  id: 'cliffside', name: 'Open Horizon', bpm: 136, key: 'B minor / D major',
  style: 'flowing melodic pop with an expansive verse, rising pre-chorus tension and an immediate open-horizon hook', swing: 0,
  sections: [TUNE, BRIDGE, CHORUS], arrangement: ['tune', 'tune', 'bridge', 'bridge', 'chorus', 'chorus']
});
