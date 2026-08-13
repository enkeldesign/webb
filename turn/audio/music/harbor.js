import { bars, makeSection, makeSong } from './song-tools.js?revision=r165-track-songbook-v1';

const TUNE = makeSection({
  name: 'tune',
  lead: bars(
    'A5 - C6 - E6 C6 A5 - G5 - E5 - A5 C6 - E6',
    'C6 - E6 - G6 E6 C6 - Bb5 - G5 - E5 G5 - C6',
    'D6 - F6 - A6 F6 D6 - C6 - A5 - F5 A5 - D6',
    'E6 - B5 - G#5 B5 - D6 - B5 - G#5 A5 - E6 -'
  ),
  bass: bars(
    'A1 - - - E2 - - - A2 - - - E2 - - -',
    'C2 - - - G2 - - - C3 - - - G2 - - -',
    'D2 - - - A2 - - - D3 - - - A2 - - -',
    'E2 - - - B2 - - - E3 - - - B2 - - -'
  ),
  arp: bars(
    'A3 E4 C4 E4 A4 E4 C4 E4 A3 C4 E4 G4 A4 G4 E4 C4',
    'C4 G4 E4 G4 C5 G4 E4 G4 C4 E4 G4 Bb4 C5 Bb4 G4 E4',
    'D4 A4 F4 A4 D5 A4 F4 A4 D4 F4 A4 C5 D5 C5 A4 F4',
    'E4 B4 G#4 B4 E5 B4 G#4 B4 E4 G#4 B4 D5 E5 D5 B4 G#4'
  ),
  drums: bars(
    'KH H H H SH H K H KH H KH H SH H K OH',
    'KH H K H SH H KH H K H H H SH H K OH',
    'KH H KH H SH H K H KH H K H SH H K OH',
    'KS H K H SH H KH OH KS H K H S H KSO OH'
  )
});

const CHORUS = makeSection({
  name: 'chorus',
  leadVoice: 'flute',
  lead: bars(
    'A4 A4 E5 E5 C5 C5 E5 E5 A5 A5 G5 G5 E5 E5 C5 C5',
    'C5 C5 G5 G5 E5 E5 G5 G5 C6 C6 Bb5 Bb5 G5 G5 E5 E5',
    'D5 D5 A5 A5 F5 F5 A5 A5 D6 D6 C6 C6 A5 A5 F5 F5',
    'E5 E5 B4 B4 G#4 G#4 B4 B4 D5 D5 E5 E5 G#5 G#5 B5 B5'
  ),
  bass: bars(
    'A1 A1 A1 A1 E2 E2 E2 E2 A2 A2 A2 A2 E2 E2 E2 E2',
    'C2 C2 C2 C2 G2 G2 G2 G2 C3 C3 C3 C3 G2 G2 G2 G2',
    'D2 D2 D2 D2 A2 A2 A2 A2 D3 D3 D3 D3 A2 A2 A2 A2',
    'E2 E2 E2 E2 B2 B2 B2 B2 E3 E3 E3 E3 B2 B2 B2 B2'
  ),
  arp: bars(
    'A3 - C4 - E4 - C4 - A4 - E4 - C4 - E4 -',
    'C4 - E4 - G4 - E4 - C5 - G4 - E4 - G4 -',
    'D4 - F4 - A4 - F4 - D5 - A4 - F4 - A4 -',
    'E4 - G#4 - B4 - G#4 - D5 - B4 - G#4 - B4 -'
  ),
  drums: bars(
    'KH H H H SH H K H KH H H H SH H K OH',
    'KH H K H SH H KH OH K H K H SH H K OH',
    'KH H KH H SH H K H KH H H H SH H K OH',
    'KS H K H SH H KS OH K H KS H S H KSO OH'
  )
});

const BRIDGE = makeSection({
  name: 'bridge',
  lead: bars(
    'F5 - A5 C6 - F6 - E6 - C6 - A5 F5 - C6 -',
    'G5 - C6 E6 - G6 - E6 - D6 C6 - G5 - E6 -',
    'B5 - D6 F6 - B6 - F6 - D6 B5 - A5 - F6 -',
    'E6 D6 B5 - G#5 - E5 G#5 B5 - D6 - E6 - B5 -'
  ),
  bass: bars(
    'F1 - - - C2 - - - F2 - - - C2 - - -',
    'C2 - - - G2 - - - C3 - - - G2 - - -',
    'B1 - - - F2 - - - B2 - - - F2 - - -',
    'E2 - B2 - D3 - G#2 - E3 - B2 - D3 - B2 -'
  ),
  arp: bars(
    'F4 A4 C5 A4 F5 C5 A4 C5 F4 A4 C5 E5 F5 E5 C5 A4',
    'C4 E4 G4 E4 C5 G4 E4 G4 C4 G4 C5 E5 G5 E5 C5 G4',
    'B3 D4 F4 D4 B4 F4 D4 F4 B3 D4 F4 A4 B4 A4 F4 D4',
    'E4 G#4 B4 D5 E5 D5 B4 G#4 E4 B4 D5 E5 G#5 E5 D5 B4'
  ),
  drums: bars(
    'K H - H S H K H KH H - H S H K OH',
    'K H KH H S H K OH K H KH H S H K OH',
    'KH H K H SH H KH H K H KH H SH H K OH',
    'KS H KS H SH H K OH KS H K H S KS KSO OH'
  )
});

export const HARBOR_SONG = makeSong({
  id: 'harbor',
  name: 'Dockside Rush',
  bpm: 120,
  sections: [TUNE, CHORUS, BRIDGE],
  arrangement: ['bridge', 'tune', 'chorus', 'tune', 'chorus', 'bridge']
});
