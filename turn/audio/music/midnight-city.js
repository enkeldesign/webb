import { bars, makeSection, makeSong } from './song-tools.js?revision=r184-score-v2';

const TUNE = makeSection({
  name: 'tune', harmony: ['Gm7', 'Dm7', 'Gm7', 'Dm7'],
  leadVoice: 'neon', bassVoice: 'synth', arpVoice: 'neon', drumKit: 'night',
  lead: bars(
    'G5 - D6 G6 - Bb6 - G6 - D6 Bb5 - G5 - D6 -',
    'F5 - A5 D6 - F6 - D6 - A5 F5 - D5 - A5 -',
    'G5 - Bb5 D6 - G6 - F6 D6 - Bb5 - G5 - D6 -',
    'A5 - C6 D6 - F6 - D6 - C6 A5 - F5 - D6 -'
  ),
  bass: bars(
    'G1 - G2 - D2 - G2 - F2 - G2 - D2 - F2 -',
    'D2 - D3 - A2 - D3 - C3 - D3 - A2 - C3 -',
    'G1 - G2 - D2 - G2 - F2 - G2 - D2 - F2 -',
    'D2 - D3 - A2 - D3 - C3 - D3 - A2 - C3 -'
  ),
  arp: bars(
    'G4 Bb4 D5 F5 G5 F5 D5 Bb4 G4 Bb4 D5 F5 G5 F5 D5 Bb4',
    'D4 F4 A4 C5 D5 C5 A4 F4 D4 F4 A4 C5 D5 C5 A4 F4',
    'G4 Bb4 D5 F5 G5 F5 D5 Bb4 G4 Bb4 D5 F5 G5 F5 D5 Bb4',
    'D4 F4 A4 C5 D5 C5 A4 F4 D4 F4 A4 C5 D5 C5 A4 F4'
  ),
  drums: bars(
    'K H H H SC H H H K H H H SC H K OH',
    'K H H H SC H K H K H H H SC H K OH',
    'KC H KH H SC H H H K H KH H SC H K OH',
    'K H K H SC H K OH KC H K H SC H KC OH'
  )
});

const CHORUS = makeSection({
  name: 'chorus', harmony: ['Gm7', 'Bb', 'Dm7', 'Gm7'],
  leadVoice: 'neon', bassVoice: 'synth', arpVoice: 'glass', drumKit: 'night',
  lead: bars(
    'G5 G5 Bb5 - D6 D6 G6 - Bb6 G6 - D6 - Bb5 - -',
    'Bb5 Bb5 D6 - F6 F6 Bb6 - D7 Bb6 - F6 - D6 - -',
    'A5 A5 C6 - F6 F6 A6 - C7 A6 - F6 - D6 - -',
    'G5 - Bb5 D6 G6 - Bb6 - G6 D6 - Bb5 - G5 - D6'
  ),
  bass: bars(
    'G1 G1 - D2 G2 G2 - F2 G1 G1 - Bb1 D2 G2 - F2',
    'Bb1 Bb1 - F2 Bb2 Bb2 - D2 Bb1 Bb1 - D2 F2 Bb2 - D2',
    'D2 D2 - A2 D3 D3 - C3 D2 D2 - F2 A2 C3 - A2',
    'G1 G1 - D2 G2 G2 - F2 G1 G1 - Bb1 D2 G2 - F2'
  ),
  arp: bars(
    'G5 - Bb5 D6 - Bb5 D6 F6 G5 - Bb5 D6 - Bb5 D6 -',
    'Bb4 - D5 F5 - D5 F5 Bb5 Bb4 - D5 F5 - D5 F5 -',
    'D5 - F5 A5 - F5 A5 C6 D5 - F5 A5 - F5 A5 -',
    'G5 Bb5 D6 F6 G6 F6 D6 Bb5 G5 Bb5 D6 F6 G6 F6 D6 Bb5'
  ),
  drums: bars(
    'KC H H H SC H K H KC H H H SC H K OH',
    'KC H KH H SC H K OH KC H H H SC H KC OH',
    'KC H H H SC H KH H K H KH H SC H K OH',
    'KC H KC H SC H K OH KC H KC H SC H KCO OH'
  )
});

const BRIDGE = makeSection({
  name: 'bridge', harmony: ['Eb', 'Dm7', 'D7', 'Gm7'],
  leadVoice: 'organ', bassVoice: 'synth', arpVoice: 'neon', drumKit: 'night',
  lead: bars(
    'G5 - Bb5 Eb6 - G6 - Eb6 Bb5 - G5 - Bb5 - Eb6 -',
    'A5 - C6 D6 - F6 - D6 C6 - A5 - F5 - D6 -',
    'F#5 - A5 D6 - F#6 - A6 F#6 - D6 - C6 - A5 -',
    'G5 - Bb5 D6 - G6 - F6 D6 - Bb5 - G5 - D6 -'
  ),
  bass: bars(
    'Eb2 - Eb3 - Bb2 - Eb3 - G2 - Eb3 - Bb2 - G2 -',
    'D2 - D3 - A2 - D3 - C3 - D3 - A2 - C3 -',
    'D2 - D3 - A2 - D3 - C3 - D3 - F#2 - A2 -',
    'G1 - G2 - D2 - G2 - F2 - G2 - D2 - F2 -'
  ),
  arp: bars(
    'Eb4 G4 Bb4 G4 Eb5 Bb4 G4 Bb4 Eb4 G4 Bb4 Eb5 Bb4 G4 Bb4 G4',
    'D4 F4 A4 C5 D5 C5 A4 F4 D4 F4 A4 C5 D5 C5 A4 F4',
    'D4 F#4 A4 C5 D5 C5 A4 F#4 D4 F#4 A4 C5 D5 C5 A4 F#4',
    'G4 Bb4 D5 F5 G5 F5 D5 Bb4 G4 Bb4 D5 F5 G5 F5 D5 Bb4'
  ),
  drums: bars(
    'K H - H SC H K H K H - H SC H K OH',
    'K H H H SC H K OH K H H H SC H K OH',
    'KC H KH H SC H K H KC H KH H SC H K OH',
    'KC H K H SC H K OH KC H K H SC H KCO OH'
  )
});

export const MIDNIGHT_CITY_SONG = makeSong({
  id: 'midnight-city', name: 'Neon Velocity', bpm: 118, key: 'G minor',
  style: 'dark G-minor neon synthwave with a D-minor pedal', swing: 0,
  sections: [TUNE, CHORUS, BRIDGE], arrangement: ['chorus', 'tune', 'bridge', 'chorus', 'tune', 'bridge']
});
