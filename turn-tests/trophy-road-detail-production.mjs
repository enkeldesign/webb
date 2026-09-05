import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const feedback = await fs.readFile(
  new URL('../turn/achievements/trophy-road-feedback.js', import.meta.url),
  'utf8'
);

assert.match(feedback, /function renderedSelection\(\)/,
  'The enhanced Trophy Road must adopt the reward selected by the canonical view');
assert.match(feedback, /trophy-road-showcase\.js\?revision=r240-trophy-road-2/,
  'The reward preview must use the current vehicle catalog through a fresh module identity');
assert.match(feedback, /syncRenderedSelection: \(\) => preserveUserSelection\(\{ adoptRendered: true \}\)/,
  'Opening Achievements must preserve the already rendered first reward card');
assert.doesNotMatch(feedback, /homeTrigger\?\.addEventListener\('click', resetView\)/,
  'The Home trigger must not clear the detail card after the canonical view opens it');
assert.doesNotMatch(feedback, /raceTrigger\?\.addEventListener\('click', resetView\)/,
  'The race trigger must not clear the detail card after the canonical view opens it');
assert.match(feedback, /queueMicrotask\(\(\) => \{[\s\S]*preserveUserSelection\(\{ adoptRendered \}\)/,
  'Reward synchronization must run after the canonical click renderer has replaced the card DOM');
assert.match(feedback, /if \(reward\.type !== 'vehicle' && reward\.type !== 'vehicle-pack'\) \{[\s\S]*showcase\.clear\(\);[\s\S]*restoreStaticRewardIcon\(reward, host\)/,
  'Only vehicle rewards may start WebGL; tracks, features, perks and scoring systems restore static artwork');
assert.match(feedback, /host\.innerHTML = icon/,
  'The selected line-art reward must be rehydrated even if the previous canvas removed its contents');
assert.doesNotMatch(feedback, /requestAnimationFrame|scrollLeft|scrollBy|scrollWidth|clientWidth/,
  'The complete road grid must not retain carousel geometry or an animation-frame layout path');

console.log('TURN Trophy Road 2 selection, static artwork and no-carousel transitions passed.');
