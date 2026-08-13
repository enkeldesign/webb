import { bars, makeSection, makeSong } from './song-tools.js?revision=r184-score-v2';

const TUNE = makeSection({
  name: 'tune', harmony: ['C', 'G', 'Em7', 'Am7'],
  leadVoice: 'organ', bassVoice: 'drone', arpVoice: 'organ', drumKit: 'cinematic',
  lead: bars(
    'G5 - - - E6 - - - C6 - - - G5 - - -',
    'G5 - - - B5 - - - D6 - - - B5 - - -',
    'G5 - - - B5 - - - E6 - - - D6 - - -',
    'A5 - - - C6 - - - E6 - - - C6 - - -'
  ),
  bass: bars(
    'C2 - - - - - - - C2 - - - G1 - - -',
    'G1 - - - - - - - G1 - - - D2 - - -',
    'E1 - - - - - - - E1 - - - B1 - - -',
    'A1 - - - - - - - A1 - - - E2 - - -'
  ),
  arp: bars(
    'C4 - - - E4 - - - G4 - - - E4 - - -',
    'G3 - - - B3 - - - D4 - - - B3 - - -',
    'E3 - - - G3 - - - B3 - - - D4 - - -',
    'A3 - - - C4 - - - E4 - - - G4 - - -'
  ),
  drums: bars(
    'K - - - T - - - S - - - T - - -',
    'K - - - - - T - S - - - T - - -',
    'K - - - T - - - S - - - - - T -',
    'K - - - T - - - S - - - T - K -'
  )
});

const CHORUS = makeSection({
  name: 'chorus', harmony: ['Cm7', 'Gm7', 'Eb', 'Bb'],
  leadVoice: 'reed', bassVoice: 'drone', arpVoice: 'organ', drumKit: 'cinematic',
  lead: bars(
    'G5 - C6 - Eb6 - - - C6 - G5 - Eb6 - - -',
    'G5 - Bb5 - D6 - - - Bb5 - G5 - D6 - - -',
    'G5 - Bb5 - Eb6 - - - Bb5 - G5 - Eb6 - - -',
    'F5 - Bb5 - D6 - - - Bb5 - F5 - D6 - - -'
  ),
  bass: bars(
    'C2 - - - - - - - C3 - - - G2 - - -',
    'G1 - - - - - - - G2 - - - D2 - - -',
    'Eb2 - - - - - - - Eb3 - - - Bb2 - - -',
    'Bb1 - - - - - - - Bb2 - - - F2 - - -'
  ),
  arp: bars(
    'C4 - Eb4 - G4 - Bb4 - C5 - Bb4 - G4 - - -',
    'G3 - Bb3 - D4 - F4 - G4 - F4 - D4 - - -',
    'Eb4 - G4 - Bb4 - G4 - Eb5 - Bb4 - G4 - - -',
    'Bb3 - D4 - F4 - D4 - Bb4 - F4 - D4 - - -'
  ),
  drums: bars(
    'K - - - T - - - S - - - T - - -',
    'K - - - T - - - S - - - - - T -',
    'K - - - T - K - S - - - T - - -',
    'K - T - T - - - S - T - T - K -'
  )
});

const BRIDGE = makeSection({
  name: 'bridge', harmony: ['Ab', 'Eb', 'G7', 'Cm7'],
  leadVoice: 'organ', bassVoice: 'drone', arpVoice: 'organ', drumKit: 'cinematic',
  lead: bars(
    'Eb6 - - C6 - - Ab5 - - C6 - - Eb6 - - -',
    'G5 - - Bb5 - - Eb6 - - Bb5 - - G5 - - -',
    'F6 - D6 - B5 - G5 - B5 - D6 - F6 - - -',
    'G5 - - Eb6 - - C6 - G5 - Eb5 - G5 - C6 -'
  ),
  bass: bars(
    'Ab1 - - - Eb2 - - - Ab2 - - - Eb2 - - -',
    'Eb2 - - - Bb2 - - - Eb3 - - - Bb2 - - -',
    'G1 - - - D2 - - - F2 - - - B1 - - -',
    'C2 - - - G2 - - - Bb2 - - - C3 - - -'
  ),
  arp: bars(
    'Ab3 - C4 - Eb4 - C4 - Ab4 - Eb4 - C4 - - -',
    'Eb4 - G4 - Bb4 - G4 - Eb5 - Bb4 - G4 - - -',
    'G3 B3 D4 F4 G4 F4 D4 B3 G3 B3 D4 F4 G4 F4 D4 B3',
    'C4 - Eb4 - G4 - Bb4 - C5 - Bb4 - G4 - - -'
  ),
  drums: bars(
    'K - - - T - - - S - - - T - - -',
    'K - - - T - K - S - - - T - - -',
    'K - T - T - - - S - T - T - K -',
    'K - - - T - - - S - - - T - - -'
  )
});

export const CLIFFSIDE_SONG = makeSong({
  id: 'cliffside', name: 'Cliffside Run', bpm: 90, key: 'C major → C minor',
  style: 'slow cinematic mountain drive with parallel-minor turn', swing: 0,
  sections: [TUNE, CHORUS, BRIDGE], arrangement: ['tune', 'bridge', 'chorus', 'tune', 'bridge', 'chorus']
});
