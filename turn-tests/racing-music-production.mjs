import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  index,
  labIndex,
  releaseSource,
  homeLayout,
  engine,
  songbookSource,
  menuSource,
  songToolsSource,
  toneRuntime,
  drumRuntime,
  instrumentBankSource,
  leadVoicesSource,
  bassVoicesSource,
  arpVoicesSource,
  drumKitsSource,
  controlsSource,
  controlsCss
] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-lab/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/racing-music-v5.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/songbook.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/menu-theme.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/song-tools.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tone-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/drum-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/instrument-bank.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/lead-voices.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/bass-voices.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/arp-voices.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/drum-kits.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/music-controls.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/music-controls.css', import.meta.url), 'utf8')
]);

const { MENU_SONG, SONGBOOK, TRACK_SONGS, songForTrack } = await import(
  new URL('../turn/audio/music/songbook.js?test=score-v2', import.meta.url)
);
const { LEAD_VOICES, BASS_VOICES, ARP_VOICES, DRUM_KITS } = await import(
  new URL('../turn/audio/music/instrument-bank.js?test=score-v2', import.meta.url)
);

function importMapImports(source) {
  const jsonText = source.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
  assert.ok(jsonText, 'TURN must expose an import map');
  return JSON.parse(jsonText).imports;
}

const release = JSON.parse(releaseSource);
const musicSpecifier = `/turn/audio/racing-music-v2.js?build=${release.cacheKey}-racing-music-warm-v2`;
const expectedMusicTarget = '/turn/audio/racing-music-v5.js?revision=r185-menu-orchestration';
const productionImports = importMapImports(index);
const labImports = importMapImports(labIndex);

assert.match(homeLayout, /audio\/racing-music-v2\.js\?build=\$\{buildKey\}-racing-music-warm-v2/,
  'Home keeps the established release-derived compatibility specifier');
assert.equal(productionImports[musicSpecifier], expectedMusicTarget,
  'Production must route the compatibility specifier to the fresh menu-orchestration URL');
assert.equal(labImports[musicSpecifier], expectedMusicTarget,
  'TURN LAB must exercise the same menu-orchestrated score-v5 engine');
assert.doesNotMatch(index, /racing-music-v4\.js\?revision=track-songbook-20260813-v1/,
  'Production must not retain the stale score-v4 cache target');
assert.doesNotMatch(labIndex, /racing-music-v4\.js\?revision=track-songbook-20260813-v1/,
  'TURN LAB must not retain the stale score-v4 cache target');

assert.match(engine, /music\/songbook\.js\?revision=r185-menu-orchestration/,
  'score-v5 must reload the songbook for the orchestrated menu theme');
for (const moduleName of ['tone-runtime', 'drum-runtime', 'instrument-bank', 'music-controls']) {
  assert.match(engine, new RegExp(`music/${moduleName}\\.js\\?revision=r184-score-v2`),
    `score-v5 must keep ${moduleName} on the current instrument-library revision`);
}
assert.match(engine, /music-controls\.css\?revision=r184-score-v2/,
  'Music control CSS stays on the current score revision');
assert.match(songbookSource, /menu-theme\.js\?revision=r185-menu-orchestration/,
  'The songbook must not serve a cached pre-v2 menu theme');
for (const trackFile of ['countryside', 'airport', 'cliffside', 'harbor', 'midnight-city']) {
  assert.match(songbookSource, new RegExp(`${trackFile}\\.js\\?revision=r184-score-v2`),
    `${trackFile} must keep the approved score-v2 revision`);
}

assert.equal(MENU_SONG.id, 'menu');
assert.equal(MENU_SONG.name, 'TURN Theme');
assert.equal(MENU_SONG.bpm, 120, 'The approved UI theme stays at 120 BPM');
assert.equal(MENU_SONG.key, 'E minor', 'The established menu theme keeps its tonal identity');
assert.equal(MENU_SONG.style, 'warm arcade title anthem');
assert.deepEqual(MENU_SONG.form, ['chorus', 'chorus', 'tune', 'tune', 'bridge', 'tune'],
  'The established UI theme keeps its C C T T B T form');
assert.match(menuSource, /song-tools\.js\?revision=r185-menu-orchestration/,
  'The menu theme must use the score-v2 section schema rather than its stale legacy import');
assert.match(menuSource, /'E5', null, 'G5', 'B5', 'D6'/,
  'The established menu melody remains intact');
const menuPalettes = Object.fromEntries(MENU_SONG.sections.map((section) => [
  section.name,
  `${section.leadVoice}/${section.bassVoice}/${section.arpVoice}/${section.drumKit}`
]));
assert.deepEqual(menuPalettes, {
  tune: 'brass/warm/mandolin/classic',
  bridge: 'reed/warm/organ/cinematic',
  chorus: 'whistle/warm/glass/night'
}, 'The same TURN theme notes must be re-orchestrated through three distinct score-v2 palettes');

const expectedTrackIds = ['countryside', 'airport', 'cliffside', 'harbor', 'midnight-city'];
assert.deepEqual(Object.keys(TRACK_SONGS), expectedTrackIds);
assert.equal(SONGBOOK.length, 6, 'The songbook contains UI music plus five track scores');

const expected = {
  countryside: {
    bpm: 100, key: 'C major / A minor', swing: 0.10,
    form: ['tune', 'chorus', 'tune', 'bridge', 'tune', 'chorus'],
    harmony: ['Am7-Dm7-G7-C', 'C-Am7-Dm7-G7', 'Fm7-Eb-Fm7-G7']
  },
  airport: {
    bpm: 144, key: 'C major / A minor', swing: 0,
    form: ['tune', 'chorus', 'tune', 'bridge', 'chorus', 'bridge'],
    harmony: ['Am7-G7-G7-C', 'C-Am7-G7-C', 'C-Cm-G7-C']
  },
  cliffside: {
    bpm: 90, key: 'C major → C minor', swing: 0,
    form: ['tune', 'bridge', 'chorus', 'tune', 'bridge', 'chorus'],
    harmony: ['C-G-Em7-Am7', 'Cm7-Gm7-Eb-Bb', 'Ab-Eb-G7-Cm7']
  },
  harbor: {
    bpm: 118, key: 'E minor', swing: 0,
    form: ['tune', 'chorus', 'bridge', 'tune', 'chorus', 'bridge'],
    harmony: ['Em7-Bm7-B7-Em7', 'Em7-Bm7-G-B7', 'Am7-Bm7-B7-Em7']
  },
  'midnight-city': {
    bpm: 118, key: 'G minor', swing: 0,
    form: ['chorus', 'tune', 'bridge', 'chorus', 'tune', 'bridge'],
    harmony: ['Gm7-Dm7-Gm7-Dm7', 'Gm7-Bb-Dm7-Gm7', 'Eb-Dm7-D7-Gm7']
  }
};

for (const [trackId, contract] of Object.entries(expected)) {
  const song = TRACK_SONGS[trackId];
  assert.equal(song.bpm, contract.bpm, `${trackId} tempo`);
  assert.equal(song.key, contract.key, `${trackId} tonal identity`);
  assert.equal(song.swing, contract.swing, `${trackId} groove`);
  assert.deepEqual(song.form, contract.form, `${trackId} six-part form`);
  assert.deepEqual(song.sections.map((section) => section.harmony.join('-')), contract.harmony,
    `${trackId} must retain its source-led harmonic plan`);
  assert.ok(song.style, `${trackId} must declare a scoring identity`);
  assert.equal(song.sections.length, 3);
  for (const section of song.sections) {
    assert.equal(section.lead.length, 64, `${trackId} ${section.name} lead`);
    assert.equal(section.bass.length, 64, `${trackId} ${section.name} bass`);
    assert.equal(section.arp.length, 64, `${trackId} ${section.name} arp`);
    assert.equal(section.drums.length, 64, `${trackId} ${section.name} drums`);
    assert.equal(section.harmony.length, 4, `${trackId} ${section.name} chord plan`);
  }
  assert.equal(songForTrack(trackId), song);
}

assert.equal(new Set(Object.values(TRACK_SONGS).map((song) => `${song.bpm}:${song.key}:${song.swing}:${song.form.join('-')}`)).size, 5,
  'Every track score must have a distinct tempo/tonality/groove/form identity');
const palettes = Object.values(TRACK_SONGS).map((song) => song.sections.map(
  (s) => `${s.leadVoice}/${s.bassVoice}/${s.arpVoice}/${s.drumKit}`
).join('|'));
assert.equal(new Set(palettes).size, 5, 'Every track must have its own instrument palette');

// Music-theory guardrails: harmony is explicit; accompaniment uses chord tones and
// strong-beat melody notes agree with the active chord. Passing tones remain free on weak beats.
const PC = Object.freeze({ C:0, 'C#':1, Db:1, D:2, 'D#':3, Eb:3, E:4, F:5, 'F#':6, Gb:6, G:7, 'G#':8, Ab:8, A:9, 'A#':10, Bb:10, B:11 });
const chordQualities = Object.freeze({
  '': [0,4,7], m:[0,3,7], '7':[0,4,7,10], m7:[0,3,7,10]
});
function pitchClass(note) {
  const match = /^([A-G](?:#|b)?)/.exec(note || '');
  return match ? PC[match[1]] : null;
}
function chordInfo(symbol) {
  const match = /^([A-G](?:#|b)?)(m7|m|7)?$/.exec(symbol);
  assert.ok(match, `Unsupported chord symbol in score: ${symbol}`);
  const root = PC[match[1]], quality = match[2] || '';
  return { root, tones: new Set(chordQualities[quality].map((interval) => (root + interval) % 12)) };
}
for (const song of Object.values(TRACK_SONGS)) {
  for (const section of song.sections) {
    for (let bar = 0; bar < 4; bar += 1) {
      const chord = chordInfo(section.harmony[bar]);
      const offset = bar * 16;
      const firstBass = section.bass.slice(offset, offset + 16).find(Boolean);
      assert.equal(pitchClass(firstBass), chord.root,
        `${song.id} ${section.name} bar ${bar + 1} bass must establish the chord root`);
      for (const note of section.arp.slice(offset, offset + 16).filter(Boolean)) {
        assert.ok(chord.tones.has(pitchClass(note)),
          `${song.id} ${section.name} bar ${bar + 1} arp ${note} must be a chord tone of ${section.harmony[bar]}`);
      }
      for (const step of [0, 4, 8, 12]) {
        const note = section.lead[offset + step];
        if (note) assert.ok(chord.tones.has(pitchClass(note)),
          `${song.id} ${section.name} bar ${bar + 1} strong-beat lead ${note} must agree with ${section.harmony[bar]}`);
      }
    }
  }
}

assert.match(songToolsSource, /harmony must name exactly one chord per bar/,
  'Song construction must reject malformed chord plans');
assert.match(songToolsSource, /swing must be between 0 and 0\.24/,
  'Song construction must validate groove amount');

assert.deepEqual(Object.keys(LEAD_VOICES), ['lead','picked','pluck','whistle','pulse','brass','organ','reed','bell','neon']);
assert.deepEqual(Object.keys(BASS_VOICES), ['warm','upright','sub','drone','drive','synth']);
assert.deepEqual(Object.keys(ARP_VOICES), ['soft','mandolin','glass','organ','metal','neon']);
assert.deepEqual(Object.keys(DRUM_KITS), ['classic','brush','electro','cinematic','industrial','night']);
assert.match(instrumentBankSource, /lead-voices\.js\?revision=r184-score-v2/);
assert.match(instrumentBankSource, /bass-voices\.js\?revision=r184-score-v2/);
assert.match(instrumentBankSource, /arp-voices\.js\?revision=r184-score-v2/);
assert.match(instrumentBankSource, /drum-kits\.js\?revision=r184-score-v2/);
assert.match(leadVoicesSource, /body: 'square'/, 'The palette includes filtered pulse/reed synthesis');
assert.match(leadVoicesSource, /body: 'sawtooth'/, 'The palette includes filtered brass/neon synthesis');
assert.match(bassVoicesSource, /upright:/);
assert.match(bassVoicesSource, /drone:/);
assert.match(arpVoicesSource, /mandolin:/);
assert.match(arpVoicesSource, /metal:/);
assert.match(drumKitsSource, /industrial:/);
assert.match(drumKitsSource, /cinematic:/);

assert.match(toneRuntime, /createBiquadFilter/,
  'Every tonal instrument must pass through a controllable filter');
assert.match(toneRuntime, /graphs = new Map\(\)/,
  'Tone runtime must explicitly track downstream graphs');
assert.match(toneRuntime, /function stop\(\)[\s\S]*source\.stop\(\)/,
  'Tone runtime must stop active oscillators');
assert.match(drumRuntime, /graphs = new Map\(\)/,
  'Drum runtime must explicitly track downstream graphs');
assert.match(drumRuntime, /function stop\(\)[\s\S]*source\.stop\(\)/,
  'Drum runtime must stop active sources');
for (const generatedSource of [engine, toneRuntime, drumRuntime]) {
  assert.doesNotMatch(generatedSource, /fetch\(|new Audio\(/,
    'TURN music remains generated Web Audio with no downloaded music assets');
  assert.doesNotMatch(generatedSource, /createWaveShaper/,
    'The expanded palette must not add distortion waveshapers');
}

assert.match(engine, /function stepSpacing\(step\)[\s\S]*activeSong\.swing/,
  'The sequencer must support per-song swing');
assert.match(engine, /tones\?\.playLead\(section\.lead\[step\], time, section\.leadVoice/);
assert.match(engine, /tones\?\.playBass\(section\.bass\[step\], time, section\.bassVoice/);
assert.match(engine, /tones\?\.playArp\(section\.arp\[step\], time, section\.arpVoice/);
assert.match(engine, /drums\?\.play\(section\.drums\[step\], time, section\.drumKit/);
assert.match(engine, /addEventListener\('turn:track-changed',handleTrackChanged\)/);
assert.match(engine, /addEventListener\('turn:ui-state-change',handleUiStateChange\)/);
assert.match(engine, /if \(detail\.running \=\=\= true\)[\s\S]*songForTrack\(trackId\)/,
  'A running race selects its track score');
assert.match(engine, /switchSong\(MENU_SONG, \{ restart: false \}\)/,
  'Non-race UI returns to the TURN theme');
assert.match(engine, /clearScheduler\(\); tones\?\.stop\(\); drums\?\.stop\(\)/,
  'Song changes must remove already scheduled sources');
assert.match(engine, /playing=false; clearScheduler\(\); tones\?\.stop\(\); drums\?\.stop\(\)/,
  'MUSIC OFF must stop scheduling and both generated instrument runtimes');
assert.match(engine, /context\.suspend\(\)/,
  'MUSIC OFF must suspend the AudioContext');
assert.match(engine, /const DEFAULT_VOLUME = 50/);
assert.match(engine, /MUSIC_VOLUME_STORAGE_KEY = 'turn-racing-music-volume-v1'/);
assert.match(engine, /timbre:'score-v5-multi-instrument'/);
assert.match(engine, /instruments:Object\.freeze/);

assert.match(controlsSource, /turn-music-home-toggle/);
assert.match(controlsSource, /turn-music-blank-toggle/);
assert.match(controlsSource, /<strong>Music volume<\/strong><small>OFF stops the music engine completely\.<\/small>/);
assert.match(controlsSource, /<span>OFF<\/span><span>100%<\/span>/);
assert.match(controlsCss, /\.turn-music-home-toggle/);
assert.match(controlsCss, /\.turn-music-blank-toggle/);

console.log(`TURN score v5: ${Object.values(TRACK_SONGS).map((song) => `${song.id}=${song.key}@${song.bpm}:${song.form.join('-')}`).join(', ')}.`);