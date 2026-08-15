import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, tools, css] = await Promise.all([
  fs.readFile(new URL('../turn/audio/music/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tracker-column-octave.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tracker-column-octave.css', import.meta.url), 'utf8')
]);

assert.match(index, /tracker-column-octave\.js\?revision=r206-column-tools/,
  'Music Tracker must load the fresh column tools module');
assert.match(tools, /tracker-column-octave\.css\?revision=r206-column-tools/,
  'Column tools must cache-bust their styles');

assert.match(tools, /import \{[^}]*\bL\b[^}]*\} from '.\/tracker-core\.js\?revision=r187-music-tracker'/,
  'Column selection should use all tracker lanes');
assert.match(tools, /for \(const lane of L\)/,
  'LEAD, BASS, ARP and DRUMS should all get selectable column headings');
assert.match(tools, /Tap any column heading for copy, paste and clear tools/,
  'Tracker instructions should advertise the shared column tools');
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
assert.match(tools, /Column clipboard:/,
  'Column tools should expose an inline clipboard summary');

assert.match(css, /\.column-tools-actions-three/,
  'Bar and part actions should use compact three-button groups');
assert.match(css, /@media \(max-width: 760px\)[\s\S]*grid-template-columns: 1fr/,
  'Column tools should stack cleanly on phones');

console.log('TURN Music Tracker column tools regression passed.');
