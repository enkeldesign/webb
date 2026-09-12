import { AUTHORED_PERK_ICON } from '../ui/perk-icon.js';

const STYLE_ID = 'turn-lot-perk-authored-icon-styles';

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .lot-perk-disclosure .lot-perk-head {
      justify-content: flex-start;
    }

    .lot-perk-disclosure .lot-perk-icon {
      display: grid;
      flex: 0 0 46px;
      width: 46px;
      height: 47px;
      margin-top: 1px;
      color: var(--ink, #08090a);
      place-items: center;
    }

    .lot-perk-disclosure .lot-perk-icon svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    .lot-perk-disclosure .lot-perk-heading {
      flex: 1 1 auto;
    }

    .lot-perk-disclosure .lot-perk-close {
      margin-left: auto;
    }

    @media (max-height: 520px) {
      .lot-perk-disclosure .lot-perk-icon {
        flex-basis: 40px;
        width: 40px;
        height: 41px;
      }
    }
  `;
  document.head.appendChild(style);
}

export function installLotPerkIcon(root = document.body) {
  const head = root?.querySelector?.('.lot-perk-disclosure .lot-perk-head');
  if (!head) return () => {};

  const existing = head.querySelector(':scope > .lot-perk-icon');
  if (existing) return () => {};

  installStyles();

  const icon = document.createElement('span');
  icon.className = 'lot-perk-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = AUTHORED_PERK_ICON;
  head.insertBefore(icon, head.firstChild);

  return () => icon.remove();
}
