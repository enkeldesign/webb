import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, labIndex, trackerIndex, releaseSource, homeLayout, engine, songbookSource, songToolsSource,
  toneRuntime, drumRuntime, leadVoicesSource, bassVoicesSource, arpVoicesSource,
  drumKitsSource] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-lab/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/racing-music-v5.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/songbook.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/song-tools.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tone-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/drum-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/lead-voices.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/bass-voices.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/arp-voices.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/drum-kits.js', import.meta.url), 'utf8')
]);

const { MENU_SONG, SONGBOOK, TRACK_SONGS, songForTrack } = await import(
  new URL('../turn/audio/music/songbook.js?test=user-scores', import.meta.url)
);
const { LEAD_VOICES, BASS_VOICES, ARP_VOICES, DRUM_KITS } = await import(
  new URL('../turn/audio/music/instrument-bank.js?test=user-scores', import.meta.url)
);

function importMapImports(source) {
  const jsonText = source.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
  assert.ok(jsonText, 'TURN must expose an import map');
  return JSON.parse(jsonText).imports;
}

const release = JSON.parse(releaseSource);
const musicSpecifier = `/turn/audio/racing-music-v2.js?build=${release.cacheKey}-racing-music-warm-v2`;
const productionImports = importMapImports(index);
const labImports = importMapImports(labIndex);
const trackerImports = importMapImports(trackerIndex);
assert.equal(productionImports[musicSpecifier], '/turn/audio/racing-music-v5.js?revision=r185-menu-orchestration');
assert.equal(labImports[musicSpecifier], '/turn/audio/racing-music-v5.js?revision=r185-menu-orchestration');
assert.match(homeLayout, /audio\/racing-music-v2\.js\?build=\$\{buildKey\}-racing-music-warm-v2/);
assert.match(engine, /music\/songbook\.js\?revision=r185-menu-orchestration/);
assert.equal(
  trackerImports['./songbook.js?revision=r185-menu-orchestration'],
  './songbook.js?revision=r196-user-scores-repair',
  'Music Tracker must bypass stale songbook modules after direct score edits'
);
assert.match(trackerIndex, /tracker\.js\?revision=r196-song-recovery/,
  'Music Tracker entry must get a fresh module identity after a broken song import');

// Creative score files are intentionally user-editable. Cache-bust their direct imports whenever
// the checked-in scores change so installed Safari PWAs do not keep stale song modules.
for (const songFile of ['menu-theme', 'countryside', 'airport', 'cliffside', 'harbor', 'midnight-city']) {
  assert.match(songbookSource, new RegExp(`${songFile}\\.js\\?revision=r196-user-scores-repair`),
    `${songFile} must use the current user-score cache revision`);
}

const expectedTrackIds = ['countryside', 'airport', 'cliffside', 'harbor', 'midnight-city'];
assert.equal(MENU_SONG.id, 'menu');
assert.deepEqual(Object.keys(TRACK_SONGS), expectedTrackIds);
assert.equal(SONGBOOK.length, 6, 'Songbook contains menu music plus five track songs');

const leadNames = new Set(Object.keys(LEAD_VOICES));
const bassNames = new Set(Object.keys(BASS_VOICES));
const arpNames = new Set(Object.keys(ARP_VOICES));
const drumNames = new Set(Object.keys(DRUM_KITS));
const requiredSections = new Set(['tune', 'bridge', 'chorus']);

for (const song of SONGBOOK) {
  assert.ok(song.id && song.name, `${song.id || 'song'} must have id and name`);
  assert.ok(song.bpm >= 70 && song.bpm <= 180, `${song.id} BPM stays within engine range`);
  assert.ok(song.swing >= 0 && song.swing <= 0.24, `${song.id} swing stays within engine range`);
  assert.equal(song.form.length, 6, `${song.id} has a six-part arrangement`);
  assert.ok(song.form.every((name) => requiredSections.has(name)), `${song.id} arrangement only uses T/B/C sections`);
  assert.equal(song.sections.length, 3, `${song.id} exposes tune, bridge and chorus`);
  assert.deepEqual(new Set(song.sections.map((section) => section.name)), requiredSections,
    `${song.id} has the required named sections`);

  for (const section of song.sections) {
    const length = section.lead.length;
    assert.ok(length > 0 && length % 16 === 0, `${song.id} ${section.name} uses whole 16-step bars`);
    assert.equal(section.bass.length, length, `${song.id} ${section.name} bass length`);
    assert.equal(section.arp.length, length, `${song.id} ${section.name} arp length`);
    assert.equal(section.drums.length, length, `${song.id} ${section.name} drum length`);
    assert.equal(section.harmony.length, length / 16, `${song.id} ${section.name} harmony/bar count`);
    assert.ok(leadNames.has(section.leadVoice), `${song.id} ${section.name} lead voice exists`);
    assert.ok(bassNames.has(section.bassVoice), `${song.id} ${section.name} bass voice exists`);
    assert.ok(arpNames.has(section.arpVoice), `${song.id} ${section.name} arp voice exists`);
    assert.ok(drumNames.has(section.drumKit), `${song.id} ${section.name} drum kit exists`);
  }
}

for (const trackId of expectedTrackIds) assert.equal(songForTrack(trackId), TRACK_SONGS[trackId]);
assert.equal(songForTrack('not-a-track'), TRACK_SONGS.countryside, 'Unknown tracks fall back to Countryside');

assert.match(songToolsSource, /BPM must be between 70 and 180/);
assert.match(songToolsSource, /swing must be between 0 and 0\.24/);
assert.match(songToolsSource, /must have exactly six arrangement parts/);
assert.match(songToolsSource, /cannot use note ties/);
assert.match(songToolsSource, /compileTieSequence/);

assert.deepEqual(Object.keys(LEAD_VOICES), ['lead','picked','pluck','whistle','pulse','brass','organ','reed','bell','neon']);
assert.deepEqual(Object.keys(BASS_VOICES), ['warm','upright','sub','drone','drive','synth']);
assert.deepEqual(Object.keys(ARP_VOICES), ['soft','mandolin','glass','organ','metal','neon']);
assert.deepEqual(Object.keys(DRUM_KITS), ['classic','brush','electro','cinematic','industrial','night']);
assert.match(leadVoicesSource, /body: 'sawtooth'/);
assert.match(bassVoicesSource, /upright:/);
assert.match(arpVoicesSource, /organ:/);
assert.match(drumKitsSource, /brush:/);

for (const generatedSource of [engine, toneRuntime, drumRuntime]) {
  assert.doesNotMatch(generatedSource, /fetch\(|new Audio\(/,
    'TURN music remains generated Web Audio with no downloaded score assets');
  assert.doesNotMatch(generatedSource, /createWaveShaper/,
    'TURN music does not add distortion waveshapers');
}
assert.match(engine, /function stepSpacing\(step\)/, 'Engine keeps swing-aware scheduling');
assert.match(engine, /tones\?\.playLead/);
assert.match(engine, /tones\?\.playBass/);
assert.match(engine, /tones\?\.playArp/);
assert.match(engine, /drums\?\.play/);

console.log('TURN generated racing music regression passed.');
