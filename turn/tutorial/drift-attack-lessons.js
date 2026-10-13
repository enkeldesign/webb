// DRIFT ATTACK TUTORIAL (#1150): one teaching lap that turns DRIFT into points, links
// drifts into COMBO, and BOOST into OVERCHARGE. Lessons follow each other, each starting
// when the last is done:
// OVERCHARGE leaks, so CATCH, HOLD and SPEND come straight after BUILD. There is no
// failure state: OVERCHARGE that leaks away sends the player back to BUILD, and the line
// ends the lesson either way. Every prompt names OVERCHARGE: on the meter it is only
// a purple segment.
//
// pauseAfter: seconds the doneText stays before the next lesson. needsOvercharge: the
// lesson cannot go on once OVERCHARGE is gone. keyboardPrompt: for players driving by
// keyboard, where it differs (LOCK has no key).
export const DRIFT_ATTACK_LESSONS = Object.freeze([
  Object.freeze({
    id: 'score',
    targets: ['.drive-boost-zone', '.drive-drift-zone'],
    title: 'DRIFT SCORING',
    // LOCK first: it may be what starts the slide at all.
    prompt: 'BOOST into the bend, then hold DRIFT. If the car will not slide, slide outward into LOCK. Straighten out to BANK the points.',
    keyboardPrompt: 'BOOST into the bend, then hold DRIFT. Straighten out to BANK the points.',
    doneText: 'Banked. Longer, faster slides score more.',
    pauseAfter: 3,
    done: (progress) => progress.banks > 0
  }),
  Object.freeze({
    // DRIFT ATTACK links a drift started the other way within 1.4 s of a bank
    // (scoring/drift-attack.js), and announces the higher COMBO.
    id: 'link',
    title: 'LINK',
    prompt: 'Bank a slide, then drift the other way straight away. Linked drifts raise COMBO.',
    doneText: 'Linked. Keep switching sides to keep COMBO climbing.',
    pauseAfter: 3,
    done: (progress) => progress.links > 0
  }),
  Object.freeze({
    id: 'build',
    targets: ['.drive-drift-zone'],
    title: 'BUILD',
    prompt: 'With BOOST full, keep holding DRIFT. OVERCHARGE builds past the end of the BOOST meter.',
    done: (progress) => progress.overcharge >= 0.3
  }),
  Object.freeze({
    id: 'catch',
    targets: ['.drive-gas-zone'],
    title: 'CATCH',
    prompt: 'Slide to GAS now, before OVERCHARGE leaks away.',
    needsOvercharge: true,
    done: (progress) => progress.caught
  }),
  Object.freeze({
    id: 'hold',
    title: 'HOLD',
    prompt: 'Stay on GAS. OVERCHARGE holds while you do.',
    needsOvercharge: true,
    done: (progress) => progress.caughtSeconds >= 1.5
  }),
  Object.freeze({
    id: 'spend',
    targets: ['.drive-boost-zone'],
    title: 'SPEND',
    prompt: 'Slide to BOOST. OVERCHARGE burns first, as a stronger burst.',
    doneText: 'That was OVERCHARGE. Build, catch, hold, spend.',
    needsOvercharge: true,
    done: (progress) => progress.spent
  })
]);

export const DRIFT_ATTACK_RETRY_PROMPT = 'OVERCHARGE leaked away. Build it again: with BOOST full, keep holding DRIFT.';
export const DRIFT_ATTACK_GRADUATION_MESSAGE = 'Tutorial complete. CATCH THE CHARGE and HEAD START are yours to earn now.';
export const DRIFT_ATTACK_PRACTICE_MESSAGE = 'Tutorial complete. Keep practising: build, catch, hold, spend.';
