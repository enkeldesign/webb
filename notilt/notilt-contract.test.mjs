import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, css, app, input] = await Promise.all([
  readFile(new URL('./index.html', import.meta.url), 'utf8'),
  readFile(new URL('./styles.css', import.meta.url), 'utf8'),
  readFile(new URL('./app.mjs', import.meta.url), 'utf8'),
  readFile(new URL('./input.mjs', import.meta.url), 'utf8')
]);

test('NO TILT is explicitly portrait-first', () => {
  assert.match(html, /ROTATE BACK TO PORTRAIT/);
  assert.match(css, /@media \(orientation: landscape\)/);
  assert.match(css, /\.orientation-guard \{ display: grid; \}/);
  assert.match(app, /pauseRun\(true\)/);
  assert.match(app, /PORTRAIT · RECENTERED/);
});

test('all modes and both input paths are present in the start experience', () => {
  assert.match(html, /value="easy"/);
  assert.match(html, /value="medium"/);
  assert.match(html, /value="hard"/);
  assert.match(html, /PLAY WITH TILT/);
  assert.match(html, /TOUCH MODE/);
  assert.match(html, /LIFT PHONE OR TAP/);
});

test('motion permission, gravity pose and physical lift detection are implemented', () => {
  assert.match(input, /requestPermission/);
  assert.match(input, /accelerationIncludingGravity/);
  assert.match(input, /verticalImpulse/);
  assert.match(input, /queueJump\('lift'\)/);
  assert.match(input, /screenSpaceVector/);
});

test('the visual runtime uses the same Three.js version as TURN', () => {
  assert.match(html, /three@0\.184\.0\/build\/three\.module\.js/);
  assert.match(html, /type="importmap"/);
  assert.match(app, /from '\.\/game-view\.mjs'/);
});

test('screen-reader, reduced-motion and high-contrast affordances are included', () => {
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /role="progressbar"/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /prefers-contrast: more/);
});

test('best attempts are recorded for a later YOUR TURN layer', () => {
  assert.match(app, /notilt\.best-runs\.v1/);
  assert.match(app, /RECORD_INTERVAL_SECONDS = 1 \/ 15/);
  assert.match(app, /createRunSnapshot/);
  assert.match(html, /future YOUR TURN challenge mode/);
});
