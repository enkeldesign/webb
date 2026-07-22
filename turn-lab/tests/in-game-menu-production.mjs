import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { GAME_MODE } from '../../turn/race/game-state.js';
import {
  IN_GAME_MENU_STATE,
  inGameMenuStateFor,
  inGameMenuVisibilityFor
} from '../../turn/ui/in-game-menu-state.js';

assert.equal(inGameMenuStateFor(GAME_MODE.STAGED), IN_GAME_MENU_STATE.STAGED);
assert.equal(inGameMenuStateFor(GAME_MODE.RACING), IN_GAME_MENU_STATE.RACING);
assert.equal(inGameMenuStateFor(GAME_MODE.SPECTATING), IN_GAME_MENU_STATE.HIDDEN);

assert.deepEqual(inGameMenuVisibilityFor(GAME_MODE.STAGED), { menuState: IN_GAME_MENU_STATE.STAGED, backToStart: false, startActions: true });
assert.deepEqual(inGameMenuVisibilityFor(GAME_MODE.RACING), { menuState: IN_GAME_MENU_STATE.RACING, backToStart: true, startActions: false });
assert.deepEqual(inGameMenuVisibilityFor(GAME_MODE.SPECTATING), { menuState: IN_GAME_MENU_STATE.HIDDEN, backToStart: false, startActions: false });

const [index, app, menu, controls, backToLot, main, css, spectate] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/in-game-menu.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/gameplay-controls.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/back-to-lot.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/in-game-menu.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/spectate.js', import.meta.url), 'utf8')
]);

assert.match(index, /TURN v1\.3\.29 · Build 2026\.07\.22-r46/);
assert.match(index, /in-game-menu\.css\?build=20260722-r46/);
assert.match(index, /id="calibrateButton"[^>]*>Recalibrate<\/button>/);
assert.match(index, /id="resetButton"[^>]*>Restart Lap<\/button>/);
assert.match(app, /await import\(withBuild\('\.\/ui\/in-game-menu\.js'\)\)/);
assert.match(menu, /backToStartButton\.textContent = 'Restart Lap'/, 'The race reset action should describe restarting the lap rather than navigating away');
assert.match(menu, /Restart the current lap from the start line/, 'Restart Lap must expose an accurate accessible label');
assert.match(menu, /inGameMenuVisibilityFor\(runtime\.state\.mode\)/, 'Menu visibility must follow the explicit game mode');
assert.doesNotMatch(menu, /state\.speed/, 'Menu visibility must not infer race state from speed');
assert.match(menu, /backToStartButton\.hidden = !visibility\.backToStart/);
assert.match(menu, /backToLotButton\.hidden = !visibility\.startActions/);
assert.match(menu, /recalibrateButton\.hidden = !visibility\.startActions/);
assert.match(menu, /resetRivalsButton\.hidden = !visibility\.startActions/);
assert.match(menu, /const buttonOrder = \[\s*backToLotButton,\s*recalibrateButton,\s*resetRivalsButton,\s*spectateButton,\s*backToStartButton\s*\]/, 'Start actions must follow the requested order');
assert.match(menu, /closest\('\.chip'\)/, 'Restart Lap must follow the TIME card validity state rather than duplicate race logic');
assert.match(menu, /classList\.contains\('is-invalid-lap'\)/, 'The TIME card invalid class must be the shared source of truth');
assert.match(menu, /new MutationObserver\(\(\) => syncLapValidity\(\)\)/, 'Invalid-lap feedback must remain event-driven rather than adding another loop');
assert.match(menu, /classList\.toggle\('is-lap-invalid', invalid\)/, 'Restart Lap must stay red while the visible TIME card is invalid');
assert.match(menu, /classList\.add\('is-lap-invalid-pulse'\)/, 'Restart Lap must pulse once when the lap first becomes invalid');
assert.doesNotMatch(menu, /setInterval|setAnimationLoop/, 'Invalid-lap button feedback must not add a polling loop');
assert.match(controls, /Reset Rivals/);
assert.match(controls, /globalThis\.__turnResetRivals/);
assert.match(backToLot, /Back to Lot/);
assert.match(main, /globalThis\.__turnResetRivals = resetRivals/);
assert.match(spectate, /spectateButton\.hidden = !current\.available/, 'Spectate must remain conditional on a saved rival');
assert.match(css, /\.utility-group\[data-menu-state="staged"\]/);
assert.match(css, /\.utility-group\[data-menu-state="racing"\] \.back-to-start-button/);
assert.match(css, /\.back-to-start-button\.is-lap-invalid \{\s*background: #ff6b6b;/s, 'Restart Lap must use the same invalid red as the TIME card');
assert.match(css, /@keyframes turn-restart-invalid-pulse/, 'The invalid restart cue must pulse exactly through a dedicated one-shot animation');
assert.match(css, /prefers-reduced-motion: reduce/, 'The restart cue must respect reduced-motion preferences');
assert.match(css, /\.utility-group\[data-menu-state="hidden"\]/);

console.log('TURN state-aware in-game menu and invalid-lap Restart Lap cue regression passed.');