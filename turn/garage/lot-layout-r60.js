export function installLotLayout(root = document.body) {
  const screen = root.querySelector('.lot-screen');
  const attributesHeading = screen?.querySelector('.lot-car-title > span');
  const infoButton = screen?.querySelector('.lot-stats-help');

  if (!screen || !attributesHeading) return () => {};

  screen.classList.remove('is-view-closed');

  attributesHeading.replaceChildren(document.createTextNode('ATTRIBUTES'));
  if (infoButton) {
    infoButton.textContent = 'i';
    infoButton.setAttribute('aria-label', 'What do the attributes mean?');
    infoButton.setAttribute('title', 'What do the attributes mean?');
    attributesHeading.appendChild(infoButton);
  }

  return () => {};
}
