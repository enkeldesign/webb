import { bars, makeSection, makeSong } from './song-tools.js?revision=r184-score-v2';

const TUNE = makeSection({
  name: 'tune', harmony: ['Am7', 'G7', 'G7', 'C'],
  leadVoice: 'pulse', bassVoice: 'sub', arpVoice: 'glass', drumKit: 'electro',
  lead: bars(
    'A5 - C6 E6 A6 - E6 C6 - A5 C6 - E6 - A6 -',
    'G5 - B5 D6 F6 - D6 B5 - G5 B5 - D6 - G6 -',
    'B5 - D6 F6 G6 - F6 D6 - B5 D6 - F6 - G6 -',
    'C6 - E6 G6 C7 - G6 E6 - C6 E6 - G6 - C7 -'
  ),
  bass: bars(
    'A1 - A2 - E2 - A2 - G2 - A2 - E2 - G2 -',
    'G1 - G2 - D2 - G2 - F2 - G2 - D2 - F2 -',
    'G1 - G2 - D2 - G2 - F2 - G2 - D2 - F2 -',
    'C2 - C3 - G2 - C3 - E2 - C3 - G2 - E2 -'
  ),
  arp: bars(
    'A4 C5 E5 G5 A5 G5 E5 C5 A4 C5 E5 G5 A5 G5 E5 C5',
    'G4 B4 D5 F5 G5 F5 D5 B4 G4 B4 D5 F5 G5 F5 D5 B4',
    'G4 B4 D5 F5 G5 F5 D5 B4 G4 B4 D5 F5 G5 F5 D5 B4',
    'C5 E5 G5 E5 C6 G5 E5 G5 C5 E5 G5 C6 G5 E5 G5 E5'
  ),
  drums: bars(
    'KC H H H SC H H H K H H H SC H K OH',
    'K H H H SC H K H KC H H H SC H K OH',
    'KC H KH H SC H H H K H KH H SC H K OH',
    'KC H KC H SC H K OH KC H KC H SC H KCO OH'
  )
});

const CHORUS = makeSection({
  name: 'chorus', harmony: ['C', 'Am7', 'G7', 'C'],
  leadVoice: 'brass', bassVoice: 'sub', arpVoice: 'glass', drumKit: 'electro',
  lead: bars(
    'E6 E6 G6 - C7 C7 G6 - E6 G6 C7 - G6 - E6 -',
    'E6 E6 A6 - C7 C7 A6 - E6 A6 C7 - A6 - E6 -',
    'F6 F6 G6 - B6 B6 D7 - F7 D7 - B6 - G6 - D7',
    'E6 E6 G6 - C7 C7 E7 - G7 E7 - C7 - G6 - C7'
  ),
  bass: bars(
    'C2 C2 - G2 C3 C3 - E2 C2 C2 - G2 C3 C3 - E2',
    'A1 A1 - E2 A2 A2 - G2 A1 A1 - E2 A2 A2 - G2',
    'G1 G1 - D2 G2 G2 - F2 G1 G1 - D2 G2 G2 - F2',
    'C2 C2 - G2 C3 C3 - E2 C2 C2 - G2 C3 C3 - E2'
  ),
  arp: bars(
    'C5 - E5 G5 - E5 G5 C6 C5 - E5 G5 - E5 G5 -',
    'A4 - C5 E5 - C5 E5 G5 A4 - C5 E5 - C5 E5 -',
    'G4 - B4 D5 - F5 D5 B4 G4 - B4 D5 - F5 D5 -',
    'C5 E5 G5 C6 G5 E5 G5 E5 C5 E5 G5 C6 G5 E5 G5 E5'
  ),
  drums: bars(
    'KC H H H SC H K H KC H H H SC H K OH',
    'KC H KH H SC H K OH KC H H H SC H KC OH',
    'KC H H H SC H KH H K H KH H SC H K OH',
    'KC H KC H SC H K OH KC H KC H SC H KCO OH'
  )
});

const BRIDGE = makeSection({
  name: 'bridge', harmony: ['C', 'Cm', 'G7', 'C'],
  leadVoice: 'pulse', bassVoice: 'sub', arpVoice: 'glass', drumKit: 'electro',
  lead: bars(
    'C6 - E6 G6 - C7 - G6 E6 - D6 C6 - G6 - -',
    'C6 - Eb6 G6 - C7 - G6 Eb6 - D6 C6 - G6 - -',
    'B5 - D6 F6 G6 - F6 D6 - B5 - A5 G5 - D6 -',
    'C6 E6 G6 - C7 - G6 E6 - D6 - C6 - G6 - C7'
  ),
  bass: bars(
    'C2 - C3 - G2 - C3 - E2 - C3 - G2 - E2 -',
    'C2 - C3 - G2 - C3 - Eb2 - C3 - G2 - Eb2 -',
    'G1 - G2 - D2 - G2 - F2 - G2 - D2 - F2 -',
    'C2 - C3 - G2 - C3 - E2 - C3 - G2 - E2 -'
  ),
  arp: bars(
    'C5 E5 G5 E5 C6 G5 E5 G5 C5 E5 G5 C6 G5 E5 G5 E5',
    'C5 Eb5 G5 Eb5 C6 G5 Eb5 G5 C5 Eb5 G5 C6 G5 Eb5 G5 Eb5',
    'G4 B4 D5 F5 G5 F5 D5 B4 G4 B4 D5 F5 G5 F5 D5 B4',
    'C5 E5 G5 E5 C6 G5 E5 G5 C5 E5 G5 C6 G5 E5 G5 E5'
  ),
  drums: bars(
    'K H H H SC H K H K H H H SC H K OH',
    'K H H H SC H K OH K H H H SC H KC OH',
    'KC H KH H SC H K H KC H KH H SC H K OH',
    'KC H KC H SC H K OH KC H KC H SC H KCO OH'
  )
});

export const AIRPORT_SONG = makeSong({
  id: 'airport', name: 'Airport Runway', bpm: 144, key: 'C major / A minor',
  style: 'high-energy runway electro pop', swing: 0,
  sections: [TUNE, CHORUS, BRIDGE], arrangement: ['tune', 'chorus', 'tune', 'bridge', 'chorus', 'bridge']
});
