import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, labIndex, homeLayout, music, headerFix] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-lab/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/racing-music-v3.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/home-header-r425.css', import.meta.url), 'utf8')
]);

assert.match(
  index,
  /"\/turn\/audio\/racing-music-v2\.js\?build=20260809-r163-racing-music-warm-v2": "\/turn\/audio\/racing-music-v3\.js\?revision=r424-eighth-note-flute-chorus"/,
  'The established Home music import must resolve to the fresh eighth-note chorus URL'
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
  'The eighth-note chorus must preserve the current 120 BPM tempo');
assert.match(music, /const DEFAULT_VOLUME = 25/,
  'The eighth-note chorus must preserve the current hand-tuned 25% default volume');
assert.match(music, /User-tuned T\/B lead transposition:[\s\S]*const hz = noteToFrequency\(note\) \/ 4/,
  'The ordinary T/B lead must preserve the two-octave-down transposition');
assert.match(music, /User-tuned bass transposition:[\s\S]*const hz = noteToFrequency\(note\) \/ 2/,
  'The bass must preserve the one-octave-down transposition');

assert.match(music, /const CHORUS = Object\.freeze\(/,
  'The song must retain a distinct reusable chorus section');
assert.match(music, /name: 'chorus',[\s\S]*leadVoice: 'flute'/,
  'The chorus must keep its dedicated flute voice without using sustain as the routing flag');
assert.doesNotMatch(music, /sustainLead|leadHoldSteps|nextSustainedLeadNote|nextNote/,
  'The chorus must not retain the old sustain or portamento machinery');
assert.match(
  music,
  /'E6', null, 'G6', null, 'B6', null, 'G6', null,[\s\S]*'G6', null, 'E6', null, 'C7', null, 'E7', null,[\s\S]*'D7', null, 'B6', null, 'G6', null, 'B6', null,[\s\S]*'F#6', null, 'A6', null, 'B6', null, 'D#7', null/,
  'The chorus lead must articulate on alternating sixteenth-note slots, i.e. true eighth notes'
);
assert.match(music, /const ARRANGEMENT = Object\.freeze\(\[TUNE, TUNE, BRIDGE, TUNE, CHORUS, CHORUS, BRIDGE, BRIDGE\]\)/,
  'The approved form must remain T T B T C C B B');

assert.match(music, /function playFluteLead\(note, time\)/,
  'The chorus must use a dedicated articulated flute voice');
assert.match(music, /Chorus flute stays one octave above the T\/B lead transposition\.[\s\S]*const hz = noteToFrequency\(note\) \/ 2/,
  'The chorus flute must stay one octave above the ordinary lead');
assert.match(music, /const duration = STEP_SECONDS \* 2 \* 0\.88/,
  'Each flute event must occupy one eighth note with a small articulation gap');
assert.match(music, /scheduleGainEnvelope\(amp\.gain, time, 0\.07, endTime, 0\.035\)/,
  'The articulated flute must preserve the current quieter 0.07 peak');
assert.match(music, /const bodyGain = makeGain\(0\.9\)/,
  'The flute body balance must preserve the current hand-tuned value');
assert.match(music, /const overtoneGain = makeGain\(0\.04\)/,
  'The flute overtone must remain restrained');
assert.match(music, /filter\.frequency\.value = 2400/,
  'The flute chorus should remain soft rather than bright and chiptune-like');
assert.doesNotMatch(music, /const vibrato =|linearRampToValueAtTime\(nextHz|scheduleFluteEnvelope/,
  'Eighth-note chorus events must not use sustained vibrato, glide, or hold envelopes');

assert.match(music, /function playLead\(note, time, \{ voice = 'lead' \} = \{\}\)/,
  'Lead voice selection must be independent of note sustain');
assert.match(music, /if \(voice === 'flute'\) \{[\s\S]*playFluteLead\(note, time\);[\s\S]*return;/,
  'The dedicated chorus voice must route to the flute synth');
assert.match(music, /voice: section\.leadVoice \|\| 'lead'/,
  'The scheduler must select the chorus flute by voice rather than by sustain');
assert.match(music, /body\.type = 'triangle'/,
  'The ordinary T/B lead and bass must keep the established warm triangle character');

assert.match(music, /MUSIC_VOLUME_STORAGE_KEY = 'turn-racing-music-volume-v1'/,
  'The chorus rollout must preserve existing saved volume preferences');
assert.doesNotMatch(music, /fetch\(|new Audio\(/,
  'Racing music must remain generated Web Audio rather than a downloaded asset');
assert.doesNotMatch(music, /type = 'square'|type = 'sawtooth'|createWaveShaper/,
  'The chorus must not reintroduce the old chiptune-like voices');

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
  'Runtime diagnostics must expose the actual T/T/B/T/C/C/B/B form');
assert.match(music, /timbre: 'warm-v3-eighth-note-flute-chorus'/);

console.log('TURN T/T/B/T/C/C/B/B eighth-note flute chorus, Home header boundary, music alignment, and controls regression passed.');
