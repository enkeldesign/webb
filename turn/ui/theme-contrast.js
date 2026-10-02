// Dark theme contrast guard (#1067). In the dark theme, neutral surfaces turn dark and
// the ink on them turns cream, while semantic colours (yellow, pink, cyan, green,
// orange, the pastel cards and tiles) keep their light values. Text that sits on one of
// those light colours but inherits its colour from a dark surface would read cream on
// yellow. This guard finds text whose colour fails against the background it actually
// sits on, and marks that element to read Ink or cream, whichever contrasts better with
// that background (design-tokens.css [data-turn-on]). Buttons on a colour always read
// Ink, exactly as in the light theme. Text that already reads well, such as yellow
// NEXT UP on its Ink chip, is left alone. The light theme never runs it.
const MARK = 'data-turn-on';
const PILL = 'data-turn-pill';
const MIN_CONTRAST = 4.5;
const INK = [8, 9, 10];
const CREAM = [255, 248, 232];
const CONTROLS = 'button, a, [role="button"], summary, select, .turn-pr-chip';
// Night surfaces are darker than this (relative luminance); anything lighter is a colour.
const NIGHT = 0.12;

function parseColor(value) {
  const text = String(value);
  const wide = text.match(/color\((?:srgb|display-p3) ([^)]+)\)/);
  const match = wide || text.match(/rgba?\(([^)]+)\)/);
  if (!match) return null;
  const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  if (wide) return [parts[0] * 255, parts[1] * 255, parts[2] * 255, parts[3] ?? 1];
  return [parts[0], parts[1], parts[2], parts[3] ?? 1];
}

function luminance([r, g, b]) {
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// An element's own fill: its background colour, else the first colour of a gradient.
function ownFill(style) {
  const color = parseColor(style.backgroundColor);
  if (color && color[3] >= 0.5) return color;
  const stop = style.backgroundImage !== 'none' ? parseColor(style.backgroundImage) : null;
  return stop && stop[3] >= 0.5 ? stop : null;
}

// One scan reads each element's fill once.
let fills = new Map();
function fillOf(node) {
  if (!fills.has(node)) fills.set(node, ownFill(getComputedStyle(node)));
  return fills.get(node);
}

function backdrop(element) {
  for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
    const fill = fillOf(node);
    if (fill) return fill;
  }
  return null;
}

function hasOwnText(element) {
  for (const node of element.childNodes) {
    if (node.nodeType === 3 && node.textContent.trim()) return true;
  }
  if (element.matches('svg, [class*="icon"]')) return true;
  // A masked ::before icon draws in its control's colour (the trophy in the app bar).
  if (!element.matches('button, a, [role="button"]')) return false;
  const before = getComputedStyle(element, '::before').content;
  return before !== 'none' && before !== 'normal';
}

// Pills (Erik): on a night surface a light pill becomes a coloured wireframe, its own
// colour on text and border over Ink. The fill stays underneath (an Ink layer covers
// it), so a state change that recolours the pill still reads here.
function pill(element) {
  // A pill inside a coloured button keeps the button's look; on a night control it
  // switches like any other pill.
  const host = element.parentElement?.closest(CONTROLS.replace(', .turn-pr-chip', ''));
  if (element.matches('button, a, [role="button"]') || (host && luminance(fillOf(host) || INK) > NIGHT)) return false;
  if (!hasOwnText(element)) return false;
  const fill = fillOf(element);
  if (!fill || luminance(fill) <= NIGHT) return false;
  const box = element.getBoundingClientRect();
  if (!box.height || box.height > 44 || box.width > 280) return false;
  const style = getComputedStyle(element);
  if (parseFloat(style.borderTopLeftRadius) < box.height * 0.45) return false;
  const parent = element.parentElement && backdrop(element.parentElement);
  if (!parent || luminance(parent) > NIGHT) return false;
  const colour = style.backgroundColor;
  if (element.style.getPropertyValue('--turn-pill') !== colour) element.style.setProperty('--turn-pill', colour);
  if (!element.hasAttribute(PILL)) element.setAttribute(PILL, '');
  return true;
}

function check(element) {
  if (element.closest('canvas, svg > *')) return;
  if (element.closest(`[${PILL}]`)) return;
  if (!hasOwnText(element)) return;
  if (element.checkVisibility && !element.checkVisibility()) return;
  // A button on a colour reads exactly as in the light theme: Ink, always. Only a
  // control on a night surface (PAINT, menu entries) reads cream.
  const control = element.closest(CONTROLS);
  const controlFill = control ? fillOf(control) : null;
  if (controlFill && luminance(controlFill) > NIGHT) {
    if (control.getAttribute(MARK) !== 'light') control.setAttribute(MARK, 'light');
    return;
  }
  const style = getComputedStyle(element);
  const text = parseColor(style.color);
  const fill = backdrop(element);
  if (!text || !fill) return;
  // Judge the opaque text colour, so a deliberately quiet (translucent) role is kept
  // quiet but moved to the side that reads.
  if (contrast(text, fill) >= MIN_CONTRAST) return;
  const side = contrast(INK, fill) >= contrast(CREAM, fill) ? 'light' : 'dark';
  if (element.getAttribute(MARK) !== side) element.setAttribute(MARK, side);
}

let scheduled = false;
let lastMs = 0;
function scan() {
  scheduled = false;
  const started = performance.now();
  const root = document.documentElement;
  if (root.dataset.theme !== 'dark') {
    for (const marked of document.querySelectorAll(`[${MARK}]`)) marked.removeAttribute(MARK);
    for (const marked of document.querySelectorAll(`[${PILL}]`)) {
      marked.removeAttribute(PILL);
      marked.style.removeProperty('--turn-pill');
    }
    return;
  }
  fills = new Map();
  for (const element of document.body.querySelectorAll(`[${PILL}]`)) {
    if (!pill(element)) {
      element.removeAttribute(PILL);
      element.style.removeProperty('--turn-pill');
    }
  }
  for (const element of document.body.querySelectorAll('*')) {
    if (!element.hasAttribute(PILL) && element.checkVisibility?.() !== false) pill(element);
  }
  // Two passes: marking a parent changes what its children inherit.
  for (let pass = 0; pass < 2; pass += 1) {
    fills = new Map();
    for (const element of document.body.querySelectorAll('*')) check(element);
  }
  fills = new Map();
  lastScan = performance.now();
  lastMs = lastScan - started;
}

let lastScan = -Infinity;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => requestAnimationFrame(scan), 120);
}

// The race HUD changes many times a second and its panels are themed by their tokens:
// during a race, only a dialog opening or closing (the race menu, PAUSED) calls a scan.
function onMutations(records) {
  if (document.body.classList.contains('turn-race-active')
    && !records.some((record) => record.attributeName === 'open' || (record.attributeName === 'class' && record.target === document.body))) return;
  schedule();
}

function install() {
  if (!document.body) return;
  new MutationObserver(onMutations).observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'open', 'hidden', 'aria-selected', 'aria-pressed', 'aria-current']
  });
  globalThis.__turnTheme?.subscribe?.(() => {
    for (const marked of document.querySelectorAll(`[${MARK}]`)) marked.removeAttribute(MARK);
    schedule();
  });
  schedule();
  globalThis.__turnThemeContrast = Object.freeze({ scan, get lastMs() { return lastMs; } });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
}
