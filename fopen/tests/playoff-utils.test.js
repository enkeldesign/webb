const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { resolveSeedToTeam, collectSpecialPlayoffFormats } = require('../logic/playoff-utils.js');

const ruleset = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'ruleset.json'), 'utf8')
);

function byParticipants(count) {
  return ruleset.formats.find((format) => format.participants === count);
}

function mkGroup(label, pointsByRank) {
  return pointsByRank.map((points, idx) => ({
    team: `${label}_T${idx + 1}`,
    points,
    goalsFor: 10 - idx,
    goalsAgainst: idx,
    fairPlay: idx
  }));
}

test('statisk inventering flaggar format med fromBestOf och groupPlayoffs', () => {
  const flagged = collectSpecialPlayoffFormats(ruleset);
  assert.deepEqual(flagged.map((item) => item.participants), [12, 13, 15, 21]);
  assert.equal(flagged.find((item) => item.participants === 21).hasGroupPlayoffs, true);
});

test('12 lag: W3_* resolvas till faktiska lag', () => {
  const format = byParticipants(12);
  const rankedStatsByGroup = {
    A: mkGroup('A', [8, 6, 5, 1]),
    B: mkGroup('B', [7, 5, 4, 1]),
    C: mkGroup('C', [9, 4, 3, 1])
  };

  const w3_1 = resolveSeedToTeam('W3_1', format.playoffs.seeds, rankedStatsByGroup);
  const w3_2 = resolveSeedToTeam('W3_2', format.playoffs.seeds, rankedStatsByGroup);

  assert.equal(w3_1, 'A_T3');
  assert.equal(w3_2, 'B_T3');
});

test('13 lag: W3_BC resolvas till bästa trean mellan B/C', () => {
  const format = byParticipants(13);
  const rankedStatsByGroup = {
    A: mkGroup('A', [9, 5, 1, 0, 0]),
    B: mkGroup('B', [7, 4, 6, 2]),
    C: mkGroup('C', [8, 5, 3, 1])
  };

  const seed = resolveSeedToTeam('W3_BC', format.playoffs.seeds, rankedStatsByGroup);
  assert.equal(seed, 'B_T3');
});

test('15 lag: W3_1 och W3_2 resolvas konsekvent', () => {
  const format = byParticipants(15);
  const rankedStatsByGroup = {
    A: mkGroup('A', [8, 7, 5, 1, 0]),
    B: mkGroup('B', [9, 6, 4, 1, 0]),
    C: mkGroup('C', [7, 6, 3, 2, 0])
  };

  const first = resolveSeedToTeam('W3_1', format.playoffs.seeds, rankedStatsByGroup);
  const second = resolveSeedToTeam('W3_2', format.playoffs.seeds, rankedStatsByGroup);

  assert.equal(first, 'A_T3');
  assert.equal(second, 'B_T3');
});

test('21 lag: X3_* finns för groupPlayoffs-flödet i ruleset', () => {
  const format = byParticipants(21);
  assert.ok(format.playoffs.groupPlayoffs?.length > 0);
  assert.ok(format.playoffs.seeds.X3_1?.fromBestOf);
  assert.ok(format.playoffs.seeds.X3_2?.fromBestOf);
});
