import fs from 'node:fs/promises';

const path = 'turn/main.js';
const source = await fs.readFile(path, 'utf8');
const before = `function getViewportSize() {
  const viewport = window.visualViewport;
  const root = document.documentElement;
  const width = Math.max(1, Math.round(Math.max(
    Number(viewport?.width) || 0,
    Number(window.innerWidth) || 0,
    Number(root.clientWidth) || 0
  )));
  const height = Math.max(1, Math.round(Math.max(
    Number(viewport?.height) || 0,
    Number(window.innerHeight) || 0,
    Number(root.clientHeight) || 0
  )));
  return { width, height };
}`;
const after = `function isStandaloneDisplayMode() {
  return document.documentElement.classList.contains('turn-standalone')
    || window.matchMedia?.('(display-mode: standalone)').matches
    || window.matchMedia?.('(display-mode: fullscreen)').matches
    || navigator.standalone === true;
}

function getStandaloneScreenSize(width, height) {
  if (!isStandaloneDisplayMode()) return { width: 0, height: 0 };

  const reportedWidth = Math.max(
    Number(screen.width) || 0,
    Number(screen.availWidth) || 0
  );
  const reportedHeight = Math.max(
    Number(screen.height) || 0,
    Number(screen.availHeight) || 0
  );
  if (!reportedWidth || !reportedHeight) return { width: 0, height: 0 };

  const longSide = Math.max(reportedWidth, reportedHeight);
  const shortSide = Math.min(reportedWidth, reportedHeight);
  return width >= height
    ? { width: longSide, height: shortSide }
    : { width: shortSide, height: longSide };
}

function getViewportSize() {
  const viewport = window.visualViewport;
  const root = document.documentElement;
  const layoutWidth = Math.max(
    Number(viewport?.width) || 0,
    Number(window.innerWidth) || 0,
    Number(root.clientWidth) || 0
  );
  const layoutHeight = Math.max(
    Number(viewport?.height) || 0,
    Number(window.innerHeight) || 0,
    Number(root.clientHeight) || 0
  );
  const standaloneScreen = getStandaloneScreenSize(layoutWidth, layoutHeight);
  const width = Math.max(1, Math.round(Math.max(layoutWidth, standaloneScreen.width)));
  const height = Math.max(1, Math.round(Math.max(layoutHeight, standaloneScreen.height)));
  return { width, height };
}`;

const matches = source.split(before).length - 1;
if (matches !== 1) {
  throw new Error(`TURN r74 viewport patch expected one exact source match, found ${matches}.`);
}
await fs.writeFile(path, source.replace(before, after));
console.log('TURN r74 iPad standalone viewport patch applied.');
