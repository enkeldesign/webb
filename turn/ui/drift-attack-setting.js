let installed = false;

export function installDriftAttackSetting(runtime = globalThis.__turnDriftAttack) {
  if (!runtime || typeof document === 'undefined') return false;
  const dialog = document.querySelector('.m8-settings-dialog');
  const list = dialog?.querySelector('.m8-settings-list');
  if (!dialog || !list) return false;

  let section = list.querySelector('[data-turn-scoring-settings]');
  if (!section) {
    section = document.createElement('section');
    section.className = 'm8-setting-card';
    section.dataset.turnScoringSettings = '';
    section.setAttribute('aria-labelledby', 'm8ScoringTitle');
    section.innerHTML = `
      <h3 id="m8ScoringTitle">Scoring</h3>
      <label class="m8-toggle-row" data-turn-drift-hud-setting>
        <input id="m8DriftHudVisible" type="checkbox">
        <span>
          <strong>Show DRIFT scoring</strong>
          <small>Show the live DRIFT HUD. Scores, records and achievements continue when hidden.</small>
        </span>
      </label>`;
    const records = list.querySelector('.m8-record-setting');
    if (records) records.before(section);
    else list.appendChild(section);
  }

  const row = section.querySelector('[data-turn-drift-hud-setting]');
  const checkbox = section.querySelector('#m8DriftHudVisible');
  const status = dialog.querySelector('.m8-settings-status');

  function sync() {
    const available = runtime.isEnabled() === true;
    row.hidden = !available;
    section.hidden = !available;
    checkbox.checked = runtime.isHudVisible() === true;
  }

  if (!installed) {
    installed = true;
    checkbox.addEventListener('change', () => {
      const next = checkbox.checked;
      if (!runtime.setHudVisible(next, { now: globalThis.performance?.now?.() || 0 })) {
        checkbox.checked = runtime.isHudVisible() === true;
        if (status) status.textContent = 'DRIFT scoring visibility could not be saved.';
        return;
      }
      if (status) {
        status.textContent = next
          ? 'Live DRIFT scoring shown.'
          : 'Live DRIFT scoring hidden. Scoring and records remain active.';
      }
    });
    dialog.addEventListener('toggle', sync);
    globalThis.addEventListener?.('turn:drift-availability-change', sync);
    globalThis.addEventListener?.('turn:drift-hud-visibility-change', sync);
  }

  sync();
  return true;
}
