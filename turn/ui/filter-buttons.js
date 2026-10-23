// Shared ACHIEVEMENTS / INSTALL PERK toggle-button presentation. Native buttons
// retain Tab, Space and Enter; each owner enforces its own single selection.
export function filterButtons(choices, attribute, selected = 'all') {
  return choices.map(([id, label]) => `<button type="button" aria-pressed="${id === selected}" ${attribute}="${id}">${label}</button>`).join('');
}
