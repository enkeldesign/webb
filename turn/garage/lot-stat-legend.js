import { VEHICLE_STAT_LEGEND } from '../vehicle/catalog.js?build=20260724-r59';

const DIALOG_ID = 'turnLotStatsLegend';
const TITLE_ID = 'turnLotStatsLegendTitle';

export function installLotStatLegend(root = document.body) {
  const screen = root.querySelector('.lot-screen');
  const stats = screen?.querySelector('.lot-stats');
  if (!screen || !stats || screen.querySelector('.lot-stats-help')) return () => {};

  let previousFocus = null;
  relabelStats(stats);

  const statsObserver = new MutationObserver(() => relabelStats(stats));
  statsObserver.observe(stats, { childList: true });

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'lot-stats-help';
  trigger.textContent = 'WHAT DO THE STATS MEAN?';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', DIALOG_ID);
  trigger.setAttribute('aria-expanded', 'false');
  trigger.addEventListener('click', openDialog);
  stats.insertAdjacentElement('afterend', trigger);

  const dialog = makeDialog();
  screen.appendChild(dialog);

  return () => {
    statsObserver.disconnect();
    trigger.remove();
    dialog.remove();
    previousFocus = null;
  };

  function relabelStats(statsElement) {
    const labels = statsElement.querySelectorAll('.lot-stat > span');
    labels.forEach((label, index) => {
      const definition = VEHICLE_STAT_LEGEND[index];
      if (definition && label.textContent !== definition.label) {
        label.textContent = definition.label;
      }
    });
  }

  function makeDialog() {
    const overlay = document.createElement('section');
    overlay.className = 'lot-stats-dialog';
    overlay.id = DIALOG_ID;
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', TITLE_ID);

    const panel = document.createElement('div');
    panel.className = 'lot-stats-dialog-card';

    const header = document.createElement('header');
    header.className = 'lot-stats-dialog-head';

    const title = document.createElement('h2');
    title.id = TITLE_ID;
    title.textContent = 'WHAT THE STATS DO';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'lot-stats-dialog-close';
    close.setAttribute('aria-label', 'Close vehicle stat legend');
    close.textContent = '×';
    close.addEventListener('click', closeDialog);

    header.append(title, close);

    const list = document.createElement('div');
    list.className = 'lot-stats-dialog-list';
    for (const entry of VEHICLE_STAT_LEGEND) {
      const item = document.createElement('div');
      item.className = 'lot-stats-dialog-item';

      const name = document.createElement('strong');
      name.textContent = entry.label;

      const description = document.createElement('p');
      description.textContent = entry.description;

      item.append(name, description);
      list.appendChild(item);
    }

    const rule = document.createElement('p');
    rule.className = 'lot-stats-dialog-rule';
    rule.textContent = 'GAS is fastest. DRIFT turns harder but always costs speed. BOOST is a limited burst.';

    panel.append(header, list, rule);
    overlay.appendChild(panel);

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeDialog();
    });
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDialog();
      } else if (event.key === 'Tab') {
        event.preventDefault();
        close.focus();
      }
    });

    return overlay;
  }

  function openDialog() {
    previousFocus = document.activeElement;
    dialog.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    dialog.querySelector('.lot-stats-dialog-close')?.focus();
  }

  function closeDialog() {
    dialog.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
    else trigger.focus();
  }
}
