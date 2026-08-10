import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, homeLayout, music] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/racing-music-v3.js', import.meta.url), 'utf8')
]);

assert.match(
  index,
  /"\/turn\/audio\/racing-music-v2\.js\?build=20260809-r163-racing-music-warm-v2": "\/turn\/audio\/racing-music-v3\.js\?revision=r422-flute-legato-chorus"/,
  'The existing Home music import must resolve to a fresh flute-chorus URL without disturbing the Home layout'
);
assert.match(homeLayout, /audio\/racing-music-v2\.js\?build=\$\{buildKey\}-racing-music-warm-v2/,
  'The established Home lifecycle remains the single music installation point');
assert.match(homeLayout, /installRacingMusic\(\{ home \}\)/,
  'Racing music must remain attached to production Home rather than TURN NEXT');

assert.match(music, /const BPM = 120/,
  'The flute chorus must preserve the user-tuned 120 BPM tempo');
assert.match(music, /const DEFAULT_VOLUME = 50/,
  'The flute chorus must preserve the user-tuned default volume');
assert.match(music, /const hz = noteToFrequency\(note\) \/ 4/,
  'The lead must preserve the user-tuned two-octave-down transposition');
assert.match(music, /const hz = noteToFrequency\(note\) \/ 2/,
  'The bass must preserve the user-tuned one-octave-down transposition');

assert.match(music, /const CHORUS = Object\.freeze\(/,
  'The song must retain a distinct reusable chorus section');
assert.match(music, /name: 'chorus',[\s\S]*sustainLead: true/,
  'The chorus must explicitly opt into sustained lead notes');
assert.match(
  music,
  /'E6', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,[\s\S]*'G6', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,[\s\S]*'B6', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,[\s\S]*'D#6', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null/,
  'Each chorus pitch must occupy a full sixteen-step 4/4 bar before the next written note'
);
assert.match(music, /const ARRANGEMENT = Object\.freeze\(\[TUNE, TUNE, BRIDGE, TUNE, CHORUS, CHORUS\]\)/,
  'The form must remain T T B T C C so the chorus stays a scarce two-pass payoff');

assert.match(music, /function scheduleFluteEnvelope\(gain, time, peak, releaseTime\)/,
  'The chorus needs a dedicated flute envelope rather than stretching the punchy lead decay');
assert.match(music, /gain\.setValueAtTime\(peak, releaseStart\)/,
  'The flute envelope must hold its level until the very end instead of fading through beats two and three');
assert.match(music, /function nextSustainedLeadNote\(sectionIndex, step\)/,
  'The scheduler must know the destination pitch for chorus legato');
assert.match(music, /if \(!nextSection\?\.sustainLead\) return null/,
  'The second chorus must not force a portamento into the returning punchy T section');
assert.match(music, /function playFluteLead\(note, nextNote, time, holdSteps\)/,
  'Sustained chorus notes must use a dedicated flute-like voice');
assert.match(music, /const beatSeconds = STEP_SECONDS \* STEPS_PER_BEAT/,
  'The legato transition must be phrased in musical beats');
assert.match(music, /const glideStart = Math\.max\(time \+ 0\.2, endTime - beatSeconds\)/,
  'Pitch movement must begin on beat four after holding through beats one to three');
assert.match(music, /body\.frequency\.linearRampToValueAtTime\(nextHz, endTime - 0\.025\)/,
  'The flute must glide toward the next pitch during beat four');
assert.match(music, /body\.type = 'sine';[\s\S]*overtone\.type = 'sine';[\s\S]*vibrato\.type = 'sine'/,
  'The sustained chorus should use a sine-rich flute timbre with gentle vibrato');
assert.match(music, /vibrato\.frequency\.setValueAtTime\(5\.2, time\)/,
  'The held flute note should carry subtle natural vibrato');
assert.match(music, /filter\.frequency\.value = 2400/,
  'The flute chorus should remain soft rather than bright and chiptune-like');

assert.match(music, /if \(sustained\) \{[\s\S]*playFluteLead\(note, nextNote, time, holdSteps\);[\s\S]*return;/,
  'Only sustained chorus notes should use the flute path');
assert.match(music, /body\.type = 'triangle'/,
  'The ordinary T/B lead and bass must keep the established warm triangle character');
assert.match(music, /nextNote: section\.sustainLead \? nextSustainedLeadNote\(currentSection, step\) : null/,
  'The scheduler must provide portamento destinations only to sustained sections');

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
  'Runtime diagnostics must expose the actual T/T/B/T/C/C form');
assert.match(music, /timbre: 'warm-v3-flute-legato-chorus'/);

console.log('TURN T/T/B/T/C/C flute-legato chorus, user-tuned tempo/transposition, and music controls regression passed.');
