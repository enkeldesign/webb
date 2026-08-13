import { bars, makeSection, makeSong } from './song-tools.js?revision=r165-track-songbook-v1';

const TUNE = makeSection({
  name: 'tune',

  lead: bars(
    'G6 - D6 G6 - Bb6 - D7 - C7 Bb6 G6 - D6 - D7',
    'Eb6 - G6 Bb6 - D7 - C7 Bb6 G6 - F6 G6 - Bb6 -',
    'F6 - A6 C7 - F7 - Eb7 C7 A6 - G6 A6 - C7 -',
    'G6 - Bb6 D7 - G7 - F7 D7 Bb6 - A6 D7 - D7 -'
  ),

  bass: bars(
    'G2 - G2 - D3 - G3 - G2 - D3 - F3 - D3 -',
    'Eb2 - Eb2 - Bb2 - Eb3 - Eb2 - Bb2 - D3 - Bb2 -',
    'F2 - F2 - C3 - F3 - F2 - C3 - Eb3 - C3 -',
    'G2 - G2 - D3 - G3 - G2 - D3 - F#3 - D3 -'
  ),

  arp: bars(
    'G4 D5 Bb4 D5 G5 D5 Bb4 D5 G4 Bb4 D5 F5 G5 F5 D5 Bb4',
    'Eb4 Bb4 G4 Bb4 Eb5 Bb4 G4 Bb4 Eb4 G4 Bb4 D5 Eb5 D5 Bb4 G4',
    'F4 C5 A4 C5 F5 C5 A4 C5 F4 A4 C5 Eb5 F5 Eb5 C5 A4',
    'G4 D5 Bb4 D5 G5 D5 Bb4 D5 G4 Bb4 D5 F#5 G5 F#5 D5 Bb4'
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
    'G5 G5 Bb5 Bb5 D6 D6 F6 F6 G6 G6 F6 F6 D6 D6 Bb5 Bb5',
    'Eb5 Eb5 G5 G5 Bb5 Bb5 D6 D6 Eb6 Eb6 D6 D6 Bb5 Bb5 G5 G5',
    'Bb5 Bb5 D6 D6 F6 F6 Bb6 Bb6 A6 A6 F6 F6 D6 D6 F6 F6',
    'F5 F5 A5 A5 C6 C6 F6 F6 D6 D6 C6 C6 A5 A5 D6 D6'
  ),

  bass: bars(
    'G2 G2 G2 G2 D3 D3 D3 D3 G3 G3 G3 G3 D3 D3 F3 F3',
    'Eb2 Eb2 Eb2 Eb2 Bb2 Bb2 Bb2 Bb2 Eb3 Eb3 Eb3 Eb3 Bb2 Bb2 D3 D3',
    'Bb1 Bb1 Bb1 Bb1 F2 F2 F2 F2 Bb2 Bb2 Bb2 Bb2 F2 F2 A2 A2',
    'F2 F2 F2 F2 C3 C3 C3 C3 F3 F3 F3 F3 D3 D3 D3 D3'
  ),

  arp: bars(
    'G4 - D5 - Bb4 - D5 - G5 - D5 - Bb4 - F5 -',
    'Eb4 - Bb4 - G4 - Bb4 - Eb5 - Bb4 - G4 - D5 -',
    'Bb3 - F4 - D4 - F4 - Bb4 - F4 - D4 - A4 -',
    'F4 - C5 - A4 - C5 - F5 - C5 - A4 - D5 -'
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
    'C6 - G6 - Bb6 - G6 - Eb7 - D7 - Bb6 - G6 -',
    'Eb6 - Bb6 - D7 - Bb6 - G6 - F6 - D6 - Bb6 -',
    'F#6 - A6 C7 - D7 - C7 - A6 F#6 - D6 - A6 -',
    'A6 - C7 D7 - F#7 - D7 - C7 A6 - F#6 - D7 -'
  ),

  bass: bars(
    'C2 - - - G2 - - - C3 - - - G2 - - -',
    'Eb2 - - - Bb2 - - - Eb3 - - - Bb2 - - -',
    'D2 - - - A2 - - - D3 - - - A2 - - -',
    'D2 - A2 - C3 - F#2 - D3 - A2 - C3 - D3 -'
  ),

  arp: bars(
    'C4 G4 Eb4 G4 C5 G4 Eb4 G4 C4 Eb4 G4 Bb4 C5 Bb4 G4 Eb4',
    'Eb4 Bb4 G4 Bb4 Eb5 Bb4 G4 Bb4 Eb4 G4 Bb4 D5 Eb5 D5 Bb4 G4',
    'D4 A4 F#4 A4 D5 A4 F#4 A4 D4 F#4 A4 C5 D5 C5 A4 F#4',
    'D4 F#4 A4 C5 D5 C5 A4 F#4 D4 A4 C5 D5 F#5 D5 C5 A4'
  ),

  drums: bars(
    'K H - H S H - H K H - H S H K OH',
    'K H - H S H K OH K H - H S H K OH',
    'KH H K H SH H KH H K H K H SH H K OH',
    'KS H KS H SH H K OH KS H KS H S KS KSO OH'
  )
});


export const MIDNIGHT_CITY_SONG = makeSong({
  id: 'midnight-city',
  name: 'Neon Velocity',
  bpm: 128,

  sections: [
    TUNE,
    CHORUS,
    BRIDGE
  ],

  arrangement: [
    'tune',
    'tune',
    'chorus',
    'bridge',
    'chorus',
    'tune'
  ]
});