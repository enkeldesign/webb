export function installFixedLiveryUiGuard() {
  const emergencyVehicleNames = new Set(['Fire Truck', 'Police Car', 'Ambulance']);

  const update = () => {
    for (const screen of document.querySelectorAll('.lot-screen')) {
      const colors = screen.querySelector('.lot-colors');
      if (!colors) continue;

      const selectedName = screen.querySelector('.lot-car-title strong')?.textContent?.trim() || '';
      const fixedLivery = colors.querySelector('.lot-fixed-livery');
      const fixedVehicle = Boolean(fixedLivery) || emergencyVehicleNames.has(selectedName);
      const viewbox = screen.querySelector('.lot-viewbox');

      if (fixedVehicle) {
        if (colors.childNodes.length > 0) colors.replaceChildren();
        colors.hidden = false;
        colors.setAttribute('aria-hidden', 'true');
        colors.removeAttribute('aria-label');
        viewbox?.classList.add('lot-viewbox-with-paint');
      } else if (colors.children.length > 0) {
        colors.hidden = false;
        colors.removeAttribute('aria-hidden');
        viewbox?.classList.add('lot-viewbox-with-paint');
      }
    }
  };

  const observer = new MutationObserver(update);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
  update();

  return () => observer.disconnect();
}
