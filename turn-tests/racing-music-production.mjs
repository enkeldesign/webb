import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [homeLayout, music] = await Promise.all([
  fs.readFile(new URL('../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/racing-music.js', import.meta.url), 'utf8')
]);

assert.match(homeLayout, /audio\/racing-music\.js\?build=\$\{buildKey\}-racing-music-v1/,
  'Production Home must load the TURN-only racing music module');
assert.match(homeLayout, /installRacingMusic\(\{ home \}\)/,
  'Racing music must join the established Home lifecycle rather than TURN NEXT');

assert.match(music, /const BPM = 140/);
assert.match(music, /const ARRANGEMENT = Object\.freeze\(\[TUNE, TUNE, BRIDGE\]\)/,
  'The song must reuse the main tune twice, then play the bridge, without duplicating tune data');
assert.match(music, /'D#6'/, 'The bridge must retain its B7-to-E-minor turnaround');
assert.doesNotMatch(music, /fetch\(|new Audio\(/,
  'Racing music must remain generated Web Audio rather than a downloaded audio asset');

assert.match(music, /MUSIC_VOLUME_STORAGE_KEY = 'turn-racing-music-volume-v1'/);
assert.match(music, /DEFAULT_VOLUME = 70/,
  'Music should be on by default at a deliberately sub-maximal mix level');
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

console.log('TURN generated racing music and accessibility controls regression passed.');
