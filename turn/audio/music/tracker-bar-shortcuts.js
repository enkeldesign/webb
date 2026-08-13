const previous = document.getElementById('prevBarButton');
const next = document.getElementById('nextBarButton');

previous.setAttribute('aria-keyshortcuts', 'Shift+ArrowLeft');
next.setAttribute('aria-keyshortcuts', 'Shift+ArrowRight');
previous.title = 'Previous bar · Shift + Left Arrow';
next.title = 'Next bar · Shift + Right Arrow';

function editingText(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

function focusSelectedCell() {
  requestAnimationFrame(() => document.querySelector('.step-cell.selected')?.focus());
}

document.addEventListener('keydown', (event) => {
  if (!event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || editingText(event.target)) return;
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

  event.preventDefault();
  (event.key === 'ArrowLeft' ? previous : next).click();
  focusSelectedCell();
});
