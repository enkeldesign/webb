const BLOCKED_EVENT = 'turn:motion-permission-blocked';
const installations = new WeakMap();

export function installMotionPermissionDeniedDialog({ environment = globalThis } = {}) {
  if (installations.has(environment)) return installations.get(environment);

  const documentRef = environment.document;
  if (!documentRef?.body || typeof environment.addEventListener !== 'function') {
    const unavailable = Object.freeze({ installed: false, show() {} });
    installations.set(environment, unavailable);
    return unavailable;
  }

  let dialog = null;

  function ensureDialog() {
    if (dialog?.isConnected) return dialog;

    dialog = documentRef.createElement('dialog');
    dialog.className = 'turn-motion-denied-dialog';
    dialog.setAttribute('aria-labelledby', 'turnMotionDeniedTitle');
    dialog.setAttribute('aria-describedby', 'turnMotionDeniedText');
    dialog.innerHTML = `
      <article class="turn-motion-denied-card">
        <span class="turn-motion-denied-kicker">DEVICE ROTATION</span>
        <h2 id="turnMotionDeniedTitle">MOTION ACCESS DENIED</h2>
        <p id="turnMotionDeniedText">You denied motion access. Close and reopen TURN to try again, or use on-screen steering in Settings.</p>
        <button type="button" data-motion-dialog-close>OK</button>
      </article>`;

    const closeButton = dialog.querySelector('[data-motion-dialog-close]');
    closeButton.addEventListener('click', () => closeDialog());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) closeDialog();
    });
    dialog.addEventListener('close', restoreFocus);
    documentRef.body.appendChild(dialog);
    return dialog;
  }

  function restoreFocus() {
    const target = dialog?.__turnReturnFocus;
    dialog.__turnReturnFocus = null;
    target?.focus?.();
  }

  function closeDialog() {
    if (!dialog) return;
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else {
      dialog.removeAttribute('open');
      restoreFocus();
    }
  }

  function show() {
    const currentDialog = ensureDialog();
    currentDialog.__turnReturnFocus = documentRef.querySelector('.lot-race') || documentRef.activeElement;

    if (typeof currentDialog.showModal === 'function') {
      if (!currentDialog.open) currentDialog.showModal();
    } else {
      currentDialog.setAttribute('open', '');
    }

    const focusClose = () => currentDialog.querySelector('[data-motion-dialog-close]')?.focus?.();
    if (typeof environment.requestAnimationFrame === 'function') environment.requestAnimationFrame(focusClose);
    else environment.setTimeout?.(focusClose, 0);
  }

  environment.addEventListener(BLOCKED_EVENT, show);

  const api = Object.freeze({ installed: true, show });
  installations.set(environment, api);
  return api;
}
