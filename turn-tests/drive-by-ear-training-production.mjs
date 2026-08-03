import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [runtime, stages, course, view, css, fixedLayout] = await Promise.all([
  fs.readFile(new URL('../turn/training/drive-by-ear-training.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/training/stages.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/training/course.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/training/view.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/training/drive-by-ear-training.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8')
]);
const training = `${runtime}\n${stages}\n${course}\n${view}`;

assert.match(fixedLayout, /training\/drive-by-ear-training\.js\?build=\$\{buildKey\}-r149-dbe-training/);
assert.match(fixedLayout, /installDriveByEarTraining\(globalThis\.__turnRuntime\)/);
assert.match(fixedLayout, /driveByEarTraining/);
assert.match(stages, /TRAINING_BALANCE = 0\.95/);
assert.match(stages, /BALANCE_SUGGESTION_THRESHOLD = 75/);
assert.match(stages, /TRAINING_CAR_ID = 'classic'/);
assert.equal((stages.match(/id: 'dbe-training-[1-5]'/g) || []).length, 5);
assert.match(stages, /title: 'Find the ribbon'[\s\S]*guideRails: true[\s\S]*startOffset: -6/);
assert.match(stages, /title: 'Listen ahead'[\s\S]*guideRails: true/);
assert.match(stages, /title: 'Leave and return'[\s\S]*guideRails: false[\s\S]*startOffset: -\(ROAD_HALF_WIDTH \+ 4\)/);
assert.match(stages, /title: 'Trust the sequence'[\s\S]*LEFT, 3/);
assert.match(stages, /title: 'Drive by ear'/);
assert.match(stages, /RECOVERY_LIMIT = ROAD_HALF_WIDTH \+ 10/);

assert.match(view, /homeButton\.textContent = 'DRIVE BY EAR TRAINING'/);
assert.doesNotMatch(view, /homeButton[\s\S]{0,120}(?:complete|completed|done)/i);
assert.doesNotMatch(training, /training-complete(?:d)?-v|localStorage.*training.*complete/i);
assert.match(view, /class="turn-dbe-training-visual-hint" aria-hidden="true"/);
assert.match(stages, /Try Blank screen mode for this part/);
assert.match(view, /The screen stays on while you learn/);
assert.match(view, /blankButton\.dataset\.state !== 'armed'/);
assert.match(view, /Blank screen mode lets you drive using sound/);
assert.match(view, /m8-home-menu/);
assert.match(view, /m8-how-dialog \.m8-guide-wide/);
assert.match(view, /m8-settings-dialog #m8AudioTitle/);
assert.match(view, /New to these sounds\?/);
assert.match(view, /Drive By Ear is prominent in the sound mix/);

assert.match(course, /makeGuideRails/);
assert.match(runtime, /constrainToCourse\(nearest, session\.stage\)/);
assert.match(runtime, /stage\.outerLimit/);
assert.match(runtime, /turn:pace-note-priority/);
assert.match(runtime, /finalBeepDurationSeconds: note\.long \? 0\.17 : 0\.055/);
assert.match(runtime, /turn:pace-note-silence/);
assert.match(runtime, /setAudioEnabled\?\.\(true\)/);
assert.match(runtime, /setDriveByEarEnabled\?\.\(true\)/);
assert.match(runtime, /setBalance\?\.\(TRAINING_BALANCE\)/);
assert.match(runtime, /await activateTrack\(snapshot\.trackId, runtime\)/);
assert.match(runtime, /await raceSession\.selectVehicle\(snapshot\.vehicle\)/);
assert.match(runtime, /runtime\.openLot = snapshot\.openLot/);
assert.match(runtime, /resetButton\.textContent = snapshot\.resetLabel/);
assert.match(runtime, /leaveButton\.textContent = snapshot\.leaveLabel/);

assert.match(css, /\.turn-dbe-training-home[\s\S]*--turn-action-information/);
assert.match(css, /\.turn-dbe-training-active \.turn-dbe-training-hidden-map/);
assert.match(css, /\.turn-dbe-training-hud\[hidden\]/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);

console.log('TURN Drive By Ear five-part training and preference restoration passed.');
