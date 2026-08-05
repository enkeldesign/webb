import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, main, world, styles] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('main.mjs', root), 'utf8'),
  readFile(new URL('world.mjs', root), 'utf8'),
  readFile(new URL('styles.css', root), 'utf8')
]);

test('every JavaScript ID selector has a matching unique HTML element', () => {
  const htmlIds = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const duplicateIds = htmlIds.filter((id, index) => htmlIds.indexOf(id) !== index);
  assert.deepEqual(duplicateIds, []);

  const selectorIds = [...main.matchAll(/\$\('#([^']+)'\)/g)].map((match) => match[1]);
  const missing = [...new Set(selectorIds)].filter((id) => !htmlIds.includes(id));
  assert.deepEqual(missing, []);

  const labelledByIds = [...html.matchAll(/aria-labelledby="([^"]+)"/g)]
    .flatMap((match) => match[1].split(/\s+/));
  assert.deepEqual([...new Set(labelledByIds)].filter((id) => !htmlIds.includes(id)), []);
});

test('fresh-player and campaign overlays have named controls and real hidden states', () => {
  assert.match(html, /id="welcomeScreen" aria-labelledby="welcomeTitle"/);
  assert.match(html, /id="startButton"[^>]*>Start first shift</);
  assert.match(html, /id="campaignScreen" aria-labelledby="campaignTitle" hidden/);
  assert.match(html, /id="shiftList"/);
  assert.match(styles, /\.campaign-screen\[hidden\]/);
  assert.match(main, /if \(campaign\.completed\['first-rounds'\]\)/);
});

test('runtime no longer plays the sharp sample files', () => {
  assert.doesNotMatch(main, /new Audio\s*\(/);
  assert.doesNotMatch(main, /assets\/audio/);
  assert.match(main, /oscillator\.type = 'triangle'/);
  assert.match(main, /filter\.type = 'lowpass'/);
  assert.match(main, /\[392, 0\.15, 0\.16, 0\.016\]/);
});

test('no-WebGL mode is guarded before scene groups are dereferenced', () => {
  const setModeStart = world.indexOf('setMode(mode, immediate = false)');
  const guard = world.indexOf('if (!this.camera || !this.terminalGroup', setModeStart);
  const dereference = world.indexOf("this.terminalGroup.visible = mode === 'terminal'", setModeStart);
  assert.ok(setModeStart > 0);
  assert.ok(guard > setModeStart);
  assert.ok(dereference > guard);
  assert.match(main, /Every shift remains playable with the controls below|complete shift remains playable below/i);
});

test('all required world actions retain large HTML alternatives', () => {
  for (const action of [
    'inspect-express',
    'move-staff',
    'inspect-scanner',
    'inspect-depot',
    'allocate-truck',
    'choose-route',
    'prioritize',
    'repair-scanner',
    'inspect-case',
    'choose-location',
    'choose-recovery',
    'dispatch'
  ]) {
    assert.match(main, new RegExp(`data-action=\\"${action}\\"`), action);
  }
});

test('portrait command deck has compact and expanded layouts', () => {
  assert.match(styles, /\.command-content\[data-layout="wide"\]/);
  assert.match(styles, /@media \(max-height: 700px\)[\s\S]*\.command-content\[data-layout="wide"\]/);
  assert.match(styles, /\.choice-grid--three/);
  assert.match(styles, /\.parcel-priority-grid/);
});
