import { bars, makeSection, makeSong } from './song-tools.js?revision=r165-track-songbook-v1';


const TUNE = makeSection({
  name: 'tune',

  lead: bars(
    'G5 - E5 G5 - C6 - B5 - G5 E5 - D5 - E5 -',
    'A5 - E5 A5 - C6 - B5 A5 E5 - C5 - E5 - -',
    'C6 - A5 C6 - F6 - E6 C6 A5 - G5 - A5 - -',
    'D6 - B5 D6 - G6 - F6 D6 B5 - A5 - G5 - -'
  ),

  bass: bars(
    'C2 - - C3 - - G2 - C2 - C3 - G2 - E2 -',
    'A1 - - A2 - - E2 - A1 - A2 - E2 - C2 -',
    'F1 - - F2 - - C2 - F1 - F2 - C2 - A1 -',
    'G1 - - G2 - - D2 - G1 - G2 - D2 - B1 -'
  ),

  arp: bars(
    'C4 G4 E4 G4 C5 G4 E4 G4 C4 E4 G4 B4 C5 B4 G4 E4',
    'A3 E4 C4 E4 A4 E4 C4 E4 A3 C4 E4 G4 A4 G4 E4 C4',
    'F3 C4 A3 C4 F4 C4 A3 C4 F3 A3 C4 E4 F4 E4 C4 A3',
    'G3 D4 B3 D4 G4 D4 B3 D4 G3 B3 D4 F4 G4 F4 D4 B3'
  ),

  drums: bars(
    'K H - H S H - H K H - H S H K OH',
    'K H - H S H K H K H - H S H K OH',
    'K H KH H S H - H K H KH H S H K OH',
    'KH H K H SH H K OH KH H K H SH H KS OH'
  )
});


const CHORUS = makeSection({
  name: 'chorus',
  leadVoice: 'flute',

  lead: bars(
    'E5 E5 G5 G5 C6 C6 E6 E6 D6 D6 C6 C6 G5 G5 E5 E5',
    'A4 A4 C5 C5 E5 E5 A5 A5 G5 G5 E5 E5 C5 C5 E5 E5',
    'F5 F5 A5 A5 C6 C6 F6 F6 E6 E6 C6 C6 A5 A5 C6 C6',
    'G5 G5 E5 E5 C5 C5 E5 E5 G5 G5 C6 C6 B5 B5 G5 G5'
  ),

  bass: bars(
    'C2 C2 C2 C2 G2 G2 G2 G2 C3 C3 C3 C3 G2 G2 G2 G2',
    'A1 A1 A1 A1 E2 E2 E2 E2 A2 A2 A2 A2 E2 E2 E2 E2',
    'F1 F1 F1 F1 C2 C2 C2 C2 F2 F2 F2 F2 C2 C2 C2 C2',
    'C2 C2 C2 C2 G2 G2 G2 G2 C3 C3 C3 C3 G2 G2 G2 G2'
  ),

  arp: bars(
    'C4 - G4 - E4 - G4 - C5 - G4 - E4 - G4 -',
    'A3 - E4 - C4 - E4 - A4 - E4 - C4 - E4 -',
    'F3 - C4 - A3 - C4 - F4 - C4 - A3 - C4 -',
    'C4 - G4 - E4 - G4 - C5 - G4 - E4 - B4 -'
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
    'D5 - F5 Bb5 - D6 - C6 - Bb5 F5 - D5 - F5 -',
    'C6 - A5 C6 - F6 - E6 C6 A5 - F5 - A5 - -',
    'C6 - Eb6 Ab6 - C7 - Bb6 Ab6 Eb6 - C6 - Eb6 - -',
    'B5 - D6 G6 - F6 - D6 B5 - A5 - G5 - D6 -'
  ),

  bass: bars(
    'Bb1 - - Bb2 - - F2 - Bb1 - Bb2 - F2 - D2 -',
    'F1 - - F2 - - C2 - F1 - F2 - C2 - A1 -',
    'Ab1 - - Ab2 - - Eb2 - Ab1 - Ab2 - Eb2 - C2 -',
    'G1 - - G2 - - D2 - G1 - G2 - D2 - B1 -'
  ),

  arp: bars(
    'Bb3 F4 D4 F4 Bb4 F4 D4 F4 Bb3 D4 F4 A4 Bb4 A4 F4 D4',
    'F3 C4 A3 C4 F4 C4 A3 C4 F3 A3 C4 E4 F4 E4 C4 A3',
    'Ab3 Eb4 C4 Eb4 Ab4 Eb4 C4 Eb4 Ab3 C4 Eb4 G4 Ab4 G4 Eb4 C4',
    'G3 D4 B3 D4 G4 D4 B3 D4 G3 B3 D4 F4 G4 F4 D4 B3'
  ),

  drums: bars(
    'K H - H S H K H K H - H S H K OH',
    'K H KH H S H K OH K H KH H S H K OH',
    'KH H - H SH H KH H K H - H SH H K OH',
    'KS H KS H SH H K OH KS H K H S KS KSO OH'
  )
});


export const COUNTRYSIDE_SONG = makeSong({
  id: 'countryside',
  name: 'Countryside Lap',
  bpm: 100,

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
    'tune'
  ]
});