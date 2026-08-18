import { bars, makeSection, makeSong } from './song-tools.js?revision=r186-note-ties';

const TUNE = makeSection({
  name: 'tune',
  leadVoice: 'pluck', bassVoice: 'sub', arpVoice: 'glass', drumKit: 'classic',
  lead: bars(
    'E6 - G6 B6 D7 - B6 G6 E6 - G6 A6 B6 D7 E7 -',
    'D7 - B6 A6 G6 - E6 G6 A6 B6 D7 B6 A6 G6 F#6 -',
    'E6 - B6 D7 E7 G7 F#7 E7 D7 - B6 G6 A6 B6 D7 -',
    'B6 D7 E7 G7 F#7 E7 D7 B6 A6 B6 G6 F#6 E6 B6 E7 -'
  ),
  bass: bars(
    'E2 = E3 E4 - B3 D4 - E2 = G3 B3 D4 B3 E4 -',
    'C2 = C4 G3 - C4 B3 - D2 = D4 A3 D4 F#4 A3 -',
    'E2 = E4 B3 D4 B3 G3 - E2 = E4 - D4 B3 G3 -',
    'C2 = G3 C4 B3 - D4 C4 D2 = D4 F#4 E3 B3 E4 -'
  ),
  arp: bars(
    'E6 B6 G6 B6 E7 B6 G6 B6 E6 B6 G6 B6 E7 B6 G6 D7',
    'C6 G6 E6 G6 C7 G6 E6 G6 D6 A6 F#6 A6 D7 A6 F#6 A6',
    'E6 B6 G6 B6 E7 B6 G6 B6 E6 G6 B6 D7 E7 D7 B6 G6',
    'C6 G6 E6 G6 C7 B6 G6 E6 D6 A6 F#6 A6 E6 B6 G6 E7'
  ),
  drums: bars(
    'KH H KH H KSH H KH H KH H KH H KSH H K OH',
    'KH H KH H KSH H K H KH H KH H KSH H KS OH',
    'KH H KH H KSH H KH H KH H KH H KSH H K OH',
    'KH H KH H KSH H KH H KH H KSH H KS S KS OH'
  )
});

const BRIDGE = makeSection({
  name: 'bridge',
  leadVoice: 'pluck', bassVoice: 'sub', arpVoice: 'glass', drumKit: 'cinematic',
  lead: bars(
    'G6 - B6 D7 G7 F#7 D7 B6 A6 B6 D7 E7 D7 B6 G6 -',
    'F#6 - A6 D7 F#7 E7 D7 A6 B6 D7 E7 F#7 E7 D7 A6 -',
    'E6 G6 C7 E7 G7 E7 D7 C7 G6 C7 D7 E7 G7 E7 C7 -',
    'F#6 A6 B6 D#7 F#7 D#7 B6 A6 F#6 A6 B6 D#7 F#7 D#7 B6 D#7'
  ),
  bass: bars(
    'G2 = G3 D4 - G4 F#4 D4 G2 = D4 - G4 D4 B3 -',
    'D2 = D4 A3 - D4 F#4 A3 D2 = D4 - F#4 D4 A3 -',
    'C2 = C4 G3 - C4 E4 G3 C2 = C4 - E4 C4 G3 -',
    'B1 = B3 F#3 A3 B3 D#4 F#4 B1 = A3 B3 D#4 F#4 B3 D#4'
  ),
  arp: bars(
    'G6 D7 B6 D7 G7 D7 B6 D7 G6 B6 D7 G7 D7 B6 D7 G7',
    'D6 A6 F#6 A6 D7 A6 F#6 A6 D6 F#6 A6 D7 F#7 D7 A6 F#6',
    'C6 G6 E6 G6 C7 G6 E6 G6 C6 E6 G6 C7 E7 C7 G6 E6',
    'B5 F#6 A6 D#7 B6 F#6 A6 D#7 B5 A6 D#7 F#7 A7 F#7 D#7 B6'
  ),
  drums: bars(
    'KH H KHM H KSHC H KHM H KH H KHM H KSHC H KM OH',
    'KH H KHM H KSHC H KM H KH H KHM H KSHC H KSM OH',
    'KH H KHM H KSHC H KHM H KH H KHM H KSHC H KM OH',
    'KH H KHM H KSHC H KHM H KS H KSCM H KSC SHC KSM KSO'
  )
});

const CHORUS = makeSection({
  name: 'chorus',
  leadVoice: 'pluck', bassVoice: 'sub', arpVoice: 'organ', drumKit: 'classic',
  lead: bars(
    'E6 E6 G6 G6 B6 B6 G6 G6 E7 E7 B6 B6 G6 G6 B6 B6',
    'G6 G6 E6 E6 C7 C7 E7 E7 G7 G7 E7 E7 D7 D7 C7 C7',
    'D7 D7 B6 B6 G6 G6 B6 B6 D7 D7 B6 B6 A6 A6 G6 G6',
    'F#6 F#6 A6 A6 B6 B6 D#7 D#7 B6 B6 A6 A6 F#6 F#6 D#6 D#6'
  ),
  bass: bars(
    'E2 = E2 E2 B2 B2 B2 B2 E2 = B2 B2 B2 B2 B2 B2',
    'C2 = C2 C2 G2 G2 G2 G2 C2 = C3 C3 G2 G2 G2 G2',
    'G2 = G2 G2 D3 D3 D3 D3 G2 = G3 G3 D3 D3 D3 D3',
    'B1 = B1 B1 F#2 F#2 F#2 F#2 A2 = A2 A2 D#3 D#3 F#3 F#3'
  ),
  arp: bars(
    'E6 - G6 - B6 - G6 - E7 - B6 - G6 - B6 -',
    'C6 - E6 - G6 - E6 - C7 - G6 - E6 - G6 -',
    'G6 - B6 - D7 - B6 - G7 - D7 - B6 - D7 -',
    'B5 - D#6 - F#6 - A6 - B6 - F#6 - D#6 - F#6 -'
  ),
  drums: bars(
    'KH H KH H KSH H K H KH H KH H KSH H K OH',
    'KH H KH H KSH H K H KH H KH OH KSH H K OH',
    'KH H KH H KSH H K H KH H KH H KSH H K OH',
    'KH H KH H KSH H KH H KS H K OH KSH H KS OH'
  )
});

export const MOUNTAIN_SONG = makeSong({
  id: 'mountain', name: 'TURN Theme', bpm: 120, key: 'E minor',
  style: 'warm arcade title anthem', swing: 0.07,
  sections: [TUNE, BRIDGE, CHORUS], arrangement: ['tune', 'tune', 'bridge', 'tune', 'chorus', 'chorus']
});
