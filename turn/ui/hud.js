const RIVAL_MAP_COLORS = ['#38d9ff', '#ff4fa3', '#9775fa', '#ff922b'];
const mapCache = new WeakMap();

export function updateHudState({
  state,
  speedEl,
  lapEl,
  lapTimeEl,
  bestTimeEl,
  tiltNeedle,
  tiltValue,
  mapCanvas,
  mapCtx,
  samples,
  trackSampleCount,
  replayFrameAt,
  findNearestTrack,
  setRacePosition
}) {
  const lapInvalid = state.lapActive && state.lapInvalid === true;
  setText(speedEl, Math.round(state.speed * 3.6));
  setText(lapEl, state.lap);
  setText(lapTimeEl, lapInvalid ? 'INVALID LAP' : formatTime(state.lapElapsed));
  setText(bestTimeEl, formatTime(state.bestTime));
  lapTimeEl.closest?.('.chip')?.classList.toggle('is-invalid-lap', lapInvalid);

  const driveDisplay = state.throttle >= state.brake ? state.throttle : -state.brake;
  const drivePercent = Math.round(driveDisplay * 100);
  const needleLeft = `${50 + driveDisplay * 46}%`;
  if (tiltNeedle.style.left !== needleLeft) tiltNeedle.style.left = needleLeft;
  if (drivePercent > 2) setText(tiltValue, `gas ${drivePercent}%`);
  else if (drivePercent < -2) setText(tiltValue, `brake ${Math.abs(drivePercent)}%`);
  else setText(tiltValue, 'neutral');

  drawMap({
    state,
    mapCanvas,
    mapCtx,
    samples,
    replayFrameAt
  });

  updateRacePosition({
    state,
    trackSampleCount,
    replayFrameAt,
    findNearestTrack,
    setRacePosition
  });
}

function drawMap({ state, mapCanvas, mapCtx, samples, replayFrameAt }) {
  const staticMap = getStaticMap(mapCanvas, samples);
  mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
  mapCtx.drawImage(staticMap.canvas, 0, 0);

  const playerPoint = staticMap.mapPoint(state.position);
  mapCtx.beginPath();
  mapCtx.arc(playerPoint.x, playerPoint.y, 8, 0, Math.PI * 2);
  mapCtx.fillStyle = '#ffd43b';
  mapCtx.fill();
  mapCtx.strokeStyle = '#08090a';
  mapCtx.lineWidth = 4;
  mapCtx.stroke();

  if (!state.lapActive) return;

  for (let index = 0; index < state.competitorLaps.length; index += 1) {
    const rival = replayFrameAt(state.competitorLaps[index], state.lapElapsed);
    if (!rival) continue;

    const rivalPoint = staticMap.mapPoint(rival);
    mapCtx.beginPath();
    mapCtx.arc(rivalPoint.x, rivalPoint.y, 6, 0, Math.PI * 2);
    mapCtx.fillStyle = RIVAL_MAP_COLORS[index] || RIVAL_MAP_COLORS[0];
    mapCtx.fill();
    mapCtx.strokeStyle = '#08090a';
    mapCtx.lineWidth = 3;
    mapCtx.stroke();
  }
}

function getStaticMap(mapCanvas, samples) {
  const cached = mapCache.get(mapCanvas);
  if (
    cached &&
    cached.samples === samples &&
    cached.width === mapCanvas.width &&
    cached.height === mapCanvas.height
  ) {
    return cached;
  }

  const canvas = document.createElement('canvas');
  canvas.width = mapCanvas.width;
  canvas.height = mapCanvas.height;
  const ctx = canvas.getContext('2d');
  const bounds = getMapBounds(samples);
  const mapPoint = createMapPoint(canvas, bounds);

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  samples.forEach((sample, index) => {
    const point = mapPoint(sample.point);
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.strokeStyle = '#08090a';
  ctx.lineWidth = 16;
  ctx.stroke();
  ctx.strokeStyle = '#ff4fa3';
  ctx.lineWidth = 8;
  ctx.stroke();

  const startPoint = mapPoint(samples[0].point);
  const beforeStart = mapPoint(samples[samples.length - 4].point);
  const afterStart = mapPoint(samples[4].point);
  const startDx = afterStart.x - beforeStart.x;
  const startDy = afterStart.y - beforeStart.y;
  const startLength = Math.max(0.001, Math.hypot(startDx, startDy));
  const startNx = -startDy / startLength;
  const startNy = startDx / startLength;

  ctx.beginPath();
  ctx.moveTo(startPoint.x - startNx * 11, startPoint.y - startNy * 11);
  ctx.lineTo(startPoint.x + startNx * 11, startPoint.y + startNy * 11);
  ctx.strokeStyle = '#08090a';
  ctx.lineWidth = 9;
  ctx.stroke();
  ctx.strokeStyle = '#fff8e8';
  ctx.lineWidth = 5;
  ctx.stroke();

  const value = {
    samples,
    width: mapCanvas.width,
    height: mapCanvas.height,
    canvas,
    mapPoint
  };
  mapCache.set(mapCanvas, value);
  return value;
}

function updateRacePosition({
  state,
  trackSampleCount,
  replayFrameAt,
  findNearestTrack,
  setRacePosition
}) {
  const total = state.competitorLaps.length + 1;
  if (!state.lapActive || !state.competitorLaps.length) {
    setRacePosition?.(state.lapActive ? 1 : null, total);
    return;
  }

  let rivalsAhead = 0;
  const playerDistance = state.progress;

  for (const lap of state.competitorLaps) {
    const frame = replayFrameAt(lap, state.lapElapsed);
    if (!frame) continue;

    const progress = Number.isFinite(frame.p)
      ? frame.p
      : findNearestTrack(frame).index / trackSampleCount;
    const completedGhostLaps = Number.isFinite(lap.time) && lap.time > 0
      ? Math.floor(state.lapElapsed / lap.time)
      : 0;

    if (completedGhostLaps + progress > playerDistance + 0.002) rivalsAhead += 1;
  }

  setRacePosition?.(rivalsAhead + 1, total);
}

function getMapBounds(samples) {
  const xs = samples.map((sample) => sample.point.x);
  const zs = samples.map((sample) => sample.point.z);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs)
  };
}

function createMapPoint(canvas, bounds) {
  const pad = 20;
  const width = canvas.width - pad * 2;
  const height = canvas.height - pad * 2;
  const sx = width / (bounds.maxX - bounds.minX);
  const sz = height / (bounds.maxZ - bounds.minZ);
  const scale = Math.min(sx, sz);
  const contentW = (bounds.maxX - bounds.minX) * scale;
  const contentH = (bounds.maxZ - bounds.minZ) * scale;
  const offsetX = (canvas.width - contentW) / 2;
  const offsetY = (canvas.height - contentH) / 2;

  return (point) => ({
    x: offsetX + (point.x - bounds.minX) * scale,
    y: offsetY + (point.z - bounds.minZ) * scale
  });
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '--:--.---';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
  return `${minutes}:${secs}.${ms}`;
}

function setText(element, value) {
  const text = String(value);
  if (element.textContent !== text) element.textContent = text;
}