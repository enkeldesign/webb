import { bars, makeSection, makeSong } from './song-tools.js?revision=r165-track-songbook-v1';

const TUNE = makeSection({
  name: 'tune',
  lead: bars(
    'G5 - B5 - D6 - B5 - A5 - G5 - E5 - D5 -',
    'F#5 - A5 - D6 - A5 - B5 - A5 - F#5 - E5 -',
    'E5 - G5 - B5 - E6 - D6 - B5 - G5 - E5 -',
    'C6 - B5 - G5 - E5 - F#5 - A5 - D6 - D5 -'
  ),
  bass: bars(
    'G2 - - - D3 - - - G3 - - - D3 - - -',
    'D2 - - - A2 - - - D3 - - - A2 - - -',
    'E2 - - - B2 - - - E3 - - - B2 - - -',
    'C2 - - - G2 - - - D2 - - - A2 - - -'
  ),
  arp: bars(
    'G4 - B4 - D5 - B4 - G5 - D5 - B4 - D5 -',
    'D4 - F#4 - A4 - F#4 - D5 - A4 - F#4 - A4 -',
    'E4 - G4 - B4 - G4 - E5 - B4 - G4 - B4 -',
    'C4 - E4 - G4 - E4 - D4 - F#4 - A4 - F#4 -'
  ),
  drums: bars(
    'KH H H H SH H K H KH H H H SH H K OH',
    'KH H H H SH H KH H K H H H SH H K OH',
    'KH H KH H SH H K H KH H H H SH H K OH',
    'KH H H H SH H K OH KH H KS H SH H KS OH'
  )
});

const CHORUS = makeSection({
  name: 'chorus',
  leadVoice: 'flute',
  lead: bars(
    'G4 G4 B4 B4 D5 D5 B4 B4 G5 G5 D5 D5 B4 B4 D5 D5',
    'A4 A4 F#4 F#4 D5 D5 F#5 F#5 A5 A5 F#5 F#5 E5 E5 D5 D5',
    'E4 E4 G4 G4 B4 B4 E5 E5 G5 G5 E5 E5 D5 D5 B4 B4',
    'C5 C5 G4 G4 E4 E4 G4 G4 A4 A4 D5 D5 F#5 F#5 D5 D5'
  ),
  bass: bars(
    'G2 G2 G2 G2 D3 D3 D3 D3 G3 G3 G3 G3 D3 D3 D3 D3',
    'D2 D2 D2 D2 A2 A2 A2 A2 D3 D3 D3 D3 A2 A2 A2 A2',
    'E2 E2 E2 E2 B2 B2 B2 B2 E3 E3 E3 E3 B2 B2 B2 B2',
    'C2 C2 C2 C2 G2 G2 G2 G2 D2 D2 D2 D2 A2 A2 A2 A2'
  ),
  arp: bars(
    'G4 - D5 - B4 - D5 - G5 - D5 - B4 - D5 -',
    'D4 - A4 - F#4 - A4 - D5 - A4 - F#4 - A4 -',
    'E4 - B4 - G4 - B4 - E5 - B4 - G4 - B4 -',
    'C4 - G4 - E4 - G4 - D4 - A4 - F#4 - A4 -'
  ),
  drums: bars(
    'KH H H H SH H - H KH H H H SH H K OH',
    'KH H H H SH H K H KH H H OH SH H K OH',
    'KH H H H SH H - H KH H KH H SH H K OH',
    'KS H K H SH H K OH KH H KS H SH H KS OH'
  )
});

const BRIDGE = makeSection({
  name: 'bridge',
  lead: bars(
    'E5 - G5 A5 G5 - E5 - C6 - B5 - G5 - E5 -',
    'A5 - C6 - E6 - C6 - B5 - A5 - E5 - C6 -',
    'B5 - G5 - E5 G5 B5 - D6 - B5 - A5 - G5 -',
    'F#5 A5 D6 - C6 - A5 - F#5 - E5 F#5 A5 - D6 -'
  ),
  bass: bars(
    'C2 - - - G2 - - - C3 - - - G2 - - -',
    'A1 - - - E2 - - - A2 - - - E2 - - -',
    'E2 - - - B2 - - - E3 - - - B2 - - -',
    'D2 - - - A2 - - - D3 - - - A2 - - -'
  ),
  arp: bars(
    'C4 E4 G4 E4 C5 G4 E4 G4 C4 E4 G4 C5 G4 E4 C5 G4',
    'A3 E4 C4 E4 A4 E4 C4 E4 A3 C4 E4 A4 E4 C4 A4 E4',
    'E4 B4 G4 B4 E5 B4 G4 B4 E4 G4 B4 D5 E5 D5 B4 G4',
    'D4 A4 F#4 A4 D5 A4 F#4 A4 D4 F#4 A4 C5 D5 C5 A4 F#4'
  ),
  drums: bars(
    'K H H H S H K H KH H H H S H K OH',
    'K H KH H S H K OH K H KH H S H K OH',
    'KH H H H SH H KH H K H H H SH H K OH',
    'KH H KH H SH H K H KS H K OH SH H KS OH'
  )
});

export const COUNTRYSIDE_SONG = makeSong({
  id: 'countryside',
  name: 'Open Road',
  bpm: 116,
  sections: [TUNE, CHORUS, BRIDGE],
  arrangement: ['tune', 'chorus', 'tune', 'bridge', 'chorus', 'tune']
});
