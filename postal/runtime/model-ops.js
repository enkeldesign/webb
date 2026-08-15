'use strict';
PostalSimulation.prototype._spawnRoutinePackage = function() {
    const cityId = CITY_IDS[Math.floor(this.random() * CITY_IDS.length)];
    const city = CITIES[cityId];
    const origin = city.towns[Math.floor(this.random() * city.towns.length)];
    const roll = this.random();
    const service = this.random() < 0.22 ? 'express' : 'standard';
    if (roll < 0.18) {
      const country = ['USA', 'Denmark', 'Germany', 'Finland'][Math.floor(this.random() * 4)];
      const originPlace = { USA: 'Chicago', Denmark: 'København', Germany: 'Hamburg', Finland: 'Helsinki' }[country];
      const targetId = CITY_IDS[Math.floor(this.random() * CITY_IDS.length)];
      const target = CITIES[targetId];
      const destination = { place: target.towns[Math.floor(this.random() * target.towns.length)], country: 'Sweden' };
      this.addPackage({
        prefix: 'IN', origin: { place: originPlace, country }, destination,
        cityId: null, location: `${originPlace} partner hub`, status: 'ready-inbound', service,
        deadline: this.clock + (service === 'express' ? 82 : 145),
        trace: [{ t: this.clock, label: 'Accepted by partner network', place: originPlace }]
      });
    } else {
      let destination;
      if (roll < 0.36) {
        const country = ['Denmark', 'Germany', 'Finland'][Math.floor(this.random() * 3)];
        destination = { place: country === 'Denmark' ? 'København' : country === 'Germany' ? 'Hamburg' : 'Helsinki', country };
      } else {
        const targetId = CITY_IDS[Math.floor(this.random() * CITY_IDS.length)];
        const target = CITIES[targetId];
        destination = { place: target.towns[Math.floor(this.random() * target.towns.length)], country: 'Sweden' };
      }
      this.addPackage({
        prefix: city.short,
        origin: { place: origin, country: 'Sweden' }, destination,
        cityId, location: city.hub, service,
        deadline: this.clock + (service === 'express' ? 60 : 115)
      });
    }
};


PostalSimulation.prototype._maybeCreateIncident = function() {
    const candidates = [...this.packages.values()].filter(p => p.status !== 'delivered' && !p.issue && !p.status.startsWith('transit'));
    if (!candidates.length || this.random() > 0.68) return;
    const pkg = candidates[Math.floor(this.random() * candidates.length)];
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
    if (!valid[issue]?.includes(action)) {
      if (action === 'contact') {
        pkg.complaint = false;
        this.stats.complaintsResolved += 1;
        this.addEvent('info', `Customer updated about ${pkg.id}`, 'Useful, but the parcel still needs an operational fix.', pkg.id);
        return { ok: true, partial: true, message: 'Customer updated. The parcel is still held.' };
      }
      return { ok: false, message: 'That does not resolve the operational exception.' };
    }

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
      .filter(pkg => pkg.issue || pkg.complaint)
      .sort((a, b) => packageScore(b, this.focus, this.clock) - packageScore(a, this.focus, this.clock));
};


PostalSimulation.prototype.getMetrics = function() {
    const active = [...this.packages.values()].filter(p => p.status !== 'delivered');
    const late = active.filter(p => p.deadline < this.clock).length;
    const dueSoon = active.filter(p => p.deadline >= this.clock && p.deadline - this.clock < 25).length;
    const issues = active.filter(p => p.issue || p.complaint).length;
    const onTime = this.stats.delivered ? Math.round(100 * (this.stats.delivered - this.stats.lateDelivered) / this.stats.delivered) : 100;
    return { active: active.length, late, dueSoon, issues, onTime, delivered: this.stats.delivered };
};

globalThis.PostalSimulation = PostalSimulation;
globalThis.CITIES = CITIES;
globalThis.CITY_IDS = CITY_IDS;
globalThis.FOCUS_MODES = FOCUS_MODES;
globalThis.packageScore = packageScore;
globalThis.nextLegForPackage = nextLegForPackage;
globalThis.POSTAL_MODEL = { PostalSimulation, CITIES, CITY_IDS, FOCUS_MODES, packageScore, nextLegForPackage, cityForPlace, gatewayForCountry, isInternationalPlace, makePackageId };
