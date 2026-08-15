'use strict';
let onboardingActive = false;
const FIRST_SHIFT_KEY = 'postal-first-shift-v2';

function closeSheet() {
  if (onboardingActive) return;
  if (app.sheet.open && typeof app.sheet.close === 'function') app.sheet.close();
  else app.sheet.removeAttribute('open');
  app.sheetClose.hidden = false;
}

function needsFirstShiftBriefing() {
  try { return localStorage.getItem(FIRST_SHIFT_KEY) !== 'complete'; }
  catch { return true; }
}

function finishFirstShiftBriefing() {
  try { localStorage.setItem(FIRST_SHIFT_KEY, 'complete'); } catch {}
  onboardingActive = false;
  app.sheetClose.hidden = false;
  if (app.sheet.open && typeof app.sheet.close === 'function') app.sheet.close();
  else app.sheet.removeAttribute('open');
  simulation.paused = false;
  updateUI(true);
  announce('Morning shift started. Incoming packages are ready.');
}

function showBriefingSheet({ firstRun = false } = {}) {
  onboardingActive = firstRun;
  app.sheetClose.hidden = firstRun;
  const metrics = simulation.getMetrics();
  const action = firstRun
    ? '<button class="action-btn primary full briefing-start" data-start-shift>START THE MORNING SHIFT</button>'
    : '<button class="action-btn primary full" data-close-sheet>BACK TO THE NETWORK</button>';
  showSheet(firstRun ? 'Morning briefing' : 'How to run the network', `
    <div class="briefing-hero">
      <span class="eyebrow">SHIFT 1 · 07:00</span>
      <h3>Keep the morning moving</h3>
      <p>${metrics.incoming} packages are already on depot floors. Your team sorts automatically; you decide what deserves attention.</p>
    </div>
    <div class="briefing-steps">
      <article><span aria-hidden="true">1</span><div><strong>Watch INCOMING</strong><p>Open the depot queues, inspect any package and prioritise the ones that cannot wait.</p></div></article>
      <article><span aria-hidden="true">2</span><div><strong>Resolve red ISSUES</strong><p>Read the scan trail, find what stopped the package and choose an operational fix.</p></div></article>
      <article><span aria-hidden="true">3</span><div><strong>Zoom out before trouble spreads</strong><p>DEPOT shows people and parcels, REGION shows local trucks, and SWEDEN shows national and international flow.</p></div></article>
    </div>
    <div class="interaction-key"><strong>Also interactive:</strong><span>workers</span><span>packages</span><span>trucks</span><span>towns</span><span>hubs</span></div>
    ${action}
  `);
}

function showFocusSheet() {
  const buttons = FOCUS_MODES.map(mode => `
    <button class="focus-option ${simulation.focus === mode ? 'is-active' : ''}" data-focus="${mode}" aria-pressed="${simulation.focus === mode}">
      <span class="focus-option-icon" aria-hidden="true">${focusIcon(mode)}</span>
      <strong>${focusLabel(mode)}</strong>
      <small>${focusDescription(mode)}</small>
    </button>`).join('');
  showSheet('Choose the team focus', `<p class="sheet-lede">The depot keeps moving. Your focus changes which packages every worker pulls first.</p><div class="focus-grid">${buttons}</div>`);
}

function focusIcon(mode) {
  return ({ late: '⏱', complaints: '☎', express: 'ϟ', international: '↗' })[mode] || '●';
}

function focusDescription(mode) {
  return ({
    late: 'Recover the packages closest to missing their deadline.',
    complaints: 'Pull visible customer pain to the front of each queue.',
    express: 'Protect the fastest paid service across every handoff.',
    international: 'Prioritise routes with fewer chances to recover.'
  })[mode];
}

function showIssuesSheet() {
  const issues = simulation.getIssues();
  const html = issues.length
    ? `<p class="sheet-lede">These packages have left the normal flow. Open one, read its scan trail and choose an operational fix.</p><div class="issue-list">${issues.map(pkg => packageRow(pkg, true)).join('')}</div>`
    : `<div class="empty-state"><span class="empty-state-icon" aria-hidden="true">✓</span><strong>No active exceptions</strong><p>The network is moving cleanly.</p></div>`;
  showSheet(`Issues · ${issues.length}`, html);
}

function showIncomingSheet() {
  const incoming = simulation.getIncomingPackages();
  const sorting = incoming.filter(pkg => pkg.status === 'sorting').length;
  const held = incoming.filter(pkg => pkg.status === 'held').length;
  const waiting = incoming.length - sorting - held;
  const sections = CITY_IDS.map(cityId => {
    const packages = incoming.filter(pkg => pkg.cityId === cityId);
    return `<section class="depot-queue">
      <header><div><span class="eyebrow">${CITIES[cityId].short} DEPOT</span><strong>${CITIES[cityId].name}</strong></div><span>${packages.length}</span></header>
      <div class="package-list">${packages.length ? packages.slice(0, 8).map(pkg => packageRow(pkg)).join('') : '<p class="hint">The depot floor is clear.</p>'}</div>
    </section>`;
  }).join('');
  showSheet(`Incoming · ${incoming.length}`, `
    <p class="sheet-lede">The live intake across all three depots. Open a package to inspect its route or move it to the front of the sort.</p>
    <div class="intake-summary"><span><strong>${waiting}</strong> waiting</span><span><strong>${sorting}</strong> sorting</span><span><strong>${held}</strong> held</span></div>
    ${sections}
  `);
}

function packageRow(pkg, showIssue = false) {
  const route = `${pkg.origin.place} → ${pkg.destination.place}`;
  const className = pkg.issue ? 'critical' : pkg.complaint ? 'warning' : 'normal';
  const cubeLabel = pkg.service === 'express' ? 'EXP' : pkg.id.split('-')[0].slice(0, 3);
  return `<button class="package-row ${className}" data-open-package="${pkg.id}">
    <span class="parcel-cube" aria-hidden="true">${escapeHtml(cubeLabel)}</span>
    <span class="package-row-copy">
      <span class="package-row-main"><strong>${escapeHtml(pkg.id)}</strong><span>${escapeHtml(route)}</span></span>
      <span class="package-row-meta">${showIssue ? escapeHtml(pkg.issueDetail || 'Customer complaint') : escapeHtml(pkg.location)}</span>
    </span>
    <span class="row-arrow" aria-hidden="true">›</span>
  </button>`;
}

function showFindSheet() {
  showSheet('Find a package', `
    <label class="search-label" for="package-search">Package ID, town, country or carrier</label>
    <div class="search-box"><input id="package-search" class="package-search" type="search" inputmode="search" autocomplete="off" placeholder="Try US-77104 or Timrå"></div>
    <div id="search-results" class="search-results"><p class="hint">Search every live package in Sweden and beyond.</p></div>
  `, { onOpen() { setTimeout(() => $('#package-search')?.focus(), 30); } });
}

function showPackage(packageId) {
  const pkg = simulation.packages.get(packageId);
  if (!pkg) return;
  selectedPackageId = packageId;
  const slack = Math.round(pkg.deadline - simulation.clock);
  const status = humanStatus(pkg.status);
  const issue = pkg.issue ? `<div class="exception-card"><span class="eyebrow">NEEDS YOU</span><strong>${issueTitle(pkg.issue)}</strong><p>${escapeHtml(pkg.issueDetail)}</p></div>` : '';
  const complaint = pkg.complaint ? `<div class="complaint-note"><strong>Customer complaint</strong><span>The recipient has asked where this package is.</span></div>` : '';
  const actions = packageActions(pkg);
  const traceHtml = [...pkg.trace].reverse().map(item => `<li><span>${formatGameClock(item.t)}</span><div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.place)}</small></div></li>`).join('');
  showSheet(pkg.id, `
    <div class="package-label-card ${carrierClass(pkg.carrier)}">
      <span class="carrier-band" aria-hidden="true"></span>
      <div class="package-hero">
        <div><span class="eyebrow">${escapeHtml(pkg.carrier)} · ${pkg.service.toUpperCase()}</span><h3>${escapeHtml(pkg.origin.place)} <span aria-hidden="true">→</span> ${escapeHtml(pkg.destination.place)}</h3><p>${escapeHtml(pkg.origin.country)} → ${escapeHtml(pkg.destination.country)}</p></div>
        <span class="deadline-pill ${slack < 0 ? 'late' : slack < 25 ? 'soon' : ''}">${slack < 0 ? `${Math.abs(slack)}m late` : `${slack}m left`}</span>
      </div>
      <div class="route-visual" aria-hidden="true"><span></span><i></i><span></span></div>
    </div>
    <dl class="package-facts"><div><dt>Status</dt><dd>${status}</dd></div><div><dt>Current location</dt><dd>${escapeHtml(pkg.location)}</dd></div></dl>
    ${issue}${complaint}
    <div class="sheet-actions">${actions}</div>
    <details class="trace" open><summary>Full trace · ${pkg.trace.length} scans</summary><ol>${traceHtml}</ol></details>
  `);
}

function carrierClass(carrier) {
  return `carrier-${String(carrier || 'other').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

function packageActions(pkg) {
  const btn = (label, action, cls = 'secondary') => `<button class="action-btn ${cls}" data-package-action="${action}" data-package-id="${pkg.id}">${label}</button>`;
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
  const worker = Object.values(simulation.cities).flatMap(city => city.workers).find(item => item.id === workerId);
  if (!worker) return;
  const pkg = worker.packageId ? simulation.packages.get(worker.packageId) : null;
  const progress = Math.min(100, Math.round((worker.progress / worker.total) * 100) || 0);
  showSheet(worker.name, `
    <div class="entity-card">
      <div class="entity-card-layout">
        <span class="entity-avatar" aria-hidden="true">${escapeHtml(worker.name.slice(0, 1))}</span>
        <div><span class="eyebrow">${escapeHtml(worker.role.toUpperCase())} · ${CITIES[worker.cityId].name.toUpperCase()}</span><h3>${escapeHtml(worker.task)}</h3></div>
      </div>
      <p>${pkg ? `Working on <button class="inline-link" data-open-package="${pkg.id}">${pkg.id}</button> because it scores highest under <strong>${focusLabel(simulation.focus)}</strong>.` : `Ready for the next package. Current team focus: <strong>${focusLabel(simulation.focus)}</strong>.`}</p>
      <div class="progress-rail" aria-label="Task ${progress}% complete"><i style="width:${progress}%"></i></div>
      <div class="mini-stats"><span><strong>${worker.handled}</strong> handled</span><span><strong>${progress}%</strong> current task</span></div>
    </div>`);
}

function findTruck(truckId) {
  return [...Object.values(simulation.cities).flatMap(city => city.regionalTrucks), ...simulation.nationalTrucks].find(truck => truck.id === truckId);
}

function capacityDots(load, capacity) {
  return `<div class="capacity-dots" aria-label="${load} of ${capacity} load spaces filled">${Array.from({ length: capacity }, (_, i) => `<i class="${i < load ? 'is-full' : ''}"></i>`).join('')}</div>`;
}

function showTruck(truckId) {
  const truck = findTruck(truckId);
  if (!truck) return;
  const from = CITIES[truck.from]?.name || truck.from;
  const to = CITIES[truck.to]?.name || truck.to;
  const load = truck.load.map(id => simulation.packages.get(id)).filter(Boolean);
  const progress = truck.state === 'driving' ? Math.round(truck.progress * 100) : 0;
  showSheet(truck.kind === 'national' ? 'National linehaul' : 'Regional truck', `
    <div class="entity-card">
      <div class="entity-card-layout"><span class="entity-avatar" aria-hidden="true">↗</span><div><span class="eyebrow">${truck.state.toUpperCase()}</span><h3>${escapeHtml(from)} → ${escapeHtml(to)}</h3></div></div>
      <p>${truck.state === 'driving' ? `${progress}% through the route. Tap any package below to follow its whole journey.` : 'Waiting for a useful load or a deadline that forces departure.'}</p>
      ${capacityDots(load.length, truck.capacity)}
      <div class="mini-stats"><span><strong>${load.length}/${truck.capacity}</strong> load</span><span><strong>${truck.departures}</strong> runs</span></div>
    </div>
    <div class="package-list">${load.length ? load.map(pkg => packageRow(pkg)).join('') : '<p class="hint">No packages aboard right now.</p>'}</div>`);
}

function showTransport(transportId) {
  const transport = simulation.internationalTransports.find(item => item.id === transportId);
  if (!transport) return;
  const load = transport.load.map(id => simulation.packages.get(id)).filter(Boolean);
  const from = CITIES[transport.from]?.name || transport.from;
  const to = CITIES[transport.to]?.name || transport.to;
  const waiting = transport.direction === 'inbound' ? 'Waiting for inbound packages at the partner gateway.' : 'Waiting for outbound international packages.';
  showSheet('International transport', `<div class="entity-card"><div class="entity-card-layout"><span class="entity-avatar" aria-hidden="true">◎</span><div><span class="eyebrow">${transport.state.toUpperCase()}</span><h3>${escapeHtml(from)} → ${escapeHtml(to)}</h3></div></div><p>${transport.state === 'driving' ? `${Math.round(transport.progress * 100)}% complete.` : waiting}</p>${capacityDots(load.length, transport.capacity)}</div><div class="package-list">${load.length ? load.map(pkg => packageRow(pkg)).join('') : '<p class="hint">No packages aboard right now.</p>'}</div>`);
}

function showTown(cityId, town) {
  const packages = [...simulation.packages.values()].filter(pkg => pkg.destination.place === town && pkg.status !== 'delivered');
  showSheet(town, `<div class="entity-card"><span class="eyebrow">${CITIES[cityId].name.toUpperCase()} REGION</span><h3>${packages.length} package${packages.length === 1 ? '' : 's'} heading here</h3><p>Regional trucks leave automatically when their load is worthwhile or a deadline forces the run.</p></div><div class="package-list">${packages.length ? packages.map(pkg => packageRow(pkg)).join('') : '<div class="empty-state"><span class="empty-state-icon" aria-hidden="true">✓</span><strong>Route clear</strong><p>Nothing is waiting for this town.</p></div>'}</div>`);
}

function showCity(cityId) {
  const city = simulation.cities[cityId];
  const waiting = Object.values(city.queues).flat().length;
  const activeWorkers = city.workers.filter(worker => worker.packageId).length;
  const movingTrucks = city.regionalTrucks.filter(truck => truck.state === 'driving').length;
  showSheet(CITIES[cityId].name, `<div class="entity-card"><span class="eyebrow">SWEDEN HUB</span><h3>${waiting} packages on the depot floor</h3><div class="mini-stats"><span><strong>${activeWorkers}/3</strong> workers sorting</span><span><strong>${movingTrucks}</strong> trucks moving</span></div></div><button class="action-btn primary full" data-open-region="${cityId}">OPEN ${CITIES[cityId].name.toUpperCase()} REGION</button>`);
}

function showHandoff(cityId) {
  const city = simulation.cities[cityId];
  const packages = city.queues.readyNational.map(id => simulation.packages.get(id)).filter(Boolean);
  showSheet('National handoff', `<p class="sheet-lede">Packages leave the region here. Sweden-level linehaul chooses the correct hub automatically.</p><div class="package-list">${packages.length ? packages.map(pkg => packageRow(pkg)).join('') : '<div class="empty-state"><span class="empty-state-icon" aria-hidden="true">✓</span><strong>Handoff clear</strong><p>No national packages are waiting.</p></div>'}</div>`);
}

function issueTitle(issue) {
  return ({ 'scan-gap': 'Missing scan trail', 'wrong-dock': 'Wrong dock', 'label-damage': 'Unreadable label', 'missed-scan': 'Missing handoff scan', routing: 'No route' })[issue] || 'Exception';
}

function humanStatus(status) {
  return ({ arrived: 'At depot', sorting: 'Being sorted', 'ready-local': 'Ready for regional truck', 'ready-national': 'Ready for national handoff', 'ready-international': 'Ready for international departure', 'ready-inbound': 'Waiting at overseas gateway', 'transit-local': 'On regional truck', 'transit-national': 'On national linehaul', 'transit-international': 'International transport', held: 'Held for investigation', delivered: 'Delivered' })[status] || status;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function announce(text) {
  app.live.textContent = '';
  requestAnimationFrame(() => { app.live.textContent = text; });
}
