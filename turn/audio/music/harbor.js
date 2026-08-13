import { bars, makeSection, makeSong } from './song-tools.js?revision=r184-score-v2';

const TUNE = makeSection({
  name: 'tune', harmony: ['Em7', 'Bm7', 'B7', 'Em7'],
  leadVoice: 'bell', bassVoice: 'drive', arpVoice: 'metal', drumKit: 'industrial',
  lead: bars(
    'E5 - G5 B5 - E6 - D6 B5 - G5 - E5 B5 - -',
    'B5 - D6 F#6 - B6 - F#6 D6 - B5 - A5 F#6 - -',
    'B5 - D#6 F#6 - A6 - F#6 D#6 - B5 - A5 F#6 - -',
    'E5 - G5 B5 - E6 - B5 G5 - F#5 E5 - B5 - E6'
  ),
  bass: bars(
    'E1 - E2 - B1 - E2 - D2 - E2 - B1 - D2 -',
    'B1 - B2 - F#2 - B2 - A2 - B2 - F#2 - A2 -',
    'B1 - B2 - F#2 - B2 - A2 - B2 - D#2 - F#2 -',
    'E1 - E2 - B1 - E2 - D2 - E2 - B1 - D2 -'
  ),
  arp: bars(
    'E4 G4 B4 D5 E5 D5 B4 G4 E4 G4 B4 D5 E5 D5 B4 G4',
    'B3 D4 F#4 A4 B4 A4 F#4 D4 B3 D4 F#4 A4 B4 A4 F#4 D4',
    'B3 D#4 F#4 A4 B4 A4 F#4 D#4 B3 D#4 F#4 A4 B4 A4 F#4 D#4',
    'E4 G4 B4 D5 E5 D5 B4 G4 E4 G4 B4 D5 E5 D5 B4 G4'
  ),
  drums: bars(
    'KM H M H S H M H K H M H S H KM OH',
    'K H M H S H K M K H M H S H M OH',
    'KM H M H S H M H K H KM H S H M OH',
    'K H KM H S H M OH KM H M H S H KM OH'
  )
});

const CHORUS = makeSection({
  name: 'chorus', harmony: ['Em7', 'Bm7', 'G', 'B7'],
  leadVoice: 'brass', bassVoice: 'drive', arpVoice: 'metal', drumKit: 'industrial',
  lead: bars(
    'G5 G5 B5 - E6 - G6 - B6 G6 - E6 - B5 - -',
    'F#5 F#5 B5 - D6 - F#6 - B6 F#6 - D6 - B5 - -',
    'G5 G5 B5 - D6 - G6 - B6 G6 - D6 - B5 - -',
    'A5 - B5 D#6 F#6 - A6 - F#6 D#6 - B5 - F#6 - -'
  ),
  bass: bars(
    'E1 E1 - B1 E2 E2 - D2 E1 E1 - G1 B1 E2 - D2',
    'B1 B1 - F#2 B2 B2 - A2 B1 B1 - D2 F#2 B2 - A2',
    'G1 G1 - D2 G2 G2 - B1 G1 G1 - D2 G2 G2 - B1',
    'B1 B1 - F#2 B2 B2 - A2 B1 B1 - D#2 F#2 A2 - F#2'
  ),
  arp: bars(
    'E4 G4 B4 D5 E5 D5 B4 G4 E4 G4 B4 D5 E5 D5 B4 G4',
    'B3 D4 F#4 A4 B4 A4 F#4 D4 B3 D4 F#4 A4 B4 A4 F#4 D4',
    'G3 B3 D4 B3 G4 D4 B3 D4 G3 B3 D4 G4 D4 B3 D4 B3',
    'B3 D#4 F#4 A4 B4 A4 F#4 D#4 B3 D#4 F#4 A4 B4 A4 F#4 D#4'
  ),
  drums: bars(
    'KM H M H S H KM H K H M H S H KM OH',
    'KM H KM H S H M OH K H M H S H KM OH',
    'K H M H S H KM H KM H M H S H M OH',
    'KM H KM H S H M OH KM H KM H S H KMOH OH'
  )
});

const BRIDGE = makeSection({
  name: 'bridge', harmony: ['Am7', 'Bm7', 'B7', 'Em7'],
  leadVoice: 'bell', bassVoice: 'drive', arpVoice: 'metal', drumKit: 'industrial',
  lead: bars(
    'A5 - C6 E6 - A6 - E6 C6 - B5 A5 - E6 - -',
    'B5 - D6 F#6 - B6 - F#6 D6 - C6 B5 - F#6 - -',
    'B5 - D#6 F#6 - A6 - F#6 D#6 - B5 - A5 F#6 - -',
    'E5 - G5 B5 - E6 - D6 B5 - G5 - G5 E5 - B5'
  ),
  bass: bars(
    'A1 - E2 - A2 - G2 - A1 - C2 - E2 - G2 -',
    'B1 - F#2 - B2 - A2 - B1 - D2 - F#2 - A2 -',
    'B1 - F#2 - B2 - A2 - B1 - D#2 - F#2 - A2 -',
    'E1 - B1 - E2 - D2 - E1 - G1 - B1 - D2 -'
  ),
  arp: bars(
    'A3 C4 E4 G4 A4 G4 E4 C4 A3 C4 E4 G4 A4 G4 E4 C4',
    'B3 D4 F#4 A4 B4 A4 F#4 D4 B3 D4 F#4 A4 B4 A4 F#4 D4',
    'B3 D#4 F#4 A4 B4 A4 F#4 D#4 B3 D#4 F#4 A4 B4 A4 F#4 D#4',
    'E4 G4 B4 D5 E5 D5 B4 G4 E4 G4 B4 D5 E5 D5 B4 G4'
  ),
  drums: bars(
    'K H M H S H M H K H M H S H KM OH',
    'KM H M H S H K M K H M H S H KM OH',
    'KM H KM H S H M OH KM H M H S H KM OH',
    'K H M H S H KM H KM H M H S H KMOH OH'
  )
});

export const HARBOR_SONG = makeSong({
  id: 'harbor', name: 'Harbor Run', bpm: 118, key: 'E minor',
  style: 'industrial dockside electro rock', swing: 0,
  sections: [TUNE, CHORUS, BRIDGE], arrangement: ['tune', 'chorus', 'bridge', 'tune', 'chorus', 'bridge']
});
