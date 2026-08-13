import { bars, makeSection, makeSong } from './song-tools.js?revision=r165-track-songbook-v1';


const TUNE = makeSection({
  name: 'tune',

  lead: bars(
    'B5 - D6 G6 - F#6 - E6 - D6 B5 - A5 - B5 -',
    'E6 - B5 E6 - G6 - F#6 E6 B5 - A5 B5 - D6 -',
    'C6 - E6 G6 - C7 - B6 G6 E6 - D6 - E6 - G6',
    'D6 - F#6 A6 - D7 - C7 A6 F#6 - E6 - D6 - A6'
  ),

  bass: bars(
    'G1 - G1 - D2 - G2 - G1 - D2 - B1 - D2 -',
    'E1 - E1 - B1 - E2 - E1 - B1 - G1 - B1 -',
    'C2 - C2 - G2 - C3 - C2 - G2 - E2 - G2 -',
    'D2 - D2 - A2 - D3 - D2 - A2 - F#2 - A2 -'
  ),

  arp: bars(
    'G3 D4 B3 D4 G4 D4 B3 D4 G3 B3 D4 F#4 G4 F#4 D4 B3',
    'E3 B3 G3 B3 E4 B3 G3 B3 E3 G3 B3 D4 E4 D4 B3 G3',
    'C4 G4 E4 G4 C5 G4 E4 G4 C4 E4 G4 B4 C5 B4 G4 E4',
    'D4 A4 F#4 A4 D5 A4 F#4 A4 D4 F#4 A4 C5 D5 C5 A4 F#4'
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
    'G5 G5 B5 B5 D6 D6 G6 G6 F#6 F#6 D6 D6 B5 B5 D6 D6',
    'E5 E5 G5 G5 B5 B5 E6 E6 D6 D6 B5 B5 G5 G5 B5 B5',
    'C5 C5 E5 E5 G5 G5 C6 C6 B5 B5 G5 G5 E5 E5 G5 G5',
    'D5 D5 F#5 F#5 A5 A5 D6 D6 E6 E6 F#6 F#6 A6 A6 B6 B6'
  ),

  bass: bars(
    'G1 G1 G1 G1 D2 D2 D2 D2 G2 G2 G2 G2 D2 D2 D2 D2',
    'E1 E1 E1 E1 B1 B1 B1 B1 E2 E2 E2 E2 B1 B1 B1 B1',
    'C2 C2 C2 C2 G2 G2 G2 G2 C3 C3 C3 C3 G2 G2 G2 G2',
    'D2 D2 D2 D2 A2 A2 A2 A2 D3 D3 D3 D3 A2 A2 B2 B2'
  ),

  arp: bars(
    'G3 - D4 - B3 - D4 - G4 - D4 - B3 - F#4 -',
    'E3 - B3 - G3 - B3 - E4 - B3 - G3 - D4 -',
    'C4 - G4 - E4 - G4 - C5 - G4 - E4 - B4 -',
    'D4 - A4 - F#4 - A4 - D5 - A4 - F#4 - B4 -'
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
    'A5 - C6 E6 - A6 - G6 E6 C6 - B5 - C6 - E6',
    'C6 - E6 G6 - C7 - B6 G6 E6 - D6 - E6 - G6',
    'E6 - G6 B6 - E7 - D7 B6 G6 - F#6 - G6 - B6',
    'F#6 - A6 D7 - C7 - A6 F#6 E6 - D6 - A6 - D7'
  ),

  bass: bars(
    'A1 - - - E2 - - - A2 - - - E2 - - -',
    'C2 - - - G2 - - - C3 - - - G2 - - -',
    'E1 - - - B1 - - - E2 - - - B1 - - -',
    'D2 - A2 - C3 - F#2 - D3 - A2 - C3 - D3 -'
  ),

  arp: bars(
    'A3 E4 C4 E4 A4 E4 C4 E4 A3 C4 E4 G4 A4 G4 E4 C4',
    'C4 G4 E4 G4 C5 G4 E4 G4 C4 E4 G4 B4 C5 B4 G4 E4',
    'E3 B3 G3 B3 E4 B3 G3 B3 E3 G3 B3 D4 E4 D4 B3 G3',
    'D4 F#4 A4 C5 D5 C5 A4 F#4 D4 A4 C5 D5 F#5 D5 C5 A4'
  ),

  drums: bars(
    'K H - H S H - H K H - H S H K OH',
    'K H KH H S H K OH K H - H S H K OH',
    'KH H - H SH H KH H K H - H SH H K OH',
    'KS H KS H SH H K OH KS H KS H S KS KSO OH'
  )
});


export const HARBOR_SONG = makeSong({
  id: 'harbor',
  name: 'Harbor Run',
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