const STYLE_ID = 'turn-world-playground-entry-style';
const SECTION_CLASS = 'm8-guide-world-playground';
const ENTRY_ATTRIBUTE = 'data-turn-world-playground-entry';

export function installWorldPlaygroundEntry(root = document) {
  installStyles(root);
  const dialog = root.querySelector('.m8-how-dialog');
  const grid = dialog?.querySelector('.m8-guide-grid');
  const before = grid?.querySelector('.m8-guide-wide');
  if (!dialog || !grid || !before) return null;

  const existing = dialog.querySelector(`[${ENTRY_ATTRIBUTE}]`);
  if (existing) return existing;

  const section = root.createElement('section');
  section.className = SECTION_CLASS;
  section.dataset.guideTopic = 'world-playground';

  const button = root.createElement('button');
  button.type = 'button';
  button.setAttribute(ENTRY_ATTRIBUTE, '');
  button.setAttribute('aria-label', 'Explore the world of TURN in the Learner Car');
  button.innerHTML = `
    <strong class="m8-guide-card-number" aria-hidden="true">8</strong>
    <span class="m8-guide-card-title" role="heading" aria-level="3">Explore the world of TURN</span>
    <span class="turn-world-playground-arrow" aria-hidden="true">›</span>`;

  section.appendChild(button);
  grid.insertBefore(section, before);
  dialog.dataset.worldPlaygroundEntry = 'r1-map-layout';
  return button;
}

function installStyles(root) {
  if (root.getElementById(STYLE_ID)) return;
  const style = root.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .m8-guide-grid section.${SECTION_CLASS} {
      display: block;
      min-width: 0;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
    }

    .${SECTION_CLASS} > button {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 13px;
      width: 100%;
      min-height: 70px;
      padding: 13px 16px;
      border: 4px solid var(--m8-ink);
      border-radius: 20px;
      color: var(--m8-ink);
      background: var(--turn-action-information, #38d9ff);
      box-shadow: 5px 5px 0 var(--m8-ink);
      box-sizing: border-box;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }

    .${SECTION_CLASS} > button:focus-visible {
      outline: 5px solid var(--m8-pink);
      outline-offset: 4px;
    }

    .${SECTION_CLASS} .turn-world-playground-arrow {
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      border: 2px solid var(--m8-ink);
      border-radius: 50%;
      background: var(--m8-cream);
      font-size: 2rem;
      font-weight: 950;
      line-height: .75;
    }

    .${SECTION_CLASS} > button[aria-busy="true"] {
      cursor: progress;
      opacity: .72;
    }

    /* The model world is deliberately untimed free roam: keep speed and driving
       controls, but remove competitive lap/record chips and result surfaces. */
    .turn-world-playground-active .lap-chip,
    .turn-world-playground-active .time-chip,
    .turn-world-playground-active .best-chip,
    .turn-world-playground-active .position-chip,
    .turn-world-playground-active .lap-result-toast {
      display: none !important;
    }
  `;
  root.head.appendChild(style);
}
