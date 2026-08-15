import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, workflow] = await Promise.all([
  fs.readFile(new URL('../turn/audio/music/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tracker-workflow.css', import.meta.url), 'utf8')
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

console.log('TURN Music Tracker mobile sheet regression passed.');
