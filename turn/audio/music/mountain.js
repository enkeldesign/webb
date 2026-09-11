import { bars, makeSection, makeSong } from './song-tools.js?revision=r186-note-ties';

const TUNE = makeSection({
  name: 'tune', harmony: ['Dm', 'C', 'Bb', 'F/A'],
  leadVoice: 'picked', bassVoice: 'drone', arpVoice: 'neon', drumKit: 'cinematic',
  lead: bars(
    'F5 = = A5 = F5 E5 D5 = = C5 D5 F5 = E5 -',
    'E5 = = G5 = E5 D5 C5 = = A4 C5 E5 = D5 -',
    'D5 = F5 = D5 C5 Bb4 = = D5 F5 A5 = G5 F5 -',
    'F5 = = A5 = C6 A5 F5 = E5 D5 C5 A4 = = -'
  ),
  bass: bars(
    'D1 = = = A1 = = = D2 = F2 = A1 = C2 -',
    'C1 = = = G1 = = = C2 = E2 = G1 = D2 -',
    'Bb0 = = = F1 = = = Bb1 = D2 = F1 = A1 -',
    'A0 = = = E1 = = = A1 = C2 = F2 = E2 -'
  ),
  arp: bars(
    'D3 = A3 - D4 - F4 = A4 - F4 D4 A3 = F3 -',
    'C3 = G3 - C4 - E4 = G4 - E4 C4 G3 = E3 -',
    'Bb2 = F3 - Bb3 - D4 = F4 - D4 Bb3 F3 = D3 -',
    'A2 = E3 - A3 - C4 = F4 - A4 F4 C4 = E4 -'
  ),
  drums: bars(
    'K - - - KS - - - K - - - KS - - -',
    'K - - - KS - - - K - - - KS - - -',
    'K - - - KS - - - K - - - KS - - -',
    'K - - - KS - - - K - - K KS T T T'
  )
});

const BRIDGE = makeSection({
  name: 'bridge', harmony: ['Bb', 'C', 'Dm', 'A7'],
  leadVoice: 'picked', bassVoice: 'drone', arpVoice: 'neon', drumKit: 'cinematic',
  lead: bars(
    'F5 = D5 = Bb4 = D5 F5 = = G5 F5 D5 = C5 -',
    'G5 = E5 = C5 = E5 G5 = = A5 G5 E5 = D5 -',
    'A5 = F5 = D5 = F5 A5 = = C6 A5 F5 = E5 -',
    'E5 = C#5 = A4 = C#5 E5 = G5 F5 E5 C#5 A4 = -'
  ),
  bass: bars(
    'Bb0 = = = F1 = = = Bb1 = D2 = F1 = D2 -',
    'C1 = = = G1 = = = C2 = E2 = G1 = E2 -',
    'D1 = = = A1 = = = D2 = F2 = A1 = F2 -',
    'A0 = = = E1 = = = G1 = E1 = C#2 = A1 -'
  ),
  arp: bars(
    'Bb2 F3 Bb3 D4 F4 = D4 Bb3 F3 = Bb3 D4 F4 A4 F4 D4',
    'C3 G3 C4 E4 G4 = E4 C4 G3 = C4 E4 G4 C5 G4 E4',
    'D3 A3 D4 F4 A4 = F4 D4 A3 = D4 F4 A4 D5 A4 F4',
    'A2 E3 A3 C#4 E4 = G4 A4 C#5 = A4 G4 E4 C#4 A3 E3'
  ),
  drums: bars(
    'K - H - KS - - - K - H - KS - - KO',
    'K - H - KS - - - K - H K KS - T KOT',
    'K - H - KS - - - K - H - KS - - KO',
    'K - H - KS - - - K - H - KS T HT KOT'
  )
});

const CHORUS = makeSection({
  name: 'chorus', harmony: ['Dm', 'Gm', 'Dm', 'A7'],
  leadVoice: 'picked', bassVoice: 'drone', arpVoice: 'neon', drumKit: 'cinematic',
  lead: bars(
    '- A5 A5 F5 D5 = = - A5 G5 F5 E5 D5 = C5 -',
    'D5 - G5 Bb5 - A5 G5 - F5 D5 G5 = A5 Bb5 A5 -',
    '- A5 A5 F5 D5 = = - A5 G5 F5 E5 D5 = C5 -',
    'E5 E5 G5 E5 C#5 = - A4 C#5 E5 G5 A5 G5 E5 C#5 -'
  ),
  bass: bars(
    'D1 = = = A1 = = = F2 = = = A1 = F1 -',
    'G1 = = = D2 = = = Bb1 = D2 = G2 = F2 -',
    'D1 = = = A1 = = = F2 = = = A1 = F1 -',
    'A0 = = = E1 = = = G1 = E1 = C#2 = A1 -'
  ),
  arp: bars(
    'D3 = = = A3 - D4 - F4 = A4 - F4 D4 A3 -',
    'G2 D3 G3 - Bb3 = D4 - G4 - D4 Bb3 G3 - F3 -',
    'D3 = = = A3 - D4 - F4 = A4 - F4 D4 A3 -',
    'A2 E3 A3 - C#4 = E4 - G4 A4 G4 E4 C#4 A3 E3 -'
  ),
  drums: bars(
    'K - H - KS - H - K - H - KS - H -',
    'K - H - KS - H - K - H - KS - H KO',
    'K - H - KS - H - K - H - KS - H -',
    'K - H - KS - H - K - H - KS T HT KOT'
  )
});

export const MOUNTAIN_SONG = makeSong({
  id: 'mountain', name: 'Mountain', bpm: 144, key: 'D minor',
  style: 'dark melodic mountain theme with sustained reed melody, deep moving drone bass, orchestral organ figures and a relentless cinematic pulse', swing: 0,
  sections: [TUNE, BRIDGE, CHORUS], arrangement: ['chorus', 'chorus', 'tune', 'tune', 'bridge', 'bridge']
});
