import fs from 'node:fs';

const releasePath = 'turn/release.json';
const historyPath = 'turn/content/about-history-current.js';

const release = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
if (release.version !== '1.20.2' || release.id !== '2026.09.14-r234' || release.cacheKey !== '20260914-r234') {
  fs.writeFileSync(releasePath, `${JSON.stringify({
    version: '1.20.2',
    id: '2026.09.14-r234',
    cacheKey: '20260914-r234'
  }, null, 2)}\n`);
}

let history = fs.readFileSync(historyPath, 'utf8');
if (!history.includes('SUPPORT_CHALLENGE_LIFECYCLE_HISTORY')) {
  const block = `const SUPPORT_CHALLENGE_LIFECYCLE_HISTORY = Object.freeze({
  period: '14 September',
  title: 'Support feedback has one owner',
  paragraphs: Object.freeze([
    'TURN 1.20.2 makes support-challenge feedback use explicit game and Home lifecycle events instead of observing and rewriting other toast elements. SAFETY and other race challenges now publish their compact completion pill directly when the support target is cleared.',
    'When CHOOSE TRACK opens after a completed challenge, TURN replays the pill with the temporary trophy check first. Trophy Road reward presentation is held by the achievement runtime until that support feedback finishes, then resumes in the normal reward queue.'
  ]),
  milestones: Object.freeze([
    'Reliable in-race support completion pill for SAFETY and other race challenges',
    'Explicit CHOOSE TRACK replay lifecycle with ordered Trophy Road rewards',
    'TURN 1.20.2 · 2026.09.14-r234'
  ])
});

`;
  const marker = 'const previousLatest = BASE_CHANGELOG.at(-1);';
  if (!history.includes(marker)) throw new Error('Could not find current history insertion point.');
  history = history.replace(marker, `${block}${marker}`);

  const developmentTail = `  SUPPORT_CHALLENGE_HISTORY,\n  SUPPORT_CHALLENGE_FEEDBACK_HISTORY\n]);`;
  if (!history.includes(developmentTail)) throw new Error('Could not find current development history tail.');
  history = history.replace(
    developmentTail,
    `  SUPPORT_CHALLENGE_HISTORY,\n  SUPPORT_CHALLENGE_FEEDBACK_HISTORY,\n  SUPPORT_CHALLENGE_LIFECYCLE_HISTORY\n]);`
  );

  const changelogTail = `      Object.freeze(['1.20.1 r233', 'Makes START CHALLENGE preselect both the recommended track and owned car, and replaces the large challenge completion block with the compact pill cue.']),\n      Object.freeze(['Ordered support feedback', 'Shows challenge and same-lap achievement feedback together, then gives Trophy Road rewards their own turn; CHOOSE TRACK replays the challenge cue while its trophy notification pulses away.'])`;
  if (!history.includes(changelogTail)) throw new Error('Could not find current support changelog tail.');
  history = history.replace(
    changelogTail,
    `${changelogTail},\n      Object.freeze(['1.20.2 r234', 'Makes race support completion and CHOOSE TRACK reprise reliable by replacing toast DOM interception with explicit lifecycle events.']),\n      Object.freeze(['One feedback queue', 'Lets support feedback temporarily hold Trophy Road reward presentation, then returns control to the normal achievement reward queue after the pill and trophy check finish.'])`
  );

  history = history.replace(
    `  version: '1.20.1',\n  build: '2026.09.14-r233',\n  note: 'TURN 1.20.1 polishes support challenge routing and completion feedback.'`,
    `  version: '1.20.2',\n  build: '2026.09.14-r234',\n  note: 'TURN 1.20.2 makes support challenge completion and reward feedback reliable.'`
  );

  fs.writeFileSync(historyPath, history);
}

console.log('TURN 1.20.2 / 2026.09.14-r234 release metadata prepared.');
