function waitForRuntime() {
  if (globalThis.__turnRuntime) {
    install(globalThis.__turnRuntime);
    return;
  }

  window.addEventListener('turn:runtime-ready', (event) => {
    install(event.detail || globalThis.__turnRuntime);
  }, { once: true });
}

function install(runtime) {
  if (!runtime || runtime.__backToLotInstalled) return;
  runtime.__backToLotInstalled = true;

  const resetButton = document.querySelector('#resetButton');
  if (!resetButton) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'utility back-to-lot-button';
  button.textContent = 'Back to the Lot';
  button.setAttribute('aria-label', 'Back to The Lot and choose another car');

  resetButton.insertAdjacentElement('afterend', button);

  button.addEventListener('click', async () => {
    if (button.disabled || typeof runtime.openLot !== 'function') return;
    button.disabled = true;
    try {
      await runtime.openLot();
    } finally {
      button.disabled = false;
    }
  });
}

waitForRuntime();
