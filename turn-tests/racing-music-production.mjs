import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, homeLayout, music] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/racing-music-v3.js', import.meta.url), 'utf8')
]);

assert.match(
  index,
  /"\/turn\/audio\/racing-music-v2\.js\?build=20260809-r163-racing-music-warm-v2": "\/turn\/audio\/racing-music-v3\.js\?revision=r421-sustained-chorus"/,
  'The existing Home music import must resolve to a fresh chorus-v3 URL without disturbing the Home layout'
);
assert.match(homeLayout, /audio\/racing-music-v2\.js\?build=\$\{buildKey\}-racing-music-warm-v2/,
  'The established Home lifecycle remains the single music installation point');
assert.match(homeLayout, /installRacingMusic\(\{ home \}\)/,
  'Racing music must remain attached to production Home rather than TURN NEXT');

assert.match(music, /const BPM = 120/,
  'The chorus build must preserve the user-tuned 120 BPM tempo');
assert.match(music, /const DEFAULT_VOLUME = 50/,
  'The chorus build must preserve the user-tuned default volume');
assert.match(music, /const hz = noteToFrequency\(note\) \/ 4/,
  'The lead must preserve the user-tuned two-octave-down transposition');
assert.match(music, /const hz = noteToFrequency\(note\) \/ 2/,
  'The bass must preserve the user-tuned one-octave-down transposition');

assert.match(music, /const CHORUS = Object\.freeze\(/,
  'The song must gain a distinct reusable chorus section');
assert.match(music, /name: 'chorus',[\s\S]*sustainLead: true/,
  'The chorus must explicitly opt into sustained lead notes');
assert.match(music, /'E6',[\s\S]*'G6',[\s\S]*'B6',[\s\S]*'D#6'/,
  'The chorus hook must rise through E minor and end on the leading tone that pulls back to E');
assert.match(music, /const ARRANGEMENT = Object\.freeze\(\[TUNE, TUNE, BRIDGE, TUNE, CHORUS, CHORUS\]\)/,
  'The form must be T T B T C C so the chorus is a scarce two-pass payoff');
assert.match(music, /function leadHoldSteps\(section, step\)/,
  'The scheduler must derive held-note duration only for sustained sections');
assert.match(music, /while \(step \+ hold < section\.lead\.length && section\.lead\[step \+ hold\] == null\) hold \+= 1/,
  'Null chorus steps after a note must extend that note instead of retriggering it');
assert.match(music, /sustained: section\.sustainLead === true/,
  'Only chorus-style sections may use the sustained lead envelope');
assert.match(music, /sustained \? 0\.075 : 0\.022/,
  'Long chorus notes must use a slower attack than the punchy T/B lead');
assert.match(music, /filter\.frequency\.value = sustained \? 2700 : 3200/,
  'The sustained chorus lead should be slightly softer than the ordinary lead');

assert.match(music, /MUSIC_VOLUME_STORAGE_KEY = 'turn-racing-music-volume-v1'/,
  'The chorus rollout must preserve existing saved volume preferences');
assert.doesNotMatch(music, /fetch\(|new Audio\(/,
  'Racing music must remain generated Web Audio rather than a downloaded asset');
assert.match(music, /body\.type = 'triangle'/,
  'Lead and bass body oscillators must retain the warm triangle timbre');
assert.match(music, /overtone\.type = 'sine'/,
  'The lead must retain its soft sine overtone');
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
assert.match(music, /timbre: 'warm-v3-sustained-chorus'/);

console.log('TURN T/T/B/T/C/C sustained chorus, user-tuned tempo/transposition, and music controls regression passed.');
