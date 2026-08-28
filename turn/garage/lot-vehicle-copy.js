const VEHICLE_COPY_BY_ID = Object.freeze({
  convertible: 'A compact all-wheel-drive utility car with a short wheelbase, high ride height and sure-footed handling.',
  suv: 'A road-focused luxury SUV with a broad body, high cabin and strong acceleration.',
  'sedan-sports': 'A compact sporty hatchback with a short wheelbase, rear hatch and practical everyday shape.',
  'toy-racer': 'A grey-and-gold competition car with a low stance, high rear wing and rally-bred trim.'
});

export function installLotVehicleCopy(root = document.body) {
  const screen = root?.matches?.('.lot-screen') ? root : root?.querySelector?.('.lot-screen');
  const picker = screen?.querySelector?.('.lot-car-picker');
  const description = screen?.querySelector?.('.lot-car-description');
  if (!screen || !picker || !description) return () => {};

  const sync = () => {
    for (const button of picker.querySelectorAll('.lot-car-option[data-car-id]')) {
      const copy = VEHICLE_COPY_BY_ID[button.dataset.carId];
      if (!copy) continue;
      const name = String(button.textContent || '').trim();
      button.setAttribute('aria-label', `${name} ${copy}`.trim());
      if (button.getAttribute('aria-checked') === 'true') description.textContent = copy;
    }
  };

  const observer = new MutationObserver(sync);
  observer.observe(picker, {
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-checked']
  });
  sync();

  return () => observer.disconnect();
}
