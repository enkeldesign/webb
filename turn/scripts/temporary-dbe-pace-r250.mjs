import fs from 'node:fs/promises';

async function read(path) {
  return fs.readFile(path, 'utf8');
}

async function write(path, content) {
  await fs.writeFile(path, content);
}

function replaceOnce(source, from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`Duplicate ${label}`);
  return source.slice(0, first) + to + source.slice(first + from.length);
}

let stages = await read('turn/training/stages.js');
stages = replaceOnce(stages,
  'notes: [note(0.10, RIGHT, 1), note(0.49, LEFT, 2)]',
  'notes: [note(0.19, RIGHT, 1), note(0.55, LEFT, 2)]',
  'Part 2 pace notes');
stages = replaceOnce(stages,
  'notes: [note(0.17, RIGHT, 1)]',
  'notes: [note(0.27, RIGHT, 1)]',
  'Part 3 pace note');
stages = replaceOnce(stages,
  'notes: [note(0.16, LEFT, 3, true)]',
  'notes: [note(0.27, LEFT, 3, true)]',
  'Part 4 pace note');
stages = replaceOnce(stages,
  'notes: [note(0.08, RIGHT, 1), note(0.43, RIGHT, 2), note(0.43, LEFT, 2, true)]',
  'notes: [note(0.15, RIGHT, 1), note(0.45, RIGHT, 2), note(0.45, LEFT, 2, true)]',
  'Part 5 pace notes');
await write('turn/training/stages.js', stages);

let tests = await read('turn-tests/drive-by-ear-training-production.mjs');
tests = replaceOnce(tests,
  "assert.ok(part2.notes[0].progress <= 0.10, 'The first Part 2 BIP must play on the long straight');\nassert.ok(part2.notes[1].progress <= 0.49, 'The second Part 2 cue must play before its curve');",
  "assert.equal(part2.notes[0].progress, 0.19, 'The first Part 2 BIP must stay on the straight but sit closer to the gentle right');\nassert.equal(part2.notes[1].progress, 0.55, 'The second Part 2 cue must sit closer to its broader left');",
  'Part 2 timing assertions');
tests = replaceOnce(tests,
  "assert.ok(part3.notes[0].progress <= 0.17, 'Part 3 BIP must play well before the gentle right');",
  "assert.equal(part3.notes[0].progress, 0.27, 'Part 3 BIP must play on the final straight approach to the gentle right');",
  'Part 3 timing assertion');
tests = replaceOnce(tests,
  'assert.match(part4.lead, /BIP BIP BEEP/);',
  "assert.equal(part4.notes[0].progress, 0.27, 'Part 4 phrase must play closer to the long tight left at SMV practice speed');\nassert.match(part4.lead, /BIP BIP BEEP/);",
  'Part 4 timing assertion');
tests = replaceOnce(tests,
  "assert.equal(\n  part5.notes[1].progress,\n  part5.notes[2].progress,",
  "assert.deepEqual(\n  part5.notes.map(({ progress }) => progress),\n  [0.15, 0.45, 0.45],\n  'Part 5 pace notes must sit close to their curve entries at SMV practice speed'\n);\nassert.equal(\n  part5.notes[1].progress,\n  part5.notes[2].progress,",
  'Part 5 timing assertion');
await write('turn-tests/drive-by-ear-training-production.mjs', tests);

let history = await read('turn/content/about-history-current.js');
const historyBlock = `const DBE_SMV_PACE_TIMING_HISTORY = Object.freeze({
  period: '16 September',
  title: 'DRIVE BY EAR 101 brings pace notes closer',
  paragraphs: Object.freeze([
    'TURN 1.21.0 build r250 moves the authored DRIVE BY EAR 101 pace notes closer to their curve entries for the slow-moving vehicle’s lower practice speeds. The cue still arrives before the steering action, but the learner no longer waits through a long straight after hearing it.',
    'The final linked right–left phrase remains one sequence, preserving BIP BIP right followed by BIP BEEP left while bringing the whole phrase closer to the paired curves.'
  ]),
  milestones: Object.freeze([
    'Later cues in all four pace-note training parts',
    'Linked right–left phrase remains one sequence',
    'TURN 1.21.0 · 2026.09.16-r250'
  ])
});

`;
history = replaceOnce(history,
  'const FACTORY_SECONDARY_PAINT_HISTORY = Object.freeze({',
  `${historyBlock}const FACTORY_SECONDARY_PAINT_HISTORY = Object.freeze({`,
  'pace timing history insertion');
history = replaceOnce(history,
  '  TRACTOR_RELEASE_CLEANUP_HISTORY,\n  DBE_SMV_TRAINING_HISTORY\n]);',
  '  TRACTOR_RELEASE_CLEANUP_HISTORY,\n  DBE_SMV_TRAINING_HISTORY,\n  DBE_SMV_PACE_TIMING_HISTORY\n]);',
  'pace timing history list');
history = replaceOnce(history,
  "    Object.freeze(['DBE 101 vehicle', 'Uses the temporary vehicle’s factory paint, restores the player’s selection on exit, and routes legacy training imports to the current build.'])",
  "    Object.freeze(['DBE 101 vehicle', 'Uses the temporary vehicle’s factory paint, restores the player’s selection on exit, and routes legacy training imports to the current build.']),\n    Object.freeze(['1.21.0 r250', 'Moves DRIVE BY EAR 101 pace notes closer to their curves for the slow-moving vehicle’s lower practice speeds.']),\n    Object.freeze(['Closer pace-note timing', 'Keeps each cue on the approach while reducing the wait between hearing the BIPs and reaching the turn.'])",
  'pace timing changelog');
history = replaceOnce(history,
  "build: '2026.09.16-r249'",
  "build: '2026.09.16-r250'",
  'current release build');
await write('turn/content/about-history-current.js', history);

const release = JSON.parse(await read('turn/release.json'));
const expected = JSON.stringify({ version: '1.21.0', id: '2026.09.16-r249', cacheKey: '20260916-r249' });
if (JSON.stringify(release) !== expected) throw new Error(`Unexpected release baseline: ${JSON.stringify(release)}`);
release.id = '2026.09.16-r250';
release.cacheKey = '20260916-r250';
await write('turn/release.json', `${JSON.stringify(release, null, 2)}\n`);

console.log('Prepared DBE 101 pace-note retiming for r250.');
