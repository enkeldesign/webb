import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const [index, labIndex, homeLayout, music, headerFix] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-lab/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/racing-music-v3.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/home-header-r425.css', import.meta.url), 'utf8')
]);

function gitBlobSha(source) {
  const header = `blob ${Buffer.byteLength(source, 'utf8')}\0`;
  return crypto.createHash('sha1').update(header).update(source).digest('hex');
}

function importMapImports(source) {
  const jsonText = source.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
  assert.ok(jsonText, 'TURN must expose an import map');
  return JSON.parse(jsonText).imports;
}

const musicSpecifier = '/turn/audio/racing-music-v2.js?build=20260809-r163-racing-music-warm-v2';
const musicRevision = `blob-${gitBlobSha(music).slice(0, 12)}`;
const expectedMusicTarget = `/turn/audio/racing-music-v3.js?revision=${musicRevision}`;

assert.equal(
  importMapImports(index)[musicSpecifier],
  expectedMusicTarget,
  'Production must fingerprint the approved v3 music URL from the actual racing-music-v3.js blob so direct song edits cannot reuse stale cached bytes'
);
assert.equal(
  importMapImports(labIndex)[musicSpecifier],
  expectedMusicTarget,
  'TURN LAB must use the same content-fingerprinted racing music URL as production'
);
assert.match(homeLayout, /audio\/racing-music-v2\.js\?build=\$\{buildKey\}-racing-music-warm-v2/,
  'The established Home lifecycle remains the single music installation point');
assert.match(homeLayout, /installRacingMusic\(\{ home \}\)/,
  'Racing music must remain attached to production Home rather than TURN NEXT');

assert.match(index, /home-header-r425\.css\?revision=r425-header-boundary/,
  'Production TURN must load the cache-busted Home header correction');
assert.match(labIndex, /home-header-r425\.css\?revision=r425-header-boundary/,
  'TURN LAB must load the same Home header correction as production');
assert.match(headerFix, /html \.m8-home\.m8-home-fixed-layout \{\s*background: var\(--m8-blue\);/,
  'The fixed Home canvas must own the blue background instead of a percentage-based yellow split');
assert.match(headerFix, /html \.m8-home\.m8-home-fixed-layout \.m8-home-head \{\s*background: var\(--m8-yellow\);/,
  'The actual Home header must own the yellow background so it stops at its real border');
assert.match(headerFix, /turn-music-home-toggle \{\s*transform: translateY\(clamp\(-14px, -1\.8vh, -8px\)\);/,
  'The Home music control must align upward with the version/build row while retaining its hit target');
assert.match(headerFix, /@media \(max-width: 760px\) and \(orientation: portrait\)[\s\S]*turn-music-home-toggle \{\s*transform: none;/,
  'Portrait Home must not inherit the landscape metadata alignment offset');

assert.match(music, /const BPM = 120/,
  'The approved song must preserve the hand-tuned 120 BPM tempo');
assert.match(music, /const DEFAULT_VOLUME = 50/,
  'The approved song must preserve the hand-tuned 50% default volume');
assert.match(music, /User-tuned T\/B lead transposition:[\s\S]*const hz = noteToFrequency\(note\) \/ 4/,
  'The ordinary T/B lead must preserve the two-octave-down transposition');
assert.match(music, /User-tuned bass transposition:[\s\S]*const hz = noteToFrequency\(note\) \/ 2/,
  'The bass must preserve the one-octave-down transposition');

assert.match(music, /const CHORUS = Object\.freeze\(/,
  'The song must retain a distinct reusable chorus section');
assert.match(music, /name: 'chorus',[\s\S]*leadVoice: 'flute'/,
  'The chorus must retain its dedicated lead routing identifier');
assert.doesNotMatch(music, /sustainLead|leadHoldSteps|nextSustainedLeadNote|nextNote/,
  'The chorus must not retain obsolete sustain or portamento machinery');
assert.match(
  music,
  /'E4', 'E4', 'G4', 'G4', 'B4', 'B4', 'G4', 'G4',[\s\S]*'G4', 'G4', 'E4', 'E4', 'C5', 'C5', 'E5', 'E5',[\s\S]*'D5', 'D5', 'B4', 'B4', 'G4', 'G4', 'B4', 'B4',[\s\S]*'F#4', 'F#4', 'A4', 'A4', 'B4', 'B4', 'D#5', 'D#5'/,
  'The chorus lead must preserve the approved paired sixteenth-note melody'
);
assert.match(music, /const ARRANGEMENT = Object\.freeze\(\[CHORUS, CHORUS, TUNE, TUNE, BRIDGE, TUNE\]\)/,
  'The approved form must remain C C T T B T');

assert.match(music, /function playFluteLead\(note, time\)/,
  'The dedicated chorus lead synth must remain available under its compatibility function name');
assert.match(music, /Keep the chorus in its current octave\.[\s\S]*const hz = noteToFrequency\(note\) \/ 2/,
  'The chorus lead must preserve its current octave');
assert.match(music, /const duration = STEP_SECONDS \* 0\.88/,
  'Each chorus lead event must remain a short articulated sixteenth note');
assert.match(music, /const bodyGain = makeGain\(0\.75\)/,
  'The chorus lead body balance must preserve the approved value');
assert.match(music, /const harmonicGain = makeGain\(0\.16\)/,
  'The brighter chorus harmonic must preserve the approved value');
assert.match(music, /body\.type = 'triangle'/);
assert.match(music, /harmonic\.type = 'triangle'/);
assert.match(music, /body\.frequency\.setValueAtTime\(hz \* 1\.018, time\)[\s\S]*exponentialRampToValueAtTime\([\s\S]*hz,[\s\S]*time \+ 0\.025/,
  'The chorus lead must preserve its short picked-string pitch transient');
assert.match(music, /filter\.frequency\.setValueAtTime\(2000, time\)[\s\S]*1000,[\s\S]*endTime/,
  'The chorus lead must retain its bright-to-warm pluck filter sweep');
assert.match(music, /amp\.gain\.exponentialRampToValueAtTime\([\s\S]*0\.075,[\s\S]*time \+ 0\.008/,
  'The chorus lead must retain its quick picked attack');
assert.doesNotMatch(music, /const vibrato =|linearRampToValueAtTime\(nextHz|scheduleFluteEnvelope/,
  'Sixteenth-note chorus events must not use the abandoned sustained vibrato or glide machinery');

assert.match(music, /function playLead\(note, time, \{ voice = 'lead' \} = \{\}\)/,
  'Lead voice selection must remain independent of note sustain');
assert.match(music, /if \(voice === 'flute'\) \{[\s\S]*playFluteLead\(note, time\);[\s\S]*return;/,
  'The dedicated chorus voice must route to its chorus synth');
assert.match(music, /voice: section\.leadVoice \|\| 'lead'/,
  'The scheduler must select the chorus voice explicitly');
assert.match(music, /body\.type = 'triangle'/,
  'The generated song must keep its established warm triangle character');

assert.match(music, /MUSIC_VOLUME_STORAGE_KEY = 'turn-racing-music-volume-v1'/,
  'The release must preserve existing saved volume preferences');
assert.doesNotMatch(music, /fetch\(|new Audio\(/,
  'Racing music must remain generated Web Audio rather than a downloaded asset');
assert.doesNotMatch(music, /type = 'square'|type = 'sawtooth'|createWaveShaper/,
  'The approved song must not introduce harsh square, sawtooth or waveshaper voices');

assert.match(music, /document\.addEventListener\('pointerdown', handleUserActivation/,
  'Music must unlock from a permitted pointer gesture');
assert.match(music, /document\.addEventListener\('keydown', handleUserActivation/,
  'Keyboard-only players must also be able to unlock music');
assert.match(music, /if \(musicVolume <= 0 \|\| !soundEnabled\)[\s\S]*stopPlayback/,
  'OFF must stop the engine rather than merely mute it');
assert.match(music, /clearScheduler\(\);[\s\S]*stopActiveSources\(\);[\s\S]*context\.suspend\(\)/,
  'An off music engine must have no scheduler, active note sources or running AudioContext');

assert.match(music, /className = 'turn-music-home-toggle'/);
assert.match(music, /className = 'turn-music-blank-toggle'/);
assert.match(music, /label\.innerHTML = '<strong>Music volume<\/strong><small>OFF stops the music engine completely\.<\/small>'/);
assert.match(music, /labels\.innerHTML = '<span>OFF<\/span><span>100%<\/span>'/);
assert.match(music, /arrangement: Object\.freeze\(ARRANGEMENT\.map\(\(section\) => section\.name\)\)/,
  'Runtime diagnostics must expose the actual arrangement');
assert.match(music, /timbre: 'warm-v3-eighth-note-flute-chorus'/,
  'The existing runtime timbre identifier must remain stable for compatibility');

console.log(`TURN approved 120 BPM / 50% generated racing music and content-fingerprinted cache revision ${musicRevision} passed.`);
