'use strict';
function packageView(pkg) {
  const cityId = pkg.cityId || cityForPlace(pkg.destination.place) || cityForPlace(pkg.origin.place) || currentCityId;
  if (['ready-local', 'transit-local'].includes(pkg.status)) return { cityId, level: 'region' };
  if (['ready-national', 'transit-national', 'ready-international', 'ready-inbound', 'transit-international'].includes(pkg.status)) return { cityId, level: 'sweden' };
  return { cityId, level: 'depot' };
}

function selectPackage(packageId, { navigate = true, announceSelection = true } = {}) {
  const pkg = simulation.packages.get(packageId);
  if (!pkg) return false;
  selectedPackageId = packageId;
  selectedTruckId = null;
  packageRailKey = '';
  if (navigate) {
    const view = packageView(pkg);
    currentCityId = view.cityId;
    currentLevel = view.level;
    buildScene();
  } else if (currentLevel === 'depot' && pkg.cityId === currentCityId) {
    syncDepotPackages(currentCityId);
  }
  updateUI(true);
  app.packageRail.querySelector(`[data-select-package="${packageId}"]`)?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
  if (announceSelection) announce(`${pkg.carrier} package selected. ${pkg.origin.place} to ${pkg.destination.place}.`);
  return true;
}

function selectTruck(truckId) {
  const truck = simulation.findTruck(truckId);
  if (!truck) return false;
  selectedTruckId = truck.id;
  packageRailKey = '';
  updateUI(true);
  const from = CITIES[truck.from]?.name || truck.from;
  const to = CITIES[truck.to]?.name || truck.to;
  announce(`${from} to ${to} truck selected. ${truck.state === 'waiting' ? 'Choose its load and departure.' : 'Truck is on the road.'}`);
  return true;
}

function advanceTutorialAfterLoad(pkg, truck) {
  if (!tutorialIsActive() || !pkg || !truck) return;
  if (pkg.id === 'DAY1-1001' && truck.kind === 'regional') simulation.tutorialStage = 'send-local';
  else if (pkg.id === 'US-77104' && truck.kind === 'national') simulation.tutorialStage = 'send-national';
  else if (pkg.id === 'US-77104' && truck.kind === 'regional') simulation.tutorialStage = 'send-timra';
}

function resolveSelectedIssue(action, { reopen = false } = {}) {
  const pkg = selectedPackageId ? simulation.packages.get(selectedPackageId) : null;
  if (!pkg) return false;
  const result = simulation.resolveIssue(pkg.id, action);
  announce(result.message);
  if (!result.ok) return false;
  if (tutorialIsActive() && pkg.id === 'US-77104' && simulation.tutorialStage === 'select-chicago') {
    simulation.tutorialStage = 'watch-chicago-sort';
    closeSheet();
  } else if (reopen) showPackage(pkg.id);
  if (currentLevel === 'depot' && pkg.cityId === currentCityId) syncDepotPackages(currentCityId);
  packageRailKey = '';
  updateUI(true);
  return true;
}

function dispatchSelectedTruck(truckId = selectedTruckId) {
  const truck = simulation.findTruck(truckId);
  if (!truck) return false;
  const result = simulation.dispatchTruck(truck.id);
  announce(result.message);
  if (!result.ok) return false;
  showFlowFeedback(result);
  handleTutorialTruckDispatched(result.truck);
  selectedTruckId = null;
  packageRailKey = '';
  closeSheet();
  updateUI(true);
  return true;
}

function showFlowFeedback(result) {
  if (!result?.grade || !app.flowFeedback) return;
  clearTimeout(flowFeedbackTimer);
  app.flowFeedbackGrade.textContent = result.grade;
  app.flowFeedbackPoints.textContent = `+${result.points}${result.chain > 1 ? ` · ${result.chain}× FLOW` : ''}`;
  app.flowFeedback.hidden = false;
  app.flowFeedback.classList.remove('is-showing');
  requestAnimationFrame(() => app.flowFeedback.classList.add('is-showing'));
  flowFeedbackTimer = setTimeout(() => {
    app.flowFeedback.classList.remove('is-showing');
    setTimeout(() => { app.flowFeedback.hidden = true; }, 240);
  }, 1750);
}

function performDockAction(action) {
  const pkg = selectedPackageId ? simulation.packages.get(selectedPackageId) : null;
  if (action === 'select-suggested') {
    const targetId = simulation.tutorialStage === 'select-package' ? 'DAY1-1001'
      : simulation.tutorialStage === 'select-chicago' ? 'US-77104'
      : simulation.getActivePackages(1)[0]?.id;
    if (targetId) selectPackage(targetId);
    return;
  }
  if (action === 'open-focus') { currentCityId = 'sundsvall'; showFocusSheet(); return; }
  if (action === 'start-tutorial-sort') {
    if (simulation.startFirstDaySort(selectedPackageId)) {
      announce('DLH package released to Express sort. Watch Leo move it.');
      if (currentLevel === 'depot') syncDepotPackages(currentCityId);
      packageRailKey = '';
      updateUI(true);
    }
    return;
  }
  if (['scan-cage', 'reroute', 'reprint', 'rescan'].includes(action)) { resolveSelectedIssue(action); return; }
  if (action === 'priority' && pkg) {
    simulation.flagPriority(pkg.id);
    packageRailKey = '';
    updateUI(true);
    announce(`${pkg.id} priority ${pkg.priorityFlag ? 'set' : 'cleared'}.`);
    return;
  }
  if (action === 'load-package' && pkg) {
    const result = simulation.planPackageOnTruck(pkg.id);
    announce(result.message);
    if (result.ok) {
      selectedTruckId = result.truck.id;
      advanceTutorialAfterLoad(pkg, result.truck);
      packageRailKey = '';
      updateUI(true);
    }
    return;
  }
  if (action === 'dispatch-truck') { dispatchSelectedTruck(); return; }
  if (action === 'follow' && pkg) { selectPackage(pkg.id); return; }
  if (action === 'details' && pkg) { showPackage(pkg.id); updateUI(true); return; }
  if (action === 'edit-load' && selectedTruckId) { showTruck(selectedTruckId); updateUI(true); return; }
  if (action === 'first-day-summary') { showFirstDaySummary(); return; }
  if (action === 'dismiss-celebration') {
    firstDayCelebration = false;
    selectedPackageId = simulation.getActivePackages(1)[0]?.id || null;
    packageRailKey = '';
    updateUI(true);
    announce('The full network is live. Keep the carrier promises moving.');
    return;
  }
  if (action === 'watch') announce('The selected package is moving through the current operation.');
}

function onScenePointer(event) {
  const rect = app.canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(world.children, true);
  for (const hit of hits) {
    let obj = hit.object;
    while (obj && obj !== world) {
      if (obj.userData?.entityType) {
        const d = obj.userData;
        if (d.entityType === 'package') selectPackage(d.packageId, { navigate: false });
        else if (d.entityType === 'worker') showWorker(d.workerId);
        else if (d.entityType === 'truck') selectTruck(d.truckId);
        else if (d.entityType === 'transport') showTransport(d.transportId);
        else if (d.entityType === 'town') showTown(d.cityId, d.town);
        else if (d.entityType === 'city') showCity(d.cityId);
        else if (d.entityType === 'handoff') showHandoff(d.cityId);
        return;
      }
      obj = obj.parent;
    }
  }
}

function resizeRenderer() {
  const rect = app.viewport.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  renderer?.setSize(width, height, false);
  const aspect = width / height;
  const base = currentLevel === 'region' ? 7.15 : currentLevel === 'sweden' ? 6.15 : 6.15;
  if (aspect >= 1) {
    camera.left = -base * aspect; camera.right = base * aspect; camera.top = base; camera.bottom = -base;
  } else {
    camera.left = -base; camera.right = base; camera.top = base / aspect; camera.bottom = -base / aspect;
  }
  camera.updateProjectionMatrix();
}

function animate(now) {
  const realDt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  simulation.tick(realDt);
  if (!simulation.paused) visualTime += realDt;
  updateSceneVisuals();
  updateUI();
  renderer?.render(scene, camera);
  requestAnimationFrame(animate);
}

function bindUI() {
  $$('.level-tab').forEach(btn => btn.addEventListener('click', () => setLevel(btn.dataset.level)));
  $$('.city-chip').forEach(btn => btn.addEventListener('click', () => setCity(btn.dataset.city)));
  app.pause.addEventListener('click', () => { simulation.togglePause(); updateUI(true); announce(simulation.paused ? 'Network paused.' : 'Network running.'); });
  app.incoming.addEventListener('click', showIncomingSheet);
  app.incoming.addEventListener('animationend', () => app.incoming.classList.remove('new-arrival'));
  $('#help-btn').addEventListener('click', showBriefingSheet);
  $('#focus-btn').addEventListener('click', showFocusSheet);
  $('#issues-btn').addEventListener('click', showIssuesSheet);
  $('#find-btn').addEventListener('click', showFindSheet);
  app.actionPrimary.addEventListener('click', () => performDockAction(app.actionPrimary.dataset.action));
  app.actionDetails.addEventListener('click', () => performDockAction(app.actionDetails.dataset.action));
  app.packageRail.addEventListener('click', event => {
    const card = event.target.closest('[data-select-package]');
    if (card) selectPackage(card.dataset.selectPackage);
  });
  app.sheetClose.addEventListener('click', closeSheet);
  app.sheet.addEventListener('click', event => { if (event.target === app.sheet) closeSheet(); });
  app.sheet.addEventListener('cancel', event => { event.preventDefault(); closeSheet(); });
  app.canvas.addEventListener('pointerup', onScenePointer);

  app.sheetBody.addEventListener('click', event => {
    const close = event.target.closest('[data-close-sheet]');
    if (close) { closeSheet(); return; }
    const focus = event.target.closest('[data-focus]');
    if (focus) {
      const cityId = focus.dataset.focusCity || currentCityId;
      const tutorialChoice = tutorialIsActive() && simulation.tutorialStage === 'choose-focus';
      if (!simulation.setFocus(cityId, focus.dataset.focus)) return;
      if (tutorialChoice) {
        handleTutorialFocusChosen(cityId);
        closeSheet();
      } else showFocusSheet();
      updateUI(true);
      announce(`${CITIES[cityId].name} priority set to ${focusLabel(simulation.getFocus(cityId))}.`);
      return;
    }
    const openPkg = event.target.closest('[data-open-package]');
    if (openPkg) { showPackage(openPkg.dataset.openPackage); updateUI(true); return; }
    const action = event.target.closest('[data-package-action]');
    if (action) {
      const id = action.dataset.packageId;
      selectedPackageId = id;
      selectedTruckId = null;
      if (action.dataset.packageAction === 'priority') {
        simulation.flagPriority(id); showPackage(id); updateUI(true); announce(`${id} priority updated.`); return;
      }
      resolveSelectedIssue(action.dataset.packageAction, { reopen: true });
      return;
    }
    const toggleLoad = event.target.closest('[data-toggle-truck-load]');
    if (toggleLoad) {
      selectedTruckId = toggleLoad.dataset.truckId;
      const changed = simulation.toggleTruckLoad(selectedTruckId, toggleLoad.dataset.toggleTruckLoad);
      const truck = simulation.findTruck(selectedTruckId);
      const pkg = simulation.packages.get(toggleLoad.dataset.toggleTruckLoad);
      if (changed && truck?.plannedLoad.includes(pkg?.id)) advanceTutorialAfterLoad(pkg, truck);
      showTruck(selectedTruckId); updateUI(true); return;
    }
    const autoFill = event.target.closest('[data-auto-fill-truck]');
    if (autoFill) {
      selectedTruckId = autoFill.dataset.autoFillTruck;
      simulation.autoFillTruck(selectedTruckId);
      const truck = simulation.findTruck(selectedTruckId);
      const pkg = selectedPackageId ? simulation.packages.get(selectedPackageId) : null;
      if (truck?.plannedLoad.includes(pkg?.id)) advanceTutorialAfterLoad(pkg, truck);
      showTruck(selectedTruckId); updateUI(true); announce('Truck filled with the highest-priority compatible packages.'); return;
    }
    const dispatch = event.target.closest('[data-dispatch-truck]');
    if (dispatch) { selectedTruckId = dispatch.dataset.dispatchTruck; dispatchSelectedTruck(selectedTruckId); return; }
    const openRegion = event.target.closest('[data-open-region]');
    if (openRegion) { currentCityId = openRegion.dataset.openRegion; closeSheet(); if (currentLevel === 'region') buildScene(); else setLevel('region'); return; }
  });

  app.sheetBody.addEventListener('input', event => {
    if (event.target.id !== 'package-search') return;
    const results = simulation.findPackages(event.target.value);
    const target = $('#search-results');
    target.innerHTML = results.length ? results.map(p => packageRow(p)).join('') : `<p class="hint">${event.target.value ? 'No matching live parcel.' : 'Search the live network from parcel to country.'}</p>`;
  });

  addEventListener('resize', resizeRenderer, { passive: true });
  document.addEventListener('visibilitychange', () => { lastFrame = performance.now(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && app.sheet.open) closeSheet();
    if (event.code === 'Space' && !app.sheet.open && !['INPUT','BUTTON'].includes(document.activeElement?.tagName)) {
      event.preventDefault(); simulation.togglePause(); updateUI(true);
    }
  });
}

async function boot() {
  bindUI();
  resizeRenderer();
  if (renderer) await preloadAssets();
  buildScene();
  updateUI(true);
  app.loader.classList.add('is-done');
  setTimeout(() => app.loader.remove(), 420);
  requestAnimationFrame(animate);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

boot().catch(error => {
  console.error('POSTAL failed to start.', error);
  app.canvas.hidden = true;
  app.fallback.hidden = false;
  app.loader?.classList.add('is-done');
  setTimeout(() => app.loader?.remove(), 420);
  updateUI(true);
  announce('The 3D view could not start. Package controls are still available.');
});
