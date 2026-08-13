import { bars, makeSection, makeSong } from './song-tools.js?revision=r165-track-songbook-v1';


const TUNE = makeSection({
  name: 'tune',

  lead: bars(
    'E6 - G6 C7 - B6 - G6 - E6 D6 - G6 - C7 -',
    'D6 - G6 Bb6 - D7 - C7 Bb6 G6 - F6 - D6 - G6',
    'F6 - A6 C7 - A6 - F6 - E6 F6 A6 - C7 - A6',
    'G6 - B6 D7 - G7 - F7 D7 B6 - A6 - G6 - D7'
  ),

  bass: bars(
    'C2 - C2 - G2 - C3 - C2 - G2 - E2 - G2 -',
    'G1 - G1 - D2 - G2 - G1 - D2 - Bb1 - D2 -',
    'F1 - F1 - C2 - F2 - F1 - C2 - A1 - C2 -',
    'G1 - G1 - D2 - G2 - G1 - D2 - B1 - D2 -'
  ),

  arp: bars(
    'C4 G4 E4 G4 C5 G4 E4 G4 C4 E4 G4 B4 C5 B4 G4 E4',
    'G3 D4 Bb3 D4 G4 D4 Bb3 D4 G3 Bb3 D4 F4 G4 F4 D4 Bb3',
    'F3 C4 A3 C4 F4 C4 A3 C4 F3 A3 C4 E4 F4 E4 C4 A3',
    'G3 D4 B3 D4 G4 D4 B3 D4 G3 B3 D4 F4 G4 F4 D4 B3'
  ),

  drums: bars(
    'KH H K H SH H KH H K H K H SH H K OH',
    'KH H K H SH H K OH KH H K H SH H KS OH',
    'KH H KH H SH H K H K H KH H SH H K OH',
    'KS H K H SH H KH OH K H KS H SH H KSO OH'
  )
});


const CHORUS = makeSection({
  name: 'chorus',
  leadVoice: 'flute',

  lead: bars(
    'E5 E5 G5 G5 C6 C6 E6 E6 G6 G6 E6 E6 C6 C6 G5 G5',
    'A4 A4 C5 C5 E5 E5 A5 A5 G5 G5 E5 E5 C5 C5 E5 E5',
    'F5 F5 A5 A5 C6 C6 F6 F6 E6 E6 C6 C6 A5 A5 C6 C6',
    'G5 G5 B5 B5 D6 D6 G6 G6 F6 F6 D6 D6 B5 B5 D6 D6'
  ),

  bass: bars(
    'C2 C2 C2 C2 G2 G2 G2 G2 C3 C3 C3 C3 G2 G2 G2 G2',
    'A1 A1 A1 A1 E2 E2 E2 E2 A2 A2 A2 A2 E2 E2 E2 E2',
    'F1 F1 F1 F1 C2 C2 C2 C2 F2 F2 F2 F2 C2 C2 C2 C2',
    'G1 G1 G1 G1 D2 D2 D2 D2 G2 G2 G2 G2 D2 D2 D2 D2'
  ),

  arp: bars(
    'C4 - G4 - E4 - G4 - C5 - G4 - E4 - G4 -',
    'A3 - E4 - C4 - E4 - A4 - E4 - C4 - E4 -',
    'F3 - C4 - A3 - C4 - F4 - C4 - A3 - C4 -',
    'G3 - D4 - B3 - D4 - G4 - D4 - B3 - D4 -'
  ),

  drums: bars(
    'KH H K H SH H K H KH H K H SH H K OH',
    'KH H KH H SH H K OH KH H K H SH H KS OH',
    'KH H K H SH H KH H K H K H SH H K OH',
    'KS H KS H SH H K OH KS H KS H S KS KSO OH'
  )
});


const BRIDGE = makeSection({
  name: 'bridge',

  lead: bars(
    'D6 - F#6 A6 - D7 - C7 A6 F#6 - E6 - F#6 - A6',
    'E6 - G#6 B6 - E7 - D7 B6 G#6 - F#6 - G#6 B6 -',
    'F6 - A6 C7 - F7 - E7 C7 A6 - G6 - A6 - C7',
    'G6 B6 D7 - F7 - E7 - D7 B6 - A6 - G6 D7 -'
  ),

  bass: bars(
    'D2 - - - A2 - - - D3 - - - A2 - - -',
    'E2 - - - B2 - - - E3 - - - B2 - - -',
    'F2 - - - C3 - - - F3 - - - C3 - - -',
    'G1 - D2 - F2 - B1 - G2 - D2 - F2 - G2 -'
  ),

  arp: bars(
    'D4 A4 F#4 A4 D5 A4 F#4 A4 D4 F#4 A4 C5 D5 C5 A4 F#4',
    'E4 B4 G#4 B4 E5 B4 G#4 B4 E4 G#4 B4 D5 E5 D5 B4 G#4',
    'F4 C5 A4 C5 F5 C5 A4 C5 F4 A4 C5 E5 F5 E5 C5 A4',
    'G3 D4 B3 D4 G4 D4 B3 D4 G3 B3 D4 F4 G4 F4 D4 B3'
  ),

  drums: bars(
    'K H - H S H K H K H - H S H K OH',
    'K H KH H S H K OH K H KH H S H K OH',
    'KH H K H SH H KH H K H K H SH H K OH',
    'KS H KS H SH H K OH KS H KS H S KS KSO OH'
  )
});


export const AIRPORT_SONG = makeSong({
  id: 'airport',
  name: 'Airport Runway',
  bpm: 128,

  sections: [
    TUNE,
    CHORUS,
    BRIDGE
  ],

  arrangement: [
    'tune',
    'chorus',
    'tune',
    'bridge',
    'chorus',
    'bridge'
  ]
});