let installed = false;

const SCORING_SETTING_COPY = Object.freeze({
  drift: Object.freeze({ label: 'DRIFT', title: 'Show DRIFT scoring' }),
  flow: Object.freeze({ label: 'FLOW', title: 'Show FLOW scoring' })
});

function scoringToggleMarkup(channel) {
  const copy = SCORING_SETTING_COPY[channel] || SCORING_SETTING_COPY.drift;
  const id = channel === 'flow' ? 'm8FlowHudVisible' : 'm8DriftHudVisible';
  return `
    <label class="m8-toggle-row" data-turn-${channel}-hud-setting>
      <input id="${id}" type="checkbox">
      <span>
        <strong>${copy.title}</strong>
        <small>Show the live ${copy.label} HUD. Scores, records and achievements continue when hidden.</small>
      </span>
    </label>`;
}

export function installDriftAttackSetting(
  runtime = globalThis.__turnDriftAttack,
  flowRuntime = globalThis.__turnFlow
) {
  if ((!runtime && !flowRuntime) || typeof document === 'undefined') return false;
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
      ${scoringToggleMarkup('drift')}
      ${scoringToggleMarkup('flow')}`;
    const records = list.querySelector('.m8-record-setting');
    if (records) records.before(section);
    else list.appendChild(section);
  } else {
    // Keep the installer forward-compatible with a cached settings dialog
    // created by an older TURN module before both scoring rows existed.
    if (!section.querySelector('[data-turn-drift-hud-setting]')) {
      section.insertAdjacentHTML('beforeend', scoringToggleMarkup('drift'));
    }
    if (!section.querySelector('[data-turn-flow-hud-setting]')) {
      section.insertAdjacentHTML('beforeend', scoringToggleMarkup('flow'));
    }
  }

  const row = section.querySelector('[data-turn-drift-hud-setting]');
  const checkbox = section.querySelector('#m8DriftHudVisible');
  const flowRow = section.querySelector('[data-turn-flow-hud-setting]');
  const flowCheckbox = section.querySelector('#m8FlowHudVisible');
  const status = dialog.querySelector('.m8-settings-status');

  function sync() {
    const driftAvailable = runtime?.isEnabled?.() === true;
    const flowAvailable = flowRuntime?.isEnabled?.() === true;
    row.hidden = !driftAvailable;
    flowRow.hidden = !flowAvailable;
    section.hidden = !driftAvailable && !flowAvailable;
    checkbox.checked = runtime?.isHudVisible?.() === true;
    flowCheckbox.checked = flowRuntime?.isHudVisible?.() === true;
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
    flowCheckbox.addEventListener('change', () => {
      const next = flowCheckbox.checked;
      if (!flowRuntime?.setHudVisible?.(next, { now: globalThis.performance?.now?.() || 0 })) {
        flowCheckbox.checked = flowRuntime?.isHudVisible?.() === true;
        if (status) status.textContent = 'FLOW scoring visibility could not be saved.';
        return;
      }
      if (status) {
        status.textContent = next
          ? 'Live FLOW scoring shown.'
          : 'Live FLOW scoring hidden. Scoring and records remain active.';
      }
    });
    dialog.addEventListener('toggle', sync);
    globalThis.addEventListener?.('turn:drift-availability-change', sync);
    globalThis.addEventListener?.('turn:drift-hud-visibility-change', sync);
    globalThis.addEventListener?.('turn:flow-availability-change', sync);
    globalThis.addEventListener?.('turn:flow-hud-visibility-change', sync);
  }

  sync();
  return true;
}
