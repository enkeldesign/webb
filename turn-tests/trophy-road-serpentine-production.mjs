import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  TROPHY_ROAD_REWARDS,
  getTrophyRoadReward
} from '../turn/progression/trophy-road.js';
import {
  TROPHY_ROAD_RESPONSIVE_LAYOUTS,
  trophyRoadVisualLayout,
  trophyRoadVisualSlot
} from '../turn/achievements/view.js';

const [viewSource, roadStyles, semanticStyles, bend, straight, checkered] = await Promise.all([
  fs.readFile(new URL('../turn/achievements/view.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/progression/trophy-road.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/progression/trophy-road-r157.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/assets/trophy-road/road-sand-bend.png', import.meta.url)),
  fs.readFile(new URL('../turn/assets/trophy-road/road-sand-straight.png', import.meta.url)),
  fs.readFile(new URL('../turn/assets/trophy-road/road-sand-checkered.png', import.meta.url))
]);

const expectedRoad = [
  ['paintjob', 400],
  ['awd-traction', 500],
  ['drift-attack', 600],
  ['midnight-city', 700],
  ['truck-torque', 800],
  ['vintage-racer', 900],
  ['shift', 1000],
  ['race-car', 1100],
  ['emergency-pack', 1200],
  ['mountain', 1300],
  ['van-carry-on', 1400],
  ['flow', 1500],
  ['future-racer', 1600],
  ['suv-full-tank', 1700],
  ['monster', 1800],
  ['sedan-double-shift', 1900],
  ['rally-racer', 2000],
  ['sports-car-drift-demon', 2100],
  ['learner-graduated', 2200]
];

assert.deepEqual(
  TROPHY_ROAD_REWARDS.map(({ id, threshold }) => [id, threshold]),
  expectedRoad,
  'The visual road must preserve the current Trophy Road order and thresholds'
);
assert.equal(TROPHY_ROAD_REWARDS.length, 19);
assert.equal(getTrophyRoadReward('?'), null, 'A future teaser must never become a reward entitlement');

assert.deepEqual(
  TROPHY_ROAD_RESPONSIVE_LAYOUTS.map(({ name, rewardsPerRow }) => [name, rewardsPerRow]),
  [['narrow', 3], ['medium', 5], ['wide', 7]],
  'Available width must select the authoritative 3 / 5 / 7 reward compositions'
);

const expectedCurrentLayouts = new Map([
  [3, {
    rowCount: 7,
    finish: [7, 3],
    slots: [
      [1, 2], [1, 3], [1, 4],
      [2, 4], [2, 3], [2, 2],
      [3, 2], [3, 3], [3, 4],
      [4, 4], [4, 3], [4, 2],
      [5, 2], [5, 3], [5, 4],
      [6, 4], [6, 3], [6, 2],
      [7, 2]
    ]
  }],
  [5, {
    rowCount: 4,
    finish: [4, 2],
    slots: [
      [1, 2], [1, 3], [1, 4], [1, 5], [1, 6],
      [2, 6], [2, 5], [2, 4], [2, 3], [2, 2],
      [3, 2], [3, 3], [3, 4], [3, 5], [3, 6],
      [4, 6], [4, 5], [4, 4], [4, 3]
    ]
  }],
  [7, {
    rowCount: 3,
    finish: [3, 7],
    slots: [
      [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7], [1, 8],
      [2, 8], [2, 7], [2, 6], [2, 5], [2, 4], [2, 3], [2, 2],
      [3, 2], [3, 3], [3, 4], [3, 5], [3, 6]
    ]
  }]
]);

for (const { rewardsPerRow } of TROPHY_ROAD_RESPONSIVE_LAYOUTS) {
  const layout = trophyRoadVisualLayout(TROPHY_ROAD_REWARDS.length, rewardsPerRow);
  const expected = expectedCurrentLayouts.get(rewardsPerRow);
  assert.equal(layout.rowCount, expected.rowCount);
  assert.equal(layout.columnCount, rewardsPerRow + 2);
  assert.deepEqual(layout.start, { row: 1, column: 1 });
  assert.deepEqual([layout.finish.row, layout.finish.column], expected.finish);
  assert.deepEqual(
    layout.rewardSlots.map(({ row, column }) => [row, column]),
    expected.slots,
    `${rewardsPerRow}-per-row rewards must follow the authoritative responsive mockup`
  );
  assert.deepEqual(layout.rewardSlots[0], { row: 1, column: 2 },
    'START must be immediately before reward 1');
  const lastReward = layout.rewardSlots.at(-1);
  assert.equal(layout.finish.row, lastReward.row);
  assert.equal(Math.abs(layout.finish.column - lastReward.column), 1,
    'FINISH must be immediately after the final real reward');
  assert.equal(layout.bends.length, (layout.rowCount - 1) * 2,
    'Every row transition needs a two-piece Kenney bend');
}

for (const rewardsPerRow of [3, 5, 7]) {
  for (const rewardCount of [0, 1, rewardsPerRow, rewardsPerRow + 1, 19, 20, 27, 41]) {
    const layout = trophyRoadVisualLayout(rewardCount, rewardsPerRow);
    assert.equal(layout.rewardSlots.length, rewardCount);
    assert.equal(layout.rowCount, Math.max(1, Math.ceil(rewardCount / rewardsPerRow)));
    const occupied = new Set();
    const occupy = ({ row, column }, label) => {
      assert.ok(row >= 1 && row <= layout.rowCount, `${label} row must remain on the generated road`);
      assert.ok(column >= 1 && column <= layout.columnCount, `${label} column must remain on the generated road`);
      const key = `${row}:${column}`;
      assert.equal(occupied.has(key), false, `${label} must not collide with another road piece at ${key}`);
      occupied.add(key);
    };
    occupy(layout.start, 'START');
    layout.rewardSlots.forEach((slot, index) => occupy(slot, `reward ${index + 1}`));
    layout.bends.forEach((slot, index) => occupy(slot, `bend ${index + 1}`));
    occupy(layout.finish, 'FINISH');
    const finalPathCell = rewardCount > 0 ? layout.rewardSlots.at(-1) : layout.start;
    assert.equal(layout.finish.row, finalPathCell.row);
    assert.equal(Math.abs(layout.finish.column - finalPathCell.column), 1,
      `FINISH must follow the final path cell for ${rewardCount} rewards`);
  }
}

assert.deepEqual(trophyRoadVisualSlot(4, 3), { row: 2, column: 4 });
assert.deepEqual(trophyRoadVisualSlot(8, 7), { row: 2, column: 8 });

assert.match(viewSource, /TROPHY_ROAD_REWARDS\.map\(\(reward, index\) =>/,
  'Reward controls must be emitted once in canonical progression order');
assert.match(viewSource, /data-trophy-road-step="\$\{step\}"/,
  'Every real reward needs a stable visual step hook');
assert.match(viewSource, /<ol class="turn-trophy-road-markers"[^>]+aria-describedby="turnTrophyRoadSequence"/,
  'The semantic ordered list must remain the only reward-control container');
assert.match(viewSource, /class="turn-trophy-road-scenery is-\$\{name\}"[\s\S]*aria-hidden="true"/,
  'All road bends and visual landmarks must be excluded from the accessibility tree');
assert.match(viewSource, /is-start[^>]*>[\s\S]*START/);
assert.match(viewSource, /is-finish[^>]*>[\s\S]*FINISH/);
assert.doesNotMatch(viewSource, /is-future|<b>\?<\/b>|BEYOND|future reward/,
  'The shipped road must not contain a future teaser tile');
assert.match(viewSource, /The road runs from START through every reward in progression order to FINISH\./,
  'Assistive technology must receive the actual path without decorative focus stops');
assert.match(viewSource, /aria-label="\$\{reward\.shortTitle\}\. \$\{reward\.threshold\} trophies\. \$\{stateLabel\}\."/,
  'Existing reward names and textual earned/current/locked state must remain intact');
assert.match(viewSource, /aria-pressed="\$\{selected\}"/,
  'Current detail selection must remain programmatically exposed');
assert.match(viewSource, /openTrophyRoadDetail\(\)/,
  'Selecting a reward must open its anchored detail modal');

assert.match(roadStyles, /container: turn-trophy-road \/ inline-size/,
  'The road must respond to its actual available component width');
assert.match(roadStyles, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/,
  'Narrow layout must reserve START/bend edges around three reward columns');
assert.match(roadStyles, /@container turn-trophy-road \(min-width: 560px\)[\s\S]*grid-template-columns: repeat\(7, minmax\(0, 1fr\)\)/,
  'Medium layout must reserve edges around five reward columns');
assert.match(roadStyles, /@container turn-trophy-road \(min-width: 820px\)[\s\S]*grid-template-columns: repeat\(9, minmax\(0, 1fr\)\)/,
  'Wide layout must reserve edges around seven reward columns');
assert.match(roadStyles, /grid-row: var\(--turn-road-narrow-row\)/);
assert.match(roadStyles, /grid-row: var\(--turn-road-medium-row\)/);
assert.match(roadStyles, /grid-row: var\(--turn-road-wide-row\)/);
assert.match(roadStyles, /road-sand-bend\.png/);
assert.match(roadStyles, /road-sand-straight\.png/);
assert.match(roadStyles, /road-sand-checkered\.png/);
assert.doesNotMatch(roadStyles, /overflow-x:\s*auto/,
  'Responsive redistribution must not require horizontal panning');
assert.doesNotMatch(roadStyles, /minmax\(64px, \.76fr\) repeat\(5/,
  'Low-height landscape must not replace the active 3 / 5 / 7-column composition');
assert.doesNotMatch(roadStyles, /min-width:\s*540px/,
  'Low-height landscape must remain width-responsive without forced horizontal overflow');
assert.doesNotMatch(roadStyles, /animation(?:-name)?:/,
  'The static road must not add a continuous presentation animation');

for (const asset of [bend, straight, checkered]) {
  assert.equal(asset.subarray(1, 4).toString('ascii'), 'PNG');
  assert.equal(asset.readUInt32BE(16), 128);
  assert.equal(asset.readUInt32BE(20), 128);
}

for (const type of ['vehicle', 'track', 'feature', 'scoring-system']) {
  assert.match(semanticStyles, new RegExp(`data-trophy-reward-type="${type}"`),
    `The ${type} category colour contract must remain in place`);
}
assert.match(semanticStyles, /\.turn-trophy-road-detail[\s\S]*data-trophy-reward-state="locked"/,
  'The modal paper must derive its category/state colour directly from its rendered reward data');
assert.doesNotMatch(semanticStyles, /:has\([^)]*is-selected/,
  'Reward-modal colour must not require relational marker matching');

console.log('TURN Trophy Road responsive serpentine layout, accessibility and immutable progression regression passed.');
