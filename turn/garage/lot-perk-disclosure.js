import { getCarDefinition } from '../vehicle/catalog.js?revision=r243-mountain-1300';
import { vehiclePerkPresentation } from '../vehicle/perk-presentation.js?revision=r220-apex-grip';
import {
  isVehiclePerkUnlocked,
  rewardForVehiclePerk
} from '../progression/trophy-road.js';

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
      gap: 6px;
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
      min-height: 28.5px;
      margin: 0 2.25px 2.25px 0;
      padding: 3.75px 9.75px;
      border: 2.5px solid var(--ink, #08090a);
      border-radius: 749.25px;
      background: var(--turn-action-information, #38d9ff);
      box-shadow: 3px 3px 0 var(--ink, #08090a);
      color: var(--ink, #08090a);
      font-size: max(var(--turn-text-floor, 11px), clamp(0.435rem, 1.05vw, 0.54rem));
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

    .lot-showroom .lot-perk-button.turn-perk-selection-wiggle {
      animation: turn-perk-selection-wiggle 430ms cubic-bezier(.2,.85,.25,1.15) 1;
      transform-origin: 50% 50%;
    }

    /* The legacy first-encounter cue must never animate a Trophy Road perk
       while that perk is still locked. */
    .lot-showroom .lot-perk-button.is-locked.turn-first-perk-attention {
      animation: none !important;
    }

    @keyframes turn-perk-selection-wiggle {
      0%, 100% { transform: rotate(0deg) scale(1); }
      28% { transform: rotate(-4deg) scale(1.06); }
      58% { transform: rotate(4deg) scale(1.06); }
      82% { transform: rotate(-2deg) scale(1.02); }
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
      outline-offset: 2.25px;
    }

    .lot-perk-disclosure {
      position: fixed;
      z-index: 40;
      inset: auto;
      top: var(--lot-perk-popover-top, 9px);
      left: var(--lot-perk-popover-left, 9px);
      box-sizing: border-box;
      width: min(225px, calc(100vw - 18px));
      max-height: min(172.5px, calc(100vh - 18px));
      max-height: min(172.5px, calc(100dvh - 18px));
      margin: 0 !important;
      padding: 8.25px 9px 9px;
      overflow: auto;
      overscroll-behavior: contain;
      border: 3px solid var(--ink, #08090a);
      border-radius: 11.25px;
      background: var(--paper, #fff8e8);
      box-shadow: 5.25px 5.25px 0 var(--ink, #08090a);
      color: var(--ink, #08090a);
    }

    .lot-perk-disclosure .lot-perk-head {
      display: flex;
      min-width: 0;
      align-items: flex-start;
      justify-content: space-between;
      gap: 7.5px;
    }

    .lot-perk-disclosure .lot-perk-heading {
      min-width: 0;
    }

    .lot-perk-disclosure .lot-perk-eyebrow {
      display: block;
      margin-bottom: 3px;
      color: #a20f5d;
      font-size: max(var(--turn-text-floor, 11px), 0.36rem);
      font-weight: 950;
      letter-spacing: .1em;
    }

    .lot-perk-disclosure .lot-perk-title {
      display: block;
      font-size: max(var(--turn-text-floor, 11px), clamp(0.585rem, 1.7vw, 0.7875rem));
      font-weight: 950;
      line-height: 1.05;
      overflow-wrap: anywhere;
    }

    .lot-perk-disclosure .lot-perk-close {
      flex: 0 0 25.5px;
      width: 25.5px;
      height: 25.5px;
      min-height: 0;
      padding: 0 0 2.25px;
      border: 2px solid var(--ink, #08090a);
      border-radius: 50%;
      background: var(--pink, #ff4fa3);
      box-shadow: 2.25px 2.25px 0 var(--ink, #08090a);
      color: var(--ink, #08090a);
      font: 950 max(var(--turn-text-floor, 11px), 0.9rem)/1 system-ui, sans-serif;
    }

    .lot-showroom .lot-perk-disclosure .lot-perk-copy {
      margin: 6.75px 0 0;
      color: var(--ink, #08090a);
      font-family: system-ui, sans-serif;
      font-size: max(var(--turn-text-floor, 11px), clamp(0.525rem, 1.35vw, 0.645rem));
      font-weight: 750;
      line-height: 1.3;
    }

    @media (max-height: 390px) {
      .lot-showroom .lot-perk-button {
        min-height: 25.5px;
        margin-right: 1.5px;
        padding: 3px 8.25px;
        font-size: max(var(--turn-text-floor, 11px), clamp(0.405rem, 1vw, 0.48rem));
      }

      .lot-perk-disclosure {
        width: min(210px, calc(100vw - 15px));
        max-height: calc(100vh - 15px);
        max-height: calc(100dvh - 15px);
        padding: 6.75px 7.5px 7.5px;
        border-radius: 9.75px;
        box-shadow: 3.75px 3.75px 0 var(--ink, #08090a);
      }

      .lot-showroom .lot-perk-disclosure .lot-perk-copy {
        margin-top: 5.25px;
        font-size: max(var(--turn-text-floor, 11px), clamp(0.495rem, 1.28vw, 0.6rem));
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .lot-showroom .lot-perk-button.turn-perk-selection-wiggle {
        animation: none;
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
  let wiggleTimer = 0;

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

  function wiggleUnlockedPerk() {
    if (wiggleTimer) {
      globalThis.clearTimeout?.(wiggleTimer);
      wiggleTimer = 0;
    }
    trigger.classList.remove('turn-perk-selection-wiggle');
    void trigger.offsetWidth;
    trigger.classList.add('turn-perk-selection-wiggle');
    wiggleTimer = globalThis.setTimeout?.(() => {
      wiggleTimer = 0;
      trigger.classList.remove('turn-perk-selection-wiggle');
    }, 650) || 0;
  }

  function sync({ selectedByPlayer = false } = {}) {
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

    if (selectedByPlayer && perkUnlocked) wiggleUnlockedPerk();
  }

  // Observe only the radio-selection state. The button and popover live outside
  // the picker, so opening, closing or rewriting them cannot recreate the r164
  // mutation loop that previously froze The Lot.
  const observer = new MutationObserver(() => sync({ selectedByPlayer: true }));
  observer.observe(picker, {
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-checked']
  });
  const syncTrophyRoad = () => sync();
  globalThis.addEventListener?.('turn:trophy-road-updated', syncTrophyRoad);
  sync();

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    observer.disconnect();
    globalThis.removeEventListener?.('turn:trophy-road-updated', syncTrophyRoad);
    closePopover();
    if (wiggleTimer) globalThis.clearTimeout?.(wiggleTimer);
    wiggleTimer = 0;
    trigger.classList.remove('turn-perk-selection-wiggle');
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
