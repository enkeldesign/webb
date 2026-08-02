import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const design = await fs.readFile(new URL('../turn/design.html', import.meta.url), 'utf8');

assert.match(design, /^<!doctype html>/i);
assert.match(design, /<html lang="en">/);
assert.match(design, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
assert.doesNotMatch(design, /user-scalable=no/);
assert.doesNotMatch(design, /<script\b/i, 'The reference page should remain static and dependency-free');
assert.doesNotMatch(design, /https?:\/\/(?!enkel\.design)/i, 'The specimen must not depend on third-party assets');
assert.match(design, /src="\.\/TURNicon\.PNG"/);

for (const token of [
  '--turn-ink',
  '--turn-paper',
  '--turn-yellow-600',
  '--turn-yellow-400',
  '--turn-blue-500',
  '--turn-blue-300',
  '--turn-pink-500',
  '--turn-red-500',
  '--turn-green-500',
  '--turn-orange-500',
  '--turn-action-primary',
  '--turn-action-information',
  '--turn-action-success',
  '--turn-action-warning',
  '--turn-action-danger',
  '--turn-action-exit',
  '--turn-border-micro',
  '--turn-border-compact',
  '--turn-border-default',
  '--turn-border-heavy',
  '--turn-radius-micro',
  '--turn-radius-compact',
  '--turn-radius-default',
  '--turn-radius-hero',
  '--turn-radius-pill',
  '--turn-radius-circle',
  '--turn-shadow-compact',
  '--turn-shadow-default',
  '--turn-shadow-hero'
]) {
  assert.match(design, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

assert.match(design, /2, 3, 7, 8, 10, 12, 13, 14, 15, 16, 17, 18, 20, 21, 22, 24, 26, 28 and 30px/);
assert.match(design, /1\.5, 2, 3, 4, 5 and 6px/);
assert.match(design, /#ff4fa3, #ff7ab7, #ff8caf, #ff8fab/);
assert.match(design, /#38d9ff, #68c8f2, #8ed8ff/);
assert.match(design, /50% only on equal-width\/equal-height controls and indicators/);
assert.match(design, /Keep the candy shop\. Label every jar\./);

for (const section of ['audit', 'colour', 'shape', 'components', 'screens', 'migration']) {
  assert.match(design, new RegExp(`id="${section}"`));
  assert.match(design, new RegExp(`href="#${section}"`));
}

for (const page of [
  'TURN install page design specimen',
  'TURN Home and track-selection design specimen',
  'TURN The Lot design specimen',
  'TURN race HUD and control design specimen',
  'TURN How to Play dialog design specimen'
]) {
  assert.match(design, new RegExp(page));
}

assert.match(design, /class="skip-link" href="#main"/);
assert.match(design, /aria-label="Design system sections"/);
assert.match(design, /a:focus-visible/);
assert.match(design, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(design, /Reference page only\. Production UI is unchanged\./);
assert.match(design, /Introduce one shared token file/);
assert.match(design, /Alias existing variables/);
assert.match(design, /Remove orphan values only after parity review/);

console.log('TURN design-system audit, normative tokens and five page specimens passed.');
