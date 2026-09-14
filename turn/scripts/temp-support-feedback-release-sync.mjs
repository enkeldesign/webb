import fs from 'node:fs';

const path = new URL('../content/about-history-current.js', import.meta.url);
let source = fs.readFileSync(path, 'utf8');

if (!source.includes('SUPPORT_CHALLENGE_FEEDBACK_HISTORY')) {
  const history = `const SUPPORT_CHALLENGE_FEEDBACK_HISTORY = Object.freeze({
  period: '14 September',
  title: 'Support challenges hand off cleanly',
  paragraphs: Object.freeze([
    'TURN 1.20.1 makes START CHALLENGE carry both parts of the recommendation into play: it selects the challenge track and preselects the recommended owned car in The Lot.',
    'Challenge completion now uses the compact pill cue in-race and replays it on CHOOSE TRACK while the trophy notification pulses away. When the same lap also unlocks an achievement and Trophy Road reward, challenge and achievement feedback share the first beat and the reward waits for the next one.'
  ]),
  milestones: Object.freeze([
    'Recommended challenge car preselected in The Lot',
    'Compact challenge pill and ordered challenge, achievement and reward feedback',
    'TURN 1.20.1 · 2026.09.14-r233'
  ])
});

`;

  source = source.replace(
    'const previousLatest = BASE_CHANGELOG.at(-1);',
    `${history}const previousLatest = BASE_CHANGELOG.at(-1);`
  );
  source = source.replace(
    '  OVERCHARGED_BOOST_HISTORY,\n  SUPPORT_CHALLENGE_HISTORY\n]);',
    '  OVERCHARGED_BOOST_HISTORY,\n  SUPPORT_CHALLENGE_HISTORY,\n  SUPPORT_CHALLENGE_FEEDBACK_HISTORY\n]);'
  );
  source = source.replace(
    "      Object.freeze(['Progress without guesswork', 'Recommends an owned car, explains that a clean lap stays on-road from start to finish, awards 5 trophies for each previously unread HOW TO PLAY part, and offers a reroll after continued attempts.'])",
    "      Object.freeze(['Progress without guesswork', 'Recommends an owned car, explains that a clean lap stays on-road from start to finish, awards 5 trophies for each previously unread HOW TO PLAY part, and offers a reroll after continued attempts.']),\n      Object.freeze(['1.20.1 r233', 'Makes START CHALLENGE preselect both the recommended track and owned car, and replaces the large challenge completion block with the compact pill cue.']),\n      Object.freeze(['Ordered support feedback', 'Shows challenge and same-lap achievement feedback together, then gives Trophy Road rewards their own turn; CHOOSE TRACK replays the challenge cue while its trophy notification pulses away.'])"
  );
  source = source.replace(
    "  note: 'TURN 1.20.0 adds adaptive Trophy Road support challenges for stalled progress.'",
    "  note: 'TURN 1.20.1 polishes support challenge routing and completion feedback.'"
  );
  fs.writeFileSync(path, source);
}
