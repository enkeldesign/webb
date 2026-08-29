import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [handedness, home, css, app, manualCss] = await Promise.all([
  fs.readFile(new URL('../turn/ui/control-handedness.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/control-handedness.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/manual-steering.css', import.meta.url), 'utf8')
]);

assert.match(handedness, /turn-control-handedness-v1/);
assert.match(handedness, /turn-left-handed-controls/);
assert.match(handedness, /localStorage/);
assert.match(home, /Left-handed controls/);
assert.match(home, /Move the drive pad to the left/);
assert.match(home, /on-screen steering, steering moves to the right/i);
assert.match(home, /saveControlHandedness/);
assert.match(home, /loadControlHandedness/);
assert.match(css, /\.turn-left-handed-controls \.controls[\s\S]*flex-direction: row-reverse/);
assert.match(css, /\.turn-left-handed-controls \.manual-steer[\s\S]*right:/);
assert.match(css, /\.turn-left-handed-controls \.drive-lock-bubble/);
assert.match(manualCss, /left: max\(22px, env\(safe-area-inset-left\)\)/);
assert.match(app, /control-handedness\.css\?revision=r228-left-handed-controls/);
assert.match(app, /m8-home\.js\?revision=r228-left-handed-controls/);

console.log('TURN left-handed control layout and steering-setting regression passed.');
