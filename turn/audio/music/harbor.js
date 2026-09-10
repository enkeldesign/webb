import { bars, makeSection, makeSong } from './song-tools.js?revision=r186-note-ties';

const TUNE = makeSection({
  name: 'tune', harmony: ['Em7', 'G', 'Am7', 'B7'],
  leadVoice: 'brass', bassVoice: 'drone', arpVoice: 'organ', drumKit: 'industrial',
  lead: bars(
    'E5 G5 A5 - - E5 G5 A5 - - B4 D5 E5 - - -',
    'G5 A5 B5 - - G5 A5 B5 - - D5 E5 G5 - - -',
    'A5 C6 D6 - - A5 C6 D6 - - E5 G5 A5 - - -',
    'B5 D#6 E6 - - B5 D#6 E6 - - A5 F#5 D#5 - B4 -'
  ),
  bass: bars(
    'E2 - B2 - E3 - D3 - B2 - G2 - B2 - D3 -',
    'G2 - D3 - G3 - B2 - D3 - B2 - D3 - G2 -',
    'A2 - E3 - A3 - G3 - E3 - C3 - E3 - G3 -',
    'B2 - F#3 - B3 - A3 - F#3 - D#3 - F#3 - A3 -'
  ),
  arp: bars(
    '- - - E4 - - - G4 - - - B4 - - D4 -',
    '- - - G4 - - - B4 - - - D5 - - B4 -',
    '- - - A4 - - - C5 - - - E5 - - G4 -',
    '- - - B4 - - - D#5 - - - F#5 - - A4 -'
  ),
  drums: bars(
    'KH - H - S - H - KH - H - S - H -',
    'KH - H - S - H - KH - H - S - H -',
    'KH - H - S - H - KH - H - S - H -',
    'KH - H - S - H - KH - H - S H T T'
  )
});

const BRIDGE = makeSection({
  name: 'bridge', harmony: ['C', 'Am7', 'Em7', 'B7'],
  leadVoice: 'brass', bassVoice: 'drone', arpVoice: 'organ', drumKit: 'industrial',
  lead: bars(
    'E6 E6 G6 A6 - G6 E6 - G6 A6 C7 A6 - G6 E6 -',
    'E6 E6 G6 A6 - G6 E6 - C6 E6 G6 E6 - D6 C6 -',
    'E6 E6 G6 A6 - G6 E6 - A6 Bb6 B6 D7 - B6 A6 -',
    'B6 B6 A6 F#6 - D#6 B5 - D#6 F#6 A6 F#6 - D#6 B5 -'
  ),
  bass: bars(
    'C3 - G3 - C4 - E3 - G3 - E3 - G3 - E3 -',
    'A2 - E3 - A3 - G3 - E3 - C3 - E3 - C3 -',
    'E2 - B2 - E3 - D3 - G2 - B2 - D3 - B2 -',
    'B2 - F#3 - B3 - A3 - F#3 - D#3 - F#3 - A3 -'
  ),
  arp: bars(
    'G4 - C5 - E5 - C5 - G4 - E4 - C4 - E4 -',
    'A4 - C5 - E5 - C5 - A4 - G4 - E4 - C4 -',
    'E4 - G4 - B4 - D5 - B4 - G4 - E4 - D4 -',
    'F#4 - A4 - B4 - D#5 - B4 - A4 - F#4 - D#4 -'
  ),
  drums: bars(
    'KH - H - S - H - KH - H - S - H -',
    'KH - H - S - H - KH - H - S - H -',
    'KH - H - S - H - KH - H - S - H -',
    'KH - H - S - H - KH - H - S H T T'
  )
});

const CHORUS = makeSection({
  name: 'chorus', harmony: ['Em', 'D', 'C', 'B7'],
  leadVoice: 'whistle', bassVoice: 'drone', arpVoice: 'organ', drumKit: 'industrial',
  lead: bars(
    'E5 E5 G5 A5 B5 - B5 A5 G5 - E5 G5 A5 - B5 -',
    'D6 - B5 A5 G5 - F#5 E5 D5 - F#5 A5 B5 - A5 -',
    'C6 - C6 B5 G5 - E5 G5 A5 - G5 E5 D5 - C5 -',
    'B5 B5 A5 F#5 D#5 - F#5 A5 B5 - A5 F#5 D#5 - B4 -'
  ),
  bass: bars(
    'E2 - B2 - E3 - G3 - B2 - G3 - E3 - B2 -',
    'D2 - A2 - D3 - F#3 - A3 - F#3 - D3 - A2 -',
    'C2 - G2 - C3 - E3 - G3 - E3 - C3 - G2 -',
    'B1 - F#2 - B2 - D#3 - F#3 - D#3 - B2 - A2 -'
  ),
  arp: bars(
    'E4 G4 B4 - G4 B4 E5 - B4 E5 G5 - E5 B4 G4 -',
    'D4 F#4 A4 - F#4 A4 D5 - A4 D5 F#5 - D5 A4 F#4 -',
    'C4 E4 G4 - E4 G4 C5 - G4 C5 E5 - C5 G4 E4 -',
    'B3 D#4 F#4 - D#4 F#4 B4 - F#4 B4 D#5 - B4 F#4 D#4 -'
  ),
  drums: bars(
    'KH - H - S - H - KH - H - S - H -',
    'KH - H - S - H - KH - H - S - H -',
    'KH - H - S - H - KH - H - S - H -',
    'KH - H - S - H - KH - H - S H T T'
  )
});

export const HARBOR_SONG = makeSong({
  id: 'harbor',
  name: 'Breakwater',
  bpm: 128,
  key: 'E minor',
  style: 'hard straight-ahead rock and roll with bluesy riffs, driving organ and a heavy descending chorus',
  swing: 0,
  sections: [TUNE, BRIDGE, CHORUS],
  arrangement: ['tune', 'tune', 'bridge', 'tune', 'chorus', 'chorus']
});
