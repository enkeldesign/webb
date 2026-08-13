/*
import { bars, makeSection, makeSong } from './song-tools.js?revision=r165-track-songbook-v1';

const TUNE = makeSection({
  name: 'tune',
  lead: bars(
    'A5 - C6 E6 - C6 - A5 - G5 - E5 G5 - A5 -',
    'F5 - A5 C6 - A5 - F5 - E5 - C5 E5 - F5 -',
    'C6 - E6 G6 - E6 - C6 - B5 - G5 B5 - C6 -',
    'G5 - B5 D6 - B5 - G5 - E5 F5 G5 - B5 - E6'
  ),
  bass: bars(
    'A1 - - A2 - - E2 - A1 - - A2 - G2 - E2',
    'F1 - - F2 - - C2 - F1 - - F2 - E2 - C2',
    'C2 - - C3 - - G2 - C2 - - C3 - B2 - G2',
    'G1 - - G2 - - D2 - G1 - - G2 - B1 - E2'
  ),
  arp: bars(
    'A4 C5 E5 C5 A4 E5 C5 E5 A4 C5 E5 A5 E5 C5 A5 E5',
    'F4 A4 C5 A4 F4 C5 A4 C5 F4 A4 C5 F5 C5 A4 F5 C5',
    'C4 E4 G4 E4 C5 G4 E4 G4 C4 E4 G4 C5 G4 E4 C5 G4',
    'G4 B4 D5 B4 G4 D5 B4 D5 G4 B4 D5 E5 G5 E5 B4 G4'
  ),
  drums: bars(
    'KH H K H SH H KH H K H K H SH H K OH',
    'KH H K H SH H K H KH H K H SH H KS OH',
    'KH H KH H SH H K H K H KH H SH H K OH',
    'KS H K H SH H KH OH K H KS H SH H KSO OH'
  )
});

const CHORUS = makeSection({
  name: 'chorus',
  leadVoice: 'flute',
  lead: bars(
    'A4 A4 C5 C5 E5 E5 A5 A5 G5 G5 E5 E5 C5 C5 E5 E5',
    'F4 F4 A4 A4 C5 C5 F5 F5 E5 E5 C5 C5 A4 A4 C5 C5',
    'C5 C5 E5 E5 G5 G5 C6 C6 B5 B5 G5 G5 E5 E5 G5 G5',
    'G4 G4 B4 B4 D5 D5 G5 G5 B5 B5 A5 A5 G5 G5 E5 E5'
  ),
  bass: bars(
    'A1 A1 A1 A1 E2 E2 E2 E2 A2 A2 A2 A2 E2 E2 E2 E2',
    'F1 F1 F1 F1 C2 C2 C2 C2 F2 F2 F2 F2 C2 C2 C2 C2',
    'C2 C2 C2 C2 G2 G2 G2 G2 C3 C3 C3 C3 G2 G2 G2 G2',
    'G1 G1 G1 G1 D2 D2 D2 D2 G2 G2 G2 G2 E2 E2 E2 E2'
  ),
  arp: bars(
    'A4 - E5 - C5 - E5 - A5 - E5 - C5 - E5 -',
    'F4 - C5 - A4 - C5 - F5 - C5 - A4 - C5 -',
    'C4 - G4 - E4 - G4 - C5 - G4 - E4 - G4 -',
    'G4 - D5 - B4 - D5 - G5 - D5 - B4 - E5 -'
  ),
  drums: bars(
    'KH H K H SH H K H KH H K H SH H K OH',
    'KH H KH H SH H K OH KH H K H SH H KS OH',
    'KH H K H SH H KH H K H K H SH H K OH',
    'KS H K H SH H KS OH K H KS H SH H KSO OH'
  )
});

const BRIDGE = makeSection({
  name: 'bridge',
  lead: bars(
    'D6 - A5 F5 - A5 - D6 - C6 - A5 - F5 - E5',
    'F5 A5 C6 - E6 - C6 - A5 F5 A5 - C6 - A5 -',
    'E5 - G#5 B5 - E6 - D6 - B5 - G#5 B5 - D6 -',
    'E6 D6 B5 - G#5 - E5 - B5 - D6 E6 - B5 - E6'
  ),
  bass: bars(
    'D2 - - - A2 - - - D3 - - - A2 - - -',
    'F1 - - - C2 - - - F2 - - - C2 - - -',
    'E2 - - - B2 - - - E3 - - - B2 - - -',
    'E2 - B2 - D3 - G#2 - E3 - B2 - D3 - B2 -'
  ),
  arp: bars(
    'D4 F4 A4 F4 D5 A4 F4 A4 D4 F4 A4 D5 A4 F4 D5 A4',
    'F4 A4 C5 A4 F5 C5 A4 C5 F4 A4 C5 E5 C5 A4 F5 C5',
    'E4 G#4 B4 G#4 E5 B4 G#4 B4 E4 G#4 B4 D5 E5 D5 B4 G#4',
    'E4 B4 G#4 B4 D5 B4 G#4 B4 E4 G#4 B4 E5 D5 B4 G#4 B4'
  ),
  drums: bars(
    'K H - H S H K H K H - H S H K OH',
    'K H KH H S H K OH K H KH H S H K OH',
    'KH H K H SH H KH H K H K H SH H K OH',
    'KS H KS H SH H K OH KS H K H S KS KSO OH'
  )
});

export const AIRPORT_SONG = makeSong({
  id: 'airport',
  name: 'Cleared for Takeoff',
  bpm: 128,
  sections: [TUNE, CHORUS, BRIDGE],
  arrangement: ['chorus', 'tune', 'bridge', 'tune', 'chorus', 'bridge']
});
*/

// Gemini version

import { bars, makeSection, makeSong } from './song-tools.js?revision=r165-track-songbook-v1';

const TUNE = makeSection({
  name: 'tune',
  lead: bars(
    'A5 - C6 E6 - C6 - A5 - G5 - E5 G5 - A5 -',
    'F5 - A5 C6 - A5 - F5 - E5 - C5 E5 - F5 -',
    'C6 - E6 G6 - E6 - C6 - B5 - G5 B5 - C6 -',
    'G5 - B5 D6 - B5 - G5 - E5 F5 G5 - B5 - E6'
  ),
  bass: bars(
    'A1 - - A2 - - E2 - A1 - - A2 - G2 - E2',
    'F1 - - F2 - - C2 - F1 - - F2 - E2 - C2',
    'C2 - - C3 - - G2 - C2 - - C3 - B2 - G2',
    'G1 - - G2 - - D2 - G1 - - G2 - B1 - E2'
  ),
  arp: bars(
    'A4 C5 E5 C5 A4 E5 C5 E5 A4 C5 E5 A5 E5 C5 A5 E5',
    'F4 A4 C5 A4 F4 C5 A4 C5 F4 A4 C5 F5 C5 A4 F5 C5',
    'C4 E4 G4 E4 C5 G4 E4 G4 C4 E4 G4 C5 G4 E4 C5 G4',
    'G4 B4 D5 B4 G4 D5 B4 D5 G4 B4 D5 E5 G5 E5 B4 G4'
  ),
  drums: bars(
    'KH H K H SH H KH H K H K H SH H K OH',
    'KH H K H SH H K H KH H K H SH H KS OH',
    'KH H KH H SH H K H K H KH H SH H K OH',
    'KS H K H SH H KH OH K H KS H SH H KSO OH'
  )
});

const CHORUS = makeSection({
  name: 'chorus',
  leadVoice: 'flute',
  lead: bars(
    'A4 A4 C5 C5 E5 E5 A5 A5 G5 G5 E5 E5 C5 C5 E5 E5',
    'F4 F4 A4 A4 C5 C5 F5 F5 E5 E5 C5 C5 A4 A4 C5 C5',
    'C5 C5 E5 E5 G5 G5 C6 C6 B5 B5 G5 G5 E5 E5 G5 G5',
    'G4 G4 B4 B4 D5 D5 G5 G5 B5 B5 A5 A5 G5 G5 E5 E5'
  ),
  bass: bars(
    'A1 A1 A1 A1 E2 E2 E2 E2 A2 A2 A2 A2 E2 E2 E2 E2',
    'F1 F1 F1 F1 C2 C2 C2 C2 F2 F2 F2 F2 C2 C2 C2 C2',
    'C2 C2 C2 C2 G2 G2 G2 G2 C3 C3 C3 C3 G2 G2 G2 G2',
    'G1 G1 G1 G1 D2 D2 D2 D2 G2 G2 G2 G2 E2 E2 E2 E2'
  ),
  arp: bars(
    'A4 - E5 - C5 - E5 - A5 - E5 - C5 - E5 -',
    'F4 - C5 - A4 - C5 - F5 - C5 - A4 - C5 -',
    'C4 - G4 - E4 - G4 - C5 - G4 - E4 - G4 -',
    'G4 - D5 - B4 - D5 - G5 - D5 - B4 - E5 -'
  ),
  drums: bars(
    'KH H K H SH H K H KH H K H SH H K OH',
    'KH H KH H SH H K OH KH H K H SH H KS OH',
    'KH H K H SH H KH H K H K H SH H K OH',
    'KS H K H SH H KS OH K H KS H SH H KSO OH'
  )
});

const BRIDGE = makeSection({
  name: 'bridge',
  lead: bars(
    'D6 - A5 F5 - A5 - D6 - C6 - A5 - F5 - E5',
    'F5 A5 C6 - E6 - C6 - A5 F5 A5 - C6 - A5 -',
    'E5 - G#5 B5 - E6 - D6 - B5 - G#5 B5 - D6 -',
    'E6 D6 B5 - G#5 - E5 - B5 - D6 E6 - B5 - E6'
  ),
  bass: bars(
    'D2 - - - A2 - - - D3 - - - A2 - - -',
    'F1 - - - C2 - - - F2 - - - C2 - - -',
    'E2 - - - B2 - - - E3 - - - B2 - - -',
    'E2 - B2 - D3 - G#2 - E3 - B2 - D3 - B2 -'
  ),
  arp: bars(
    'D4 F4 A4 F4 D5 A4 F4 A4 D4 F4 A4 D5 A4 F4 D5 A4',
    'F4 A4 C5 A4 F5 C5 A4 C5 F4 A4 C5 E5 C5 A4 F5 C5',
    'E4 G#4 B4 G#4 E5 B4 G#4 B4 E4 G#4 B4 D5 E5 D5 B4 G#4',
    'E4 B4 G#4 B4 D5 B4 G#4 B4 E4 G#4 B4 E5 D5 B4 G#4 B4'
  ),
  drums: bars(
    'K H - H S H K H K H - H S H K OH',
    'K H KH H S H K OH K H KH H S H K OH',
    'KH H K H SH H KH H K H K H SH H K OH',
    'KS H KS H SH H K OH KS H K H S KS KSO OH'
  )
});

export const AIRPORT_SONG = makeSong({
  id: 'airport',
  name: 'Cleared for Takeoff',
  bpm: 134,
  sections: [TUNE, CHORUS, BRIDGE],
  arrangement: ['chorus', 'tune', 'bridge', 'tune', 'chorus', 'bridge']
});

