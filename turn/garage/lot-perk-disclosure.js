import { getCarDefinition } from '../vehicle/catalog.js?revision=r243-mountain-1300';
import { vehiclePerkPresentation } from '../vehicle/perk-presentation.js?revision=r220-apex-grip';
import {
  isVehiclePerkUnlocked,
  rewardForVehiclePerk
} from '../progression/trophy-road.js?revision=r243-mountain-1300';

const STYLE_ID = 'turn-lot-perk-popover-r225-styles';
const activeDisclosures = new WeakMap();
let nextPopoverId = 0;

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .lot-showroom .lot-car-title {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 8px;
    }

    .lot-showroom .lot-car-title strong {
      grid-column: 1;
      grid-row: 1;
      min-width: 0;
    }

    .lot-showroom .lot-perk-button {
      grid-column: 2;
      grid-row: 1;
      min-width: 0;
      min-height: 38px;
      margin: 0 3px 3px 0;
      padding: 5px 13px;
      border: 2.5px solid var(--ink, #08090a);
      border-radius: 999px;
      background: var(--turn-action-information, #38d9ff);
      box-shadow: 4px 4px 0 var(--ink, #08090a);
      color: var(--ink, #08090a);
      font-size: clamp(.58rem, 1.05vw, .72rem);
      font-weight: 950;
      letter-spacing: .07em;
      line-height: 1;
    }

    .lot-showroom .lot-perk-button.is-trophy-road-perk.is-locked {
      background: var(--turn-reward-feature-locked, #fff1b8);
    }

    .lot-showroom .lot-perk-button.is-trophy-road-perk.is-unlocked {
      background: var(--turn-reward-feature-unlocked, #ffd43b);
    }

    /* Keep the PERK footprint in every title row. Cars without a perk use an
       inert, invisible placeholder so their attributes start at the same height. */
    .lot-showroom .lot-perk-button.is-layout-placeholder {
      visibility: hidden;
      pointer-events: none;
    }

    .lot-perk-disclosure[hidden] {
      display: none !important;
    }

    .lot-showroom .lot-perk-button:focus-visible,
    .lot-perk-disclosure:focus-visible,
    .lot-perk-disclosure .lot-perk-close:focus-visible {
      outline: 3px solid var(--cyan, #38d9ff);
      outline-offset: 3px;
    }

    .lot-perk-disclosure {
      position: fixed;
      z-index: 40;
      inset: auto;
      top: var(--lot-perk-popover-top, 12px);
      left: var(--lot-perk-popover-left, 12px);
      box-sizing: border-box;
      width: min(300px, calc(100vw - 24px));
      max-height: min(230px, calc(100vh - 24px));
      max-height: min(230px, calc(100dvh - 24px));
      margin: 0 !important;
      padding: 11px 12px 12px;
      overflow: auto;
      overscroll-behavior: contain;
      border: 3px solid var(--ink, #08090a);
      border-radius: 15px;
      background: var(--paper, #fff8e8);
      box-shadow: 7px 7px 0 var(--ink, #08090a);
      color: var(--ink, #08090a);
    }

    .lot-perk-disclosure .lot-perk-head {
      display: flex;
      min-width: 0;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }

    .lot-perk-disclosure .lot-perk-heading {
      min-width: 0;
    }

    .lot-perk-disclosure .lot-perk-eyebrow {
      display: block;
      margin-bottom: 4px;
      color: #a20f5d;
      font-size: .48rem;
      font-weight: 950;
      letter-spacing: .1em;
    }

    .lot-perk-disclosure .lot-perk-title {
      display: block;
      font-size: clamp(.78rem, 1.7vw, 1.05rem);
      font-weight: 950;
      line-height: 1.05;
      overflow-wrap: anywhere;
    }

    .lot-perk-disclosure .lot-perk-close {
      flex: 0 0 34px;
      width: 34px;
      height: 34px;
      min-height: 0;
      padding: 0 0 3px;
      border: 2px solid var(--ink, #08090a);
      border-radius: 50%;
      background: var(--pink, #ff4fa3);
      box-shadow: 3px 3px 0 var(--ink, #08090a);
      color: var(--ink, #08090a);
      font: 950 1.2rem/1 system-ui, sans-serif;
    }

    .lot-showroom .lot-perk-disclosure .lot-perk-copy {
      margin: 9px 0 0;
      color: var(--ink, #08090a);
      font-family: system-ui, sans-serif;
      font-size: clamp(.7rem, 1.35vw, .86rem);
      font-weight: 750;
      line-height: 1.3;
    }

    @media (max-height: 520px) {
      .lot-showroom .lot-perk-button {
        min-height: 34px;
        margin-right: 2px;
        padding: 4px 11px;
        font-size: clamp(.54rem, 1vw, .64rem);
      }

      .lot-perk-disclosure {
        width: min(280px, calc(100vw - 20px));
        max-height: calc(100vh - 20px);
        max-height: calc(100dvh - 20px);
        padding: 9px 10px 10px;
        border-radius: 13px;
        box-shadow: 5px 5px 0 var(--ink, #08090a);
      }

      .lot-showroom .lot-perk-disclosure .lot-perk-copy {
        margin-top: 7px;
        font-size: clamp(.66rem, 1.28vw, .8rem);
      }
    }
  `;
  document.head.appendChild(style);
}

function selectedVehicleId(screen) {
  return screen.querySelector('.lot-car-option[aria-checked="true"]')?.dataset.carId || '';
}

function focusWithoutScroll(element) {
  if (!element) return;
  try {
    element.focus({ preventScroll: true });
  } catch (_) {
    element.focus();
  }
}

export function installLotPerkDisclosure(root = document.body) {
  const screen = root?.matches?.('.lot-screen') ? root : root?.querySelector?.('.lot-screen');
  const card = screen?.querySelector?.('.lot-card');
  const carTitle = card?.querySelector?.('.lot-car-title');
  const carName = carTitle?.querySelector?.(':scope > strong');
  const description = card?.querySelector?.('.lot-car-description');
  const picker = screen?.querySelector?.('.lot-car-picker');
  if (!screen || !card || !carTitle || !carName || !description || !picker) return () => {};

  const active = activeDisclosures.get(screen);
  if (active) return active.release;

  // A Lot can be enhanced through both the prepared route and the long-lived
  // enhancement runtime. Keep the perk presentation idempotent even if those
  // paths overlap, and clean up stale controls left by an older install.
  for (const stale of screen.querySelectorAll('.lot-perk-disclosure')) stale.remove();
  for (const stale of screen.querySelectorAll('.lot-perk-button')) stale.remove();

  installStyles();

  nextPopoverId += 1;
  const popoverId = `turn-lot-perk-popover-${nextPopoverId}`;
  const titleId = `${popoverId}-title`;
  const descriptionId = `${popoverId}-description`;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'lot-perk-button is-layout-placeholder';
  trigger.textContent = 'PERK';
  trigger.disabled = true;
  trigger.tabIndex = -1;
  trigger.setAttribute('aria-hidden', 'true');
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', popoverId);
  trigger.setAttribute('aria-expanded', 'false');
  carName.after(trigger);

  const popover = document.createElement('div');
  popover.className = 'lot-perk-disclosure';
  popover.id = popoverId;
  popover.hidden = true;
  popover.tabIndex = -1;
  popover.setAttribute('popover', 'auto');
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-modal', 'false');
  popover.setAttribute('aria-labelledby', titleId);
  popover.setAttribute('aria-describedby', descriptionId);

  const header = document.createElement('div');
  header.className = 'lot-perk-head';

  const heading = document.createElement('div');
  heading.className = 'lot-perk-heading';

  const eyebrow = document.createElement('span');
  eyebrow.className = 'lot-perk-eyebrow';
  eyebrow.textContent = 'PERK';
  eyebrow.setAttribute('aria-hidden', 'true');

  const title = document.createElement('strong');
  title.className = 'lot-perk-title';
  title.id = titleId;
  heading.append(eyebrow, title);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'lot-perk-close';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Close perk information');
  header.append(heading, close);

  const copy = document.createElement('p');
  copy.className = 'lot-perk-copy';
  copy.id = descriptionId;
  popover.append(header, copy);
  description.after(popover);

  const supportsNativePopover = typeof popover.showPopover === 'function'
    && typeof popover.hidePopover === 'function';
  let isOpen = false;
  let currentPerkText = '';
  let focusFrame = 0;

  function positionPopover() {
    if (!isOpen || !trigger.isConnected || !popover.isConnected) return;

    const visualViewport = globalThis.visualViewport;
    const viewportLeft = visualViewport?.offsetLeft || 0;
    const viewportTop = visualViewport?.offsetTop || 0;
    const viewportWidth = visualViewport?.width || globalThis.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = visualViewport?.height || globalThis.innerHeight || document.documentElement.clientHeight;
    const margin = viewportHeight <= 520 ? 10 : 12;
    const gap = 8;
    const triggerBox = trigger.getBoundingClientRect();
    const popoverBox = popover.getBoundingClientRect();
    const minLeft = viewportLeft + margin;
    const maxLeft = viewportLeft + viewportWidth - popoverBox.width - margin;
    const left = Math.min(Math.max(minLeft, triggerBox.right - popoverBox.width), Math.max(minLeft, maxLeft));
    const below = triggerBox.bottom + gap;
    const above = triggerBox.top - popoverBox.height - gap;
    const maxTop = viewportTop + viewportHeight - popoverBox.height - margin;
    const top = below <= maxTop ? below : Math.max(viewportTop + margin, above);

    popover.style.setProperty('--lot-perk-popover-left', `${Math.round(left)}px`);
    popover.style.setProperty('--lot-perk-popover-top', `${Math.round(top)}px`);
  }

  function addOpenListeners() {
    document.addEventListener('keydown', handleDocumentKeydown, true);
    if (!supportsNativePopover) document.addEventListener('pointerdown', handleDocumentPointerDown, true);
    globalThis.addEventListener?.('resize', positionPopover);
    globalThis.addEventListener?.('scroll', positionPopover, true);
    globalThis.visualViewport?.addEventListener?.('resize', positionPopover);
    globalThis.visualViewport?.addEventListener?.('scroll', positionPopover);
  }

  function removeOpenListeners() {
    document.removeEventListener('keydown', handleDocumentKeydown, true);
    document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
    globalThis.removeEventListener?.('resize', positionPopover);
    globalThis.removeEventListener?.('scroll', positionPopover, true);
    globalThis.visualViewport?.removeEventListener?.('resize', positionPopover);
    globalThis.visualViewport?.removeEventListener?.('scroll', positionPopover);
  }

  function setOpenState(nextOpen) {
    if (isOpen === nextOpen) return;
    isOpen = nextOpen;
    trigger.setAttribute('aria-expanded', String(nextOpen));
    if (nextOpen) addOpenListeners();
    else removeOpenListeners();
  }

  function openPopover() {
    if (isOpen || !currentPerkText || trigger.disabled) return;
    popover.hidden = false;
    if (supportsNativePopover) popover.showPopover();
    setOpenState(true);
    positionPopover();
    if (focusFrame) cancelAnimationFrame(focusFrame);
    focusFrame = requestAnimationFrame(() => {
      focusFrame = 0;
      positionPopover();
      focusWithoutScroll(popover);
    });
  }

  function closePopover({ restoreFocus = false } = {}) {
    if (focusFrame) {
      cancelAnimationFrame(focusFrame);
      focusFrame = 0;
    }
    if (supportsNativePopover && popover.matches(':popover-open')) popover.hidePopover();
    popover.hidden = true;
    setOpenState(false);
    if (restoreFocus && trigger.isConnected && !trigger.disabled) focusWithoutScroll(trigger);
  }

  function handleTriggerClick() {
    if (isOpen) closePopover({ restoreFocus: true });
    else openPopover();
  }

  function handleCloseClick() {
    closePopover({ restoreFocus: true });
  }

  function handleDocumentKeydown(event) {
    if (event.key !== 'Escape' || !isOpen) return;
    event.preventDefault();
    event.stopPropagation();
    closePopover({ restoreFocus: true });
  }

  function handleDocumentPointerDown(event) {
    if (!isOpen || popover.contains(event.target) || trigger.contains(event.target)) return;
    closePopover();
  }

  function handleNativeToggle(event) {
    const nextOpen = event.newState === 'open';
    if (!nextOpen) popover.hidden = true;
    setOpenState(nextOpen);
  }

  trigger.addEventListener('click', handleTriggerClick);
  close.addEventListener('click', handleCloseClick);
  if (supportsNativePopover) popover.addEventListener('toggle', handleNativeToggle);

  function setTriggerAvailable(available) {
    if (!available && document.activeElement === trigger) trigger.blur();
    trigger.disabled = !available;
    trigger.classList.toggle('is-layout-placeholder', !available);
    if (available) {
      trigger.removeAttribute('aria-hidden');
      trigger.removeAttribute('tabindex');
    } else {
      trigger.setAttribute('aria-hidden', 'true');
      trigger.tabIndex = -1;
    }
  }

  function sync() {
    const vehicleId = selectedVehicleId(screen);
    const vehiclePerk = vehiclePerkPresentation(vehicleId, getCarDefinition(vehicleId)?.perk);
    const perkReward = rewardForVehiclePerk(vehicleId);
    const perkUnlocked = !perkReward || isVehiclePerkUnlocked(vehicleId);
    const perkTitle = vehiclePerk?.title || '';
    const perkDescription = vehiclePerk?.description || '';
    const perkText = perkTitle && perkDescription
      ? `${perkTitle}: ${perkDescription}`
      : '';

    closePopover();
    setTriggerAvailable(Boolean(perkText));
    trigger.classList.toggle('is-trophy-road-perk', Boolean(perkReward));
    trigger.classList.toggle('is-locked', Boolean(perkReward && !perkUnlocked));
    trigger.classList.toggle('is-unlocked', Boolean(perkReward && perkUnlocked));
    if (!perkText) {
      trigger.removeAttribute('aria-label');
      title.textContent = '';
      copy.textContent = '';
      currentPerkText = '';
      return;
    }

    trigger.textContent = perkReward && !perkUnlocked
      ? `PERK · ${perkReward.threshold}`
      : 'PERK';
    trigger.setAttribute(
      'aria-label',
      perkReward && !perkUnlocked
        ? `Perk: ${perkTitle}. Locked until ${perkReward.threshold} trophies.`
        : `Perk: ${perkTitle}. Unlocked.`
    );
    eyebrow.textContent = perkReward
      ? `PERK · ${perkUnlocked ? 'UNLOCKED' : 'LOCKED'}`
      : 'PERK';
    title.textContent = perkTitle;
    copy.textContent = perkReward && !perkUnlocked
      ? `${perkDescription} Unlocks at ${perkReward.threshold} trophies.`
      : perkDescription;
    currentPerkText = perkText;
  }

  // Observe only the radio-selection state. The button and popover live outside
  // the picker, so opening, closing or rewriting them cannot recreate the r164
  // mutation loop that previously froze The Lot.
  const observer = new MutationObserver(sync);
  observer.observe(picker, {
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-checked']
  });
  globalThis.addEventListener?.('turn:trophy-road-updated', sync);
  sync();

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    observer.disconnect();
    globalThis.removeEventListener?.('turn:trophy-road-updated', sync);
    closePopover();
    trigger.removeEventListener('click', handleTriggerClick);
    close.removeEventListener('click', handleCloseClick);
    if (supportsNativePopover) popover.removeEventListener('toggle', handleNativeToggle);
    trigger.remove();
    popover.remove();
    activeDisclosures.delete(screen);
  };

  activeDisclosures.set(screen, { release });
  return release;
}
