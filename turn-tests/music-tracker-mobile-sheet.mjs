import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, workflow, tools, toolsCss, activePartPlay, audio, playhead, playheadCss] = await Promise.all([
  fs.readFile(new URL('../turn/audio/music/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tracker-workflow.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tracker-column-octave.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tracker-column-octave.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tracker-active-part-play-r207.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tracker-audio.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tracker-playhead-r208.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tracker-playhead-r208.css', import.meta.url), 'utf8')
]);

assert.match(index, /tracker-workflow\.css\?revision=r205-mobile-sheet-fit/,
  'Music Tracker must cache-bust the mobile sheet layout');
assert.match(workflow, /@media \(max-width: 760px\)[\s\S]*?\.tracker-grid,[\s\S]*?\.tracker-row\s*\{[\s\S]*?grid-template-columns: 2\.8rem repeat\(3, minmax\(0, 1fr\)\) 4\.4rem;/,
  'Phone layouts should fit row + lead + bass + arp + drums into the available sheet width');
assert.match(workflow, /\.tracker-grid,[\s\S]*?\.tracker-row\s*\{[\s\S]*?min-width: 0;/,
  'Phone layouts must override the desktop 650px tracker minimum width');
assert.match(workflow, /@media \(max-width: 520px\)[\s\S]*?grid-template-columns: 2\.45rem repeat\(3, minmax\(0, 1fr\)\) 3\.8rem;/,
  'Narrow phones should keep the drums lane visible with a tighter proportional sheet');
assert.doesNotMatch(workflow, /@media \(max-width: 760px\)[\s\S]*?\.tracker-scroll\s*\{[^}]*overflow-x:\s*hidden/,
  'Horizontal scrolling remains available as a fallback on unusually narrow displays');

assert.match(index, /tracker-column-octave\.js\?revision=r206-column-tools/,
  'Music Tracker must load the fresh column tools module');
assert.match(tools, /tracker-column-octave\.css\?revision=r206-column-tools/,
  'Column tools must cache-bust their styles');
assert.match(tools, /for \(const lane of L\)/,
  'LEAD, BASS, ARP and DRUMS should all get selectable column headings');
assert.match(tools, /const columnMode = L\.includes\(selectedColumn\)/,
  'DRUMS must enter column mode as well as pitched lanes');

for (const id of [
  'copyColumnBarButton', 'pasteColumnBarButton', 'clearColumnBarButton',
  'copyColumnPartButton', 'pasteColumnPartButton', 'clearColumnPartButton'
]) {
  assert.match(tools, new RegExp(`id=\\"${id}\\"`), `${id} should exist`);
}

assert.match(tools, /scope === 'bar' \? currentBarSequence\(\) : \[\.\.\.currentLaneSequence\(\)\]/,
  'Copy should support both the current 16-step bar and the full part lane');
assert.match(tools, /columnClip\.kind !== laneKind\(selectedColumn\)/,
  'Drum clips should stay separate from pitched clips');
assert.match(tools, /columnClip\.data\.length !== currentLaneSequence\(\)\.length/,
  'Full-part paste must reject mismatched bar counts');
assert.match(tools, /sequenceIsValid\(selectedColumn, candidate\)/,
  'Paste and clear should protect note-tie validity across bar boundaries');
assert.match(tools, /Array\(length\)\.fill\(null\)/,
  'Clear should blank only the selected bar or full lane scope');
assert.match(tools, /\$\('columnOctaveGroup'\)\.hidden = !pitched/,
  'Octave controls should remain pitched-only while copy/paste/clear works for DRUMS');
assert.match(toolsCss, /\.column-tools-actions-three/,
  'Bar and part actions should use compact three-button groups');
assert.match(toolsCss, /@media \(max-width: 760px\)[\s\S]*grid-template-columns: 1fr/,
  'Column tools should stack cleanly on phones');

assert.match(index, /tracker-active-part-play-r207\.js\?revision=r207-active-part-play/,
  'Music Tracker must load the active-part playback affordance with a fresh module identity');
assert.match(activePartPlay, /\.part-tab\[data-part\]/,
  'Active playback styling should follow the selected tracker part');
assert.match(activePartPlay, /\.part-play\[data-part\]/,
  'Only part playback buttons should be restyled');
assert.match(activePartPlay, /button\.classList\.toggle\('primary', active\)/,
  'The selected part playback button should use TURN primary styling');
assert.match(activePartPlay, /button\.classList\.toggle\('play', !active\)/,
  'Inactive part playback buttons should retain normal game-action styling');
assert.match(activePartPlay, /button\.setAttribute\('aria-current', 'true'\)/,
  'The selected part playback button should expose its current relationship semantically');
assert.match(activePartPlay, /attributeFilter: \['class', 'aria-selected'\]/,
  'The affordance should stay synchronized when tracker rendering changes the selected part');

assert.match(index, /"\.\/tracker-audio\.js\?revision=r187-music-tracker": "\.\/tracker-audio\.js\?revision=r208-row-playhead"/,
  'Music Tracker must route the existing audio import to the fresh playhead runtime');
assert.match(index, /tracker-playhead-r208\.js\?revision=r208-row-playhead/,
  'Music Tracker must load the row playhead interaction layer');
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
  'Tracker instructions should explain row audition and one-shot start');
assert.match(playhead, /button\.dataset\.playRow = String\(step\)/,
  'Rendered row numbers should become explicit row audition controls');
assert.match(playhead, /await auditionRow\(currentPart\(\), step\)/,
  'Tapping a row number should audition only that row');
assert.match(playhead, /const start = armedStart;\s*clearArmedStart\(\);\s*startPlayback\('part', start\.part, start\.bar, start\.row\)/,
  'The armed row start must be consumed before its one playback use');
assert.match(playhead, /detail\.part !== currentPart\(\) \|\| detail\.bar !== currentBar\(\)/,
  'Playhead highlighting should only affect the visible part and bar');
assert.match(playheadCss, /\.tracker-row\.playing>/,
  'The currently sounding row should receive a subtle full-row treatment');
assert.match(playheadCss, /\.row-number\[data-play-row\]\.start-armed/,
  'The row armed as the next start should remain visibly distinct');

console.log('TURN Music Tracker mobile sheet, column tools, active part playback and row playhead regression passed.');
