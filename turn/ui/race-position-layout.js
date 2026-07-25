export function installRacePositionLayout() {
  const stats = document.querySelector('.stats');
  const lapChip = document.querySelector('#lap')?.closest('.chip');
  const positionHud = document.querySelector('.race-position-hud');

  if (!stats || !positionHud) return false;

  positionHud.classList.add('chip');
  if (lapChip?.parentElement === stats) lapChip.after(positionHud);
  else stats.appendChild(positionHud);

  return true;
}
