const SAMPLE_LIMIT = 240;
const DISPLAY_INTERVAL_MS = 500;

let activeMonitor = null;

export function performanceModeRequested(search = globalThis.location?.search || '') {
  try {
    return new URLSearchParams(search).get('perf') === '1';
  } catch (_) {
    return false;
  }
}

export function summarizeFrameSamples(samples) {
  const finite = Array.from(samples || []).filter((value) => Number.isFinite(value) && value > 0);
  if (!finite.length) {
    return Object.freeze({ fps: 0, averageMs: 0, p50Ms: 0, p95Ms: 0, slowPercent: 0 });
  }

  const ordered = [...finite].sort((a, b) => a - b);
  const total = finite.reduce((sum, value) => sum + value, 0);
  const averageMs = total / finite.length;
  const slowFrames = finite.filter((value) => value > 1000 / 30).length;

  return Object.freeze({
    fps: 1000 / averageMs,
    averageMs,
    p50Ms: percentile(ordered, 0.5),
    p95Ms: percentile(ordered, 0.95),
    slowPercent: slowFrames / finite.length * 100
  });
}

export function installPerformanceMonitor({ getMode, getTrackStats } = {}) {
  if (!performanceModeRequested() || typeof document === 'undefined') return null;
  if (activeMonitor) return activeMonitor;

  const panel = document.createElement('pre');
  panel.className = 'turn-performance-monitor';
  panel.setAttribute('aria-hidden', 'true');
  panel.style.cssText = [
    'position:fixed',
    'z-index:9999',
    'top:max(6px,env(safe-area-inset-top))',
    'left:max(6px,env(safe-area-inset-left))',
    'margin:0',
    'padding:7px 9px',
    'border:2px solid #08090a',
    'border-radius:8px',
    'background:rgb(8 9 10 / 0.84)',
    'color:#fff8e8',
    'font:700 11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace',
    'pointer-events:none',
    'white-space:pre'
  ].join(';');
  document.body.appendChild(panel);

  const timelines = new Map();
  let activeLabel = 'starting';
  let latestRenderers = [];
  let lastDisplayAt = 0;
  let lastTrackStats = getTrackStats?.() || null;
  let snapshot = Object.freeze({ enabled: true, label: activeLabel });

  activeMonitor = Object.freeze({
    enabled: true,
    record(label, renderers, now = performance.now(), { rendered = true } = {}) {
      activeLabel = label || getMode?.() || 'unknown';
      latestRenderers = normalizeRenderers(renderers);
      let timeline = timelines.get(activeLabel);
      if (!timeline) {
        timeline = { samples: new Float32Array(SAMPLE_LIMIT), cursor: 0, count: 0, lastAt: null };
        timelines.set(activeLabel, timeline);
      }

      if (timeline.lastAt != null && rendered) {
        const frameMs = now - timeline.lastAt;
        if (frameMs > 0 && frameMs < 1000) {
          timeline.samples[timeline.cursor] = frameMs;
          timeline.cursor = (timeline.cursor + 1) % SAMPLE_LIMIT;
          timeline.count = Math.min(SAMPLE_LIMIT, timeline.count + 1);
        }
      }
      timeline.lastAt = now;

      if (now - lastDisplayAt < DISPLAY_INTERVAL_MS) return;
      lastDisplayAt = now;
      const frames = timeline.count < SAMPLE_LIMIT
        ? timeline.samples.subarray(0, timeline.count)
        : timeline.samples;
      const summary = summarizeFrameSamples(frames);
      const render = summarizeRenderers(latestRenderers);
      const track = summarizeTrackChecks(getTrackStats?.(), lastTrackStats);
      if (track.current) lastTrackStats = track.current;

      snapshot = Object.freeze({
        enabled: true,
        label: activeLabel,
        mode: getMode?.() || null,
        samples: timeline.count,
        ...summary,
        ...render,
        trackChecksPerQuery: track.average
      });
      globalThis.__turnPerfSnapshot = snapshot;
      panel.textContent = formatSnapshot(snapshot);
      window.dispatchEvent(new CustomEvent('turn:perf-snapshot', { detail: snapshot }));
    },
    getSnapshot() {
      return snapshot;
    }
  });

  globalThis.__turnPerfMonitor = activeMonitor;
  globalThis.__turnGetPerfSnapshot = () => activeMonitor?.getSnapshot() || null;
  panel.textContent = 'TURN PERF · collecting…';
  return activeMonitor;
}

export function recordPerformanceFrame(label, renderers, now, options) {
  activeMonitor?.record(label, renderers, now, options);
}

function normalizeRenderers(renderers) {
  if (!renderers) return [];
  return (Array.isArray(renderers) ? renderers : [renderers]).filter(Boolean);
}

function summarizeRenderers(renderers) {
  let drawCalls = 0;
  let triangles = 0;
  let geometries = 0;
  let textures = 0;
  const pixelRatios = [];

  for (const renderer of renderers) {
    drawCalls += Number(renderer.info?.render?.calls) || 0;
    triangles += Number(renderer.info?.render?.triangles) || 0;
    geometries += Number(renderer.info?.memory?.geometries) || 0;
    textures += Number(renderer.info?.memory?.textures) || 0;
    const ratio = Number(renderer.getPixelRatio?.());
    if (Number.isFinite(ratio)) pixelRatios.push(ratio);
  }

  return {
    renderers: renderers.length,
    drawCalls,
    triangles,
    geometries,
    textures,
    pixelRatio: pixelRatios.length ? Math.max(...pixelRatios) : 0
  };
}

function summarizeTrackChecks(current, previous) {
  if (!current) return { average: 0, current: null };
  const queries = current.queryCount - (previous?.queryCount || 0);
  const checks = current.totalChecks - (previous?.totalChecks || 0);
  return {
    average: queries > 0 ? checks / queries : 0,
    current
  };
}

function formatSnapshot(snapshot) {
  return [
    `TURN PERF · ${snapshot.label}`,
    `${snapshot.fps.toFixed(1)} fps · p50 ${snapshot.p50Ms.toFixed(1)} · p95 ${snapshot.p95Ms.toFixed(1)} ms`,
    `${snapshot.drawCalls} calls · ${compactNumber(snapshot.triangles)} tris · ${snapshot.renderers} renderer${snapshot.renderers === 1 ? '' : 's'}`,
    `${snapshot.geometries} geo · ${snapshot.textures} tex · DPR ${snapshot.pixelRatio.toFixed(2)}`,
    `track ${snapshot.trackChecksPerQuery.toFixed(1)} checks/query · >33ms ${snapshot.slowPercent.toFixed(1)}%`
  ].join('\n');
}

function compactNumber(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
}

function percentile(ordered, percentileValue) {
  const index = Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * percentileValue) - 1));
  return ordered[index];
}
