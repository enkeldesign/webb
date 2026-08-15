import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, workflow, tools, toolsCss] = await Promise.all([
  fs.readFile(new URL('../turn/audio/music/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tracker-workflow.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tracker-column-octave.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tracker-column-octave.css', import.meta.url), 'utf8')
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

console.log('TURN Music Tracker mobile sheet and column tools regression passed.');
