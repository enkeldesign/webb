'use strict';
function updateDepotVisuals() {
  const city = simulation.cities[currentCityId];
  for (const worker of city.workers) {
    const item = viewState.workers.get(worker.id);
    if (!item) continue;
    const { mesh, base } = item;
    if (worker.packageId) {
      const phase = Math.min(1, worker.progress / worker.total);
      const pickup = new THREE.Vector3(base.x, base.y, -.58);
      const drop = new THREE.Vector3(base.x + 1.45, base.y, 1.42);
      if (phase < .42) mesh.position.lerpVectors(base, pickup, phase / .42);
      else if (phase < .76) mesh.position.lerpVectors(pickup, drop, (phase - .42) / .34);
      else mesh.position.lerpVectors(drop, base, (phase - .76) / .24);
      mesh.rotation.y = phase < .42 ? Math.PI : phase < .76 ? .55 : -2.5;
    } else {
      mesh.position.lerp(base, .08);
      mesh.rotation.y = Math.PI;
    }
    if (!prefersReducedMotion && !simulation.paused) mesh.position.y += Math.sin(visualTime * 5 + base.x) * .004;
    if (item.halo) {
      item.halo.position.x = mesh.position.x;
      item.halo.position.z = mesh.position.z;
      item.halo.material.opacity = worker.packageId && !simulation.paused ? .52 + Math.sin(visualTime * 4) * .16 : .38;
    }
    const badge = viewState.workerBadges.get(worker.id);
    if (badge) {
      badge.position.x = mesh.position.x;
      badge.position.z = mesh.position.z;
    }
  }
  for (const { mesh, issueRing, lane, base, baseY, offset } of viewState.packages.values()) {
    mesh.position.y = baseY;
    if (!prefersReducedMotion && !simulation.paused) {
      mesh.position.y += Math.sin(visualTime * 2.2 + offset) * .025;
      if (lane === 'sort') mesh.position.x = base.x + (((visualTime * .32 + offset) % .42) - .21);
      if (issueRing) {
        const pulse = 1 + Math.sin(visualTime * 4 + offset) * .08;
        issueRing.scale.setScalar(pulse);
      }
    }
  }
  for (const item of viewState.decorative) {
    if (item.kind === 'dockTruck' && !prefersReducedMotion && !simulation.paused) item.mesh.position.y = item.baseY + Math.sin(visualTime * 7) * .006;
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
    const t = truck.state === 'driving' ? Math.min(.995, truck.progress) : Math.min(.045 + item.offset, .16);
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
  for (const item of viewState.decorative) {
    if (item.kind !== 'routePulse') continue;
    const speed = item.speed || .045;
    const t = prefersReducedMotion || simulation.paused ? item.offset : (visualTime * speed + item.offset) % 1;
    item.mesh.position.copy(item.curve.getPoint(t));
  }
}

function updateContextHeader() {
  const city = CITIES[currentCityId];
  if (currentLevel === 'depot') {
    app.levelTitle.textContent = `${city.name} depot`;
    app.levelSubtitle.textContent = 'People sort. Packages move. You decide what matters.';
    $('#level-kicker-text').textContent = 'LIVE DEPOT';
  } else if (currentLevel === 'region') {
    app.levelTitle.textContent = `${city.name} region`;
    app.levelSubtitle.textContent = 'Local routes feed the national handoff.';
    $('#level-kicker-text').textContent = 'LIVE REGION';
  } else {
    app.levelTitle.textContent = 'Sweden network';
    app.levelSubtitle.textContent = 'Three hubs, national linehaul and the world beyond.';
    $('#level-kicker-text').textContent = 'NATIONAL VIEW';
  }
  app.viewport.dataset.level = currentLevel;
  app.viewport.dataset.city = currentCityId;
  $$('.level-tab').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.level === currentLevel)));
  $$('.city-chip').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.city === currentCityId)));
}

function updateUI(force = false) {
  const now = performance.now();
  if (!force && now - lastUiUpdate < 300) return;
  lastUiUpdate = now;
  const m = simulation.getMetrics();
  if (simulation.stats.received > lastReceivedCount) app.incoming.classList.add('new-arrival');
  lastReceivedCount = simulation.stats.received;
  app.metricOnTime.textContent = `${m.onTime}%`;
  $('#metric-ontime-bar').style.width = `${Math.max(2, m.onTime)}%`;
  app.metricFlow.textContent = `${m.incoming}`;
  app.incoming.setAttribute('aria-label', `Open ${m.incoming} incoming package${m.incoming === 1 ? '' : 's'} across all depots`);
  app.metricIssues.textContent = `${m.issues}`;
  app.issueBadge.textContent = String(m.issues);
  app.issueBadge.hidden = m.issues === 0;
  $('#clock').textContent = formatGameClock(simulation.clock);
  $('#pause-symbol').textContent = simulation.paused ? '▶' : 'Ⅱ';
  $('#pause-label').textContent = simulation.paused ? 'PLAY' : 'PAUSE';
  app.pause.setAttribute('aria-label', simulation.paused ? 'Resume network' : 'Pause network');
  app.pause.setAttribute('aria-pressed', String(simulation.paused));
  $('#focus-value').textContent = focusLabel(simulation.focus);

  const top = simulation.events.find(event => {
    if (event.kind !== 'critical' && event.kind !== 'warning') return false;
    if (!event.packageId) return true;
    const pkg = simulation.packages.get(event.packageId);
    return Boolean(pkg?.issue || pkg?.complaint);
  }) || simulation.events[0];
  if (top) {
    app.eventText.textContent = top.title;
    app.eventRibbon.dataset.kind = top.kind;
    app.eventRibbon.dataset.packageId = top.packageId || '';
    const kicker = $('.event-copy small');
    if (kicker) kicker.textContent = top.kind === 'critical' ? 'URGENT · NEEDS YOU' : top.kind === 'warning' ? 'NEEDS YOU' : 'NETWORK UPDATE';
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
