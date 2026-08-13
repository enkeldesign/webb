import { bars, makeSection, makeSong } from './song-tools.js?revision=r184-score-v2';

const TUNE = makeSection({
  name: 'tune', harmony: ['Am7', 'Dm7', 'G7', 'C'],
  leadVoice: 'pluck', bassVoice: 'upright', arpVoice: 'mandolin', drumKit: 'brush',
  lead: bars(
    'A5 - C6 E6 - C6 A5 - E5 - G5 A5 - C6 - -',
    'D6 - F6 A6 - F6 D6 - A5 - C6 D6 - F6 - -',
    'G5 - B5 D6 - F6 D6 - B5 - A5 G5 - D6 - -',
    'E6 - G6 C7 - G6 E6 - C6 - E6 G6 - C7 - -'
  ),
  bass: bars(
    'A1 - - E2 - - G2 - A2 - - E2 - G2 - -',
    'D2 - - A2 - - C3 - D3 - - A2 - C3 - -',
    'G1 - - D2 - - F2 - G2 - - D2 - F2 - -',
    'C2 - - G2 - - E2 - C3 - - G2 - E2 - -'
  ),
  arp: bars(
    'A3 C4 E4 G4 A4 G4 E4 C4 A3 C4 E4 G4 A4 G4 E4 C4',
    'D4 F4 A4 C5 D5 C5 A4 F4 D4 F4 A4 C5 D5 C5 A4 F4',
    'G3 B3 D4 F4 G4 F4 D4 B3 G3 B3 D4 F4 G4 F4 D4 B3',
    'C4 E4 G4 E4 C5 G4 E4 G4 C4 E4 G4 C5 G4 E4 G4 E4'
  ),
  drums: bars(
    'K R - R S R - R K R - R S R - R',
    'K R - R S R R R K R - R S R - R',
    'K R R R S R - R K R R R S R - R',
    'K R - R S R R R K R R R S R K R'
  )
});

const CHORUS = makeSection({
  name: 'chorus', harmony: ['C', 'Am7', 'Dm7', 'G7'],
  leadVoice: 'whistle', bassVoice: 'upright', arpVoice: 'mandolin', drumKit: 'brush',
  lead: bars(
    'G5 - C6 E6 - G6 - E6 C6 - G5 - E6 - C6 -',
    'A5 - C6 E6 - A6 - E6 C6 - A5 - E6 - C6 -',
    'A5 - D6 F6 - A6 - F6 D6 - A5 - F6 - D6 -',
    'B5 - D6 F6 - G6 - F6 D6 - B5 - D6 - G6 -'
  ),
  bass: bars(
    'C2 - - G2 - - E2 - C3 - - G2 - E2 - -',
    'A1 - - E2 - - G2 - A2 - - E2 - G2 - -',
    'D2 - - A2 - - C3 - D3 - - A2 - C3 - -',
    'G1 - - D2 - - F2 - G2 - - D2 - F2 - -'
  ),
  arp: bars(
    'C4 E4 G4 E4 C5 G4 E4 G4 C4 E4 G4 C5 G4 E4 G4 E4',
    'A3 C4 E4 G4 A4 G4 E4 C4 A3 C4 E4 G4 A4 G4 E4 C4',
    'D4 F4 A4 C5 D5 C5 A4 F4 D4 F4 A4 C5 D5 C5 A4 F4',
    'G3 B3 D4 F4 G4 F4 D4 B3 G3 B3 D4 F4 G4 F4 D4 B3'
  ),
  drums: bars(
    'K R R R S R - R K R R R S R - R',
    'K R - R S R R R K R - R S R - R',
    'K R R R S R - R K R R R S R R R',
    'K R R R S R K R K R R R S R K R'
  )
});

const BRIDGE = makeSection({
  name: 'bridge', harmony: ['Fm7', 'Eb', 'Fm7', 'G7'],
  leadVoice: 'pluck', bassVoice: 'upright', arpVoice: 'soft', drumKit: 'brush',
  lead: bars(
    'Ab5 - C6 Eb6 - C6 Ab5 - F5 - Ab5 C6 - Eb6 - -',
    'G5 - Bb5 Eb6 - Bb5 G5 - Eb5 - G5 Bb5 - Eb6 - -',
    'Ab5 - C6 F6 - Eb6 C6 - Ab5 - G5 F5 - C6 - -',
    'B5 - D6 F6 - G6 - F6 D6 - B5 - G5 G5 - D6'
  ),
  bass: bars(
    'F1 - - C2 - - Eb2 - F2 - - C2 - Eb2 - -',
    'Eb2 - - Bb2 - - G2 - Eb3 - - Bb2 - G2 - -',
    'F1 - - C2 - - Eb2 - F2 - - C2 - Eb2 - -',
    'G1 - - D2 - - F2 - G2 - - D2 - F2 - -'
  ),
  arp: bars(
    'F3 Ab3 C4 Eb4 F4 Eb4 C4 Ab3 F3 Ab3 C4 Eb4 F4 Eb4 C4 Ab3',
    'Eb4 G4 Bb4 G4 Eb5 Bb4 G4 Bb4 Eb4 G4 Bb4 Eb5 Bb4 G4 Bb4 G4',
    'F3 Ab3 C4 Eb4 F4 Eb4 C4 Ab3 F3 Ab3 C4 Eb4 F4 Eb4 C4 Ab3',
    'G3 B3 D4 F4 G4 F4 D4 B3 G3 B3 D4 F4 G4 F4 D4 B3'
  ),
  drums: bars(
    'K R - R S R - R K R - R S R - R',
    'K R - R S R R R K R - R S R - R',
    'K R R R S R - R K R - R S R R R',
    'K R R R S R K R K R R R S R K R'
  )
});

export const COUNTRYSIDE_SONG = makeSong({
  id: 'countryside', name: 'Countryside Lap', bpm: 100, key: 'C major / A minor',
  style: 'sunny swinging road-trip folk pop', swing: 0.10,
  sections: [TUNE, CHORUS, BRIDGE], arrangement: ['tune', 'chorus', 'tune', 'bridge', 'tune', 'chorus']
});
