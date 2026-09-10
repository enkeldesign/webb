import { bars, makeSection, makeSong } from './song-tools.js?revision=r186-note-ties';

const TUNE = makeSection({
  name: 'tune', harmony: ['F#m7', 'E', 'C', 'E7'],
  leadVoice: 'whistle', bassVoice: 'synth', arpVoice: 'organ', drumKit: 'classic',
  lead: bars(
    'F#5 = A5 - C#6 = B5 - A5 - G#5 = F#5 - E5 -',
    'E5 = G#5 - B5 = A5 - G#5 - F#5 = E5 - C#5 -',
    'C5 = E5 - G5 = F#5 - E5 - C5 = B4 - A4 -',
    'B4 = D5 - F#5 = E5 - D5 - B4 A4 G#4 = E4 -'
  ),
  bass: bars(
    'F#1 = = - C#2 - E2 = C#2 - A1 = = - C#2 -',
    'E1 = = - B1 - E2 = B1 - G#1 = = - B1 -',
    'C1 = = - G1 - C2 = G1 - E1 = = - G1 -',
    'E1 = = B1 - D2 B2 = - B1 G#2 = - E2 B1 ='
  ),
  arp: bars(
    'A3 - C#4 - E4 - C#4 - A4 - E4 - C#4 - E4 -',
    'G#3 - B3 - E4 - B3 - G#4 - E4 - B3 - E4 -',
    'G3 - C4 - E4 - C4 - G4 - E4 - C4 - D4 -',
    'G#3 - B3 - D4 - E4 - B4 - D4 - G#4 - B3 -'
  ),
  drums: bars(
    'K - H - S - H - K - H - S - O -',
    'K - H - S - H - K H - H S - O -',
    'K - H - S - H - K - H - S H O -',
    'KH H - H S - H - K - H H S - O -'
  )
});

const BRIDGE = makeSection({
  name: 'bridge', harmony: ['F#m7', 'C', 'C', 'E7'],
  leadVoice: 'whistle', bassVoice: 'synth', arpVoice: 'organ', drumKit: 'classic',
  lead: bars(
    'F#5 = = - E5 - C#5 = B4 - A4 = = - E5 -',
    'G5 = F#5 - E5 - C#5 - B4 = A4 - F#4 = A4 -',
    'C5 - E5 G5 = E5 D5 - C5 - D5 E5 A5 = G5 -',
    'B4 = D5 - F#5 = E5 - D5 - B4 A4 G#4 = E4 -'
  ),
  bass: bars(
    'F#1 = = - C#2 - E2 = C#2 - A1 = = - C#2 -',
    'C1 = = - G1 - C2 = G1 - E1 = = - G1 -',
    'C1 - G1 = C2 - E2 = G1 - E2 = C2 G1 E1 =',
    'E1 = - B1 F#2 = - G#1 D2 = - D2 G#2 = B1 -'
  ),
  arp: bars(
    'A3 - C#4 - E4 - C#4 - A4 - E4 - C#4 - E4 -',
    'G3 - C4 - E4 - C4 - G4 - E4 - C4 - D4 -',
    'G3 - C4 - E4 - G4 - E4 - C4 - A3 - E4 -',
    'G#3 - B3 - D4 - E4 - B4 - D4 - G#4 - B3 -'
  ),
  drums: bars(
    'K - H - S - H - K - H - S - O -',
    'K - H - S - H - K - H - S - O -',
    'KH - H - S - H - K H - H S - O -',
    'KH H - H S - H - K - H H S - O -'
  )
});

const CHORUS = makeSection({
  name: 'chorus', harmony: ['F#m7', 'C', 'D', 'E7'],
  leadVoice: 'whistle', bassVoice: 'synth', arpVoice: 'organ', drumKit: 'classic',
  lead: bars(
    'A5 = C#6 - E6 = C#6 - B5 - A5 = F#5 - E5 -',
    'G5 = E5 - C5 = E5 - G5 - A5 = C6 - G5 -',
    'A5 - C#6 D6 = C#6 B5 - A5 - F#5 A5 B5 = C#6 -',
    'D6 = D#6 - E6 = D#6 - D6 - B5 A5 G#5 = E5 -'
  ),
  bass: bars(
    'F#2 = C#3 = E3 - A2 = C#3 - E3 = F#3 E3 C#3 -',
    'C2 = G2 = C3 - E3 = G2 - E3 = C3 G2 E3 -',
    'D2 = A2 = D3 - F#3 = A2 = F#3 = D3 A2 F#2 -',
    'E2 = B2 = D3 = G#3 = B2 = D3 = E3 B2 G#2 ='
  ),
  arp: bars(
    'A3 C#4 E4 - C#4 E4 A4 - E4 A4 C#5 - A4 E4 C#4 -',
    'G3 C4 E4 - C4 E4 G4 - E4 G4 C5 - G4 E4 C4 -',
    'A3 D4 F#4 - D4 F#4 A4 - F#4 A4 D5 - A4 F#4 D4 -',
    'G#3 B3 D4 - B3 D4 E4 - B3 E4 G#4 - E4 D4 B3 -'
  ),
  drums: bars(
    'KH H - H S H K - KH H - H S H O -',
    'KH H - H S - H - KH H K H S H O -',
    'KH H H - S H - H KH H K H S H O -',
    'KH H H K S H H - KH H KOH H S H KS O'
  )
});

export const AIRPORT_SONG = makeSong({
  id: 'airport',
  name: 'Paper Skies',
  bpm: 144,
  key: 'F# minor / E major',
  style: 'dreamlike psychedelic pop with melodic bass, unexpected major-colour shifts and an airborne bell melody',
  swing: 0,
  sections: [TUNE, BRIDGE, CHORUS],
  arrangement: ['bridge', 'bridge', 'tune', 'bridge', 'chorus', 'chorus']
});
