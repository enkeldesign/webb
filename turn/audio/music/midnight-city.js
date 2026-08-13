import { bars, makeSection, makeSong } from './song-tools.js?revision=r165-track-songbook-v1';

const TUNE = makeSection({
  name: 'tune',
  lead: bars(
    'C#6 - E6 - G#6 E6 C#6 - B5 - G#5 B5 - C#6 - E6 -',
    'A5 - C#6 - E6 C#6 A5 - G#5 - E5 G#5 - A5 - C#6 -',
    'E6 - G#6 - B6 G#6 E6 - D#6 - B5 D#6 - E6 - G#6 -',
    'B5 - D#6 - F#6 D#6 B5 - A5 B5 C#6 - D#6 - F#6 - G#6 -'
  ),
  bass: bars(
    'C#2 - C#2 - G#2 - C#3 - C#2 - B1 - G#2 - C#3 -',
    'A1 - A1 - E2 - A2 - A1 - G#1 - E2 - A2 -',
    'E2 - E2 - B2 - E3 - E2 - D#2 - B2 - E3 -',
    'B1 - B1 - F#2 - B2 - A1 - B1 - D#2 - F#2 -'
  ),
  arp: bars(
    'C#4 G#4 E4 G#4 C#5 G#4 E4 G#4 C#4 E4 G#4 B4 C#5 B4 G#4 E4',
    'A3 E4 C#4 E4 A4 E4 C#4 E4 A3 C#4 E4 G#4 A4 G#4 E4 C#4',
    'E4 B4 G#4 B4 E5 B4 G#4 B4 E4 G#4 B4 D#5 E5 D#5 B4 G#4',
    'B3 F#4 D#4 F#4 B4 F#4 D#4 F#4 B3 D#4 F#4 A4 B4 A4 F#4 D#4'
  ),
  drums: bars(
    'KH H K H SH H KH H K H KH H SH H K OH',
    'KH H K H SH H K OH KH H K H SH H KS OH',
    'KH H KH H SH H K H K H KH H SH H K OH',
    'KS H K H SH H KS OH K H KS H SH H KSO OH'
  )
});

const CHORUS = makeSection({
  name: 'chorus',
  leadVoice: 'flute',
  lead: bars(
    'C#5 C#5 E5 E5 G#5 G#5 C#6 C#6 B5 B5 G#5 G#5 E5 E5 G#5 G#5',
    'A4 A4 C#5 C#5 E5 E5 A5 A5 G#5 G#5 E5 E5 C#5 C#5 E5 E5',
    'E5 E5 G#5 G#5 B5 B5 E6 E6 D#6 D#6 B5 B5 G#5 G#5 B5 B5',
    'B4 B4 D#5 D#5 F#5 F#5 B5 B5 C#6 C#6 D#6 D#6 F#6 F#6 G#6 G#6'
  ),
  bass: bars(
    'C#2 C#2 C#2 C#2 G#2 G#2 G#2 G#2 C#3 C#3 C#3 C#3 G#2 G#2 G#2 G#2',
    'A1 A1 A1 A1 E2 E2 E2 E2 A2 A2 A2 A2 E2 E2 E2 E2',
    'E2 E2 E2 E2 B2 B2 B2 B2 E3 E3 E3 E3 B2 B2 B2 B2',
    'B1 B1 B1 B1 F#2 F#2 F#2 F#2 B2 B2 B2 B2 F#2 F#2 G#2 G#2'
  ),
  arp: bars(
    'C#4 - G#4 - E4 - G#4 - C#5 - G#4 - E4 - G#4 -',
    'A3 - E4 - C#4 - E4 - A4 - E4 - C#4 - E4 -',
    'E4 - B4 - G#4 - B4 - E5 - B4 - G#4 - B4 -',
    'B3 - F#4 - D#4 - F#4 - B4 - F#4 - D#4 - G#4 -'
  ),
  drums: bars(
    'KH H K H SH H K H KH H K H SH H K OH',
    'KH H KH H SH H K OH KH H K H SH H KS OH',
    'KH H K H SH H KH H K H K H SH H K OH',
    'KS H KS H SH H K OH KS H KS H S KS KSO OH'
  )
});

const BRIDGE = makeSection({
  name: 'bridge',
  lead: bars(
    'F#5 - A5 C#6 - F#6 - E6 - C#6 A5 - F#5 - C#6 -',
    'A5 C#6 E6 - G#6 - E6 - C#6 A5 C#6 - E6 - D#6 -',
    'G#5 - B5 D#6 - G#6 - F#6 - D#6 B5 - G#5 - D#6 -',
    'G#5 B5 D#6 - F#6 - D#6 - B5 G#5 B5 - C#6 - D#6 -'
  ),
  bass: bars(
    'F#1 - - - C#2 - - - F#2 - - - C#2 - - -',
    'A1 - - - E2 - - - A2 - - - E2 - - -',
    'G#1 - - - D#2 - - - G#2 - - - D#2 - - -',
    'G#1 - D#2 - F#2 - B1 - G#2 - D#2 - F#2 - G#2 -'
  ),
  arp: bars(
    'F#3 C#4 A3 C#4 F#4 C#4 A3 C#4 F#3 A3 C#4 E4 F#4 E4 C#4 A3',
    'A3 E4 C#4 E4 A4 E4 C#4 E4 A3 C#4 E4 G#4 A4 G#4 E4 C#4',
    'G#3 D#4 B3 D#4 G#4 D#4 B3 D#4 G#3 B3 D#4 F#4 G#4 F#4 D#4 B3',
    'G#3 B3 D#4 F#4 G#4 F#4 D#4 B3 G#3 D#4 F#4 G#4 B4 G#4 F#4 D#4'
  ),
  drums: bars(
    'K H - H S H K H K H - H S H K OH',
    'K H KH H S H K OH K H KH H S H K OH',
    'KH H K H SH H KH H K H K H SH H K OH',
    'KS H KS H SH H K OH KS H KS H S KS KSO OH'
  )
});

export const MIDNIGHT_CITY_SONG = makeSong({
  id: 'midnight-city',
  name: 'Neon Apex',
  bpm: 136,
  sections: [TUNE, CHORUS, BRIDGE],
  arrangement: ['chorus', 'tune', 'chorus', 'bridge', 'tune', 'bridge']
});
