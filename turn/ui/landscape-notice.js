// Temporary portrait notice while TURN's portrait design is still being refined.
// It appears on menu surfaces only (Home and The Lot), never during a race, and a
// dismissal lasts for the current launch so the next launch in portrait shows it again.
// While visible it reserves its own strip at the top: Home and The Lot move down
// beneath it instead of having their headings and controls covered.

const DISMISSED_KEY = 'turn-landscape-notice-dismissed-v1';
// Touch devices only: a narrow desktop window is not something the player can rotate.
const PORTRAIT_DEVICE_QUERY = '(orientation: portrait) and (hover: none) and (pointer: coarse)';
const VISIBLE_CLASS = 'turn-landscape-notice-visible';
const SPACE_PROPERTY = '--turn-landscape-notice-space';

let notice;
let resizeObserver;
let dismissedInMemory = false;

function readDismissed() {
  if (dismissedInMemory) return true;
  try {
    return globalThis.sessionStorage?.getItem(DISMISSED_KEY) === 'dismissed';
  } catch (_) {
    return false;
  }
}

function rememberDismissed() {
  dismissedInMemory = true;
  try {
    globalThis.sessionStorage?.setItem(DISMISSED_KEY, 'dismissed');
  } catch (_) { /* In-memory state still covers private/storage-blocked sessions. */ }
}

// The visible menu surface, or null during races and loading.
function visibleMenuSurface() {
  if (document.body.classList.contains('turn-race-active')) return null;
  const lot = document.querySelector('.lot-screen');
  if (lot) return { element: lot, backdrop: lot };
  const home = document.querySelector('.m8-home');
  if (home && !home.hidden) return { element: home, backdrop: home.querySelector('.m8-home-head') || home };
  return null;
}

function reserveSpace() {
  if (!notice || notice.hidden) return;
  const height = Math.ceil(notice.getBoundingClientRect().height);
  document.documentElement.style.setProperty(SPACE_PROPERTY, `${height}px`);
}

function releaseSpace() {
  document.body.classList.remove(VISIBLE_CLASS);
  document.documentElement.style.removeProperty(SPACE_PROPERTY);
}

function createNotice() {
  const element = document.createElement('aside');
  element.className = 'turn-landscape-notice';
  element.setAttribute('aria-labelledby', 'turnLandscapeNoticeTitle');
  element.hidden = true;
  element.innerHTML = `
    <div class="turn-landscape-notice-card">
      <div class="turn-landscape-notice-phone" aria-hidden="true"></div>
      <div class="turn-landscape-notice-copy">
        <h2 id="turnLandscapeNoticeTitle">LANDSCAPE ORIENTATION RECOMMENDED</h2>
        <p>TURN’s portrait design is still being refined. We recommend you rotate your device to landscape.</p>
      </div>
      <button class="turn-landscape-notice-close" type="button" aria-label="Close landscape recommendation">×</button>
    </div>`;
  element.querySelector('.turn-landscape-notice-close').addEventListener('click', () => {
    const hadFocus = element.contains(document.activeElement);
    rememberDismissed();
    resizeObserver?.disconnect();
    element.remove();
    notice = undefined;
    releaseSpace();
    if (hadFocus) {
      // Keep keyboard and screen-reader focus on the surface the player is using.
      const target = document.querySelector('.lot-screen .lot-back')
        || document.querySelector('.m8-home:not([hidden]) #m8HomeTitle');
      target?.focus?.();
    }
  });
  // First in reading order, so it is met before the menu content it describes.
  document.body.prepend(element);
  resizeObserver = new ResizeObserver(reserveSpace);
  resizeObserver.observe(element);
  return element;
}

export function updateLandscapeNotice() {
  const surface = !readDismissed() && window.matchMedia(PORTRAIT_DEVICE_QUERY).matches
    ? visibleMenuSurface()
    : null;
  if (!surface) {
    if (notice) notice.hidden = true;
    releaseSpace();
    return false;
  }
  notice ||= createNotice();
  // The reserved strip continues the colour of the surface it sits on.
  notice.style.setProperty('--turn-landscape-notice-backdrop', getComputedStyle(surface.backdrop).backgroundColor);
  notice.hidden = false;
  document.body.classList.add(VISIBLE_CLASS);
  reserveSpace();
  return true;
}

export function installLandscapeNotice() {
  const update = () => updateLandscapeNotice();
  window.matchMedia(PORTRAIT_DEVICE_QUERY).addEventListener('change', update);
  window.addEventListener('turn:home-shown', update);
  window.addEventListener('turn:home-hidden', update);
  window.addEventListener('turn:ui-state-change', update);
  // The Lot is added to and removed from <body> without an event of its own.
  new MutationObserver(update).observe(document.body, { childList: true });
  update();
}
