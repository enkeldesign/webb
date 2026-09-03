import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const feedback = await fs.readFile(
  new URL('../turn/achievements/trophy-road-feedback.js', import.meta.url),
  'utf8'
);

assert.match(feedback, /function renderedSelection\(\)/,
  'The enhanced Trophy Road must adopt the reward selected by the canonical view');
assert.match(feedback, /syncRenderedSelection: \(\) => preserveUserSelection\(\{ adoptRendered: true \}\)/,
  'Opening Achievements must preserve the already rendered first reward card');
assert.doesNotMatch(feedback, /homeTrigger\?\.addEventListener\('click', resetView\)/,
  'The Home trigger must not clear the detail card after the canonical view opens it');
assert.doesNotMatch(feedback, /raceTrigger\?\.addEventListener\('click', resetView\)/,
  'The race trigger must not clear the detail card after the canonical view opens it');
assert.match(feedback, /queueMicrotask\(\(\) => \{[\s\S]*preserveUserSelection\(\{ adoptRendered \}\)/,
  'Reward synchronization must run after the canonical click renderer has replaced the card DOM');
assert.match(feedback, /if \(reward\.type === 'track' \|\| reward\.type === 'feature' \|\| reward\.type === 'vehicle-perk'\) \{[\s\S]*showcase\.clear\(\);[\s\S]*restoreStaticRewardIcon\(reward, host\)/,
  'Switching from a 3D reward to any line-art feature or perk must restore the SVG after clearing WebGL');
assert.match(feedback, /host\.innerHTML = icon/,
  'The selected line-art reward must be rehydrated even if the previous canvas removed its contents');

console.log('TURN Trophy Road first-card and 3D-to-line-art reward transitions passed.');
