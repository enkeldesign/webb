import { bars, makeSection, makeSong } from './song-tools.js?revision=r165-track-songbook-v1';


const TUNE = makeSection({
  name: 'tune',

  lead: bars(
    'E5 - G5 C6 - G5 - E5 - D5 E5 G5 - C6 - G5',
    'Ab5 - C6 - F6 - Eb6 C6 Ab5 - G5 Ab5 C6 - F6 -',
    'E5 - G5 C6 - E6 - D6 C6 G5 - E5 G5 - C6 -',
    'D6 - B5 G5 - D6 - F6 - Eb6 D6 B5 - G5 - B5'
  ),

  bass: bars(
    'C2 - C2 - G2 - C3 - C2 - G2 - E2 - G2 -',
    'F1 - F1 - C2 - F2 - F1 - C2 - Ab1 - C2 -',
    'C2 - C2 - G2 - C3 - C2 - G2 - E2 - G2 -',
    'G1 - G1 - D2 - G2 - G1 - D2 - B1 - D2 -'
  ),

  arp: bars(
    'C4 G4 E4 G4 C5 G4 E4 G4 C4 E4 G4 B4 C5 B4 G4 E4',
    'F3 C4 Ab3 C4 F4 C4 Ab3 C4 F3 Ab3 C4 Eb4 F4 Eb4 C4 Ab3',
    'C4 G4 E4 G4 C5 G4 E4 G4 C4 E4 G4 C5 E5 C5 G4 E4',
    'G3 D4 B3 D4 G4 D4 B3 D4 G3 B3 D4 F4 G4 F4 D4 B3'
  ),

  drums: bars(
    'K H - H S H K H K H - H S H K OH',
    'K H - H S H K OH K H KH H S H K OH',
    'KH H K H SH H K H K H KH H SH H K OH',
    'KS H K H SH H KH OH K H KS H SH H KSO OH'
  )
});


const CHORUS = makeSection({
  name: 'chorus',
  leadVoice: 'flute',

  lead: bars(
    'G5 G5 Bb5 Bb5 Eb6 Eb6 G6 G6 F6 F6 Eb6 Eb6 Bb5 Bb5 G5 G5',
    'Ab5 Ab5 C6 C6 Eb6 Eb6 Ab6 Ab6 G6 G6 Eb6 Eb6 C6 C6 Eb6 Eb6',
    'G5 G5 Eb5 Eb5 C5 C5 Eb5 Eb5 G5 G5 C6 C6 Bb5 Bb5 G5 G5',
    'F5 F5 Bb5 Bb5 D6 D6 F6 F6 Eb6 Eb6 D6 D6 Bb5 Bb5 D6 D6'
  ),

  bass: bars(
    'Eb2 Eb2 Eb2 Eb2 Bb2 Bb2 Bb2 Bb2 Eb3 Eb3 Eb3 Eb3 Bb2 Bb2 Bb2 Bb2',
    'Ab1 Ab1 Ab1 Ab1 Eb2 Eb2 Eb2 Eb2 Ab2 Ab2 Ab2 Ab2 Eb2 Eb2 Eb2 Eb2',
    'C2 C2 C2 C2 G2 G2 G2 G2 C3 C3 C3 C3 G2 G2 G2 G2',
    'Bb1 Bb1 Bb1 Bb1 F2 F2 F2 F2 Bb2 Bb2 Bb2 Bb2 F2 F2 F2 F2'
  ),

  arp: bars(
    'Eb4 - Bb4 - G4 - Bb4 - Eb5 - Bb4 - G4 - Bb4 -',
    'Ab3 - Eb4 - C4 - Eb4 - Ab4 - Eb4 - C4 - Eb4 -',
    'C4 - G4 - Eb4 - G4 - C5 - G4 - Eb4 - G4 -',
    'Bb3 - F4 - D4 - F4 - Bb4 - F4 - D4 - F4 -'
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
    'Eb6 - C6 G5 - C6 - Eb6 - G6 - F6 Eb6 C6 - Bb5',
    'C6 - Eb6 Ab6 - G6 - Eb6 C6 - Bb5 C6 Eb6 - Ab6 -',
    'F6 - C6 Ab5 - C6 - F6 - Eb6 C6 Ab5 - G5 - C6',
    'D6 - B5 G5 - D6 - F6 - D6 B5 G5 B5 D6 - G6'
  ),

  bass: bars(
    'C2 - - - G2 - - - C3 - - - G2 - - -',
    'Ab1 - - - Eb2 - - - Ab2 - - - Eb2 - - -',
    'F1 - - - C2 - - - F2 - - - C2 - - -',
    'G1 - D2 - F2 - B1 - G2 - D2 - F2 - G2 -'
  ),

  arp: bars(
    'C4 G4 Eb4 G4 C5 G4 Eb4 G4 C4 Eb4 G4 Bb4 C5 Bb4 G4 Eb4',
    'Ab3 Eb4 C4 Eb4 Ab4 Eb4 C4 Eb4 Ab3 C4 Eb4 G4 Ab4 G4 Eb4 C4',
    'F3 C4 Ab3 C4 F4 C4 Ab3 C4 F3 Ab3 C4 Eb4 F4 Eb4 C4 Ab3',
    'G3 D4 B3 D4 G4 D4 B3 D4 G3 B3 D4 F4 G4 F4 D4 B3'
  ),

  drums: bars(
    'K H - H S H - H K H - H S H K OH',
    'K H - H S H K OH K H - H S H K OH',
    'KH H - H SH H KH H K H - H SH H K OH',
    'KS H KS H SH H K OH KS H K H S KS KSO OH'
  )
});


export const CLIFFSIDE_SONG = makeSong({
  id: 'cliffside',
  name: 'Cliffside Run',
  bpm: 128,

  sections: [
    TUNE,
    CHORUS,
    BRIDGE
  ],

  arrangement: [
    'tune',
    'chorus',
    'bridge',
    'tune',
    'chorus',
    'bridge'
  ]
});