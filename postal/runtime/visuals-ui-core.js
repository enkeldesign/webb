'use strict';
function updateDepotVisuals() {
  const city = simulation.cities[currentCityId];
  for (const worker of city.workers) {
    const item = viewState.workers.get(worker.id);
    if (!item) continue;
    const { mesh, base } = item;
    if (worker.packageId) {
      const phase = Math.min(1, worker.progress / worker.total);
      const target = phase < .55 ? new THREE.Vector3(base.x, base.y, -0.65) : new THREE.Vector3(base.x + 1.8, base.y, 1.55);
      mesh.position.lerpVectors(base, target, phase < .55 ? phase / .55 : (phase - .55) / .45);
    } else {
      mesh.position.lerp(base, .08);
    }
    if (!prefersReducedMotion && !simulation.paused) mesh.rotation.y += Math.sin(visualTime * 1.5 + base.x) * 0.0015;
  }
  for (const { mesh, baseY, offset } of viewState.packages.values()) {
    if (!prefersReducedMotion && !simulation.paused) mesh.position.y = baseY + Math.sin(visualTime * 2 + offset) * .035;
  }
  if (simulation.clock - depotPackageSyncAt > 3) {
    depotPackageSyncAt = simulation.clock;
    syncDepotPackages(currentCityId);
  }
}

function orientAlongCurve(mesh, curve, t) {
  const clamped = Math.max(0, Math.min(.999, t));
  const pos = curve.getPoint(clamped);
  const next = curve.getPoint(Math.min(.999, clamped + .01));
  mesh.position.copy(pos); mesh.position.y += .18;
  const dir = next.clone().sub(pos);
  mesh.rotation.y = Math.atan2(dir.x, dir.z);
}

function updateRegionVisuals() {
  const city = simulation.cities[currentCityId];
  for (const truck of city.regionalTrucks) {
    const item = viewState.regionalTrucks.get(truck.id); if (!item) continue;
    const t = truck.state === 'driving' ? truck.progress : Math.min(.03, truck.wait / 100);
    orientAlongCurve(item.mesh, item.curve, t);
  }
}

function updateSwedenVisuals() {
  for (const truck of simulation.nationalTrucks) {
    const item = viewState.nationalTrucks.get(truck.id); if (!item) continue;
    const t = truck.state === 'driving' ? truck.progress : .015 + (truck.wait % 6) * .001;
    orientAlongCurve(item.mesh, item.curve, t);
  }
  for (const transport of simulation.internationalTransports) {
    const item = viewState.international.get(transport.id); if (!item) continue;
    const t = transport.state === 'driving' ? transport.progress : .02;
    orientAlongCurve(item.mesh, item.curve, t);
  }
}

function updateContextHeader() {
  const city = CITIES[currentCityId];
  if (currentLevel === 'depot') {
    app.levelTitle.textContent = `${city.name} depot`;
    app.levelSubtitle.textContent = 'People sort. Parcels move. You decide what matters.';
  } else if (currentLevel === 'region') {
    app.levelTitle.textContent = `${city.name} region`;
    app.levelSubtitle.textContent = 'Local routes feed the national handoff.';
  } else {
    app.levelTitle.textContent = 'Sweden network';
    app.levelSubtitle.textContent = 'Three hubs, national linehaul and the world beyond.';
  }
  $$('.level-tab').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.level === currentLevel)));
  $$('.city-chip').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.city === currentCityId)));
}

function updateUI(force = false) {
  const now = performance.now();
  if (!force && now - lastUiUpdate < 300) return;
  lastUiUpdate = now;
  const m = simulation.getMetrics();
  app.metricOnTime.textContent = `${m.onTime}%`;
  app.metricFlow.textContent = `${m.active}`;
  app.metricIssues.textContent = `${m.issues}`;
  app.issueBadge.textContent = String(m.issues);
  app.issueBadge.hidden = m.issues === 0;
  $('#clock').textContent = formatGameClock(simulation.clock);
  app.pause.textContent = simulation.paused ? '▶ PLAY' : 'Ⅱ PAUSE';
  app.pause.setAttribute('aria-pressed', String(simulation.paused));
  $('#focus-value').textContent = focusLabel(simulation.focus);

  const top = simulation.events.find(e => e.kind === 'critical' || e.kind === 'warning') || simulation.events[0];
  if (top) {
    app.eventText.textContent = top.title;
    app.eventRibbon.dataset.kind = top.kind;
    app.eventRibbon.hidden = false;
  } else app.eventRibbon.hidden = true;
}

function formatGameClock(sec) {
  const minutes = 7 * 60 + Math.floor(sec * 2.2);
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function focusLabel(mode) {
  return ({ late: 'LATE', complaints: 'COMPLAINTS', express: 'EXPRESS', international: 'INTERNATIONAL' })[mode] || mode.toUpperCase();
}

function setLevel(level) {
  if (!['depot','region','sweden'].includes(level) || level === currentLevel) return;
  currentLevel = level; buildScene(); updateUI(true);
}

function setCity(cityId) {
  if (!CITIES[cityId] || cityId === currentCityId) return;
  currentCityId = cityId; buildScene(); updateUI(true);
}

function showSheet(title, html, { onOpen } = {}) {
  app.sheetTitle.textContent = title;
  app.sheetBody.innerHTML = html;
  if (typeof app.sheet.showModal === 'function') {
    if (!app.sheet.open) app.sheet.showModal();
  } else app.sheet.setAttribute('open','');
  onOpen?.();
}
