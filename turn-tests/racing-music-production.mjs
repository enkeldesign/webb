import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [homeLayout, music] = await Promise.all([
  fs.readFile(new URL('../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/racing-music-v2.js', import.meta.url), 'utf8')
]);

assert.match(homeLayout, /audio\/racing-music-v2\.js\?build=\$\{buildKey\}-racing-music-warm-v2/,
  'Production Home must cache-bust and load the warmer TURN-only racing music module');
assert.match(homeLayout, /installRacingMusic\(\{ home \}\)/,
  'Racing music must join the established Home lifecycle rather than TURN NEXT');

assert.match(music, /const BPM = 124/,
  'The v2 mix should slow the original 140 BPM song without changing its composition');
assert.match(music, /const ARRANGEMENT = Object\.freeze\(\[TUNE, TUNE, BRIDGE\]\)/,
  'The song must reuse the main tune twice, then play the bridge, without duplicating tune data');
assert.match(music, /'D#6'/, 'The bridge must retain its B7-to-E-minor turnaround');
assert.doesNotMatch(music, /fetch\(|new Audio\(/,
  'Racing music must remain generated Web Audio rather than a downloaded audio asset');

assert.match(music, /MUSIC_VOLUME_STORAGE_KEY = 'turn-racing-music-volume-v1'/,
  'The warmer mix must preserve existing saved music-volume preferences');
assert.match(music, /DEFAULT_VOLUME = 10/,
  'Fresh players should start with music at a subtle 10 percent level');
assert.match(music, /body\.type = 'triangle'/,
  'Lead and bass body oscillators should use a softer triangle timbre');
assert.match(music, /overtone\.type = 'sine'/,
  'The lead should use a gentle sine overtone instead of bright FM bite');
assert.match(music, /oscillator\.type = 'triangle'/,
  'The arpeggio should use a warmer triangle tone');
assert.doesNotMatch(music, /type = 'square'|type = 'sawtooth'|createWaveShaper/,
  'The warmer mix must not reintroduce the original chiptune-like square, saw or distortion voices');
assert.match(music, /filter\.frequency\.value = 3200/,
  'The lead should be low-pass softened rather than left bright');
assert.match(music, /filter\.frequency\.value = 2300/,
  'The arpeggio should remain tucked behind the lead');
assert.match(music, /compressor\.attack\.value = 0\.015/,
  'The master dynamics should use a gentler attack than the original sharp mix');

assert.match(music, /document\.addEventListener\('pointerdown', handleUserActivation/,
  'Music must unlock from a permitted pointer gesture on browsers with autoplay restrictions');
assert.match(music, /document\.addEventListener\('keydown', handleUserActivation/,
  'Keyboard-only players must also be able to unlock the music');
assert.match(music, /if \(shouldPlay\(\)\) void startPlayback/,
  'The desired music state must be ON as soon as the Home interface is available');

assert.match(music, /className = 'turn-music-home-toggle'/);
assert.match(music, /MUSIC \$\{action\.toUpperCase\(\)\}/,
  'The Home header control must expose MUSIC OFF while playing and MUSIC ON while disabled');
assert.match(music, /setAttribute\('aria-label', `Turn music \$\{action\}`\)/,
  'The visible toggle action must have an explicit accessible name');

assert.match(music, /label\.innerHTML = '<strong>Music volume<\/strong><small>OFF stops the music engine completely\.<\/small>'/);
assert.match(music, /slider\.min = '0'/);
assert.match(music, /slider\.max = '100'/);
assert.match(music, /labels\.innerHTML = '<span>OFF<\/span><span>100%<\/span>'/,
  'The music volume scale must say OFF rather than 0% at its minimum');
assert.match(music, /if \(musicVolume <= 0 \|\| !soundEnabled\)[\s\S]*stopPlayback/,
  'OFF must stop the engine rather than merely turn its gain to zero');
assert.match(music, /clearScheduler\(\);[\s\S]*stopActiveSources\(\);[\s\S]*context\.suspend\(\)/,
  'An off music engine must have no sequencer timer, active note sources, or running AudioContext');

assert.match(music, /className = 'turn-music-blank-toggle'/);
assert.match(music, /turn-screen-blank-control\[data-state="active"\]/,
  'Audio-only driving must get a music toggle next to the restore-vision control');
assert.match(music, /z-index: 2147483001/,
  'The blank-screen music control must remain operable above the black overlay');

assert.match(music, /new globalThis\.GainNode\(context, \{ gain: value \}\)/,
  'The independent music graph must avoid the central audio-preference createGain patch');
assert.match(music, /soundEnabled = globalThis\.__turnAudioPreferences\?\.getSettings\?\.\(\)\.audioEnabled !== false/,
  'The global Sound preference must still silence racing music');
assert.doesNotMatch(music, /turn-lot-open|GAME_MODE|RACING|SPECTATING/,
  'Music playback must not be gated away when moving between Home, The Lot, and races');

console.log('TURN warmer generated racing music, 10 percent default and accessibility controls regression passed.');
