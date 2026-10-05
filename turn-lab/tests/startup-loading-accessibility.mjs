import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const source = await fs.readFile(path.join(root, 'turn/index.html'), 'utf8');
const app = await fs.readFile(path.join(root, 'turn/app.js'), 'utf8');

assert.match(source, /copy\.setAttribute\('role', 'status'\)/);
assert.match(source, /copy\.setAttribute\('aria-live', 'polite'\)/);
assert.match(source, /copy\.setAttribute\('aria-atomic', 'true'\)/,
  'Startup status updates should be announced atomically');
assert.match(source, /gate\.setAttribute\('aria-busy', 'true'\)/);
assert.match(source, /document\.documentElement\.setAttribute\('aria-busy', 'true'\)/);
assert.match(source, /gate\.setAttribute\('aria-busy', 'false'\)/);
assert.match(source, /document\.documentElement\.setAttribute\('aria-busy', 'false'\)/);
assert.match(source, /state === 'normal'[^\n]+setState\('slow'\)[^\n]+10000/);
assert.match(source, /GETTING TURN READY/);
assert.match(source, /NEW TURN UPDATE/);
assert.doesNotMatch(source, /This might take a minute on a new installation/);
assert.match(source, /spinner\.setAttribute\('aria-hidden', 'true'\)/,
  'Indeterminate visual spinner should stay decorative rather than expose a fake percentage');
assert.doesNotMatch(source, /turn-startup-spinner[\s\S]{0,300}role[^\n]*progressbar/,
  'TURN should not claim measurable loading progress when no percentage is available');
assert.match(app, /intro\.replaceChildren\(\s*makeHiddenHook\('button', 'motionButton'\),\s*makeHiddenHook\('button', 'manualButton'\),\s*makeHiddenHook\('p', 'status'\)\s*\)/,
  'Cold-start accessibility changes must preserve the legacy launch compatibility hooks');
