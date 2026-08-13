import { bars, makeSection, makeSong } from './song-tools.js?revision=r165-track-songbook-v1';

const TUNE = makeSection({
  name: 'tune',
  lead: bars(
    'D5 - F5 - A5 C6 A5 - F5 - E5 - D5 A5 - D6',
    'Bb5 - D6 - F6 D6 Bb5 - A5 - F5 - D5 F5 - A5',
    'F5 - A5 - C6 - A5 G5 - C6 - A5 - G5 - F5',
    'C6 - G5 - E5 G5 C6 - Bb5 - G5 - E5 G5 - A5'
  ),
  bass: bars(
    'D2 - - - A2 - - - D3 - - - A2 - - -',
    'Bb1 - - - F2 - - - Bb2 - - - F2 - - -',
    'F2 - - - C3 - - - F3 - - - C3 - - -',
    'C2 - - - G2 - - - C3 - - - A2 - - -'
  ),
  arp: bars(
    'D4 A4 F4 A4 D5 A4 F4 A4 D4 F4 A4 C5 D5 C5 A4 F4',
    'Bb3 F4 D4 F4 Bb4 F4 D4 F4 Bb3 D4 F4 A4 Bb4 A4 F4 D4',
    'F4 C5 A4 C5 F5 C5 A4 C5 F4 A4 C5 E5 F5 E5 C5 A4',
    'C4 G4 E4 G4 C5 G4 E4 G4 C4 E4 G4 Bb4 C5 Bb4 G4 E4'
  ),
  drums: bars(
    'K H H H S H K H KH H H H S H K OH',
    'KH H H H SH H K H K H KH H SH H K OH',
    'K H KH H S H K H KH H H H S H K OH',
    'KS H K H SH H K OH KS H KH H S H KS OH'
  )
});

const CHORUS = makeSection({
  name: 'chorus',
  leadVoice: 'flute',
  lead: bars(
    'D4 D4 F4 F4 A4 A4 D5 D5 F5 F5 D5 D5 C5 C5 A4 A4',
    'Bb4 Bb4 D5 D5 F5 F5 Bb5 Bb5 A5 A5 F5 F5 D5 D5 F5 F5',
    'F4 F4 A4 A4 C5 C5 F5 F5 A5 A5 F5 F5 E5 E5 C5 C5',
    'C5 C5 G4 G4 E4 E4 G4 G4 Bb4 Bb4 G4 G4 A4 A4 C5 C5'
  ),
  bass: bars(
    'D2 D2 D2 D2 A2 A2 A2 A2 D3 D3 D3 D3 A2 A2 A2 A2',
    'Bb1 Bb1 Bb1 Bb1 F2 F2 F2 F2 Bb2 Bb2 Bb2 Bb2 F2 F2 F2 F2',
    'F2 F2 F2 F2 C3 C3 C3 C3 F3 F3 F3 F3 C3 C3 C3 C3',
    'C2 C2 C2 C2 G2 G2 G2 G2 C3 C3 C3 C3 A2 A2 A2 A2'
  ),
  arp: bars(
    'D4 - F4 - A4 - F4 - D5 - A4 - F4 - A4 -',
    'Bb3 - D4 - F4 - D4 - Bb4 - F4 - D4 - F4 -',
    'F4 - A4 - C5 - A4 - F5 - C5 - A4 - C5 -',
    'C4 - E4 - G4 - E4 - Bb4 - G4 - E4 - G4 -'
  ),
  drums: bars(
    'K H H H S H - H KH H H H S H K OH',
    'KH H H H SH H K H K H H H SH H K OH',
    'K H KH H S H - H KH H KH H S H K OH',
    'KS H K H SH H KS OH K H KS H S H KSO OH'
  )
});

const BRIDGE = makeSection({
  name: 'bridge',
  lead: bars(
    'G5 - Bb5 D6 - Bb5 - G5 - D6 - F6 - D6 - Bb5',
    'Bb5 D6 F6 - E6 - D6 - Bb5 G5 Bb5 - D6 - C6 -',
    'A5 - C#6 E6 - A6 - E6 - C#6 - A5 E6 - D6 -',
    'A5 C#6 E6 - G6 - E6 - D6 C#6 A5 - C#6 - D6 -'
  ),
  bass: bars(
    'G1 - - - D2 - - - G2 - - - D2 - - -',
    'Bb1 - - - F2 - - - Bb2 - - - F2 - - -',
    'A1 - - - E2 - - - A2 - - - E2 - - -',
    'A1 - E2 - G2 - C#3 - A2 - E2 - G2 - A2 -'
  ),
  arp: bars(
    'G3 D4 Bb3 D4 G4 D4 Bb3 D4 G3 Bb3 D4 F4 G4 F4 D4 Bb3',
    'Bb3 F4 D4 F4 Bb4 F4 D4 F4 Bb3 D4 F4 A4 Bb4 A4 F4 D4',
    'A3 E4 C#4 E4 A4 E4 C#4 E4 A3 C#4 E4 G4 A4 G4 E4 C#4',
    'A3 C#4 E4 G4 A4 G4 E4 C#4 A3 E4 G4 A4 C#5 A4 G4 E4'
  ),
  drums: bars(
    'K H - H S H K H K H - H S H K OH',
    'K H KH H S H K OH K H KH H S H K OH',
    'KH H H H SH H KH H K H H H SH H K OH',
    'KS H KS H SH H K OH KS H KS H S KS KSO OH'
  )
});

export const CLIFFSIDE_SONG = makeSong({
  id: 'cliffside',
  name: 'No Guardrail',
  bpm: 122,
  sections: [TUNE, CHORUS, BRIDGE],
  arrangement: ['tune', 'bridge', 'chorus', 'tune', 'bridge', 'chorus']
});


/* GROK version

import { bars, makeSection, makeSong } from './song-tools.js?revision=r165-track-songbook-v1';

const TUNE = makeSection({
  name: 'tune',
  lead: bars(
    'A5 - C6 - E6 D6 A5 - G5 - E5 - A5 E6 - A6',
    'F5 - A5 - C6 A5 F5 - E5 - C5 - A4 C5 - E5',
    'D5 - F5 - A5 - F5 E5 - A5 - F5 - E5 - D5',
    'G5 - E5 - C5 E5 G5 - F5 - D5 - C5 E5 - F5'
  ),
  bass: bars(
    'A1 - - - E2 - - - A2 - - - E2 - - -',
    'F1 - - - C2 - - - F2 - - - C2 - - -',
    'D2 - - - A2 - - - D3 - - - A2 - - -',
    'G1 - - - D2 - - - G2 - - - E2 - - -'
  ),
  arp: bars(
    'A3 E4 C4 E4 A4 E4 C4 E4 A3 C4 E4 G4 A4 G4 E4 C4',
    'F3 C4 A3 C4 F4 C4 A3 C4 F3 A3 C4 E4 F4 E4 C4 A3',
    'D4 A4 F4 A4 D5 A4 F4 A4 D4 F4 A4 C5 D5 C5 A4 F4',
    'G3 D4 Bb3 D4 G4 D4 Bb3 D4 G3 Bb3 D4 F4 G4 F4 D4 Bb3'
  ),
  drums: bars(
    'K H H H S H K H KH H H H S H K OH',
    'KH H H H SH H K H K H KH H SH H K OH',
    'K H KH H S H K H KH H H H S H K OH',
    'KS H K H SH H K OH KS H KH H S H KS OH'
  )
});

const CHORUS = makeSection({
  name: 'chorus',
  leadVoice: 'flute',
  lead: bars(
    'A4 A4 C5 C5 E5 E5 A5 A5 C6 C6 A5 A5 G5 G5 E5 E5',
    'F4 F4 A4 A4 C5 C5 F5 F5 E5 E5 C5 C5 A4 A4 C5 C5',
    'D4 D4 F4 F4 A4 A4 D5 D5 F5 F5 D5 D5 C5 C5 A4 A4',
    'G4 G4 E4 E4 C4 C4 E4 E4 F4 F4 D4 D4 E4 E4 G4 G4'
  ),
  bass: bars(
    'A1 A1 A1 A1 E2 E2 E2 E2 A2 A2 A2 A2 E2 E2 E2 E2',
    'F1 F1 F1 F1 C2 C2 C2 C2 F2 F2 F2 F2 C2 C2 C2 C2',
    'D2 D2 D2 D2 A2 A2 A2 A2 D3 D3 D3 D3 A2 A2 A2 A2',
    'G1 G1 G1 G1 D2 D2 D2 D2 G2 G2 G2 G2 E2 E2 E2 E2'
  ),
  arp: bars(
    'A3 - C4 - E4 - C4 - A4 - E4 - C4 - E4 -',
    'F3 - A3 - C4 - A3 - F4 - C4 - A3 - C4 -',
    'D4 - F4 - A4 - F4 - D5 - A4 - F4 - A4 -',
    'G3 - Bb3 - D4 - Bb3 - F4 - D4 - Bb3 - D4 -'
  ),
  drums: bars(
    'K H H H S H - H KH H H H S H K OH',
    'KH H H H SH H K H K H H H SH H K OH',
    'K H KH H S H - H KH H KH H S H K OH',
    'KS H K H SH H KS OH K H KS H S H KSO OH'
  )
});

const BRIDGE = makeSection({
  name: 'bridge',
  lead: bars(
    'E5 - G5 B5 - G5 - E5 - B5 - D6 - B5 - G5',
    'G5 B5 D6 - C#6 - B5 - G5 E5 G5 - B5 - A5 -',
    'F5 - A5 C6 - F6 - C6 - A5 - F5 C6 - B5 -',
    'F5 A5 C6 - E6 - C6 - B5 A5 F5 - A5 - B5 -'
  ),
  bass: bars(
    'E1 - - - B1 - - - E2 - - - B1 - - -',
    'G1 - - - D2 - - - G2 - - - D2 - - -',
    'F1 - - - C2 - - - F2 - - - C2 - - -',
    'F1 - C2 - E2 - A2 - F2 - C2 - E2 - F2 -'
  ),
  arp: bars(
    'E3 B3 G3 B3 E4 B3 G3 B3 E3 G3 B3 D4 E4 D4 B3 G3',
    'G3 D4 Bb3 D4 G4 D4 Bb3 D4 G3 Bb3 D4 F4 G4 F4 D4 Bb3',
    'F3 C4 A3 C4 F4 C4 A3 C4 F3 A3 C4 E4 F4 E4 C4 A3',
    'F3 A3 C4 E4 F4 E4 C4 A3 F3 C4 E4 F4 A4 F4 E4 C4'
  ),
  drums: bars(
    'K H - H S H K H K H - H S H K OH',
    'K H KH H S H K OH K H KH H S H K OH',
    'KH H H H SH H KH H K H H H SH H K OH',
    'KS H KS H SH H K OH KS H KS H S KS KSO OH'
  )
});

export const CLIFFSIDE_SONG = makeSong({
  id: 'cliffside',
  name: 'No Guardrail',
  bpm: 122,
  sections: [TUNE, CHORUS, BRIDGE],
  arrangement: ['tune', 'bridge', 'chorus', 'tune', 'bridge', 'chorus']
});
*/
