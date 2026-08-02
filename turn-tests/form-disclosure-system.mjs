import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [app, tokens, components, guide, design] = await Promise.all([
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/design-tokens.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/settings-components-r141.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/how-to-play-guide.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/design.html', import.meta.url), 'utf8')
]);

assert.match(app, /settings-components-r141\.css\?revision=r141-form-disclosure/);
assert.match(app, /m8-how-to-play-r126\.css\?revision=r141-form-disclosure/);
assert.match(app, /how-to-play-guide\.js\?revision=r141-form-disclosure/);

for (const mapping of [
  '--turn-form-control-idle: var(--turn-paper)',
  '--turn-form-control-selected: var(--turn-pink-500)',
  '--turn-form-control-focus: var(--turn-blue-500)',
  '--turn-disclosure-trigger: var(--turn-blue-300)',
  '--turn-disclosure-panel: var(--turn-paper)'
]) {
  assert.ok(tokens.includes(mapping), `Missing native component token ${mapping}`);
}

assert.match(components, /\.m8-setting-card legend,[\s\S]*\.m8-setting-card > h3/);
assert.match(components, /background: var\(--turn-surface-raised\)/);
assert.match(components, /\.m8-setting-card > h3[\s\S]*margin: -31px 0 14px 2px/);
assert.match(components, /input\[type='radio'\],[\s\S]*input\[type='checkbox'\][\s\S]*appearance: none/);
assert.match(components, /input\[type='radio'\]:checked[\s\S]*radial-gradient/);
assert.match(components, /input\[type='checkbox'\]:checked[\s\S]*background-color: var\(--turn-form-control-selected\)/);
assert.match(components, /input\[type='radio'\]:focus-visible,[\s\S]*input\[type='checkbox'\]:focus-visible/);
assert.match(components, /#m8AudioBalance[\s\S]*appearance: none/);
assert.match(components, /\.m8-guide-wide[\s\S]*background: var\(--turn-surface-raised\) !important/);
assert.match(components, /\.m8-dbe-guide > summary[\s\S]*justify-content: flex-start[\s\S]*background: var\(--turn-disclosure-trigger\)/);
assert.match(components, /\.m8-disclosure-symbol[\s\S]*border-radius: var\(--turn-radius-circle\)/);
assert.match(components, /\.m8-disclosure-symbol::before[\s\S]*content: '\+'/);
assert.match(components, /\.m8-dbe-guide\[open\] \.m8-disclosure-symbol::before[\s\S]*content: '−'/);
assert.match(components, /\.m8-dbe-guide-panel,[\s\S]*background: var\(--turn-disclosure-panel\)/);
assert.doesNotMatch(components, /#eaf9ef/);

assert.match(guide, /GUIDE_VERSION = 'r141-form-disclosure-system'/);
assert.match(
  guide,
  /<summary><span class="m8-disclosure-symbol" aria-hidden="true"><\/span><span>Explore the Drive By Ear sounds<\/span><\/summary>/
);
assert.ok(
  guide.indexOf('m8-disclosure-symbol') < guide.indexOf('Explore the Drive By Ear sounds'),
  'The disclosure state symbol must precede and sit beside its summary label'
);

for (const specimen of [
  'Native form controls',
  'Legend and heading elements share one floating card-title treatment',
  'Radio buttons',
  'Checkboxes',
  'Disclosure',
  'Blue trigger, Paper panel',
  'The decorative state symbol sits directly before the summary text'
]) {
  assert.ok(design.includes(specimen), `Missing design-system specimen or rule: ${specimen}`);
}
assert.match(design, /<fieldset class="form-card">[\s\S]*<legend>Steering<\/legend>/);
assert.match(design, /<section class="form-card" aria-labelledby="designAudioTitle">[\s\S]*<h3 id="designAudioTitle">Audio<\/h3>/);
assert.match(design, /<input type="radio" name="designSteering" checked>/);
assert.match(design, /<input type="checkbox" checked>/);
assert.match(design, /<details class="disclosure-sample">[\s\S]*<summary><span class="disclosure-symbol" aria-hidden="true"><\/span><span>Explore the Drive By Ear sounds<\/span><\/summary>/);

console.log('TURN native form controls, headings and disclosure system passed.');
