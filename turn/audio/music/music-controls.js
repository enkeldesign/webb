export function installMusicControls({ home, getVolume, setVolume, toggleMusic, setSystemSoundEnabled }) {
  let homeToggle = null, blankToggle = null, settingsSlider = null, settingsOutput = null;
  const label = () => getVolume() <= 0 ? 'OFF' : `${Math.round(getVolume())}%`;
  function render(button, compact = false) {
    if (!button) return;
    const on = getVolume() > 0, action = on ? 'off' : 'on';
    const icon = on ? '<span aria-hidden="true">♫×</span>' : '<span aria-hidden="true">♫</span>';
    button.innerHTML = compact ? icon : `${icon}<span>MUSIC ${action.toUpperCase()}</span>`;
    button.setAttribute('aria-label', `Turn music ${action}`); button.title = `Turn music ${action}`;
    button.dataset.musicEnabled = on ? 'true' : 'false';
  }
  function sync() {
    render(homeToggle); render(blankToggle, true);
    if (settingsSlider) settingsSlider.value = String(Math.round(getVolume()));
    if (settingsOutput) { settingsOutput.value = label(); settingsOutput.textContent = settingsOutput.value; }
  }
  function installHome() {
    const header = home?.querySelector('.m8-home-head'), pitch = header?.querySelector('.m8-home-pitch');
    if (!header || !pitch) return;
    homeToggle = document.createElement('button'); homeToggle.type = 'button'; homeToggle.className = 'turn-music-home-toggle';
    homeToggle.addEventListener('click', toggleMusic); pitch.after(homeToggle); render(homeToggle);
  }
  function installSettings() {
    const dialog = document.querySelector('.m8-settings-dialog');
    const audioCard = dialog?.querySelector('#m8AudioTitle')?.closest('.m8-setting-card');
    if (!dialog || !audioCard || dialog.querySelector('#m8MusicVolume')) return;
    const row = document.createElement('label'); row.className = 'm8-music-volume-row'; row.htmlFor = 'm8MusicVolume';
    row.innerHTML = '<strong>Music volume</strong><small>OFF stops the music engine completely.</small>';
    settingsSlider = document.createElement('input'); settingsSlider.id = 'm8MusicVolume'; settingsSlider.type = 'range'; settingsSlider.min = '0'; settingsSlider.max = '100'; settingsSlider.step = '1'; settingsSlider.value = String(Math.round(getVolume())); settingsSlider.setAttribute('aria-describedby', 'm8MusicVolumeValue');
    const labels = document.createElement('div'); labels.className = 'm8-music-volume-labels'; labels.setAttribute('aria-hidden', 'true'); labels.innerHTML = '<span>OFF</span><span>100%</span>';
    settingsOutput = document.createElement('output'); settingsOutput.id = 'm8MusicVolumeValue'; settingsOutput.htmlFor = 'm8MusicVolume'; settingsOutput.value = label(); settingsOutput.textContent = settingsOutput.value;
    audioCard.append(row, settingsSlider, labels, settingsOutput);
    settingsSlider.addEventListener('input', () => setVolume(Number(settingsSlider.value)));
    settingsSlider.addEventListener('change', () => { const status = dialog.querySelector('.m8-settings-status'); if (status) status.textContent = `Music ${getVolume() <= 0 ? 'off' : `volume ${Math.round(getVolume())}%`}.`; });
    dialog.querySelector('#m8AudioEnabled')?.addEventListener('change', () => setSystemSoundEnabled(globalThis.__turnAudioPreferences?.getSettings?.().audioEnabled !== false));
    dialog.addEventListener('toggle', sync);
  }
  function positionBlank() {
    if (!blankToggle) return;
    const control = document.querySelector('.turn-screen-blank-control[data-state="active"]');
    if (!document.documentElement.classList.contains('turn-screen-blanked') || !control || control.hidden) { blankToggle.hidden = true; return; }
    const rect = control.getBoundingClientRect(), gap = 10, size = rect.width || 50;
    let left = rect.right + gap; if (left + size > innerWidth - 8) left = Math.max(8, rect.left - gap - size);
    Object.assign(blankToggle.style, { left: `${left}px`, top: `${rect.top}px`, width: `${size}px`, height: `${rect.height || size}px` }); blankToggle.hidden = false;
  }
  function installBlank() {
    blankToggle = document.createElement('button'); blankToggle.type = 'button'; blankToggle.className = 'turn-music-blank-toggle'; blankToggle.hidden = true;
    blankToggle.addEventListener('click', toggleMusic); document.body.appendChild(blankToggle); render(blankToggle, true);
    const observer = new MutationObserver(positionBlank); observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const control = document.querySelector('.turn-screen-blank-control'); if (control) observer.observe(control, { attributes: true, attributeFilter: ['data-state', 'hidden', 'style'] });
    addEventListener('resize', positionBlank, { passive: true });
  }
  installHome(); installSettings(); installBlank(); sync();
  return Object.freeze({ sync });
}
