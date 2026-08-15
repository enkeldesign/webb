'use strict';
class PostalSimulation {
  constructor({ seed = 7 } = {}) {
    this.clock = 0;
    this.paused = false;
    this.speed = 1;
    this.focus = 'late';
    this.rngState = seed >>> 0;
    this.packages = new Map();
    this.cities = Object.fromEntries(CITY_IDS.map(id => [id, blankCityState(id)]));
    this.nationalTrucks = [
      createTruck('N-SUN-STO', 'national', 'sundsvall', 'stockholm', 12),
      createTruck('N-STO-SUN', 'national', 'stockholm', 'sundsvall', 12),
      createTruck('N-STO-GBG', 'national', 'stockholm', 'goteborg', 12),
      createTruck('N-GBG-STO', 'national', 'goteborg', 'stockholm', 12),
      createTruck('N-SUN-GBG', 'national', 'sundsvall', 'goteborg', 10),
      createTruck('N-GBG-SUN', 'national', 'goteborg', 'sundsvall', 10)
    ];
    this.internationalTransports = [
      Object.assign(createTruck('INT-GBG-DK', 'international', 'goteborg', 'Denmark', 14), { direction: 'outbound' }),
      Object.assign(createTruck('INT-STO-USA', 'international', 'stockholm', 'USA', 14), { direction: 'outbound' }),
      Object.assign(createTruck('INT-STO-FIN', 'international', 'stockholm', 'Finland', 14), { direction: 'outbound' }),
      Object.assign(createTruck('INT-GBG-DE', 'international', 'goteborg', 'Germany', 14), { direction: 'outbound' }),
      Object.assign(createTruck('INT-DK-GBG', 'international', 'Denmark', 'goteborg', 14), { direction: 'inbound' }),
      Object.assign(createTruck('INT-USA-STO', 'international', 'USA', 'stockholm', 14), { direction: 'inbound' }),
      Object.assign(createTruck('INT-FIN-STO', 'international', 'Finland', 'stockholm', 14), { direction: 'inbound' }),
      Object.assign(createTruck('INT-DE-GBG', 'international', 'Germany', 'goteborg', 14), { direction: 'inbound' })
    ];
    for (const t of this.internationalTransports) t.duration = 26;
    this.events = [];
    this.stats = { delivered: 0, lateDelivered: 0, complaintsResolved: 0, investigationsResolved: 0 };
    this.spawnAccumulator = 0;
    this.incidentAccumulator = 0;
    this._bootstrapDemo();
  }

  random() {
    this.rngState = (1664525 * this.rngState + 1013904223) >>> 0;
    return this.rngState / 4294967296;
  }

  addEvent(kind, title, detail, packageId = null) {
    this.events.unshift({ id: `${this.clock.toFixed(2)}-${this.events.length}-${this.random()}`, t: this.clock, kind, title, detail, packageId, unread: true });
    this.events = this.events.slice(0, 24);
  }

  addPackage(spec) {
    const pkg = {
      id: spec.id || makePackageId(spec.prefix || 'PKG'),
      origin: spec.origin,
      destination: spec.destination,
      service: spec.service || 'standard',
      createdAt: spec.createdAt ?? this.clock,
      deadline: spec.deadline ?? this.clock + (spec.service === 'express' ? 55 : 105),
      status: spec.status || 'arrived',
      cityId: spec.cityId || cityForPlace(spec.location) || cityForPlace(spec.origin.place) || null,
      location: spec.location || CITIES[spec.cityId || cityForPlace(spec.origin.place)]?.hub || spec.origin.place,
      issue: spec.issue || null,
      issueDetail: spec.issueDetail || '',
      complaint: Boolean(spec.complaint),
      priorityFlag: Boolean(spec.priorityFlag),
      international: spec.origin.country !== 'Sweden' || spec.destination.country !== 'Sweden',
      trace: spec.trace ? [...spec.trace] : [],
      carrier: spec.carrier || ['NordPost', 'DLH', 'DB Stänker'][Math.floor(this.random() * 3)],
      wait: 0,
      deliveredAt: null
    };
    if (!pkg.trace.length) trace(pkg, this.clock, 'Shipment created', pkg.origin.place);
    this.packages.set(pkg.id, pkg);
    this._enqueue(pkg);
    return pkg;
  }

  _enqueue(pkg) {
    for (const city of Object.values(this.cities)) {
      for (const queue of Object.values(city.queues)) {
        const i = queue.indexOf(pkg.id);
        if (i >= 0) queue.splice(i, 1);
      }
    }
    if (!pkg.cityId || pkg.status === 'delivered' || pkg.status.startsWith('transit')) return;
    const queues = this.cities[pkg.cityId].queues;
    if (pkg.status === 'held' || pkg.issue) queues.held.push(pkg.id);
    else if (pkg.status === 'ready-local') queues.readyLocal.push(pkg.id);
    else if (pkg.status === 'ready-national') queues.readyNational.push(pkg.id);
    else if (pkg.status === 'ready-international') queues.readyInternational.push(pkg.id);
    else queues.arrived.push(pkg.id);
  }

  _bootstrapDemo() {
    this.addPackage({
      id: 'SOR-48219',
      origin: { place: 'Söråker', country: 'Sweden' }, destination: { place: 'Aarhus', country: 'Denmark' },
      cityId: 'sundsvall', location: 'Sundsvall terminal', service: 'express', deadline: 72,
      trace: [
        { t: -18, label: 'Collected', place: 'Söråker' },
        { t: -9, label: 'Arrived at regional depot', place: 'Sundsvall terminal' }
      ]
    });
    this.addPackage({
      id: 'US-77104',
      origin: { place: 'Chicago', country: 'USA' }, destination: { place: 'Timrå', country: 'Sweden' },
      cityId: 'stockholm', location: 'Stockholm terminal · inbound cage 14', service: 'express', deadline: 28,
      status: 'held', issue: 'scan-gap', complaint: true,
      issueDetail: 'No scan after customs release. Customer in Timrå says the parcel has not moved since yesterday.',
      trace: [
        { t: -96, label: 'Accepted', place: 'Chicago' },
        { t: -70, label: 'Departed USA', place: 'Chicago air hub' },
        { t: -42, label: 'Customs cleared', place: 'Stockholm Arlanda' },
        { t: -36, label: 'Arrived at terminal', place: 'Stockholm terminal' },
        { t: -31, label: 'Last scan', place: 'Inbound cage 14' }
      ]
    });
    this.addPackage({
      id: 'GBG-23018',
      origin: { place: 'Mölndal', country: 'Sweden' }, destination: { place: 'Uppsala', country: 'Sweden' },
      cityId: 'goteborg', location: 'Göteborg terminal · local dock', service: 'standard', deadline: 52,
      status: 'held', issue: 'wrong-dock', issueDetail: 'Sorted to a local delivery dock even though Uppsala requires national handoff.',
      trace: [
        { t: -24, label: 'Collected', place: 'Mölndal' },
        { t: -15, label: 'Sorted', place: 'Göteborg terminal' },
        { t: -11, label: 'Exception scan', place: 'Local dock 3' }
      ]
    });
    this.addPackage({
      id: 'STO-88402',
      origin: { place: 'Nacka', country: 'Sweden' }, destination: { place: 'Härnösand', country: 'Sweden' },
      cityId: 'stockholm', location: 'Stockholm terminal', service: 'standard', deadline: 86
    });
    this.addPackage({
      id: 'SUN-31391',
      origin: { place: 'Ånge', country: 'Sweden' }, destination: { place: 'Sundsvall', country: 'Sweden' },
      cityId: 'sundsvall', location: 'Sundsvall terminal', service: 'standard', deadline: 61
    });
    this.addEvent('critical', 'Customer complaint: USA → Timrå', 'The parcel reached Stockholm, then vanished from the scan trail.', 'US-77104');
    this.addEvent('warning', 'Wrong dock in Göteborg', 'A parcel for Uppsala is sitting with local deliveries.', 'GBG-23018');
  }

  setFocus(mode) {
    if (!FOCUS_MODES.includes(mode)) return;
    this.focus = mode;
    this.addEvent('info', `Priority changed: ${mode}`, 'Workers now pull the highest-value matching parcels first.');
  }

  togglePause() { this.paused = !this.paused; }

  tick(realSeconds) {
    if (this.paused) return;
    const dt = Math.min(1.5, realSeconds * this.speed);
    this.clock += dt;
    this.spawnAccumulator += dt;
    this.incidentAccumulator += dt;

    for (const pkg of this.packages.values()) {
      if (pkg.status !== 'delivered') pkg.wait += dt;
    }

    this._tickWorkers(dt);
    this._tickRegionalTrucks(dt);
    this._tickNationalTrucks(dt);
    this._tickInternational(dt);

    if (this.spawnAccumulator > 7.5) {
      this.spawnAccumulator = 0;
      this._spawnRoutinePackage();
    }
    if (this.incidentAccumulator > 42) {
      this.incidentAccumulator = 0;
      this._maybeCreateIncident();
    }
  }
}
