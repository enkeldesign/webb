import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  HOW_TO_PLAY_REWARD_IDS,
  rewardBatchNeedsHowToPlay
} from '../turn/achievements/reward-toast-guide.js';

const [view, replay, css, workflow] = await Promise.all([
  fs.readFile(new URL('../turn/achievements/view.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/achievements/home-reward-replay-r225.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/progression/trophy-road.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../.github/workflows/turn-lab-tests.yml', import.meta.url), 'utf8')
]);

assert.deepEqual(
  HOW_TO_PLAY_REWARD_IDS,
  ['drift-attack', 'shift', 'flow'],
  'Only the three systems that need an introduction should point to How to Play'
);
assert.equal(rewardBatchNeedsHowToPlay([{ id: 'paintjob' }, { id: 'shift' }]), true);
assert.equal(rewardBatchNeedsHowToPlay([{ id: 'paintjob' }, { id: 'mountain' }]), false);

assert.match(view, /document\.createElement\(actionTitle \? 'button' : 'div'\)/,
  'Interactive reward feedback must use a native button without changing ordinary status toasts');
assert.match(view, /\{ actionTitle: 'Open Achievements', showGuide: true \}/);
assert.match(view, /rewardToast\.addEventListener\('click', openRewardToast\)/);
assert.match(
  view,
  /function openRewardToast\(\) \{[\s\S]*?hideRewardToast\(\);[\s\S]*?open\(raceTrigger\.hidden === false \? raceTrigger : homeTrigger\);[\s\S]*?\}/,
  'Activating the reward toast must conceal it and open Achievements from either game state'
);
assert.match(view, /data-trophy-reward-guide hidden><mark>HOW TO PLAY<\/mark><span>FOR INSTRUCTIONS<\/span>/,
  'The instructions destination must be visible text rather than an aria-only hint');
assert.match(view, /rewardBatchNeedsHowToPlay\(batch\)/);
assert.match(view, /See How to Play for instructions\.[^`]*Open Achievements\./,
  'The live announcement must include both the guidance and toast action');

assert.match(replay, /rewardBatchNeedsHowToPlay\(rewards\)/,
  'Home reward replay must preserve the same conditional guide');
assert.match(replay, /querySelector\('\[data-trophy-reward-guide\]'\)/);
assert.match(replay, /See How to Play for instructions\.[^`]*Open Achievements\./);

assert.match(css, /\.turn-trophy-reward-toast \{[\s\S]*?pointer-events: auto;[\s\S]*?touch-action: manipulation;/,
  'The full reward toast is a touch-friendly activation target');
assert.match(css, /\.turn-trophy-reward-toast:focus-visible/,
  'Keyboard activation retains an obvious TURN focus treatment');
assert.match(css, /\.turn-trophy-reward-guide mark \{[\s\S]*?background: var\(--turn-action-information/,
  'HOW TO PLAY is visually highlighted inside the unlock message');
assert.match(workflow, /node turn-tests\/trophy-road-reward-toast-production\.mjs/);

console.log('TURN Trophy Road clickable reward toast and How to Play guidance regression passed.');
