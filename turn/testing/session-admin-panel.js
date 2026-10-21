// Loaded only after the preview/local session overlay is installed.
export function installAdminPanel({ documentRef, menu, menuButton }) {
  const admin = globalThis.__turnSessionAdmin;
  if (!admin) return;
  const entry = documentRef.createElement('button');
  entry.type = 'button';
  entry.className = 'm8-feedback-button turn-admin-button';
  entry.textContent = 'ADMIN';
  entry.setAttribute('aria-haspopup', 'dialog');
  entry.setAttribute('aria-controls', 'turnAdminPanel');
  menu.append(entry);
  const dialog = documentRef.createElement('dialog');
  dialog.id = 'turnAdminPanel';
  dialog.className = 'm8-dialog turn-admin-panel';
  dialog.setAttribute('aria-labelledby', 'turnAdminTitle');
  dialog.innerHTML = `
    <form class="m8-dialog-card">
      <header class="m8-dialog-head"><h2 id="turnAdminTitle" tabindex="-1">ADMIN</h2>
        <button type="button" class="m8-dialog-close" aria-label="Close admin" data-close>×</button></header>
      <p>Preview session only. Your saved game stays untouched.</p>
      <fieldset><legend>CONTENT FOR TESTING</legend>
        <label><input type="checkbox" name="tracks"> Expose all tracks</label>
        <label><input type="checkbox" name="cars"> Expose all cars</label>
        <label><input type="checkbox" name="rewards"> Expose perks and rewards</label>
      </fieldset>
      <label for="turnAdminTrophies">Temporary trophy total 🏆</label>
      <input id="turnAdminTrophies" name="trophies" type="number" min="0" max="9007199254740991" step="1" required inputmode="numeric" aria-describedby="turnAdminTrophyHelp">
      <p id="turnAdminTrophyHelp">Earn trophies normally from this total. Setting it rebuilds the session’s Trophy Road. Leave content overrides off to test locked rewards.</p>
      <button type="submit">SET TROPHY TOTAL</button>
      <p role="status" aria-live="polite" data-status></p>
      <button type="button" data-reset>RESET ADMIN SESSION</button>
      <button type="button" data-leave>LEAVE ADMIN</button>
    </form>`;
  const style = documentRef.createElement('style');
  style.textContent = `
    .turn-admin-panel .m8-dialog-card { display: grid; gap: var(--turn-space-3); }
    .turn-admin-panel p { margin: 0; font-size: var(--turn-type-body); line-height: var(--turn-leading-body); }
    .turn-admin-panel fieldset { display: grid; gap: var(--turn-space-2); border: var(--turn-border-default) solid var(--turn-outline); }
    .turn-admin-panel label { display: flex; align-items: center; gap: var(--turn-space-2); min-height: var(--turn-target-min); }
    .turn-admin-panel button, .turn-admin-panel input[type="number"] {
      min-height: var(--turn-target-min); min-width: 0; max-width: 100%; box-sizing: border-box;
      padding: var(--turn-space-3); border: var(--turn-border-control) solid var(--turn-outline);
      border-radius: var(--turn-radius-control); background: var(--turn-action-utility); color: var(--turn-text); font: inherit;
    }
    .turn-admin-panel button { cursor: pointer; font-weight: var(--turn-weight-display); }
    .turn-admin-panel input[type="checkbox"] { accent-color: var(--turn-action-primary); }
    .turn-admin-panel button[type="submit"] { background: var(--turn-action-primary); color: var(--turn-ink); }
  `;
  documentRef.head.append(style);
  documentRef.body.append(dialog);
  const form = dialog.querySelector('form');
  const total = form.elements.trophies;
  const status = dialog.querySelector('[data-status]');
  const refresh = () => {
    globalThis.dispatchEvent(new CustomEvent('turn:admin-updated'));
    globalThis.dispatchEvent(new CustomEvent('turn:trophy-road-updated', { detail: { unlocked: [], trophies: globalThis.__turnAchievements.store.trophyTotal() } }));
  };
  entry.addEventListener('click', () => {
    for (const [name, enabled] of Object.entries(admin.options)) form.elements[name].checked = enabled;
    total.value = globalThis.__turnAchievements.store.trophyTotal();
    status.textContent = '';
    dialog.showModal();
    dialog.querySelector('h2').focus();
  });
  form.addEventListener('change', (event) => {
    if (event.target.type !== 'checkbox') return;
    admin.configure(Object.fromEntries(['tracks', 'cars', 'rewards'].map((name) => [name, form.elements[name].checked])));
    refresh();
    status.textContent = 'Session content updated.';
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!globalThis.__turnAchievements.store.setTemporaryTrophyTotal(total.valueAsNumber)) return;
    refresh();
    status.textContent = `Session trophy total set to ${total.valueAsNumber}.`;
  });
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => menuButton.focus({ preventScroll: true }));
  dialog.querySelector('[data-reset]').addEventListener('click', () => admin.reset());
  dialog.querySelector('[data-leave]').addEventListener('click', () => admin.leave());
}
