export function installFixedLiveryUiGuard() {
  const update = () => {
    for (const colors of document.querySelectorAll('.lot-colors')) {
      const viewbox = colors.closest('.lot-screen')?.querySelector('.lot-viewbox');
      const fixedLivery = colors.querySelector('.lot-fixed-livery');
      if (fixedLivery) {
        colors.replaceChildren();
        colors.hidden = true;
        colors.removeAttribute('aria-label');
        viewbox?.classList.remove('lot-viewbox-with-paint');
      } else if (colors.children.length > 0) {
        colors.hidden = false;
        viewbox?.classList.add('lot-viewbox-with-paint');
      }
    }
  };

  const observer = new MutationObserver(update);
  observer.observe(document.body, { childList: true, subtree: true });
  update();

  return () => observer.disconnect();
}
