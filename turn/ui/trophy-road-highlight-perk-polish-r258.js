import { TROPHY_ROAD_REWARDS } from '../progression/trophy-road.js?revision=r253-supercar-release';

const STYLE_ID = 'turn-trophy-road-highlight-perk-polish-r258-styles';
const rewardByTitle = new Map(TROPHY_ROAD_REWARDS.map((reward) => [reward.title, reward]));

let highlightRoot = null;
let highlightObserver = null;
let detailLayer = null;
let detailObserver = null;
let returnHighlight = null;

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .turn-trophy-road-highlights > [role="button"] {
      cursor: pointer;
      touch-action: manipulation;
    }

    .turn-trophy-road-highlights > [role="button"]:focus-visible {
      outline: 4px solid var(--turn-focus-ring, #ffd43b);
      outline-offset: 2px;
    }

    .turn-achievements-dialog .turn-trophy-road-detail-close,
    .lot-showroom .lot-perk-disclosure .lot-perk-close {
      background: var(--turn-action-navigation, #ff7b54);
    }

    .lot-showroom .lot-car-title .lot-perk-button.turn-perk-selection-wiggle {
      animation-duration: 600ms;
    }
  `;
  document.head.appendChild(style);
}

function rewardForHighlight(element) {
  const title = element?.querySelector?.('strong')?.textContent?.trim() || '';
  return rewardByTitle.get(title) || null;
}

function rewardMarker(rewardId) {
  if (!rewardId) return null;
  return document.querySelector(
    `.turn-achievements-dialog .turn-trophy-road-marker[data-trophy-reward="${rewardId}"]`
  );
}

function clearHighlightSemantics(element) {
  delete element.dataset.trophyHighlightReward;
  element.removeAttribute('role');
  element.removeAttribute('tabindex');
  element.removeAttribute('aria-haspopup');
  element.removeAttribute('aria-controls');
  element.removeAttribute('aria-expanded');
  element.removeAttribute('aria-label');
}

function syncHighlight(element) {
  const reward = rewardForHighlight(element);
  if (!reward) {
    clearHighlightSemantics(element);
    return;
  }

  const marker = rewardMarker(reward.id);
  const eyebrow = element.querySelector('span')?.textContent?.trim() || 'Trophy Road reward';
  element.dataset.trophyHighlightReward = reward.id;
  element.setAttribute('role', 'button');
  element.tabIndex = 0;
  element.setAttribute('aria-haspopup', 'dialog');
  element.setAttribute('aria-controls', 'turnTrophyRoadDetailDialog');
  element.setAttribute('aria-expanded', String(marker?.getAttribute('aria-expanded') === 'true'));
  element.setAttribute(
    'aria-label',
    `${eyebrow}. ${reward.title}. ${reward.threshold} trophies. Show reward details.`
  );
}

function syncHighlights() {
  if (!highlightRoot) return;
  for (const element of highlightRoot.querySelectorAll('[data-trophy-road-highlight]')) {
    syncHighlight(element);
  }
}

function activateHighlight(element) {
  const rewardId = element?.dataset?.trophyHighlightReward;
  const marker = rewardMarker(rewardId);
  if (!marker) return;

  returnHighlight = element;
  marker.click();
  queueMicrotask(syncHighlights);
}

function handleHighlightClick(event) {
  const element = event.target.closest?.('[data-trophy-road-highlight]');
  if (!element || !highlightRoot?.contains(element) || !element.dataset.trophyHighlightReward) return;
  activateHighlight(element);
}

function handleHighlightKeydown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const element = event.target.closest?.('[data-trophy-road-highlight]');
  if (!element || !highlightRoot?.contains(element) || !element.dataset.trophyHighlightReward) return;
  event.preventDefault();
  activateHighlight(element);
}

function syncDetailState() {
  if (!detailLayer) return;
  const isOpen = detailLayer.hidden === false;
  syncHighlights();
  if (isOpen) return;

  const target = returnHighlight;
  returnHighlight = null;
  const dialog = target?.closest?.('.turn-achievements-dialog');
  if (target?.isConnected && (dialog?.open === true || dialog?.hasAttribute?.('open'))) {
    try {
      target.focus({ preventScroll: true });
    } catch (_) {
      target.focus();
    }
  }
}

function connect(dialog) {
  if (highlightRoot) return;
  const highlights = dialog?.querySelector?.('.turn-trophy-road-highlights');
  const details = dialog?.querySelector?.('[data-trophy-road-detail-layer]');
  if (!highlights || !details) return;

  highlightRoot = highlights;
  detailLayer = details;
  highlightRoot.addEventListener('click', handleHighlightClick);
  highlightRoot.addEventListener('keydown', handleHighlightKeydown);
  highlightObserver = new MutationObserver(syncHighlights);
  highlightObserver.observe(highlightRoot, { childList: true, subtree: true });
  detailObserver = new MutationObserver(syncDetailState);
  detailObserver.observe(detailLayer, { attributes: true, attributeFilter: ['hidden'] });
  syncHighlights();
}

function install() {
  installStyles();
  const currentDialog = document.querySelector('.turn-achievements-dialog');
  if (currentDialog) {
    connect(currentDialog);
    return;
  }

  const bodyObserver = new MutationObserver(() => {
    const dialog = document.querySelector('.turn-achievements-dialog');
    if (!dialog) return;
    bodyObserver.disconnect();
    connect(dialog);
  });
  bodyObserver.observe(document.body, { childList: true });
}

if (document.body) install();
else document.addEventListener('DOMContentLoaded', install, { once: true });