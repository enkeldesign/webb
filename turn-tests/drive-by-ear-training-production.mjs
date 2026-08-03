import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [training, css, fixedLayout] = await Promise.all([
  fs.readFile(new URL('../turn/training/drive-by-ear-training.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/training/drive-by-ear-training.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8')
]);

assert.match(fixedLayout, /training\/drive-by-ear-training\.js\?build=\$\{buildKey\}-r149-dbe-training/);
assert.match(fixedLayout, /installDriveByEarTraining\(globalThis\.__turnRuntime\)/);
assert.match(fixedLayout, /driveByEarTraining/);

assert.match(training, /const TRAINING_BALANCE = 0\.95/);
assert.match(training, /const BALANCE_SUGGESTION_THRESHOLD = 75/);
assert.match(training, /const TRAINING_CAR_ID = 'classic'/);
assert.match(training, /DRIVE BY EAR TRAINING/);
assert.match(training, /homeButton\.textContent = 'DRIVE BY EAR TRAINING'/);
assert.doesNotMatch(training, /homeButton[\s\S]{0,120}(?:complete|completed|done)/i, 'The permanent Home training destination must never become a completion-status button');
assert.doesNotMatch(training, /training-complete(?:d)?-v|localStorage.*training.*complete/i, 'Training completion must not create a persistent button status');

assert.equal((training.match(/id: 'dbe-training-[1-5]'/g) || []).length, 5, 'Training must contain exactly five authored parts');
assert.match(training, /title: 'Find the ribbon'[\s\S]*guideRails: true[\s\S]*startOffset: -6/);
assert.match(training, /title: 'Listen ahead'[\s\S]*guideRails: true/);
assert.match(training, /title: 'Leave and return'[\s\S]*guideRails: false[\s\S]*startOffset: -\(ROAD_HALF_WIDTH \+ 4\)/);
assert.match(training, /title: 'Trust the sequence'[\s\S]*severity: 3/);
assert.match(training, /title: 'Drive by ear'/);
assert.match(training, /const RECOVERY_LIMIT = ROAD_HALF_WIDTH \+ 10/);
assert.match(training, /constrainToCourse\(nearest, stage\)/);
assert.match(training, /runtime\.state\.position\.copy\(sample\.point\)\.addScaledVector\(sample\.normal, lateralSign \* stage\.outerLimit\)/);

assert.match(training, /finalBeepDurationSeconds: note\.long \? 0\.17 : 0\.055/);
assert.match(training, /turn:pace-note-priority/);
assert.match(training, /turn:pace-note-silence/);
assert.match(training, /PACE_NOTE_DIRECTION\.RIGHT, severity: 1/);
assert.match(training, /PACE_NOTE_DIRECTION\.LEFT, severity: 2/);
assert.match(training, /PACE_NOTE_DIRECTION\.LEFT, severity: 3/);

assert.match(training, /class="turn-dbe-training-visual-hint" aria-hidden="true"/);
assert.match(training, /Try Blank screen mode for this part/);
assert.match(training, /The screen stays on while you learn/);
assert.match(training, /MutationObserver[\s\S]*blankButton\.dataset\.state !== 'armed'/);
assert.match(training, /Blank screen mode lets you drive using sound/);

assert.match(training, /m8-home-menu/);
assert.match(training, /m8-how-dialog \.m8-guide-wide/);
assert.match(training, /m8-settings-dialog #m8AudioTitle/);
assert.match(training, /New to these sounds\?/);
assert.match(training, /Drive By Ear is prominent in the sound mix/);

assert.match(training, /setAudioEnabled\?\.\(true\)/);
assert.match(training, /setDriveByEarEnabled\?\.\(true\)/);
assert.match(training, /setBalance\?\.\(TRAINING_BALANCE\)/);
assert.match(training, /restorePreferenceStorage\(\)/);
assert.match(training, /await activateTrack\(snapshot\.trackId, runtime\)/);
assert.match(training, /await raceSession\.selectVehicle\(snapshot\.vehicle\)/);
assert.match(training, /runtime\.openLot = snapshot\.openLot/);
assert.match(training, /resetButton\.textContent = snapshot\.resetLabel/);
assert.match(training, /leaveButton\.textContent = snapshot\.leaveLabel/);

assert.match(css, /\.turn-dbe-training-home[\s\S]*--turn-action-information/);
assert.match(css, /\.turn-dbe-training-active \.turn-dbe-training-hidden-map/);
assert.match(css, /\.turn-dbe-training-hud\[hidden\]/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);

console.log('TURN Drive By Ear five-part training and preference restoration passed.');
