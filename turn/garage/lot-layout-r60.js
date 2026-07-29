export function installLotLayout(root = document.body) {
  const screen = root.querySelector('.lot-screen');
  const viewbox = screen?.querySelector('.lot-viewbox');
  const colors = screen?.querySelector('.lot-colors');
  const attributesHeading = screen?.querySelector('.lot-car-title > span');
  const infoButton = screen?.querySelector('.lot-stats-help');

  if (!screen || !viewbox || !colors || !attributesHeading) return () => {};

  viewbox.hidden = false;
  viewbox.classList.add('lot-viewbox-with-paint');
  viewbox.setAttribute('aria-hidden', 'true');
  viewbox.removeAttribute('aria-label');

  // The paint controls are visually placed inside the 3D panel, but must remain
  // outside its aria-hidden subtree so screen readers can reach them.
  const paintA11yHost = document.createElement('div');
  paintA11yHost.className = 'lot-paint-a11y-host';
  paintA11yHost.appendChild(colors);
  viewbox.insertAdjacentElement('afterend', paintA11yHost);

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
