'use strict';
PostalSimulation.prototype._spawnRoutinePackage = function() {
    const cityId = CITY_IDS[Math.floor(this.random() * CITY_IDS.length)];
    const city = CITIES[cityId];
    const origin = city.towns[Math.floor(this.random() * city.towns.length)];
    const carrierId = CARRIER_IDS[Math.floor(this.random() * CARRIER_IDS.length)];
    const carrier = CARRIERS[carrierId];
    const roll = this.random();
    const service = carrier.id === 'dlh' || (carrier.id === 'nordpost' && this.random() < .14) ? 'express' : carrier.service;

    // Each carrier changes the shape of the queue, not only its paint.
    // BRUNG stays local, DLH creates urgent single decisions, STÄNKER fills
    // national vehicles, and NORDPOST supplies the steady mixed baseline.
    if (carrier.id === 'brung') {
      let destinationTown = city.towns[Math.floor(this.random() * city.towns.length)];
      if (destinationTown === origin) destinationTown = city.name;
      this.addPackage({
        prefix: carrier.code, carrierId, origin: { place: origin, country: 'Sweden' },
        destination: { place: destinationTown, country: 'Sweden' }, cityId, location: city.hub,
        service, deadline: this.clock + carrier.deadline
      });
      return;
    }

    if (roll < (carrier.id === 'stanker' ? .08 : .18)) {
      const country = ['USA', 'Denmark', 'Germany', 'Finland'][Math.floor(this.random() * 4)];
      const originPlace = { USA: 'Chicago', Denmark: 'København', Germany: 'Hamburg', Finland: 'Helsinki' }[country];
      const targetId = CITY_IDS[Math.floor(this.random() * CITY_IDS.length)];
      const target = CITIES[targetId];
      const destination = { place: target.towns[Math.floor(this.random() * target.towns.length)], country: 'Sweden' };
      this.addPackage({
        prefix: carrier.code, carrierId, origin: { place: originPlace, country }, destination,
        cityId: null, location: `${originPlace} partner hub`, status: 'ready-inbound', service,
        deadline: this.clock + carrier.deadline + 24,
        trace: [{ t: this.clock, label: 'Accepted by partner network', place: originPlace }]
      });
    } else {
      let destination;
      if (carrier.id === 'stanker' && roll < .34) {
        const country = ['Denmark', 'Germany', 'Finland'][Math.floor(this.random() * 3)];
        destination = { place: country === 'Denmark' ? 'København' : country === 'Germany' ? 'Hamburg' : 'Helsinki', country };
      } else {
        let targetId = CITY_IDS[Math.floor(this.random() * CITY_IDS.length)];
        if (carrier.id === 'stanker' && targetId === cityId) targetId = CITY_IDS[(CITY_IDS.indexOf(cityId) + 1) % CITY_IDS.length];
        const target = CITIES[targetId];
        destination = { place: target.towns[Math.floor(this.random() * target.towns.length)], country: 'Sweden' };
      }
      this.addPackage({
        prefix: carrier.code, carrierId,
        origin: { place: origin, country: 'Sweden' }, destination,
        cityId, location: city.hub, service,
        deadline: this.clock + carrier.deadline
      });
    }
};


PostalSimulation.prototype.focusForPackage = function(pkg) {
    return this.cities[pkg?.cityId]?.focus || 'late';
};


PostalSimulation.prototype.getActivePackages = function(limit = 30) {
    return [...this.packages.values()]
      .filter(pkg => pkg.status !== 'delivered')
      .sort((a, b) => {
        const aSelected = a.priorityFlag ? 1 : 0;
        const bSelected = b.priorityFlag ? 1 : 0;
        return Number(Boolean(b.issue)) - Number(Boolean(a.issue)) || bSelected - aSelected ||
          packageScore(b, this.focusForPackage(b), this.clock) - packageScore(a, this.focusForPackage(a), this.clock);
      })
      .slice(0, limit);
};


PostalSimulation.prototype.findTruck = function(truckId) {
    return [...Object.values(this.cities).flatMap(city => city.regionalTrucks), ...this.nationalTrucks]
      .find(truck => truck.id === truckId) || null;
};


PostalSimulation.prototype.eligiblePackagesForTruck = function(truckOrId) {
    const truck = typeof truckOrId === 'string' ? this.findTruck(truckOrId) : truckOrId;
    if (!truck || truck.state !== 'waiting') return [];
    const city = this.cities[truck.from];
    if (!city) return [];
    const ids = truck.kind === 'regional' ? city.queues.readyLocal : city.queues.readyNational;
    return ids.map(id => this.packages.get(id)).filter(pkg => {
      if (!pkg) return false;
      if (truck.kind === 'regional') return pkg.destination.place === truck.to;
      return nextLegForPackage(pkg).to === truck.to;
    }).sort((a, b) => packageScore(b, city.focus, this.clock) - packageScore(a, city.focus, this.clock));
};


PostalSimulation.prototype.truckForPackage = function(packageId) {
    const pkg = this.packages.get(packageId);
    if (!pkg || !pkg.cityId) return null;
    if (pkg.status === 'ready-local') {
      return this.cities[pkg.cityId].regionalTrucks.find(truck => truck.to === pkg.destination.place && truck.state === 'waiting') || null;
    }
    if (pkg.status === 'ready-national') {
      const leg = nextLegForPackage(pkg);
      return this.nationalTrucks.find(truck => truck.from === pkg.cityId && truck.to === leg.to && truck.state === 'waiting') || null;
    }
    return null;
};


PostalSimulation.prototype.planPackageOnTruck = function(packageId) {
    const truck = this.truckForPackage(packageId);
    if (!truck) return { ok: false, message: 'No compatible truck is ready yet.' };
    const eligible = this.eligiblePackagesForTruck(truck);
    if (!eligible.some(pkg => pkg.id === packageId)) return { ok: false, message: 'That package is not ready for this route.' };
    for (const other of [...Object.values(this.cities).flatMap(city => city.regionalTrucks), ...this.nationalTrucks]) {
      other.plannedLoad = other.plannedLoad.filter(id => id !== packageId);
    }
    if (!truck.plannedLoad.includes(packageId)) truck.plannedLoad.unshift(packageId);
    truck.plannedLoad = truck.plannedLoad.slice(0, truck.capacity);
    return { ok: true, truck, message: `${packageId} loaded for ${truck.to}.` };
};


PostalSimulation.prototype.toggleTruckLoad = function(truckId, packageId) {
    const truck = this.findTruck(truckId);
    if (!truck || truck.state !== 'waiting') return false;
    const eligible = this.eligiblePackagesForTruck(truck);
    if (!eligible.some(pkg => pkg.id === packageId)) return false;
    const index = truck.plannedLoad.indexOf(packageId);
    if (index >= 0) truck.plannedLoad.splice(index, 1);
    else if (truck.plannedLoad.length < truck.capacity) truck.plannedLoad.push(packageId);
    return true;
};


PostalSimulation.prototype.autoFillTruck = function(truckId) {
    const truck = this.findTruck(truckId);
    if (!truck || truck.state !== 'waiting') return [];
    const eligible = this.eligiblePackagesForTruck(truck);
    const kept = truck.plannedLoad.filter(id => eligible.some(pkg => pkg.id === id));
    for (const pkg of eligible) {
      if (kept.length >= truck.capacity) break;
      if (!kept.includes(pkg.id)) kept.push(pkg.id);
    }
    truck.plannedLoad = kept;
    return [...truck.plannedLoad];
};


PostalSimulation.prototype.dispatchTruck = function(truckId) {
    const truck = this.findTruck(truckId);
    if (!truck || truck.state !== 'waiting') return { ok: false, message: 'That truck is already on the road.' };
    const eligibleIds = new Set(this.eligiblePackagesForTruck(truck).map(pkg => pkg.id));
    const load = truck.plannedLoad.filter(id => eligibleIds.has(id)).slice(0, truck.capacity);
    if (!load.length) return { ok: false, message: 'Load at least one matching package first.' };

    const loadPackages = load.map(id => this.packages.get(id)).filter(Boolean);
    const fillRatio = load.length / truck.capacity;
    const protectsExpress = loadPackages.some(pkg => pkg.service === 'express');
    const protectsDeadline = loadPackages.some(pkg => pkg.deadline - this.clock < 25);
    const grade = fillRatio >= .8 ? 'FULL LOAD' : protectsDeadline ? 'DEADLINE SAVE' : protectsExpress ? 'EXPRESS RUN' : fillRatio >= .45 ? 'SMART LOAD' : 'EARLY RUN';
    const points = load.length * 35 + (fillRatio >= .8 ? 180 : fillRatio >= .45 ? 90 : 0) + (protectsDeadline ? 120 : protectsExpress ? 70 : 0);
    const chainMove = fillRatio >= .45 || protectsDeadline || protectsExpress;

    truck.load = load;
    truck.plannedLoad = [];
    for (const id of load) {
      const pkg = this.packages.get(id);
      if (!pkg) continue;
      if (truck.kind === 'regional') {
        pkg.status = 'transit-local';
        pkg.location = `${CITIES[truck.from].name} → ${truck.to}`;
        trace(pkg, this.clock, 'Regional truck departed', CITIES[truck.from].hub);
      } else {
        pkg.status = 'transit-national';
        pkg.location = `${CITIES[truck.from].name} → ${CITIES[truck.to].name}`;
        trace(pkg, this.clock, 'National linehaul departed', CITIES[truck.from].hub);
      }
      this._enqueue(pkg);
    }
    truck.state = 'driving';
    truck.progress = 0;
    truck.wait = 0;
    truck.departures += 1;
    this.stats.dispatches += 1;
    this.stats.dispatchedSpaces += load.length;
    this.stats.dispatchedCapacity += truck.capacity;
    this.stats.score += points;
    this.stats.dispatchChain = chainMove ? this.stats.dispatchChain + 1 : 0;
    this.addEvent('success', `${grade}: ${CITIES[truck.from].name} → ${CITIES[truck.to]?.name || truck.to}`, `${load.length}/${truck.capacity} spaces · +${points} points.`);
    return {
      ok: true, truck, load, grade, points, chain: this.stats.dispatchChain,
      message: `${grade} · +${points}. Truck sent with ${load.length} package${load.length === 1 ? '' : 's'}.`
    };
};


PostalSimulation.prototype.startFirstDaySort = function(packageId = 'DAY1-1001') {
    const pkg = this.packages.get(packageId);
    if (!this.firstDay || !pkg || this.tutorialStage !== 'select-package') return false;
    const city = this.cities[pkg.cityId];
    const worker = city?.workers.find(item => item.role === 'Express sort') || city?.workers[0];
    if (!city || !worker || worker.packageId) return false;
    const queueIndex = city.queues.arrived.indexOf(pkg.id);
    if (queueIndex >= 0) city.queues.arrived.splice(queueIndex, 1);
    pkg.tutorialLock = false;
    pkg.priorityFlag = true;
    pkg.status = 'sorting';
    worker.packageId = pkg.id;
    worker.progress = 0;
    worker.total = 4.2;
    worker.task = `Sorting ${pkg.id}`;
    this.tutorialStage = 'watch-sort';
    trace(pkg, this.clock, `${worker.name} started Express sort`, CITIES[pkg.cityId].hub);
    return true;
};


PostalSimulation.prototype.releaseFirstDayWave = function() {
    if (!this.firstDay || this.firstDayWaveReleased) return false;
    this.firstDayWaveReleased = true;
    const wave = [
      ['DAY1-NP', 'NORDPOST', 'Ånge', 'Sundsvall', 'Sweden', 'standard', 112],
      ['DAY1-DLH', 'DLH', 'Härnösand', 'Solna', 'Sweden', 'express', 62],
      ['DAY1-BRG', 'BRUNG', 'Söråker', 'Timrå', 'Sweden', 'standard', 84],
      ['DAY1-DBS', 'STÄNKER', 'Ånge', 'Göteborg', 'Sweden', 'standard', 136]
    ];
    for (const [id, carrier, origin, destination, country, service, margin] of wave) {
      this.addPackage({
        id, carrier, cityId: 'sundsvall', location: CITIES.sundsvall.hub, service,
        deadline: this.clock + margin,
        origin: { place: origin, country: 'Sweden' }, destination: { place: destination, country }
      });
    }
    this.tutorialStage = 'choose-focus';
    this.addEvent('info', 'Four carriers arrived together', 'Set Sundsvall’s focus before the queue grows.');
    return true;
};


PostalSimulation.prototype.releaseChicagoCase = function() {
    if (!this.firstDay || this.packages.has('US-77104')) return false;
    this.addPackage({
      id: 'US-77104', carrierId: 'dlh',
      origin: { place: 'Chicago', country: 'USA' }, destination: { place: 'Timrå', country: 'Sweden' },
      cityId: 'stockholm', location: 'Stockholm terminal · inbound cage 14', service: 'express',
      deadline: this.clock + 92, status: 'held', issue: 'scan-gap', complaint: true,
      issueDetail: 'No scan after customs release. The Timrå recipient is waiting.',
      trace: [
        { t: this.clock - 64, label: 'Accepted', place: 'Chicago' },
        { t: this.clock - 42, label: 'Departed USA', place: 'Chicago air hub' },
        { t: this.clock - 18, label: 'Customs cleared', place: 'Stockholm Arlanda' },
        { t: this.clock - 9, label: 'Last scan', place: 'Inbound cage 14' }
      ]
    });
    this.tutorialStage = 'select-chicago';
    this.addEvent('critical', 'Chicago → Timrå stopped in Stockholm', 'Follow it across every handoff.', 'US-77104');
    return true;
};


PostalSimulation.prototype.completeFirstDay = function() {
    if (!this.firstDay) return false;
    this.firstDay = false;
    this.tutorialStage = 'complete';
    this.spawnEnabled = true;
    this.spawnAccumulator = 0;
    this.addEvent('success', 'First morning complete', 'The whole network is now live.');
    for (let i = 0; i < 4; i += 1) this._spawnRoutinePackage();
    return true;
};


PostalSimulation.prototype._maybeCreateIncident = function() {
    const candidates = [...this.packages.values()].filter(p => p.status !== 'delivered' && !p.issue && !p.complaint && !p.status.startsWith('transit'));
    if (!candidates.length || this.random() > 0.68) return;
    const pkg = candidates[Math.floor(this.random() * candidates.length)];
    if (this.random() < .28) {
      pkg.complaint = true;
      this.addEvent('warning', `Recipient is asking about ${pkg.id}`, 'Deliver it to clear the complaint; a complaints-focused depot will pull it forward.', pkg.id);
      return;
    }
    pkg.issue = this.random() < 0.5 ? 'label-damage' : 'missed-scan';
    pkg.issueDetail = pkg.issue === 'label-damage' ? 'The destination label is unreadable at the sort station.' : 'A required handoff scan is missing.';
    pkg.status = 'held';
    this._enqueue(pkg);
    this.addEvent('warning', `${pkg.id} needs investigation`, pkg.issueDetail, pkg.id);
};


PostalSimulation.prototype.resolveIssue = function(packageId, action) {
    const pkg = this.packages.get(packageId);
    if (!pkg || !pkg.issue) return { ok: false, message: 'No active issue on this parcel.' };
    const issue = pkg.issue;
    const valid = {
      'scan-gap': ['scan-cage', 'reroute'],
      'wrong-dock': ['reroute'],
      'label-damage': ['reprint'],
      'missed-scan': ['rescan'],
      'routing': ['reroute']
    };
    if (!valid[issue]?.includes(action)) return { ok: false, message: 'That does not resolve the operational exception.' };

    if (issue === 'scan-gap' && action === 'scan-cage') {
      pkg.location = 'Stockholm terminal · inbound cage 14';
      trace(pkg, this.clock, 'Manual cage scan found parcel', pkg.location);
    }
    if (action === 'reroute') trace(pkg, this.clock, 'Manual route corrected', pkg.location);
    if (action === 'reprint') trace(pkg, this.clock, 'Destination label reprinted', pkg.location);
    if (action === 'rescan') trace(pkg, this.clock, 'Handoff rescan completed', pkg.location);

    pkg.issue = null;
    pkg.issueDetail = '';
    pkg.status = 'arrived';
    pkg.priorityFlag = true;
    this._enqueue(pkg);
    this.stats.investigationsResolved += 1;
    this.addEvent('success', `${pkg.id} is moving again`, 'Workers have put it at the front of the correct flow.', pkg.id);
    return { ok: true, message: 'Resolved and prioritised.' };
};


PostalSimulation.prototype.flagPriority = function(packageId) {
    const pkg = this.packages.get(packageId);
    if (!pkg) return false;
    pkg.priorityFlag = !pkg.priorityFlag;
    this.addEvent('info', pkg.priorityFlag ? `${pkg.id} prioritised` : `${pkg.id} priority cleared`, pkg.priorityFlag ? 'Workers will pull it forward when possible.' : 'It returns to normal queue scoring.', pkg.id);
    return true;
};


PostalSimulation.prototype.findPackages = function(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return [...this.packages.values()].filter(pkg => [pkg.id, pkg.origin.place, pkg.origin.country, pkg.destination.place, pkg.destination.country, pkg.location, pkg.carrier]
      .some(v => String(v || '').toLowerCase().includes(q))).slice(0, 12);
};


PostalSimulation.prototype.getIssues = function() {
    return [...this.packages.values()]
      .filter(pkg => pkg.status !== 'delivered' && (pkg.issue || pkg.complaint))
      .sort((a, b) => packageScore(b, this.focusForPackage(b), this.clock) - packageScore(a, this.focusForPackage(a), this.clock));
};

PostalSimulation.prototype.getIncomingPackages = function(cityId = null) {
    return [...this.packages.values()]
      .filter(pkg => CITY_IDS.includes(pkg.cityId) && (!cityId || pkg.cityId === cityId) && ['arrived', 'sorting', 'held'].includes(pkg.status))
      .sort((a, b) => packageScore(b, this.focusForPackage(b), this.clock) - packageScore(a, this.focusForPackage(a), this.clock));
};


PostalSimulation.prototype.getMetrics = function() {
    const active = [...this.packages.values()].filter(p => p.status !== 'delivered');
    const late = active.filter(p => p.deadline < this.clock).length;
    const dueSoon = active.filter(p => p.deadline >= this.clock && p.deadline - this.clock < 25).length;
    const issues = active.filter(p => p.issue || p.complaint).length;
    const incoming = this.getIncomingPackages().length;
    const onTime = this.stats.delivered ? Math.round(100 * (this.stats.delivered - this.stats.lateDelivered) / this.stats.delivered) : 100;
    const utilisation = this.stats.dispatchedCapacity
      ? Math.round(100 * this.stats.dispatchedSpaces / this.stats.dispatchedCapacity)
      : 0;
    return {
      active: active.length, incoming, late, dueSoon, issues, onTime, delivered: this.stats.delivered, utilisation,
      score: this.stats.score, chain: this.stats.dispatchChain
    };
};

globalThis.PostalSimulation = PostalSimulation;
globalThis.CITIES = CITIES;
globalThis.CITY_IDS = CITY_IDS;
globalThis.FOCUS_MODES = FOCUS_MODES;
globalThis.CARRIERS = CARRIERS;
globalThis.CARRIER_IDS = CARRIER_IDS;
globalThis.packageScore = packageScore;
globalThis.nextLegForPackage = nextLegForPackage;
globalThis.POSTAL_MODEL = { PostalSimulation, CITIES, CITY_IDS, FOCUS_MODES, CARRIERS, CARRIER_IDS, packageScore, nextLegForPackage, cityForPlace, gatewayForCountry, isInternationalPlace, makePackageId };
