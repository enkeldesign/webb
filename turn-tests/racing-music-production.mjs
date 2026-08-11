import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, labIndex, homeLayout, music, sharedContext, audioPreferences, headerFix] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-lab/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/racing-music-v3.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/shared-audio-context-r430.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/audio-preferences.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/home-header-r425.css', import.meta.url), 'utf8')
]);

assert.match(
  index,
  /"\/turn\/audio\/racing-music-v2\.js\?build=20260809-r163-racing-music-warm-v2": "\/turn\/audio\/racing-music-v3\.js\?revision=r430-single-context"/,
  'Production must cache-bust the single-context music engine'
);
assert.match(
  labIndex,
  /"\/turn\/audio\/racing-music-v2\.js\?build=20260809-r163-racing-music-warm-v2": "\/turn\/audio\/racing-music-v3\.js\?revision=r430-single-context"/,
  'TURN LAB must exercise the same single-context music engine as production'
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

assert.match(sharedContext, /const NativeAudioContextClass = globalThis\.AudioContext \|\| globalThis\.webkitAudioContext/,
  'The broker must retain the native browser constructor before replacing the public constructor');
assert.match(sharedContext, /let sharedContext = null/,
  'TURN must own exactly one shared Web Audio context reference');
assert.match(sharedContext, /return new NativeAudioContextClass\(\{ latencyHint: 'interactive' \}\)/,
  'The single shared context should favor interactive game audio latency');
assert.match(sharedContext, /function TurnSharedAudioContext\(\) \{\s*return getSharedAudioContext\(\);\s*\}/,
  'Legacy TURN modules that construct AudioContext must receive the shared native context');
assert.match(sharedContext, /globalThis\.AudioContext = TurnSharedAudioContext/);
assert.match(sharedContext, /globalThis\.webkitAudioContext = TurnSharedAudioContext/);
assert.match(audioPreferences, /^import \{ installSharedAudioContextConstructor \} from '\.\/shared-audio-context-r430\.js\?revision=r430-single-context';/,
  'The shared constructor must be installed before audio-system.js is evaluated');
assert.match(audioPreferences, /installSharedAudioContextConstructor\(\);/);

assert.match(music, /^import \{ getSharedAudioContext, resumeSharedAudioContext \} from '\.\/shared-audio-context-r430\.js\?revision=r430-single-context';/,
  'Racing music must explicitly join TURN’s shared audio clock');
assert.doesNotMatch(music, /const AudioContextClass|new AudioContextClass/,
  'Racing music must not create a second AudioContext');
assert.match(music, /context = getSharedAudioContext\(\)/,
  'The music graph must be built on the shared context');
assert.match(music, /const ready = await resumeSharedAudioContext\(\)/,
  'Music activation must resume the shared TURN context rather than a private one');
assert.doesNotMatch(music, /context\.suspend\(|context\.close\(/,
  'Music OFF and graph setup must never suspend or close the shared game-audio context');

assert.match(music, /const BPM = 120/,
  'The reviewed chorus must preserve the hand-tuned 120 BPM tempo');
assert.match(music, /const DEFAULT_VOLUME = 25/,
  'The hotfix keeps the reviewed 25% default while the device audio fault is isolated');
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
  'The chorus lead must retain the reviewed alternating eighth-note melody'
);
assert.match(music, /const ARRANGEMENT = Object\.freeze\(\[TUNE, TUNE, BRIDGE, TUNE, CHORUS, CHORUS\]\)/,
  'The reviewed form must remain T T B T C C');

assert.match(music, /function playFluteLead\(note, time\)/,
  'The chorus must use a dedicated articulated flute voice');
assert.match(music, /Chorus flute stays one octave above the T\/B lead transposition\.[\s\S]*const hz = noteToFrequency\(note\) \/ 2/,
  'The chorus flute must stay one octave above the ordinary lead');
assert.match(music, /const duration = STEP_SECONDS \* 2 \* 0\.88/,
  'Each flute event must occupy one eighth note with a small articulation gap');
assert.match(music, /scheduleGainEnvelope\(amp\.gain, time, 0\.07, endTime, 0\.035\)/,
  'The articulated flute must preserve the reviewed 0.07 peak');
assert.match(music, /const bodyGain = makeGain\(0\.9\)/,
  'The flute body balance must preserve the reviewed value');
assert.match(music, /const overtoneGain = makeGain\(0\.04\)/,
  'The flute overtone must remain restrained');
assert.match(music, /filter\.frequency\.value = 2400/,
  'The flute chorus should remain soft rather than bright and chiptune-like');

assert.match(music, /MUSIC_VOLUME_STORAGE_KEY = 'turn-racing-music-volume-v1'/,
  'The hotfix must preserve existing saved volume preferences');
assert.doesNotMatch(music, /fetch\(|new Audio\(/,
  'Racing music must remain generated Web Audio rather than a downloaded asset');
assert.doesNotMatch(music, /type = 'square'|type = 'sawtooth'|createWaveShaper/,
  'The chorus must not reintroduce the old chiptune-like voices');

assert.match(music, /document\.addEventListener\('pointerdown', handleUserActivation/,
  'Music must unlock from a permitted pointer gesture');
assert.match(music, /document\.addEventListener\('keydown', handleUserActivation/,
  'Keyboard-only players must also be able to unlock music');
assert.match(music, /if \(musicVolume <= 0 \|\| !soundEnabled\)[\s\S]*stopPlayback/,
  'OFF must stop the music engine rather than merely mute it');
assert.match(music, /clearScheduler\(\);[\s\S]*stopActiveSources\(\);/,
  'An off music engine must have no scheduler or active note sources');

assert.match(music, /className = 'turn-music-home-toggle'/);
assert.match(music, /className = 'turn-music-blank-toggle'/);
assert.match(music, /label\.innerHTML = '<strong>Music volume<\/strong><small>OFF stops the music engine completely\.<\/small>'/);
assert.match(music, /labels\.innerHTML = '<span>OFF<\/span><span>100%<\/span>'/);
assert.match(music, /get sampleRate\(\) \{ return context\?\.sampleRate \|\| 0; \}/,
  'Runtime diagnostics must expose the active shared sample rate for device debugging');
assert.match(music, /arrangement: Object\.freeze\(ARRANGEMENT\.map\(\(section\) => section\.name\)\)/,
  'Runtime diagnostics must expose the actual T/T/B/T/C/C form');
assert.match(music, /timbre: 'warm-v3-eighth-note-flute-chorus'/,
  'The existing runtime timbre identifier remains stable for compatibility');

console.log('TURN single-context Web Audio, reviewed T/T/B/T/C/C chorus, Home music controls and cache parity passed.');
