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
  for (const { mesh, issueRing, selectionRing, lane, base, baseY, offset } of viewState.packages.values()) {
    mesh.position.y = baseY;
    if (!prefersReducedMotion && !simulation.paused) {
      mesh.position.y += Math.sin(visualTime * 2.2 + offset) * .025;
      if (lane === 'sort') mesh.position.x = base.x + (((visualTime * .32 + offset) % .42) - .21);
      if (issueRing) {
        const pulse = 1 + Math.sin(visualTime * 4 + offset) * .08;
        issueRing.scale.setScalar(pulse);
      }
      if (selectionRing) {
        const pulse = 1 + Math.sin(visualTime * 4.6 + offset) * .11;
        selectionRing.scale.setScalar(pulse);
        selectionRing.material.opacity = .78 + Math.sin(visualTime * 4.6 + offset) * .2;
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
  for (const item of viewState.decorative) {
    if (item.kind === 'selectedRegionRoute') {
      const t = prefersReducedMotion || simulation.paused ? item.offset : (visualTime * item.speed + item.offset) % 1;
      item.mesh.position.copy(item.curve.getPoint(t));
      item.mesh.position.y += .32;
    } else if (item.kind === 'selectedRouteMarker' && !prefersReducedMotion && !simulation.paused) {
      const pulse = 1 + Math.sin(visualTime * 4.2 + item.offset) * .12;
      item.mesh.scale.setScalar(pulse);
    }
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
  $$('.city-chip').forEach(btn => {
    const active = btn.dataset.city === currentCityId;
    btn.setAttribute('aria-pressed', String(active));
    btn.setAttribute('aria-label', `${CITIES[btn.dataset.city].name}, focus ${focusLabel(simulation.getFocus(btn.dataset.city))}`);
  });
}

function shortPlace(place) {
  const known = {
    Chicago: 'CHI', Stockholm: 'STO', Sundsvall: 'SUN', Timrå: 'TMR', Göteborg: 'GBG',
    Söråker: 'SÖR', Härnösand: 'HSD', Solna: 'SOL', Nacka: 'NAC', Uppsala: 'UPP',
    Aarhus: 'AAR', København: 'CPH', Hamburg: 'HAM', Helsinki: 'HEL'
  };
  return known[place] || String(place || '').slice(0, 3).toUpperCase();
}

function packageRouteStops(pkg) {
  const stops = [pkg.origin.place];
  const originCity = cityForPlace(pkg.origin.place);
  const destinationCity = cityForPlace(pkg.destination.place);
  const gateway = pkg.origin.country !== 'Sweden' ? gatewayForCountry(pkg.origin.country)
    : pkg.destination.country !== 'Sweden' ? gatewayForCountry(pkg.destination.country) : null;
  const cityStops = [];
  if (originCity) cityStops.push(CITIES[originCity].name);
  else if (gateway) cityStops.push(CITIES[gateway].name);
  if (destinationCity && !cityStops.includes(CITIES[destinationCity].name)) cityStops.push(CITIES[destinationCity].name);
  for (const stop of cityStops) if (!stops.includes(stop) && stop !== pkg.destination.place) stops.push(stop);
  if (!stops.includes(pkg.destination.place)) stops.push(pkg.destination.place);
  return stops.slice(0, 4);
}

function packageRouteProgress(pkg, stops) {
  if (pkg.status === 'delivered') return stops.length - 1;
  const cityName = pkg.cityId ? CITIES[pkg.cityId]?.name : null;
  const cityIndex = cityName ? stops.indexOf(cityName) : -1;
  if (cityIndex >= 0) return cityIndex;
  if (pkg.origin.country !== 'Sweden' && pkg.status !== 'ready-inbound') return Math.min(1, stops.length - 1);
  return 0;
}

function packageRailCard(pkg) {
  const selected = pkg.id === selectedPackageId;
  const stops = packageRouteStops(pkg);
  const progress = packageRouteProgress(pkg, stops);
  const route = `${pkg.origin.place} → ${pkg.destination.place}`;
  const attention = pkg.issue ? 'critical' : pkg.deadline - simulation.clock < 25 ? 'warning' : 'normal';
  const tutorialTarget = tutorialIsActive() && (
    (simulation.tutorialStage === 'select-package' && pkg.id === 'DAY1-1001') ||
    (simulation.tutorialStage === 'select-chicago' && pkg.id === 'US-77104')
  );
  const nodes = stops.map((stop, index) => `<span class="route-node ${index < progress ? 'is-done' : index === progress ? 'is-current' : ''}"><i></i><b>${escapeHtml(shortPlace(stop))}</b></span>`).join('');
  return `<button class="live-package-card ${carrierClass(pkg.carrier)} ${attention} ${tutorialTarget ? 'tutorial-target' : ''}" type="button" role="listitem" data-select-package="${pkg.id}" aria-pressed="${selected}" aria-label="${escapeHtml(pkg.carrier)}, ${escapeHtml(route)}, ${humanStatus(pkg.status)}, ${Math.max(0, Math.round(pkg.deadline - simulation.clock))} minutes remaining">
    <span class="live-package-head"><span class="carrier-flag" data-pattern="${pkg.carrierPattern}">${escapeHtml(pkg.carrier)}</span><strong>${escapeHtml(route)}</strong><span class="live-deadline" data-package-deadline="${pkg.id}"></span></span>
    <span class="route-breadcrumb" aria-hidden="true">${nodes}</span>
    <span class="live-package-foot"><span>${escapeHtml(humanStatus(pkg.status))}</span><span>${escapeHtml(pkg.location)}</span></span>
  </button>`;
}

function renderPackageRail(force = false) {
  const packages = simulation.getActivePackages(40);
  if (selectedPackageId) {
    const selected = simulation.packages.get(selectedPackageId);
    if (selected && selected.status !== 'delivered' && !packages.includes(selected)) packages.unshift(selected);
  }
  const key = packages.map(pkg => `${pkg.id}:${pkg.status}:${pkg.location}:${pkg.issue || ''}`).join('|') + `:${selectedPackageId || ''}:${simulation.tutorialStage}`;
  if (force || key !== packageRailKey) {
    const scrollLeft = app.packageRail.scrollLeft;
    app.packageRail.innerHTML = packages.length
      ? packages.map(packageRailCard).join('')
      : '<div class="rail-empty"><strong>All clear</strong><span>New carrier arrivals are on the way.</span></div>';
    app.packageRail.scrollLeft = scrollLeft;
    packageRailKey = key;
  }
  const metrics = simulation.getMetrics();
  app.packageSummary.textContent = `${packages.length} active · ${metrics.dueSoon} due · ${metrics.score} pts`;
  app.packageRail.querySelectorAll('[data-package-deadline]').forEach(node => {
    const pkg = simulation.packages.get(node.dataset.packageDeadline);
    if (!pkg) return;
    const slack = Math.round(pkg.deadline - simulation.clock);
    node.textContent = slack < 0 ? `${Math.abs(slack)}m LATE` : `${slack}m`;
    node.classList.toggle('is-late', slack < 0);
    node.classList.toggle('is-soon', slack >= 0 && slack < 25);
  });
}

function configureDock({ kicker, title, meta, primary, action, secondary = 'DETAILS', secondaryAction = 'details', disabled = false, tone = 'normal' }) {
  app.actionKicker.textContent = kicker;
  app.actionTitle.textContent = title;
  app.actionMeta.textContent = meta;
  app.actionPrimary.textContent = primary;
  app.actionPrimary.dataset.action = action;
  app.actionPrimary.disabled = disabled;
  app.actionDetails.textContent = secondary;
  app.actionDetails.dataset.action = secondaryAction;
  app.actionDetails.hidden = !secondary;
  app.actionDock.dataset.tone = tone;
}

function updateActionDock() {
  const instruction = tutorialInstruction();
  const truck = selectedTruckId ? simulation.findTruck(selectedTruckId) : null;
  if (truck && truck.state === 'waiting') {
    const from = CITIES[truck.from]?.name || truck.from;
    const to = CITIES[truck.to]?.name || truck.to;
    const eligible = simulation.eligiblePackagesForTruck(truck);
    configureDock({
      kicker: instruction?.kicker || (truck.kind === 'national' ? 'NATIONAL LINEHAUL' : 'REGIONAL TRUCK'),
      title: instruction?.title || `${from} → ${to}`,
      meta: instruction?.meta || `${truck.plannedLoad.length}/${truck.capacity} loaded · ${eligible.length} eligible · you choose departure`,
      primary: instruction?.action || `SEND TO ${String(to).toUpperCase()}`,
      action: 'dispatch-truck', secondary: 'EDIT LOAD', secondaryAction: 'edit-load',
      disabled: truck.plannedLoad.length === 0, tone: truck.plannedLoad.length ? 'action' : 'normal'
    });
    return;
  }

  if (firstDayCelebration) {
    configureDock({ ...instruction, primary: instruction.action, action: 'dismiss-celebration', secondary: 'SUMMARY', secondaryAction: 'first-day-summary', tone: 'success' });
    return;
  }

  const pkg = selectedPackageId ? simulation.packages.get(selectedPackageId) : null;
  if (!pkg) {
    configureDock({
      kicker: instruction?.kicker || 'PACKAGES ARE THE CONTROLS',
      title: instruction?.title || 'Select a live package',
      meta: instruction?.meta || 'Its next physical handoff will light up in the world.',
      primary: instruction?.action || 'SELECT PACKAGE', action: instruction?.actionKey || 'select-suggested', secondary: '',
      disabled: instruction?.actionKey === 'watch', tone: tutorialIsActive() ? 'tutorial' : 'normal'
    });
    return;
  }

  const slack = Math.round(pkg.deadline - simulation.clock);
  const route = `${pkg.origin.place} → ${pkg.destination.place}`;
  let action = 'details';
  let primary = 'OPEN DETAILS';
  let disabled = false;
  let actionMeta = `${pkg.location} · ${slack < 0 ? `${Math.abs(slack)}m late` : `${slack}m left`}`;

  if (tutorialIsActive() && pkg.id === 'DAY1-1001' && simulation.tutorialStage === 'select-package') {
    action = 'start-tutorial-sort'; primary = 'SORT EXPRESS';
  } else if (pkg.issue === 'scan-gap') {
    action = 'scan-cage'; primary = 'SCAN CAGE';
  } else if (pkg.issue === 'wrong-dock' || pkg.issue === 'routing') {
    action = 'reroute'; primary = 'REROUTE';
  } else if (pkg.issue === 'label-damage') {
    action = 'reprint'; primary = 'REPRINT LABEL';
  } else if (pkg.issue === 'missed-scan') {
    action = 'rescan'; primary = 'RESCAN';
  } else if (pkg.status === 'arrived') {
    action = 'priority'; primary = pkg.priorityFlag ? 'PRIORITY SET' : 'PRIORITISE'; disabled = pkg.priorityFlag;
  } else if (pkg.status === 'sorting') {
    action = 'watch'; primary = 'SORTING…'; disabled = true;
  } else if (pkg.status === 'ready-local' || pkg.status === 'ready-national') {
    const routeTruck = simulation.truckForPackage(pkg.id);
    if (routeTruck) {
      action = 'load-package'; primary = pkg.status === 'ready-national' ? 'LOAD LINEHAUL' : 'LOAD TRUCK';
    } else {
      action = 'watch'; primary = 'TRUCK RETURNING'; disabled = true;
      actionMeta = `${pkg.location} · its route vehicle is already on the road`;
    }
  } else if (pkg.status.startsWith('transit')) {
    action = 'follow'; primary = 'FOLLOW ROUTE';
  } else if (pkg.status === 'ready-international' || pkg.status === 'ready-inbound') {
    action = 'watch'; primary = 'GATEWAY QUEUED'; disabled = true;
    actionMeta = `${pkg.location} · partner transport is scheduled automatically`;
  }

  if (instruction) {
    primary = instruction.action;
    action = instruction.actionKey || action;
    disabled = instruction.actionKey === 'watch' || disabled;
  }
  configureDock({
    kicker: instruction?.kicker || `${pkg.carrier} · ${humanStatus(pkg.status).toUpperCase()}`,
    title: instruction?.title || route,
    meta: instruction?.meta || actionMeta,
    primary, action, secondary: 'DETAILS', secondaryAction: 'details', disabled,
    tone: pkg.issue ? 'critical' : instruction ? 'tutorial' : action === 'load-package' ? 'action' : 'normal'
  });
}

function updateUI(force = false) {
  const now = performance.now();
  if (!force && now - lastUiUpdate < 300) return;
  lastUiUpdate = now;
  updateFirstDayTutorial();
  const m = simulation.getMetrics();
  if (simulation.stats.received > lastReceivedCount) app.incoming.classList.add('new-arrival');
  lastReceivedCount = simulation.stats.received;
  app.metricOnTime.textContent = `${m.onTime}%`;
  $('#metric-ontime-bar').style.width = `${Math.max(2, m.onTime)}%`;
  app.metricFlow.textContent = `${m.active}`;
  app.incoming.setAttribute('aria-label', `Open overview of ${m.active} live package${m.active === 1 ? '' : 's'}`);
  app.metricIssues.textContent = `${m.issues}`;
  app.issueBadge.textContent = String(m.issues);
  app.issueBadge.hidden = m.issues === 0;
  $('#clock').textContent = formatGameClock(simulation.clock);
  $('#pause-symbol').textContent = simulation.paused ? '▶' : 'Ⅱ';
  $('#pause-label').textContent = simulation.paused ? 'PLAY' : 'PAUSE';
  app.pause.setAttribute('aria-label', simulation.paused ? 'Resume network' : 'Pause network');
  app.pause.setAttribute('aria-pressed', String(simulation.paused));
  $('#focus-value').textContent = `${CITIES[currentCityId].short} · ${focusLabel(simulation.getFocus(currentCityId))}`;
  renderPackageRail(force);
  updateActionDock();
  updateContextHeader();
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
  if (typeof app.sheet.show === 'function') {
    if (!app.sheet.open) app.sheet.show();
  } else app.sheet.setAttribute('open','');
  onOpen?.();
}
