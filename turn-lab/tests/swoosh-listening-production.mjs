import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

// SWOOSH listening test (#909, #928): SOL's protocol — three blind versions, 24 trials
// each (2 sides × 3 anchors × 4), scored for side, tightness and comfort — and the
// candidate sounds: full-side pan, one changed dimension per variant, level-compensated.
const { SWOOSH_TIGHTNESS, SWOOSH_VARIANTS, swooshCharacter } = await import('../../turn/audio/swoosh-sound.js');
const { createSession, createTrials, scoreBlock, summarizeSession } = await import('../../turn/testing/swoosh-listening-test.js');

let seed = 11;
const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Trials: every side × anchor exactly four times, in a shuffled order.
{
  const trials = createTrials(random);
  assert.equal(trials.length, 24);
  for (const side of [-1, 1]) {
    for (const tightness of SWOOSH_TIGHTNESS) {
      assert.equal(trials.filter((trial) => trial.side === side && trial.tightness === tightness).length, 4, `${side} ${tightness} four times`);
    }
  }
  const order = trials.map((trial) => `${trial.side}${trial.tightness}`).join();
  assert.notEqual(order, createTrials(() => 0.999).map((trial) => `${trial.side}${trial.tightness}`).join(), 'the order is shuffled');
}

// Sessions: all three versions, blind-labelled, in random order.
{
  const session = createSession(random);
  assert.deepEqual(session.blocks.map((block) => block.variant).sort(), [...SWOOSH_VARIANTS].sort());
  assert.deepEqual(session.blocks.map((block) => block.label), ['VERSION 1', 'VERSION 2', 'VERSION 3']);
}

// Scoring: side and tightness accuracy, confusions, replays and comfort.
{
  const session = createSession(random);
  const block = session.blocks[0];
  block.trials.forEach((trial, index) => {
    trial.answerSide = index < 18 ? trial.side : -trial.side;
    trial.answerTightness = trial.tightness === 'tight' ? 'gentle' : trial.tightness;
    trial.replays = index === 0 ? 2 : 0;
  });
  block.comfort = 3;
  const score = scoreBlock(block);
  assert.equal(score.answered, 24);
  assert.equal(score.directionPercent, 75);
  assert.equal(score.tightnessPercent, 66.7);
  assert.equal(score.tightHeardAsGentle, 8);
  assert.equal(score.gentleHeardAsTight, 0);
  assert.equal(score.replays, 2);
  assert.equal(score.comfort, 3);
  const summary = summarizeSession(session, { build: '1.33.6 test' });
  assert.equal(summary.scores.length, 3);
  assert.equal(summary.trials[0].trials.length, 24);
  assert.match(summary.trials[0].trials[0].played, /^(left|right) (gentle|medium|tight)$/);
  assert.equal(summary.scores[1].answered, 0, 'unanswered versions score nothing');
  JSON.parse(JSON.stringify(summary));
}

// Candidate sounds: texture changes roughness only, pitch changes the tone only,
// combined changes both; the anchors are ordered gentle → tight.
{
  const texture = SWOOSH_TIGHTNESS.map((tightness) => swooshCharacter('texture', tightness));
  const pitch = SWOOSH_TIGHTNESS.map((tightness) => swooshCharacter('pitch', tightness));
  const combined = SWOOSH_TIGHTNESS.map((tightness) => swooshCharacter('combined', tightness));
  assert.deepEqual(new Set(texture.map((item) => item.pitchHz)).size, 1, 'texture keeps one pitch');
  assert.deepEqual(new Set(pitch.map((item) => item.roughnessDepth)).size, 1, 'pitch keeps one texture');
  for (const series of [texture.map((item) => item.roughnessDepth), pitch.map((item) => item.pitchHz), combined.map((item) => item.roughnessDepth), combined.map((item) => item.pitchHz)]) {
    assert.ok(series[0] < series[1] && series[1] < series[2], 'gentle → medium → tight rises');
  }
  const source = await fs.readFile(new URL('../../turn/audio/swoosh-sound.js', import.meta.url), 'utf8');
  assert.match(source, /panner\.pan\.value = side < 0 \? -1 : 1;/, 'direction is always full-side');
  assert.match(source, /const compensation = 1 \/ Math\.sqrt/, 'roughness is level-compensated');
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

console.log('TURN SWOOSH listening test: 3 blind versions × 24 balanced trials, scoring, JSON summary and full-side candidate sounds passed.');
