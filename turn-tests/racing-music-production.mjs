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
  headerFix
] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-lab/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/racing-music-v4.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/songbook.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/menu-theme.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/home-header-r425.css', import.meta.url), 'utf8')
]);

const { MENU_SONG, SONGBOOK, TRACK_SONGS, songForTrack } = await import(
  new URL('../turn/audio/music/songbook.js?test=track-songbook', import.meta.url)
);

function importMapImports(source) {
  const jsonText = source.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
  assert.ok(jsonText, 'TURN must expose an import map');
  return JSON.parse(jsonText).imports;
}

const release = JSON.parse(releaseSource);
const musicSpecifier = `/turn/audio/racing-music-v2.js?build=${release.cacheKey}-racing-music-warm-v2`;
const expectedMusicTarget = '/turn/audio/racing-music-v4.js?revision=track-songbook-20260813-v1';
const productionImports = importMapImports(index);
const labImports = importMapImports(labIndex);

assert.match(
  homeLayout,
  /audio\/racing-music-v2\.js\?build=\$\{buildKey\}-racing-music-warm-v2/,
  'Home must keep its release-derived compatibility specifier'
);
assert.equal(productionImports[musicSpecifier], expectedMusicTarget,
  'Production must route the established music entry to the track-aware engine');
assert.equal(labImports[musicSpecifier], expectedMusicTarget,
  'TURN LAB must exercise the same track-aware music engine');
assert.deepEqual(
  Object.keys(productionImports).filter((specifier) => specifier.startsWith('/turn/audio/racing-music-v2.js?build=')),
  [musicSpecifier],
  'Production must not retain stale release-specific music import-map keys'
);
assert.match(homeLayout, /installRacingMusic\(\{ home \}\)/,
  'The music engine must remain attached to production Home');

assert.match(engine, /music\/songbook\.js\?revision=r165-track-songbook-v1/,
  'The sequencer must load song data from the dedicated songbook rather than embedding a song');
assert.doesNotMatch(engine, /const TUNE =|const CHORUS =|const BRIDGE =/,
  'The audio engine must not own composition data anymore');
assert.match(songbookSource, /menu-theme\.js/);
for (const trackFile of ['countryside', 'airport', 'cliffside', 'harbor', 'midnight-city']) {
  assert.match(songbookSource, new RegExp(`${trackFile}\\.js`), `${trackFile} must have its own song module`);
}

assert.equal(MENU_SONG.id, 'menu');
assert.equal(MENU_SONG.name, 'TURN Theme');
assert.equal(MENU_SONG.bpm, 120, 'The approved TURN theme must stay at 120 BPM');
assert.deepEqual(MENU_SONG.form, ['chorus', 'chorus', 'tune', 'tune', 'bridge', 'tune'],
  'The existing theme must preserve its approved C C T T B T form after extraction');
assert.match(menuSource, /'E5', null, 'G5', 'B5', 'D6'/,
  'The moved menu theme must preserve the established tune melody');
assert.match(menuSource, /'E4', 'E4', 'G4', 'G4', 'B4', 'B4', 'G4', 'G4'/,
  'The moved menu theme must preserve the established chorus hook');

const expectedTrackIds = ['countryside', 'airport', 'cliffside', 'harbor', 'midnight-city'];
assert.deepEqual(Object.keys(TRACK_SONGS), expectedTrackIds,
  'Every production track must have exactly one registered race song');
assert.equal(SONGBOOK.length, 6, 'The songbook must contain the UI theme plus five race songs');

for (const song of SONGBOOK) {
  assert.equal(song.arrangement.length, 6, `${song.name} must loop through exactly six parts`);
  assert.equal(song.form.length, 6, `${song.name} must expose its six-part form`);
  assert.ok(song.form.includes('tune'), `${song.name} must include its tune`);
  assert.ok(song.form.includes('chorus'), `${song.name} must include its chorus`);
  assert.ok(song.form.includes('bridge'), `${song.name} must include its bridge`);
  assert.ok(song.bpm >= 70 && song.bpm <= 180, `${song.name} must use a supported tempo`);
  assert.equal(song.sections.length, 3, `${song.name} must define tune, chorus and bridge sections`);
  for (const section of song.sections) {
    assert.equal(section.lead.length, 64, `${song.name} ${section.name} lead must be four bars`);
    assert.equal(section.bass.length, 64, `${song.name} ${section.name} bass must match its lead`);
    assert.equal(section.arp.length, 64, `${song.name} ${section.name} arp must match its lead`);
    assert.equal(section.drums.length, 64, `${song.name} ${section.name} drums must match its lead`);
  }
}

assert.deepEqual(TRACK_SONGS.countryside.form, ['tune', 'chorus', 'tune', 'bridge', 'chorus', 'tune']);
assert.deepEqual(TRACK_SONGS.airport.form, ['chorus', 'tune', 'bridge', 'tune', 'chorus', 'bridge']);
assert.deepEqual(TRACK_SONGS.cliffside.form, ['tune', 'bridge', 'chorus', 'tune', 'bridge', 'chorus']);
assert.deepEqual(TRACK_SONGS.harbor.form, ['bridge', 'tune', 'chorus', 'tune', 'chorus', 'bridge']);
assert.deepEqual(TRACK_SONGS['midnight-city'].form, ['chorus', 'tune', 'chorus', 'bridge', 'tune', 'bridge']);
for (const trackId of expectedTrackIds) assert.equal(songForTrack(trackId), TRACK_SONGS[trackId]);

assert.match(engine, /function stepDurationFor\(song\)[\s\S]*60 \/ song\.bpm/,
  'Each song must be able to carry its own tempo');
assert.match(engine, /function switchSong\(nextSong/);
assert.match(engine, /stopActiveSources\(\);[\s\S]*nextStepTime = context\.currentTime \+ 0\.045;[\s\S]*scheduler\(\);/,
  'Changing songs while playing must remove already-scheduled notes before starting the new form');
assert.match(engine, /addEventListener\('turn:track-changed', handleTrackChanged\)/,
  'The engine must remember the selected production track');
assert.match(engine, /addEventListener\('turn:ui-state-change', handleUiStateChange\)/,
  'The engine must switch between UI and race music from the shared race lifecycle');
assert.match(engine, /if \(detail\.running === true\)[\s\S]*songForTrack\(trackId\)/,
  'A running race must select that track’s song');
assert.match(engine, /switchSong\(MENU_SONG, \{ restart: false \}\)/,
  'Home, menus and The Lot must return to the established TURN theme');

assert.match(engine, /const DEFAULT_VOLUME = 50/,
  'The approved 50% default volume must remain unchanged');
assert.match(engine, /MUSIC_VOLUME_STORAGE_KEY = 'turn-racing-music-volume-v1'/,
  'Existing saved music volume preferences must remain compatible');
assert.match(engine, /function playFluteLead\(note, time\)/,
  'The picked chorus voice must remain available to every song');
assert.match(engine, /const hz = noteToFrequency\(note\) \/ 2/,
  'The chorus voice must preserve its approved register');
assert.match(engine, /const hz = noteToFrequency\(note\) \/ 4/,
  'The ordinary lead must preserve the approved lower register');
assert.match(engine, /bodyGain = makeGain\(0\.75\)/);
assert.match(engine, /harmonicGain = makeGain\(0\.16\)/);
assert.doesNotMatch(engine, /type = 'square'|type = 'sawtooth'|createWaveShaper/,
  'Track songs must retain the warm generated instrument family');
assert.doesNotMatch(engine, /fetch\(|new Audio\(/,
  'The songbook must remain generated Web Audio rather than downloaded music files');

assert.match(engine, /const activeGraphs = new Map\(\)/,
  'Long sessions must retain explicit downstream graph tracking');
assert.match(engine, /function cleanupGraph\(source\)/);
assert.match(engine, /source\.addEventListener\?\.\('ended',[\s\S]*cleanupGraph\(source\)/,
  'Natural source completion must tear down its graph');
assert.match(engine, /function stopActiveSources\(\)[\s\S]*activeGraphs\.keys\(\)/,
  'Song changes and MUSIC OFF must tear down scheduled graphs');
assert.match(engine, /if \(musicVolume <= 0 \|\| !soundEnabled\)[\s\S]*stopPlayback/,
  'OFF must stop the engine rather than merely mute it');
assert.match(engine, /clearScheduler\(\);[\s\S]*stopActiveSources\(\);[\s\S]*context\.suspend\(\)/,
  'A stopped music engine must have no scheduler, sources or running AudioContext');

assert.match(engine, /className = 'turn-music-home-toggle'/);
assert.match(engine, /className = 'turn-music-blank-toggle'/);
assert.match(engine, /<strong>Music volume<\/strong><small>OFF stops the music engine completely\.<\/small>/);
assert.match(engine, /labels\.innerHTML = '<span>OFF<\/span><span>100%<\/span>'/);
assert.match(engine, /timbre: 'warm-v4-track-songbook'/);
assert.match(engine, /get songId\(\) \{ return activeSong\.id; \}/);
assert.match(engine, /get arrangement\(\) \{ return activeSong\.form; \}/);

assert.match(index, /home-header-r425\.css\?revision=r425-header-boundary/);
assert.match(labIndex, /home-header-r425\.css\?revision=r425-header-boundary/);
assert.match(headerFix, /html \.m8-home\.m8-home-fixed-layout \.m8-home-head \{\s*background: var\(--m8-yellow\);/);

console.log(`TURN track songbook: ${SONGBOOK.map((song) => `${song.id}:${song.form.join('-')}`).join(', ')}.`);
