'use strict';
PostalSimulation.prototype._tickWorkers = function(dt) {
    for (const city of Object.values(this.cities)) {
      for (const worker of city.workers) {
        if (!worker.packageId) {
          const candidates = city.queues.arrived
            .map(id => this.packages.get(id))
            .filter(pkg => pkg && !pkg.issue)
            .sort((a, b) => packageScore(b, this.focus, this.clock) - packageScore(a, this.focus, this.clock));
          const pkg = candidates[0];
          if (!pkg) {
            worker.task = 'Watching the inbound flow';
            worker.progress = 0;
            continue;
          }
          worker.packageId = pkg.id;
          worker.progress = 0;
          worker.total = pkg.service === 'express' ? 4.2 : 6.2;
          worker.task = `Sorting ${pkg.id}`;
          const i = city.queues.arrived.indexOf(pkg.id);
          if (i >= 0) city.queues.arrived.splice(i, 1);
          pkg.status = 'sorting';
          trace(pkg, this.clock, `${worker.name} started sort`, CITIES[city.cityId].hub);
        }
        worker.progress += dt;
        if (worker.progress >= worker.total) {
          const pkg = this.packages.get(worker.packageId);
          if (pkg) this._finishSort(pkg, city.cityId, worker);
          worker.packageId = null;
          worker.progress = 0;
          worker.task = 'Ready for next parcel';
          worker.handled += 1;
        }
      }
    }
};


PostalSimulation.prototype._finishSort = function(pkg, cityId, worker) {
    const leg = nextLegForPackage(pkg);
    pkg.cityId = cityId;
    if (leg.kind === 'regional') {
      pkg.status = 'ready-local';
      pkg.location = `${CITIES[cityId].hub} · local outbound`;
    } else if (leg.kind === 'national') {
      pkg.status = 'ready-national';
      pkg.location = `${CITIES[cityId].hub} · national handoff`;
    } else if (leg.kind === 'international') {
      pkg.status = 'ready-international';
      pkg.location = `${CITIES[cityId].hub} · international outbound`;
    } else {
      pkg.status = 'held';
      pkg.issue = 'routing';
      pkg.issueDetail = 'No automatic route could be calculated.';
      this.addEvent('warning', `Routing exception: ${pkg.id}`, 'Inspect the parcel and choose a route.', pkg.id);
    }
    trace(pkg, this.clock, `${worker.name} completed sort`, pkg.location);
    this.cities[cityId].processed += 1;
    this._enqueue(pkg);
};


PostalSimulation.prototype._tickRegionalTrucks = function(dt) {
    for (const city of Object.values(this.cities)) {
      for (const truck of city.regionalTrucks) {
        if (truck.state === 'waiting') {
          truck.wait += dt;
          const queue = city.queues.readyLocal
            .map(id => this.packages.get(id))
            .filter(pkg => pkg && pkg.destination.place === truck.to)
            .sort((a, b) => packageScore(b, this.focus, this.clock) - packageScore(a, this.focus, this.clock));
          const urgent = queue.some(pkg => packageScore(pkg, this.focus, this.clock) > 90);
          if (queue.length && (queue.length >= 2 || truck.wait > 8 || urgent)) {
            truck.load = queue.slice(0, truck.capacity).map(p => p.id);
            for (const id of truck.load) {
              const pkg = this.packages.get(id);
              pkg.status = 'transit-local';
              pkg.location = `Truck to ${truck.to}`;
              this._enqueue(pkg);
              trace(pkg, this.clock, 'Loaded on regional truck', CITIES[city.cityId].hub);
            }
            truck.state = 'driving'; truck.progress = 0; truck.wait = 0; truck.departures += 1;
          }
        } else {
          truck.progress += dt / truck.duration;
          if (truck.progress >= 1) {
            for (const id of truck.load) {
              const pkg = this.packages.get(id);
              if (!pkg) continue;
              pkg.status = 'delivered'; pkg.location = pkg.destination.place; pkg.deliveredAt = this.clock;
              trace(pkg, this.clock, 'Delivered', pkg.destination.place);
              this.stats.delivered += 1;
              if (pkg.deliveredAt > pkg.deadline) this.stats.lateDelivered += 1;
              city.delivered += 1;
            }
            truck.load = []; truck.state = 'waiting'; truck.progress = 0;
          }
        }
      }
    }
};


PostalSimulation.prototype._tickNationalTrucks = function(dt) {
    for (const truck of this.nationalTrucks) {
      const city = this.cities[truck.from];
      if (truck.state === 'waiting') {
        truck.wait += dt;
        const candidates = city.queues.readyNational
          .map(id => this.packages.get(id))
          .filter(pkg => pkg && nextLegForPackage(pkg).to === truck.to)
          .sort((a, b) => packageScore(b, this.focus, this.clock) - packageScore(a, this.focus, this.clock));
        const urgent = candidates.some(pkg => packageScore(pkg, this.focus, this.clock) > 95);
        if (candidates.length && (candidates.length >= 3 || truck.wait > 10 || urgent)) {
          truck.load = candidates.slice(0, truck.capacity).map(p => p.id);
          for (const id of truck.load) {
            const pkg = this.packages.get(id);
            pkg.status = 'transit-national'; pkg.location = `${CITIES[truck.from].name} → ${CITIES[truck.to].name}`;
            this._enqueue(pkg); trace(pkg, this.clock, 'National linehaul departed', CITIES[truck.from].hub);
          }
          truck.state = 'driving'; truck.progress = 0; truck.wait = 0; truck.departures += 1;
        }
      } else {
        truck.progress += dt / truck.duration;
        if (truck.progress >= 1) {
          for (const id of truck.load) {
            const pkg = this.packages.get(id);
            if (!pkg) continue;
            pkg.cityId = truck.to;
            pkg.status = 'arrived';
            pkg.location = CITIES[truck.to].hub;
            trace(pkg, this.clock, 'National linehaul arrived', pkg.location);
            this._enqueue(pkg);
          }
          truck.load = []; truck.state = 'waiting'; truck.progress = 0;
        }
      }
    }
};


PostalSimulation.prototype._tickInternational = function(dt) {
    for (const truck of this.internationalTransports) {
      const inbound = truck.direction === 'inbound';
      const gatewayCity = inbound ? truck.to : truck.from;
      const city = this.cities[gatewayCity];
      if (truck.state === 'waiting') {
        truck.wait += dt;
        const candidates = inbound
          ? [...this.packages.values()]
              .filter(pkg => pkg.status === 'ready-inbound' && pkg.origin.country === truck.from && gatewayForCountry(pkg.origin.country) === truck.to)
              .sort((a, b) => packageScore(b, this.focus, this.clock) - packageScore(a, this.focus, this.clock))
          : city.queues.readyInternational
              .map(id => this.packages.get(id))
              .filter(pkg => pkg && pkg.destination.country === truck.to)
              .sort((a, b) => packageScore(b, this.focus, this.clock) - packageScore(a, this.focus, this.clock));
        const urgent = candidates.some(pkg => packageScore(pkg, this.focus, this.clock) > 95);
        if (candidates.length && (truck.wait > 9 || urgent)) {
          truck.load = candidates.slice(0, truck.capacity).map(p => p.id);
          for (const id of truck.load) {
            const pkg = this.packages.get(id);
            pkg.status = 'transit-international';
            pkg.location = inbound ? `${truck.from} → ${CITIES[truck.to].name}` : `${CITIES[truck.from].name} → ${truck.to}`;
            this._enqueue(pkg);
            trace(pkg, this.clock, inbound ? 'Inbound transport departed' : 'International departure', inbound ? truck.from : CITIES[truck.from].hub);
          }
          truck.state = 'driving'; truck.progress = 0; truck.wait = 0; truck.departures += 1;
        }
      } else {
        truck.progress += dt / truck.duration;
        if (truck.progress >= 1) {
          for (const id of truck.load) {
            const pkg = this.packages.get(id);
            if (!pkg) continue;
            if (inbound) {
              pkg.cityId = truck.to;
              pkg.status = 'arrived';
              pkg.location = CITIES[truck.to].hub;
              trace(pkg, this.clock, 'Arrived in Sweden', pkg.location);
              this._enqueue(pkg);
            } else {
              pkg.status = 'delivered'; pkg.location = `${pkg.destination.place}, ${pkg.destination.country}`; pkg.deliveredAt = this.clock;
              trace(pkg, this.clock, 'Handed to destination network', pkg.location);
              this.stats.delivered += 1;
              if (pkg.deliveredAt > pkg.deadline) this.stats.lateDelivered += 1;
            }
          }
          truck.load = []; truck.state = 'waiting'; truck.progress = 0;
        }
      }
    }
};
