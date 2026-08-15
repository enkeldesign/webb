const partTabs = [...document.querySelectorAll('.part-tab[data-part]')];
const partPlayButtons = [...document.querySelectorAll('.part-play[data-part]')];

function selectedPart() {
  const selected = partTabs.find((tab) => tab.classList.contains('active') || tab.getAttribute('aria-selected') === 'true');
  return selected?.dataset.part || 'tune';
}

function renderActivePartPlayButton() {
  const part = selectedPart();
  partPlayButtons.forEach((button) => {
    const active = button.dataset.part === part;
    button.classList.toggle('primary', active);
    button.classList.toggle('play', !active);
    if (active) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  });
}

renderActivePartPlayButton();

const observer = new MutationObserver(renderActivePartPlayButton);
partTabs.forEach((tab) => observer.observe(tab, {
  attributes: true,
  attributeFilter: ['class', 'aria-selected']
}));

document.querySelector('.part-tabs')?.addEventListener('click', () => {
  requestAnimationFrame(renderActivePartPlayButton);
});
