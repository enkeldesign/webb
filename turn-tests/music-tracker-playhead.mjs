import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, audio, playhead, css] = await Promise.all([
  fs.readFile(new URL('../turn/audio/music/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tracker-audio.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tracker-playhead-r208.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tracker-playhead-r208.css', import.meta.url), 'utf8')
]);

assert.match(index, /"\.\/tracker-audio\.js\?revision=r187-music-tracker": "\.\/tracker-audio\.js\?revision=r208-row-playhead"/,
  'Tracker entry must route the existing audio import to the fresh playhead runtime');
assert.match(index, /tracker-playhead-r208\.js\?revision=r208-row-playhead/,
  'Tracker entry must load the row playhead interaction layer');

assert.match(audio, /export async function auditionRow\(part = model\.state\.part, step = model\.state\.bar \* 16\)/,
  'Audio runtime should expose one-row audition from the visible bar');
assert.match(audio, /export async function startPlayback\(mode, part = model\.state\.part, bar = 0, row = 0\)/,
  'Part playback should accept an optional row offset');
assert.match(audio, /const startStep = mode === 'part' \? Math\.max\(0, bar \* 16 \+ row\) : 0;/,
  'One-shot row starts must resolve to the exact tracker step');
assert.match(audio, /schedulePlaybackEvent\('turn-tracker-play-row',[\s\S]*?, t, generation\)/,
  'Visual row feedback should be scheduled for actual audio time rather than scheduler lookahead time');
assert.match(audio, /turn-tracker-playback-stop/,
  'Audio runtime should clear the playhead when playback ends or stops');

assert.match(playhead, /Tap a row number to preview that row and use it once as the next part-play start/,
  'Tracker instruction should explain row audition and one-shot start');
assert.match(playhead, /button\.dataset\.playRow = String\(step\)/,
  'Rendered row numbers should become explicit row audition controls');
assert.match(playhead, /await auditionRow\(currentPart\(\), step\)/,
  'Tapping a row number should audition only that row');
assert.match(playhead, /const start = armedStart;\s*clearArmedStart\(\);\s*startPlayback\('part', start\.part, start\.bar, start\.row\)/,
  'The armed row start must be consumed before its one playback use');
assert.match(playhead, /detail\.part !== currentPart\(\) \|\| detail\.bar !== currentBar\(\)/,
  'Playhead highlighting should only affect the visible part and bar');
assert.match(playhead, /addEventListener\('click',[\s\S]*true\);/,
  'One-shot row starts should intercept the existing part play action in capture phase');

assert.match(css, /\.tracker-row\.playing>/,
  'The currently sounding row should receive a subtle full-row treatment');
assert.match(css, /\.row-number\[data-play-row\]\.start-armed/,
  'The row armed as the next start should remain visibly distinct');

console.log('TURN Music Tracker playhead regression passed.');
