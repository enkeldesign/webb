'use strict';
function closeSheet() {
  if (app.sheet.open && typeof app.sheet.close === 'function') app.sheet.close();
  else app.sheet.removeAttribute('open');
}

function showFocusSheet() {
  const buttons = FOCUS_MODES.map(mode => `
    <button class="focus-option ${simulation.focus === mode ? 'is-active' : ''}" data-focus="${mode}" aria-pressed="${simulation.focus === mode}">
      <span>${focusLabel(mode)}</span>
      <small>${focusDescription(mode)}</small>
    </button>`).join('');
  showSheet('What matters right now?', `<p class="sheet-lede">One choice. The team automatically pulls the parcels that best match it.</p><div class="focus-grid">${buttons}</div>`);
}

function focusDescription(mode) {
  return ({
    late: 'Protect deadlines and recover parcels closest to failure.',
    complaints: 'Pull customer pain to the front of every queue.',
    express: 'Keep paid express traffic moving first.',
    international: 'Protect handoffs with fewer recovery options.'
  })[mode];
}

function showIssuesSheet() {
  const issues = simulation.getIssues();
  const html = issues.length ? issues.map(pkg => packageRow(pkg, true)).join('') : `<div class="empty-state"><strong>No active exceptions.</strong><p>The network is moving cleanly.</p></div>`;
  showSheet(`Issues · ${issues.length}`, `<div class="issue-list">${html}</div>`);
}

function packageRow(pkg, showIssue = false) {
  const route = `${pkg.origin.place} → ${pkg.destination.place}`;
  const className = pkg.issue ? 'critical' : pkg.complaint ? 'warning' : 'normal';
  return `<button class="package-row ${className}" data-open-package="${pkg.id}">
    <span class="package-row-main"><strong>${pkg.id}</strong><span>${route}</span></span>
    <span class="package-row-meta">${showIssue ? escapeHtml(pkg.issueDetail || 'Customer complaint') : escapeHtml(pkg.location)}</span>
  </button>`;
}

function showFindSheet() {
  showSheet('Find a package', `
    <label class="search-label" for="package-search">ID, town, country or carrier</label>
    <input id="package-search" class="package-search" type="search" inputmode="search" autocomplete="off" placeholder="Try US-77104 or Timrå">
    <div id="search-results" class="search-results"><p class="hint">Search the live network from parcel to country.</p></div>
  `, { onOpen() { setTimeout(() => $('#package-search')?.focus(), 30); } });
}

function showPackage(packageId) {
  const pkg = simulation.packages.get(packageId); if (!pkg) return;
  selectedPackageId = packageId;
  const slack = Math.round(pkg.deadline - simulation.clock);
  const status = humanStatus(pkg.status);
  const issue = pkg.issue ? `<div class="exception-card"><span class="eyebrow">NEEDS YOU</span><strong>${issueTitle(pkg.issue)}</strong><p>${escapeHtml(pkg.issueDetail)}</p></div>` : '';
  const complaint = pkg.complaint ? `<div class="complaint-note"><strong>Customer complaint</strong><span>The recipient has asked where this parcel is.</span></div>` : '';
  const actions = packageActions(pkg);
  const traceHtml = [...pkg.trace].reverse().map(item => `<li><span>${formatGameClock(item.t)}</span><div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.place)}</small></div></li>`).join('');
  showSheet(pkg.id, `
    <div class="package-hero">
      <div><span class="eyebrow">${escapeHtml(pkg.carrier)} · ${pkg.service.toUpperCase()}</span><h3>${escapeHtml(pkg.origin.place)} <span aria-hidden="true">→</span> ${escapeHtml(pkg.destination.place)}</h3><p>${escapeHtml(pkg.origin.country)} → ${escapeHtml(pkg.destination.country)}</p></div>
      <span class="deadline-pill ${slack < 0 ? 'late' : slack < 25 ? 'soon' : ''}">${slack < 0 ? `${Math.abs(slack)}m late` : `${slack}m left`}</span>
    </div>
    <dl class="package-facts"><div><dt>Status</dt><dd>${status}</dd></div><div><dt>Now</dt><dd>${escapeHtml(pkg.location)}</dd></div></dl>
    ${issue}${complaint}
    <div class="sheet-actions">${actions}</div>
    <details class="trace" open><summary>Trace · ${pkg.trace.length} scans</summary><ol>${traceHtml}</ol></details>
  `);
}

function packageActions(pkg) {
  const btn = (label, action, cls='secondary') => `<button class="action-btn ${cls}" data-package-action="${action}" data-package-id="${pkg.id}">${label}</button>`;
  const list = [];
  if (pkg.issue === 'scan-gap') list.push(btn('SCAN CAGE', 'scan-cage', 'primary'), btn('REROUTE', 'reroute'));
  else if (pkg.issue === 'wrong-dock' || pkg.issue === 'routing') list.push(btn('REROUTE', 'reroute', 'primary'));
  else if (pkg.issue === 'label-damage') list.push(btn('REPRINT LABEL', 'reprint', 'primary'));
  else if (pkg.issue === 'missed-scan') list.push(btn('RESCAN', 'rescan', 'primary'));
  if (pkg.complaint) list.push(btn('CONTACT CUSTOMER', 'contact'));
  list.push(btn(pkg.priorityFlag ? 'CLEAR PRIORITY' : 'PRIORITISE', 'priority', pkg.priorityFlag ? 'secondary' : 'accent'));
  return list.join('');
}

function showWorker(workerId) {
  const worker = Object.values(simulation.cities).flatMap(c => c.workers).find(w => w.id === workerId);
  if (!worker) return;
  const pkg = worker.packageId ? simulation.packages.get(worker.packageId) : null;
  showSheet(worker.name, `
    <div class="entity-card"><span class="eyebrow">SORT TEAM · ${CITIES[worker.cityId].name}</span><h3>${escapeHtml(worker.task)}</h3>
      <p>${pkg ? `Working on <button class="inline-link" data-open-package="${pkg.id}">${pkg.id}</button> because it currently scores highest under <strong>${focusLabel(simulation.focus)}</strong>.` : `Waiting for the next parcel. Current focus: <strong>${focusLabel(simulation.focus)}</strong>.`}</p>
      <div class="mini-stats"><span><strong>${worker.handled}</strong> handled</span><span><strong>${Math.round((worker.progress / worker.total) * 100) || 0}%</strong> task</span></div>
    </div>`);
}

function findTruck(truckId) {
  return [...Object.values(simulation.cities).flatMap(c => c.regionalTrucks), ...simulation.nationalTrucks].find(t => t.id === truckId);
}

function showTruck(truckId) {
  const truck = findTruck(truckId); if (!truck) return;
  const from = CITIES[truck.from]?.name || truck.from;
  const to = CITIES[truck.to]?.name || truck.to;
  const load = truck.load.map(id => simulation.packages.get(id)).filter(Boolean);
  showSheet(truck.kind === 'national' ? 'National linehaul' : 'Regional truck', `
    <div class="entity-card"><span class="eyebrow">${truck.state.toUpperCase()}</span><h3>${escapeHtml(from)} → ${escapeHtml(to)}</h3>
      <p>${truck.state === 'driving' ? `${Math.round(truck.progress * 100)}% through the trip.` : `Waiting for the right load or an urgent parcel.`}</p>
      <div class="mini-stats"><span><strong>${load.length}/${truck.capacity}</strong> load</span><span><strong>${truck.departures}</strong> runs</span></div>
    </div>
    <div class="package-list">${load.length ? load.map(p => packageRow(p)).join('') : '<p class="hint">No parcels aboard right now.</p>'}</div>`);
}

function showTransport(transportId) {
  const transport = simulation.internationalTransports.find(t => t.id === transportId); if (!transport) return;
  const load = transport.load.map(id => simulation.packages.get(id)).filter(Boolean);
  const from = CITIES[transport.from]?.name || transport.from;
  const to = CITIES[transport.to]?.name || transport.to;
  const waiting = transport.direction === 'inbound' ? 'Waiting for inbound parcels at the partner gateway.' : 'Waiting for outbound international parcels.';
  showSheet('International transport', `<div class="entity-card"><span class="eyebrow">${transport.state.toUpperCase()}</span><h3>${escapeHtml(from)} → ${escapeHtml(to)}</h3><p>${transport.state === 'driving' ? `${Math.round(transport.progress * 100)}% complete.` : waiting}</p></div><div class="package-list">${load.length ? load.map(p => packageRow(p)).join('') : '<p class="hint">No parcels aboard right now.</p>'}</div>`);
}

function showTown(cityId, town) {
  const packages = [...simulation.packages.values()].filter(p => p.destination.place === town && p.status !== 'delivered');
  showSheet(town, `<div class="entity-card"><span class="eyebrow">${CITIES[cityId].name.toUpperCase()} REGION</span><h3>${packages.length} parcel${packages.length === 1 ? '' : 's'} heading here</h3><p>Regional trucks leave automatically when the load is worthwhile or a deadline forces the run.</p></div><div class="package-list">${packages.length ? packages.map(p => packageRow(p)).join('') : '<p class="hint">Nothing waiting for this route.</p>'}</div>`);
}

function showCity(cityId) {
  const city = simulation.cities[cityId];
  const waiting = Object.values(city.queues).flat().length;
  showSheet(CITIES[cityId].name, `<div class="entity-card"><span class="eyebrow">SWEDEN HUB</span><h3>${waiting} parcels on the floor</h3><p>${city.workers.filter(w => w.packageId).length} workers sorting · ${city.regionalTrucks.filter(t => t.state === 'driving').length} regional trucks moving.</p></div><button class="action-btn primary full" data-open-region="${cityId}">OPEN ${CITIES[cityId].name.toUpperCase()} REGION</button>`);
}

function showHandoff(cityId) {
  const city = simulation.cities[cityId];
  const pkgs = city.queues.readyNational.map(id => simulation.packages.get(id)).filter(Boolean);
  showSheet('National handoff', `<p class="sheet-lede">Parcels leave the region here. Sweden-level linehaul chooses the correct hub automatically.</p><div class="package-list">${pkgs.length ? pkgs.map(p => packageRow(p)).join('') : '<p class="hint">Handoff is clear.</p>'}</div>`);
}

function issueTitle(issue) {
  return ({ 'scan-gap':'Missing scan trail', 'wrong-dock':'Wrong dock', 'label-damage':'Unreadable label', 'missed-scan':'Missing handoff scan', routing:'No route' })[issue] || 'Exception';
}

function humanStatus(status) {
  return ({ arrived:'At depot', sorting:'Being sorted', 'ready-local':'Ready for regional truck', 'ready-national':'Ready for national handoff', 'ready-international':'Ready for international departure', 'ready-inbound':'Waiting at overseas gateway', 'transit-local':'On regional truck', 'transit-national':'On national linehaul', 'transit-international':'International transport', held:'Held for investigation', delivered:'Delivered' })[status] || status;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

function announce(text) {
  app.live.textContent = '';
  requestAnimationFrame(() => { app.live.textContent = text; });
}
