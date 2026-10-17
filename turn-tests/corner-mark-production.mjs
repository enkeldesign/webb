import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { TROPHY_ROAD_REWARD_ICONS, getTrophyRoadReward } from '../turn/progression/trophy-road.js';
import { UNLOCK_INTRODUCTIONS } from '../turn/progression/unlock-introductions.js';
import { cornerMarkMarkup } from '../turn/ui/corner-mark.js';

// Corner marks (#1230): a sheet, dialog or panel about one feature shows that feature's
// Trophy Road icon in the top-right corner of its content, as the Track sheet shows its
// track. Where they sit and that nothing overlaps them: garage-browser-smoke.mjs and
// tutorial-browser-smoke.mjs.
const read = (path) => fs.readFile(new URL(path, import.meta.url), 'utf8');
const [perkulator, shift, garage, introductions, surfaces, design] = await Promise.all([
  read('../turn/garage/garage-perkulator.js'),
  read('../turn/garage/shift-setup.js'),
  read('../turn/garage/garage.js'),
  read('../turn/progression/unlock-introductions.js'),
  read('../turn/surfaces.css'),
  read('../turn/design.html')
]);

// The Trophy Road artwork itself, hidden from assistive technology: the title names it.
assert.equal(cornerMarkMarkup('perkulator'),
  `<span class="turn-corner-mark" aria-hidden="true">${TROPHY_ROAD_REWARD_ICONS.perkulator}</span>`);
assert.equal(cornerMarkMarkup('no-such-icon'), '', 'No artwork, no icon');
assert.equal(cornerMarkMarkup(undefined), '');

// Every unlock introduction has its reward's icon to show.
for (const id of Object.keys(UNLOCK_INTRODUCTIONS)) {
  const icon = getTrophyRoadReward(id)?.icon;
  assert.ok(TROPHY_ROAD_REWARD_ICONS[icon], `${id}: its Trophy Road icon is the sheet's corner mark`);
}

// Where each surface puts it: before the text that wraps around it.
assert.match(perkulator, /<div class="garage-install-perk-intro">\s*\$\{cornerMarkMarkup\('perkulator'\)\}\s*<p class="garage-install-perk-lead"/,
  'INSTALL PERK: PERKULATOR');
assert.match(shift, /<div class="garage-shift-intro">\s*\$\{cornerMarkMarkup\('shift'\)\}\s*<p id="\$\{descriptionId\}" class="garage-shift-description">/,
  'SHIFT setup: SHIFT');
assert.match(garage, /paintPanel\.insertAdjacentHTML\('afterbegin', cornerMarkMarkup\('paint'\)\);/, 'PAINT: PAINTJOB');
assert.match(introductions, /copy\.insertAdjacentHTML\('afterbegin', cornerMarkMarkup\(getTrophyRoadReward\(id\)\?\.icon\)\);/,
  'Unlock introductions: the unlock\'s own icon, below the title');

// Buttons stay words (Erik, #1230).
for (const source of [perkulator, shift, garage, introductions]) {
  assert.doesNotMatch(source, /<button[^>]*>[^<]*\$\{cornerMarkMarkup/, 'No corner mark inside a button');
}

// One style: 2.5rem, the Track sheet's size, floated into the corner in the text colour.
const rule = surfaces.match(/\n\.turn-corner-mark \{([^}]*)\}/)?.[1] || '';
for (const declaration of ['float: right;', 'width: 2.5rem;', 'height: 2.5rem;', 'color: var(--turn-text);']) {
  assert.ok(rule.includes(declaration), `.turn-corner-mark: ${declaration}`);
}

// The rule is written down where TURN's design language lives.
assert.match(design, /<strong>Corner marks<\/strong>[\s\S]*Buttons stay words\./);

console.log('Corner marks: INSTALL PERK, the unlock introductions, SHIFT setup and PAINT show their feature\'s Trophy Road icon in the corner; buttons stay words.');
