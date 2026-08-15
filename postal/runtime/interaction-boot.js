'use strict';
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
        if (d.entityType === 'package') showPackage(d.packageId);
        else if (d.entityType === 'worker') showWorker(d.workerId);
        else if (d.entityType === 'truck') showTruck(d.truckId);
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
  $('#focus-btn').addEventListener('click', showFocusSheet);
  $('#issues-btn').addEventListener('click', showIssuesSheet);
  $('#find-btn').addEventListener('click', showFindSheet);
  app.eventRibbon.addEventListener('click', () => {
    const packageId = app.eventRibbon.dataset.packageId;
    if (packageId && simulation.packages.has(packageId)) showPackage(packageId);
    else showIssuesSheet();
  });
  app.sheetClose.addEventListener('click', closeSheet);
  app.sheet.addEventListener('click', event => { if (event.target === app.sheet) closeSheet(); });
  app.canvas.addEventListener('pointerup', onScenePointer);

  app.sheetBody.addEventListener('click', event => {
    const focus = event.target.closest('[data-focus]');
    if (focus) {
      simulation.setFocus(focus.dataset.focus); updateUI(true); showFocusSheet(); announce(`Priority set to ${focusLabel(simulation.focus)}.`); return;
    }
    const openPkg = event.target.closest('[data-open-package]');
    if (openPkg) { showPackage(openPkg.dataset.openPackage); return; }
    const action = event.target.closest('[data-package-action]');
    if (action) {
      const id = action.dataset.packageId;
      if (action.dataset.packageAction === 'priority') {
        simulation.flagPriority(id); showPackage(id); announce(`${id} priority updated.`); return;
      }
      const result = simulation.resolveIssue(id, action.dataset.packageAction);
      announce(result.message);
      showPackage(id); updateUI(true);
      return;
    }
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
