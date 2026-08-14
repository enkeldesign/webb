import { bars, makeSection, makeSong } from './song-tools.js?revision=r186-note-ties';

const TUNE = makeSection({
  name: 'tune',
  leadVoice: 'brass', bassVoice: 'drone', arpVoice: 'metal', drumKit: 'industrial',
  lead: bars(
    'E5 - G5 B5 D6 - B5 G5 E5 - G5 A5 B5 D6 E6 -',
    'D6 - B5 A5 G5 - E5 G5 A5 B5 D6 B5 A5 G5 F#5 -',
    'E5 - B5 D6 E6 G6 F#6 E6 D6 - B5 G5 A5 B5 D6 -',
    'B5 D6 E6 G6 F#6 E6 D6 B5 A5 B5 G5 F#5 E5 B5 E6 -'
  ),
  bass: bars(
    'E2 = = = - - D2 = E2 = = = - - D2 =',
    'C2 = = = - - D2 = C2 = = = - - F2 =',
    'E2 = = = - - G2 = E2 = = = - - G2 =',
    'C2 = = = - - E2 = D2 = = = - - E2 ='
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
  leadVoice: 'bell', bassVoice: 'drone', arpVoice: 'metal', drumKit: 'industrial',
  lead: bars(
    'G5 - B5 D6 G6 F#6 D6 B5 A5 B5 D6 E6 D6 B5 G5 -',
    'F#5 - A5 D6 F#6 E6 D6 A5 B5 D6 E6 F#6 E6 D6 A5 -',
    'E5 G5 C6 E6 G6 E6 D6 C6 G5 C6 D6 E6 G6 E6 C6 -',
    'F#5 A5 B5 D#6 F#6 D#6 B5 A5 F#5 A5 B5 D#6 F#6 D#6 B5 D#6'
  ),
  bass: bars(
    'G2 = = = = = G2 = G2 = G2 = = G2 G2 =',
    'D2 = = = = = D2 = D2 = D2 = = D2 D2 =',
    'C2 = = = = = C2 = C2 = C2 = = C2 C2 =',
    'B1 = = = = = B1 = B1 = B1 = B1 B1 B1 B1'
  ),
  arp: bars(
    'G5 D6 B5 D6 G6 D6 B5 D6 G5 B5 D6 G6 D6 B5 D6 G6',
    'D5 A5 F#5 A5 D6 A5 F#5 A5 D5 F#5 A5 D6 F#6 D6 A5 F#5',
    'C5 G5 E5 G5 C6 G5 E5 G5 C5 E5 G5 C6 E6 C6 G5 E5',
    'B4 F#5 A5 D#6 B5 F#5 A5 D#6 B4 A5 D#6 F#6 A6 F#6 D#6 B5'
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
  leadVoice: 'brass', bassVoice: 'drone', arpVoice: 'metal', drumKit: 'industrial',
  lead: bars(
    'E5 E5 G5 G5 B5 B5 G5 G5 E6 E6 B5 B5 G5 G5 B5 B5',
    'G5 G5 E5 E5 C6 C6 E6 E6 G6 G6 E6 E6 D6 D6 C6 C6',
    'D6 D6 B5 B5 G5 G5 B5 B5 D6 D6 B5 B5 A5 A5 G5 G5',
    'F#5 F#5 A5 A5 B5 B5 D#6 D#6 B5 B5 A5 A5 F#5 F#5 D#5 D#5'
  ),
  bass: bars(
    'E2 = = = - - B2 - E2 = = = - - B2 -',
    'C2 = = = - - G2 - C2 = = = - - G2 -',
    'G2 = = = - - D3 - G2 = = = - - D3 -',
    'B1 = = = F#2 = = = B1 = = = - - F#3 -'
  ),
  arp: bars(
    'E5 - G5 - B5 - G5 - E6 - B5 - G5 - B5 -',
    'C5 - E5 - G5 - E5 - C6 - G5 - E5 - G5 -',
    'G5 - B5 - D6 - B5 - G6 - D6 - B5 - D6 -',
    'B4 - D#5 - F#5 - A5 - B5 - F#5 - D#5 - F#5 -'
  ),
  drums: bars(
    'KH H H H SH H - H KH H H H SH H K OH',
    'KH H H H SH H - H KH H H OH SH H K OH',
    'KH H H H SH H - H KH H H H SH H K OH',
    'KH H H H SH H KH H KS H K OH SH H KS OH'
  )
});

export const HARBOR_SONG = makeSong({
  id: 'harbor', name: 'TURN Theme', bpm: 136, key: 'E minor',
  style: 'warm arcade title anthem', swing: 0,
  sections: [TUNE, BRIDGE, CHORUS], arrangement: ['tune', 'tune', 'bridge', 'tune', 'chorus', 'chorus']
});
