import { GAME_MODE } from '../race/game-state.js';

export const IN_GAME_MENU_STATE = Object.freeze({
  STAGED: 'staged',
  RACING: 'racing',
  HIDDEN: 'hidden'
});

export function inGameMenuStateFor(mode) {
  if (mode === GAME_MODE.STAGED) return IN_GAME_MENU_STATE.STAGED;
  if (mode === GAME_MODE.RACING) return IN_GAME_MENU_STATE.RACING;
  return IN_GAME_MENU_STATE.HIDDEN;
}

export function inGameMenuVisibilityFor(mode) {
  const menuState = inGameMenuStateFor(mode);
  return Object.freeze({
    menuState,
    backToStart: menuState === IN_GAME_MENU_STATE.RACING,
    startActions: menuState === IN_GAME_MENU_STATE.STAGED
  });
}
