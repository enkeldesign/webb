globalThis.__turnAnalogGas = 0;

const gasButton = document.querySelector('#gasButton');
const GAS_BASE = 0.42;
const GAS_DRAG_RANGE = 110;

if (gasButton && !gasButton.dataset.turnAnalogGasInstalled) {
  gasButton.dataset.turnAnalogGasInstalled = 'true';

  let gasPointerId = null;
  let gasStartY = 0;

  function setAnalogGas(value) {
    const throttle = Math.max(0, Math.min(1, value));
    globalThis.__turnAnalogGas = throttle;
    gasButton.style.setProperty('--gas-level', throttle.toFixed(3));
    gasButton.textContent = 'Gas';
    gasButton.setAttribute('aria-label', throttle > 0 ? `Gas ${Math.round(throttle * 100)} percent` : 'Gas');
  }

  function releaseGas(event) {
    if (gasPointerId === null || (event && event.pointerId !== gasPointerId)) return;
    gasButton.releasePointerCapture?.(gasPointerId);
    gasPointerId = null;
    gasButton.classList.remove('is-dragging');
    setAnalogGas(0);
  }

  gasButton.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    gasPointerId = event.pointerId;
    gasStartY = event.clientY;
    gasButton.setPointerCapture?.(event.pointerId);
    gasButton.classList.add('is-dragging');
    setAnalogGas(GAS_BASE);
  });

  gasButton.addEventListener('pointermove', (event) => {
    if (event.pointerId !== gasPointerId) return;
    event.preventDefault();
    const drag = (gasStartY - event.clientY) / GAS_DRAG_RANGE;
    setAnalogGas(GAS_BASE + drag);
  });

  gasButton.addEventListener('pointerup', releaseGas);
  gasButton.addEventListener('pointercancel', releaseGas);
  gasButton.addEventListener('lostpointercapture', () => {
    if (gasPointerId !== null) {
      gasPointerId = null;
      gasButton.classList.remove('is-dragging');
      setAnalogGas(0);
    }
  });

  setAnalogGas(0);
}
