import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

// SWOOSH listening test (#909, #928): SOL's protocol — three blind versions, 24 trials
// each (2 sides × 3 anchors × 4), scored for side, tightness and comfort — and the
// candidate sounds: full-side pan, one changed dimension per variant, level-compensated.
const { SWOOSH_LENGTHS, SWOOSH_TIGHTNESS, swooshCharacter } = await import('../../turn/audio/swoosh-sound.js');
const { createPairs, createSession, createTrials, scoreBlock, summarizeSession } = await import('../../turn/testing/swoosh-listening-test.js');

let seed = 11;
const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Round 2 swooshes: every side × anchor × length exactly twice, shuffled.
{
  const trials = createTrials(random);
  assert.equal(trials.length, 24);
  for (const side of [-1, 1]) {
    for (const tightness of SWOOSH_TIGHTNESS) {
      for (const length of Object.keys(SWOOSH_LENGTHS)) {
        assert.equal(trials.filter((trial) => trial.side === side && trial.tightness === tightness && trial.length === length).length, 2, `${side} ${tightness} ${length} twice`);
      }
    }
  }
  const order = trials.map((trial) => `${trial.side}${trial.tightness}${trial.length}`).join();
  assert.notEqual(order, createTrials(() => 0.999).map((trial) => `${trial.side}${trial.tightness}${trial.length}`).join(), 'the order is shuffled');
}

// Pairs: R → R, R → L, L → R and L → L twice each.
{
  const pairs = createPairs(random);
  assert.equal(pairs.length, 8);
  for (const first of [-1, 1]) for (const second of [-1, 1]) {
    assert.equal(pairs.filter((pair) => pair.first === first && pair.second === second).length, 2);
  }
}

// Sessions: the arrow against round 1's static pitch sound, blind-labelled.
{
  const session = createSession(random);
  assert.equal(session.round, 2);
  assert.deepEqual(session.blocks.map((block) => block.variant).sort(), ['arrow', 'pitch']);
  assert.deepEqual(session.blocks.map((block) => block.label), ['VERSION 1', 'VERSION 2']);
}

// Scoring: side, tightness, length, length pulling tightness, pairs, replays, comfort.
{
  const session = createSession(random);
  const block = session.blocks[0];
  block.trials.forEach((trial, index) => {
    trial.answerSide = index < 18 ? trial.side : -trial.side;
    // Short tight swooshes are heard as tight; every short gentle one is heard as medium.
    trial.answerTightness = trial.length === 'short' && trial.tightness === 'gentle' ? 'medium' : trial.tightness;
    trial.answerLength = trial.length;
    trial.replays = index === 0 ? 2 : 0;
  });
  block.pairs.forEach((pair, index) => {
    pair.answerFirst = pair.first;
    pair.answerSecond = index < 6 ? pair.second : -pair.second;
  });
  block.comfort = 4;
  const score = scoreBlock(block);
  assert.equal(score.answered, 24);
  assert.equal(score.directionPercent, 75);
  assert.equal(score.tightnessPercent, 83.3);
  assert.equal(score.lengthPercent, 100);
  assert.equal(score.shortHeardTighter, 4);
  assert.equal(score.longHeardGentler, 0);
  assert.equal(score.gentleHeardAsTight, 0);
  assert.equal(score.pairsPercent, 75);
  assert.equal(score.replays, 2);
  assert.equal(score.comfort, 4);
  const summary = summarizeSession(session, { build: '1.33.7 test' });
  assert.equal(summary.round, 2);
  assert.equal(summary.trials[0].trials.length, 24);
  assert.equal(summary.trials[0].pairs.length, 8);
  assert.match(summary.trials[0].trials[0].played, /^(left|right) (gentle|medium|tight) (short|long)$/);
  assert.match(summary.trials[0].pairs[0].played, /^(left|right) → (left|right)$/);
  assert.equal(summary.scores[1].answered, 0, 'unanswered versions score nothing');
  JSON.parse(JSON.stringify(summary));
}

// Candidate sounds: the arrow travels and uses pitch with the smooth timbre; texture is
// gone from both round 2 versions; pitch rises gentle → tight; lengths are 180/360 ms.
{
  const arrow = SWOOSH_TIGHTNESS.map((tightness) => swooshCharacter('arrow', tightness));
  const pitch = SWOOSH_TIGHTNESS.map((tightness) => swooshCharacter('pitch', tightness));
  for (const series of [arrow, pitch]) {
    assert.ok(series.every((item) => item.roughnessDepth === 0), 'no roughness in round 2');
    assert.ok(series[0].pitchHz < series[1].pitchHz && series[1].pitchHz < series[2].pitchHz, 'pitch rises gentle → tight');
  }
  assert.ok(arrow.every((item) => item.travels && item.timbre === 'smooth'), 'the arrow travels with the smooth timbre');
  assert.ok(pitch.every((item) => !item.travels && item.timbre === 'round1'), 'round 1 pitch stays static');
  assert.deepEqual(SWOOSH_LENGTHS, { short: 0.18, long: 0.36 });
  const source = await fs.readFile(new URL('../../turn/audio/swoosh-sound.js', import.meta.url), 'utf8');
  assert.match(source, /panner\.pan\.setValueAtTime\(0, at\);\s*panner\.pan\.linearRampToValueAtTime\(fullSide,/, 'the arrow travels from the centre to the full side');
  assert.match(source, /const fullSide = side < 0 \? -1 : 1;/, 'every swoosh ends fully on its side');
  assert.match(source, /const compensation = 1 \/ Math\.sqrt/, 'roughness stays level-compensated');
}

// The test is admin-only, uses real buttons, and is loaded by the production page.
{
  const ui = await fs.readFile(new URL('../../turn/testing/swoosh-listening-test.js', import.meta.url), 'utf8');
  const page = await fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8');
  assert.match(ui, /if \(!isAdminProfile\(\) \|\| !document\.body\) return;/);
  assert.match(ui, /element\.type = 'button';/);
  assert.match(page, /<script type="module" src="\.\/testing\/swoosh-listening-test\.js\?build=/);
  // Menu music is held (unsaved) while the test is open and released on close, and
  // PLAY AGAIN replaces a pending autoplay so each press is exactly one swoosh.
  assert.match(ui, /__turnRacingMusic\?\.hold\?\.\(true\);[\s\S]*dialog\.showModal\(\)/);
  assert.match(ui, /addEventListener\('close'[\s\S]*__turnRacingMusic\?\.hold\?\.\(false\)/);
  assert.match(ui, /button\('PLAY AGAIN', \(\) => \{[\s\S]{0,120}clearTimeout\(playTimer\);/);
  const music = await fs.readFile(new URL('../../turn/audio/racing-music-v5.js', import.meta.url), 'utf8');
  assert.match(music, /function shouldPlay\(\) \{ return soundEnabled && musicVolume > 0 && !held/, 'a hold stops tap-to-resume');
  assert.match(music, /function hold\(on\) \{ held = Boolean\(on\); if \(held\) void stopPlayback\(\{ reset: false \}\);/, 'a hold never saves volume');
}

console.log('TURN SWOOSH listening test round 2: arrow vs pitch, 24 balanced swooshes with lengths, 8 linked pairs, scoring, JSON summary and the travelling arrow passed.');
