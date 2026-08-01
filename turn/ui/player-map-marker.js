const MAP_PADDING = 20;
const PLAYER_RADIUS = 9;
const PLAYER_BORDER_WIDTH = 4;
const PLAYER_INNER_RADIUS = 3;
const PLAYER_FILL = '#ffff00';
const PLAYER_INK = '#000000';

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function captureMapBounds(samples) {
  const xs = [];
  const zs = [];
  for (const sample of samples) {
    const x = finiteNumber(sample?.point?.x);
    const z = finiteNumber(sample?.point?.z);
    if (x === null || z === null) continue;
    xs.push(x);
    zs.push(z);
  }

  if (!xs.length || !zs.length) {
    throw new Error('TURN could not calculate the player map marker bounds.');
  }

  return Object.freeze({
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs)
  });
}

function mapPoint(canvas, bounds, point) {
  const x = finiteNumber(point?.x);
  const z = finiteNumber(point?.z);
  if (x === null || z === null) return null;

  const width = canvas.width - MAP_PADDING * 2;
  const height = canvas.height - MAP_PADDING * 2;
  const extentX = Math.max(1, bounds.maxX - bounds.minX);
  const extentZ = Math.max(1, bounds.maxZ - bounds.minZ);
  const scale = Math.min(width / extentX, height / extentZ);
  const contentWidth = extentX * scale;
  const contentHeight = extentZ * scale;
  const offsetX = (canvas.width - contentWidth) / 2;
  const offsetY = (canvas.height - contentHeight) / 2;

  return {
    x: offsetX + (x - bounds.minX) * scale,
    y: offsetY + (z - bounds.minZ) * scale
  };
}

export function installPlayerMapMarker() {
  if (globalThis.__turnPlayerMapMarker?.installed) {
    return globalThis.__turnPlayerMapMarker;
  }

  const canvas = document.querySelector('#map');
  const runtime = globalThis.__turnRuntime;
  const context = canvas?.getContext?.('2d');
  if (!canvas || !context || !runtime?.state || !Array.isArray(runtime.samples)) {
    throw new Error('TURN could not install the player map marker.');
  }

  // The canonical map captures these bounds before tracks are swapped in. Capture
  // the same initial sample geometry here so the overlay uses the exact same scale.
  const bounds = captureMapBounds(runtime.samples);
  const originalClearRect = context.clearRect.bind(context);
  let overlayQueued = false;

  const drawPlayerMarker = () => {
    const point = mapPoint(canvas, bounds, runtime.state.position);
    if (!point) return;

    context.save();
    context.beginPath();
    context.arc(point.x, point.y, PLAYER_RADIUS, 0, Math.PI * 2);
    context.fillStyle = PLAYER_FILL;
    context.fill();
    context.strokeStyle = PLAYER_INK;
    context.lineWidth = PLAYER_BORDER_WIDTH;
    context.stroke();

    context.beginPath();
    context.arc(point.x, point.y, PLAYER_INNER_RADIUS, 0, Math.PI * 2);
    context.fillStyle = PLAYER_INK;
    context.fill();
    context.restore();
  };

  // drawMap() clears and then paints the route, player and rivals synchronously.
  // Queue this marker after that stack so the local player is always the final layer.
  context.clearRect = (...args) => {
    originalClearRect(...args);
    if (overlayQueued) return;
    overlayQueued = true;
    queueMicrotask(() => {
      overlayQueued = false;
      drawPlayerMarker();
    });
  };

  const api = Object.freeze({
    installed: true,
    radius: PLAYER_RADIUS,
    borderWidth: PLAYER_BORDER_WIDTH,
    innerRadius: PLAYER_INNER_RADIUS,
    fill: PLAYER_FILL,
    ink: PLAYER_INK,
    draw: drawPlayerMarker
  });
  globalThis.__turnPlayerMapMarker = api;
  return api;
}
