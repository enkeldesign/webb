import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [main, app, physics, gameState, lapSystem, setting, toast, announcements] = await Promise.all([
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/vehicle/physics.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/race/game-state.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/race/lap-system.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/drift-attack-setting.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/lap-result-toast.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/race-announcements.js', import.meta.url), 'utf8')
]);

assert.match(main, /createDriftAttackRuntime\(\{[\s\S]*state,[\s\S]*scoreFeedback,[\s\S]*isFeatureUnlocked/,
  'DRIFT ATTACK must consume central race state and Trophy Road availability');
assert.match(main, /import \{[\s\S]*isFeatureUnlocked,[\s\S]*isVehiclePerkUnlocked[\s\S]*\} from '\/turn\/progression\/trophy-road\.js/,
  'The runtime must import its feature gate from Trophy Road');
assert.match(main, /driftAttack\.advance\(dt, now\)/,
  'The scorer must sample from the existing physics loop');
assert.match(main, /finalizeScores\([\s\S]*driftAttack\.completeLap/,
  'Lap completion must compose the DRIFT result into the established result event');
assert.doesNotMatch(main, /requestAnimationFrame\([^)]*drift|drift[^\n]*requestAnimationFrame/i,
  'DRIFT ATTACK must not add a render loop');

assert.match(physics, /state\.driftSlipAngle = signedDriftSlipAngle/,
  'Vehicle physics must expose signed physical slip');
assert.match(physics, /state\.collided = collision\.collided === true/,
  'Vehicle physics must expose collision failure state');
assert.match(gameState, /state\.driftSlipAngle = 0/);
assert.match(gameState, /state\.collided = false/);
assert.match(lapSystem, /finalizeScores/);
assert.match(lapSystem, /\.\.\.\(scoreResults \|\| \{\}\)/,
  'Scoring data must be merged into one lap-result contract');

assert.match(app, /installDriftAttackSetting\(\)/);
assert.match(setting, /Show DRIFT scoring/);
assert.match(setting, /Scores, records and achievements continue when hidden\./);
assert.doesNotMatch(setting, /scorer\.reset|runtime\.reset/,
  'The presentation preference must never turn scoring off');
assert.match(toast, /lap-result-drift/);
assert.match(announcements, /Drift score:/,
  'Lap and DRIFT results must form one assistive-technology announcement');

console.log('TURN DRIFT ATTACK physics, settings and lap-result integration regressions passed.');
