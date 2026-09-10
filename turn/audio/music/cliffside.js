import { bars, makeSection, makeSong } from './song-tools.js?revision=r186-note-ties';

const TUNE = makeSection({
  name: 'tune', harmony: ['Bm7', 'G', 'D', 'A7'],
  leadVoice: 'picked', bassVoice: 'warm', arpVoice: 'organ', drumKit: 'brush',
  lead: bars(
    'B4 = D5 F#5 = A5 = F#5 E5 = D5 - F#5 = E5 -',
    'G4 = B4 D5 = E5 = D5 B4 = A4 - B4 = G4 -',
    'D5 = F#5 A5 = F#5 E5 D5 = C#5 B4 = A4 = F#4 -',
    'E5 = F#5 A5 = G5 F#5 E5 = C#5 = B4 A4 = = -'
  ),
  bass: bars(
    'B1 = F#2 - A2 = F#2 - D2 = F#2 - B2 = A2 -',
    'G1 = D2 - B2 = G2 - D2 = G2 - B2 = D2 -',
    'D2 = A2 - F#2 = A2 - D3 = A2 - F#2 = D2 -',
    'A1 = E2 - G2 = E2 - C#2 = E2 - A2 = G2 -'
  ),
  arp: bars(
    'D4 - F#4 - A4 - F#4 - D5 - A4 - F#4 - E4 -',
    'B3 - D4 - G4 - D4 - B4 - G4 - D4 - G3 -',
    'F#3 - A3 - D4 - A3 - F#4 - D4 - A3 - F#3 -',
    'G3 - A3 - C#4 - E4 - C#4 - A3 - G3 - E3 -'
  ),
  drums: bars(
    'K - H H S - H - K - H H S - O -',
    'K - H H S - H - K H - H S - O -',
    'K - H - S H H - K - H H S - O -',
    'KH - H H S - H - K H H - S H O -'
  )
});

const BRIDGE = makeSection({
  name: 'bridge', harmony: ['Em7', 'C', 'Em7', 'A7'],
  leadVoice: 'whistle', bassVoice: 'warm', arpVoice: 'organ', drumKit: 'brush',
  lead: bars(
    'E5 = G5 B5 = A5 = G5 F#5 = E5 - D5 = E5 -',
    'G5 = E5 D5 = C5 = E5 G5 = A5 - G5 = E5 -',
    'E5 = G5 B5 = A5 = G5 F#5 = E5 - D5 = E5 -',
    'C#5 = E5 A5 = G5 F#5 E5 = C#5 = B4 A4 = C#5 -'
  ),
  bass: bars(
    'E2 = B2 - D3 = B2 - G2 = B2 - E3 = D3 -',
    'C2 = G2 - E3 = C3 - G2 = C3 - E3 = C3 -',
    'E2 = B2 - D3 = B2 - G2 = B2 - E3 = D3 -',
    'A1 = E2 - G2 = E2 - C#2 = E2 - A2 = G2 -'
  ),
  arp: bars(
    'G3 - B3 - D4 - B3 - G4 - D4 - B3 - G3 -',
    'G3 - C4 - E4 - C4 - G4 - E4 - C4 - G3 -',
    'G3 - B3 - D4 - B3 - G4 - D4 - B3 - G3 -',
    'G3 - A3 - C#4 - E4 - C#4 - A3 - G3 - E3 -'
  ),
  drums: bars(
    'K - H - S - H H K - H - S - O -',
    'K - H - S - H - K - H H S - O -',
    'K - H - S - H H K - H - S - O -',
    'KH H - H S - H - K H H - S H O -'
  )
});

const CHORUS = makeSection({
  name: 'chorus', harmony: ['G', 'D', 'Em7', 'A7'],
  leadVoice: 'whistle', bassVoice: 'warm', arpVoice: 'organ', drumKit: 'brush',
  lead: bars(
    'G5 = B5 D6 = B5 A5 G5 = F#5 = E5 D5 = G5 -',
    'F#5 = A5 D6 = C#6 B5 A5 = F#5 = E5 D5 = A4 -',
    'E5 = G5 B5 = A5 G5 F#5 = E5 = D5 B4 = E5 -',
    'C#5 = E5 A5 = G5 F#5 E5 = C#5 = B4 A4 = C#5 -'
  ),
  bass: bars(
    'G1 = D2 - B2 = G2 - D2 = G2 - B2 = D3 -',
    'F#2 = A2 - D3 = A2 - F#2 = A2 - D3 = A2 -',
    'E2 = B2 - D3 = B2 - G2 = B2 - E3 = D3 -',
    'A1 = E2 - G2 = E2 - C#2 = E2 - A2 = G2 -'
  ),
  arp: bars(
    'B3 D4 G4 - D4 G4 B4 - G4 B4 D5 - B4 G4 D4 -',
    'A3 D4 F#4 - D4 F#4 A4 - F#4 A4 D5 - A4 F#4 D4 -',
    'G3 B3 D4 - B3 D4 G4 - D4 G4 B4 - G4 D4 B3 -',
    'G3 A3 C#4 - A3 C#4 E4 - C#4 E4 G4 - E4 C#4 A3 -'
  ),
  drums: bars(
    'KH H - H S H H - K H - H S H O -',
    'KH H - H S - H H K H - H S H O -',
    'KH H H - S H - H K H H - S H O -',
    'KH H H - S H H - K H H H S H O -'
  )
});

export const CLIFFSIDE_SONG = makeSong({
  id: 'cliffside',
  name: 'Open Horizon',
  bpm: 136,
  key: 'B minor / D major',
  style: 'flowing psychedelic pop with sweeping melodic lines, rolling bass and a strange cliff-edge harmonic turn',
  swing: 0,
  sections: [TUNE, BRIDGE, CHORUS],
  arrangement: ['tune', 'tune', 'bridge', 'tune', 'chorus', 'chorus']
});
