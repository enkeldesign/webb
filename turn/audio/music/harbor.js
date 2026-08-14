import { bars, makeSection, makeSong } from './song-tools.js?revision=r186-note-ties';

const TUNE = makeSection({
  name: 'tune',
  leadVoice: 'brass', bassVoice: 'sub', arpVoice: 'metal', drumKit: 'industrial',
  lead: bars(
    'E5 - G5 B5 D6 - B5 G5 E5 - G5 A5 B5 D6 E6 -',
    'D6 - B5 A5 G5 - E5 G5 A5 B5 D6 B5 A5 G5 F#5 -',
    'E5 - B5 D6 E6 G6 F#6 E6 D6 - B5 G5 A5 B5 D6 -',
    'B5 D6 E6 G6 F#6 E6 D6 B5 A5 B5 G5 F#5 E5 B5 E6 -'
  ),
  bass: bars(
    'E2 - E2 E3 - B2 D3 - E2 - G2 B2 D3 B2 E3 -',
    'C2 - C3 G2 - C3 B2 - D2 - D3 A2 D3 F#3 A2 -',
    'E2 - E3 B2 D3 B2 G2 - E2 B2 E3 - D3 B2 G2 -',
    'C2 - G2 C3 B2 - D3 C3 D2 A2 D3 F#3 E2 B2 E3 -'
  ),
  arp: bars(
    'E4 B4 G4 B4 E5 B4 G4 B4 E4 B4 G4 B4 E5 B4 G4 D5',
    'C4 G4 E4 G4 C5 G4 E4 G4 D4 A4 F#4 A4 D5 A4 F#4 A4',
    'E4 B4 G4 B4 E5 B4 G4 B4 E4 G4 B4 D5 E5 D5 B4 G4',
    'C4 G4 E4 G4 C5 B4 G4 E4 D4 A4 F#4 A4 E4 B4 G4 E5'
  ),
  drums: bars(
    'KH H H H SH H KH H KH H H H SH H K OH',
    'KH H H H SH H K H KH H KH H SH H S OH',
    'KH H H H SH H KH H KH H H H SH H K OH',
    'KH H H H SH H KH H KH H SH H S S KS OH'
  )
});

const BRIDGE = makeSection({
  name: 'bridge',
  leadVoice: 'brass', bassVoice: 'sub', arpVoice: 'metal', drumKit: 'industrial',
  lead: bars(
    'G5 - B5 D6 G6 F#6 D6 B5 A5 B5 D6 E6 D6 B5 G5 -',
    'F#5 - A5 D6 F#6 E6 D6 A5 B5 D6 E6 F#6 E6 D6 A5 -',
    'E5 G5 C6 E6 G6 E6 D6 C6 G5 C6 D6 E6 G6 E6 C6 -',
    'F#5 A5 B5 D#6 F#6 D#6 B5 A5 F#5 A5 B5 D#6 F#6 D#6 B5 D#6'
  ),
  bass: bars(
    'G2 - G2 D3 - G3 F#3 D3 G2 B2 D3 - G3 D3 B2 -',
    'D2 - D3 A2 - D3 F#3 A2 D2 A2 D3 - F#3 D3 A2 -',
    'C2 - C3 G2 - C3 E3 G2 C2 G2 C3 - E3 C3 G2 -',
    'B1 - B2 F#2 A2 B2 D#3 F#3 B1 F#2 A2 B2 D#3 F#3 B2 D#3'
  ),
  arp: bars(
    'G4 D5 B4 D5 G5 D5 B4 D5 G4 B4 D5 G5 D5 B4 D5 G5',
    'D4 A4 F#4 A4 D5 A4 F#4 A4 D4 F#4 A4 D5 F#5 D5 A4 F#4',
    'C4 G4 E4 G4 C5 G4 E4 G4 C4 E4 G4 C5 E5 C5 G4 E4',
    'B3 F#4 A4 D#5 B4 F#4 A4 D#5 B3 A4 D#5 F#5 A5 F#5 D#5 B4'
  ),
  drums: bars(
    'KH H H H SH H KH H KH H KH H SH H K OH',
    'KH H KH H SH H K H KH H KH H SH H KS OH',
    'KH H H H SH H KH H KH H KH H SH H K OH',
    'KH H KH H SH H KH H KS H KS H S KS KS KSO'
  )
});

const CHORUS = makeSection({
  name: 'chorus',
  leadVoice: 'pulse', bassVoice: 'sub', arpVoice: 'metal', drumKit: 'industrial',
  lead: bars(
    'E6 E6 G6 G6 B6 B6 G6 G6 E7 E7 B6 B6 G6 G6 B6 B6',
    'G6 G6 E6 E6 C7 C7 E7 E7 G7 G7 E7 E7 D7 D7 C7 C7',
    'D7 D7 B6 B6 G6 G6 B6 B6 D7 D7 B6 B6 A6 A6 G6 G6',
    'F#6 F#6 A6 A6 B6 B6 D#7 D#7 B6 B6 A6 A6 F#6 F#6 D#6 D#6'
  ),
  bass: bars(
    'E3 E3 E3 E3 B3 B3 B3 B3 E4 E4 E4 E4 B3 B3 B3 B3',
    'C3 C3 C3 C3 G3 G3 G3 G3 C4 C4 C4 C4 G3 G3 G3 G3',
    'G3 G3 G3 G3 D4 D4 D4 D4 G4 G4 G4 G4 D4 D4 D4 D4',
    'B2 B2 B2 B2 F#3 F#3 F#3 F#3 A3 A3 A3 A3 D#4 D#4 F#4 F#4'
  ),
  arp: bars(
    'E4 - G4 - B4 - G4 - E5 - B4 - G4 - B4 -',
    'C4 - E4 - G4 - E4 - C5 - G4 - E4 - G4 -',
    'G4 - B4 - D5 - B4 - G5 - D5 - B4 - D5 -',
    'B3 - D#4 - F#4 - A4 - B4 - F#4 - D#4 - F#4 -'
  ),
  drums: bars(
    'KH H H H SH H - H KH H H H SH H K OH',
    'KH H H H SH H - H KH H H OH SH H K OH',
    'KH H H H SH H - H KH H H H SH H K OH',
    'KH H H H SH H KH H KS H K OH SH H KS OH'
  )
});

export const HARBOR_SONG = makeSong({
  id: 'harbor', name: 'TURN Theme', bpm: 132, key: 'E minor',
  style: 'warm arcade title anthem', swing: 0.05,
  sections: [TUNE, BRIDGE, CHORUS], arrangement: ['tune', 'tune', 'bridge', 'tune', 'chorus', 'chorus']
});
