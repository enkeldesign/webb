export function installLotLayout(root = document.body) {
  const screen = root.querySelector('.lot-screen');
  const viewbox = screen?.querySelector('.lot-viewbox');
  const colors = screen?.querySelector('.lot-colors');
  const attributesHeading = screen?.querySelector('.lot-car-title > span');
  const infoButton = screen?.querySelector('.lot-stats-help');

  if (!screen || !viewbox || !colors || !attributesHeading) return () => {};

  viewbox.hidden = false;
  viewbox.classList.add('lot-viewbox-with-paint');

  // The panel contains both the visual 3D preview and the interactive paint
  // controls. Keep the panel itself in the accessibility tree, then hide only
  // the decorative WebGL preview and its visual chrome.
  viewbox.removeAttribute('aria-hidden');
  viewbox.removeAttribute('aria-label');
  viewbox.querySelector('.lot-viewbox-head')?.setAttribute('aria-hidden', 'true');
  viewbox.querySelector('.lot-view-host')?.setAttribute('aria-hidden', 'true');
  viewbox.querySelector(':scope > small')?.setAttribute('aria-hidden', 'true');
  viewbox.appendChild(colors);

  screen.classList.remove('is-view-closed');
  screen.querySelector('.lot-view-close')?.remove();
  screen.querySelector('.lot-view-open')?.remove();

  attributesHeading.replaceChildren(document.createTextNode('ATTRIBUTES'));
  if (infoButton) {
    infoButton.textContent = 'i';
    infoButton.setAttribute('aria-label', 'What do the attributes mean?');
    infoButton.setAttribute('title', 'What do the attributes mean?');
    attributesHeading.appendChild(infoButton);
  }

  return () => {};
}
