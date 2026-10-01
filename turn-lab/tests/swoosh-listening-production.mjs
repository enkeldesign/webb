import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

// SWOOSH listening test (#909, #928), round 3: three blind swipe timbres, 12 linked pairs
// each (8 S-curves, 4 same-direction, random tightness and length per swoosh), scored for
// S-curves, same-direction pairs and comfort — and the candidate sounds: a swipe from 50%
// to 100% on its own side, pitch for tightness, every swoosh ending fully on its side.
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

// Round 3 pairs: R → L and L → R four times each, R → R and L → L twice each, every
// swoosh with a valid tightness and length.
{
  const pairs = createPairs(random);
  assert.equal(pairs.length, 12);
  const count = (first, second) => pairs.filter((pair) => pair.first === first && pair.second === second).length;
  assert.equal(count(1, -1), 4);
  assert.equal(count(-1, 1), 4);
  assert.equal(count(1, 1), 2);
  assert.equal(count(-1, -1), 2);
  for (const pair of pairs) {
    assert.ok(SWOOSH_TIGHTNESS.includes(pair.firstTightness) && SWOOSH_TIGHTNESS.includes(pair.secondTightness));
    assert.ok(Object.hasOwn(SWOOSH_LENGTHS, pair.firstLength) && Object.hasOwn(SWOOSH_LENGTHS, pair.secondLength));
  }
}

// Round 3 sessions: three swipe timbres, blind-labelled, pairs only.
{
  const session = createSession(random);
  assert.equal(session.round, 3);
  assert.deepEqual(session.blocks.map((block) => block.variant).sort(), ['swipe-air', 'swipe-breath', 'swipe-tone']);
  assert.deepEqual(session.blocks.map((block) => block.label), ['VERSION 1', 'VERSION 2', 'VERSION 3']);
  assert.ok(session.blocks.every((block) => block.trials.length === 0 && block.pairs.length === 12));
}

// Scoring: pairs, S-curves and same-direction pairs separately, replays and comfort.
{
  const session = createSession(random);
  const block = session.blocks[0];
  let wrongSCurves = 0;
  block.pairs.forEach((pair) => {
    pair.answerFirst = pair.first;
    const sCurve = pair.first !== pair.second;
    // One S-curve heard as same-direction.
    pair.answerSecond = sCurve && wrongSCurves++ === 0 ? pair.first : pair.second;
  });
  block.pairs[0].replays = 1;
  block.comfort = 5;
  const score = scoreBlock(block);
  assert.equal(score.answered, 0, 'no single swooshes in round 3');
  assert.equal(score.pairsAnswered, 12);
  assert.equal(score.pairsPercent, 91.7);
  assert.equal(score.sCurvesAnswered, 8);
  assert.equal(score.sCurvePercent, 87.5);
  assert.equal(score.sameSidePercent, 100);
  assert.equal(score.replays, 1);
  assert.equal(score.comfort, 5);
  const summary = summarizeSession(session, { build: '1.33.8 test' });
  assert.equal(summary.round, 3);
  assert.equal(summary.trials[0].pairs.length, 12);
  assert.match(summary.trials[0].pairs[0].played, /^(left|right) → (left|right)$/);
  assert.match(summary.trials[0].pairs[0].swooshes, /^(gentle|medium|tight) (short|long) → (gentle|medium|tight) (short|long)$/);
  JSON.parse(JSON.stringify(summary));
}

// Round 2's scoring of single swooshes still works (kept for later rounds).
{
  const block = { variant: 'arrow', label: 'VERSION 1', trials: createTrials(random), pairs: [], comfort: 4 };
  block.trials.forEach((trial) => {
    trial.answerSide = trial.side;
    trial.answerTightness = trial.length === 'short' && trial.tightness === 'gentle' ? 'medium' : trial.tightness;
    trial.answerLength = trial.length;
  });
  const score = scoreBlock(block);
  assert.equal(score.directionPercent, 100);
  assert.equal(score.tightnessPercent, 83.3);
  assert.equal(score.lengthPercent, 100);
  assert.equal(score.shortHeardTighter, 4);
}

// Candidate sounds: every swipe starts halfway out on its own side and travels to the
// full side, with pitch for tightness and no roughness; the three timbres differ.
{
  const swipes = ['swipe-air', 'swipe-tone', 'swipe-breath'];
  for (const variant of swipes) {
    const series = SWOOSH_TIGHTNESS.map((tightness) => swooshCharacter(variant, tightness));
    assert.ok(series.every((item) => item.travels && item.startPan === 0.5 && item.roughnessDepth === 0), `${variant}: a 50 → 100% swipe without roughness`);
    assert.ok(series[0].pitchHz < series[1].pitchHz && series[1].pitchHz < series[2].pitchHz, `${variant}: pitch rises gentle → tight`);
  }
  assert.equal(new Set(swipes.map((variant) => swooshCharacter(variant, 'medium').timbre)).size, 3, 'three different timbres');
  assert.equal(swooshCharacter('arrow', 'medium').startPan, 0, "round 2's arrow started in the centre");
  assert.deepEqual(SWOOSH_LENGTHS, { short: 0.18, long: 0.36 });
  const source = await fs.readFile(new URL('../../turn/audio/swoosh-sound.js', import.meta.url), 'utf8');
  assert.match(source, /panner\.pan\.setValueAtTime\(fullSide \* startPan, at\);\s*panner\.pan\.linearRampToValueAtTime\(fullSide,/, 'a swipe travels from its start on its own side to the full side');
  assert.match(source, /const fullSide = side < 0 \? -1 : 1;/, 'every swoosh ends fully on its side');
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

console.log('TURN SWOOSH listening test round 3: three swipe timbres, 12 balanced linked pairs (8 S-curves), S-curve scoring, JSON summary and the 50 → 100% swipe passed.');
