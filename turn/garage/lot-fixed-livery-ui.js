export function installFixedLiveryUiGuard() {
  const update = () => {
    for (const colors of document.querySelectorAll('.lot-colors')) {
      const fixedLivery = colors.querySelector('.lot-fixed-livery');
      if (fixedLivery) {
        colors.replaceChildren();
        colors.hidden = true;
        colors.removeAttribute('aria-label');
      } else if (colors.children.length > 0) {
        colors.hidden = false;
      }
    }
  };

  const observer = new MutationObserver(update);
  observer.observe(document.body, { childList: true, subtree: true });
  update();

  return () => observer.disconnect();
}
