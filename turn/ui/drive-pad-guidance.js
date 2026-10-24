// Where the drive pad is, for players who find it by touch (#1301). A screen reader
// user does not swipe to the pad in a race: they search the screen with a finger. So
// each race start says where it is, measured from where it is now, so handedness,
// orientation and text size are always right. Said only to screen readers; the pad is
// in plain sight for everyone else.
const PAD_SELECTOR = '#controls .drive-pad';
const STEERING_SELECTOR = '#manualSteer';

// A third of the screen each way: 'bottom right', 'middle left', 'top', 'centre'.
export function screenRegion(rect, width, height) {
  if (!rect || !(width > 0) || !(height > 0)) return '';
  const x = (rect.left + rect.right) / 2 / width;
  const y = (rect.top + rect.bottom) / 2 / height;
  const across = x < 1 / 3 ? 'left' : x > 2 / 3 ? 'right' : '';
  const down = y < 1 / 3 ? 'top' : y > 2 / 3 ? 'bottom' : across ? 'middle' : '';
  return [down, across].filter(Boolean).join(' ') || 'centre';
}

function regionOf(element, documentRef) {
  if (!element || element.hidden || element.closest('[hidden]')) return '';
  const rect = element.getBoundingClientRect();
  if (!(rect.width > 0 && rect.height > 0)) return '';
  const width = documentRef.documentElement.clientWidth || globalThis.innerWidth;
  const height = documentRef.documentElement.clientHeight || globalThis.innerHeight;
  return screenRegion(rect, width, height);
}

// full: the whole layout and the gesture, for tutorials and DRIVE BY EAR parts.
// Otherwise only where the pad is, for ordinary races. Empty when there is no pad.
export function drivePadGuidance({ full = false, documentRef = globalThis.document } = {}) {
  const pad = regionOf(documentRef?.querySelector?.(PAD_SELECTOR), documentRef);
  if (!pad) return '';
  if (!full) return `Drive pad, ${pad}.`;
  const steering = regionOf(documentRef.querySelector(STEERING_SELECTOR), documentRef);
  return `Drive pad: ${pad}. DRIFT and BOOST at its top, GAS in the middle, BRAKE at the bottom. Touch GAS, then double tap and hold, and slide to change control.${steering ? ` Steering: ${steering}.` : ''}`;
}
