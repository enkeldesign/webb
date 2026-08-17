import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const fixedLayout = await fs.readFile(
  new URL('../turn/m8-home-fixed-layout.js', import.meta.url),
  'utf8'
);

assert.match(fixedLayout, /const MUSIC_VOLUME_STORAGE_KEY = 'turn-racing-music-volume-v1'/);
assert.match(fixedLayout, /const MUSIC_LAST_VOLUME_STORAGE_KEY = 'turn-racing-music-last-volume-v1'/);
assert.match(fixedLayout, /function installDriveByEarTrainingMusicSilence\(training, racingMusic\)/);
assert.match(
  fixedLayout,
  /volume: Number\.isFinite\(Number\(racingMusic\.volume\)\) \? Number\(racingMusic\.volume\) : 0/,
  'DBE 101 must remember the in-memory music level before forcing silence'
);
assert.match(
  fixedLayout,
  /racingMusic\.setVolume\?\.\(0\);[\s\S]*restorePersistentMusicChoice\(temporary\)/,
  'Training may set the running engine to zero only if the persisted preference is restored immediately'
);
assert.match(
  fixedLayout,
  /racingMusic\.setVolume\?\.\(snapshot\.volume\);[\s\S]*restorePersistentMusicChoice\(snapshot\)/,
  'Leaving DBE 101 must restore both the running level and the exact stored preference'
);
assert.match(
  fixedLayout,
  /button\.addEventListener\('click', silence, \{ capture: true \}\)/,
  'Every DBE 101 entry point must silence music before its normal click handler opens training'
);
assert.match(
  fixedLayout,
  /training\.introDialog\?\.addEventListener\('close',[\s\S]*training\.getState\?\.\(\)\.active !== true\) restore\(\)/,
  'Cancelling the DBE 101 introduction must restore music when no training session started'
);
assert.match(
  fixedLayout,
  /addEventListener\('turn:dbe-training-stage-started', silence\)/,
  'The exact-stage start event must provide a fallback guarantee that music is silent during driving'
);
assert.match(
  fixedLayout,
  /addEventListener\('turn:track-changed',[\s\S]*event\.detail\?\.training === true\) silence\(\);[\s\S]*else if \(temporary\) restore\(\)/,
  'Training track changes keep music off and returning to a real track restores the prior state'
);
assert.match(fixedLayout, /const dbeTrainingMusicSilence = installDriveByEarTrainingMusicSilence\(driveByEarTraining, racingMusic\)/);
assert.match(fixedLayout, /dbeTrainingMusicSilence,/);

console.log('TURN DBE 101 temporary music silence regression passed.');
