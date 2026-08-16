import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const context = vm.createContext({ console });
context.globalThis = context;
for (const name of ['model-data.js','model-core.js','model-flow.js','model-ops.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'runtime', name), 'utf8'), context, { filename: name });
}
const { PostalSimulation, CARRIERS, packageScore, nextLegForPackage } = context.POSTAL_MODEL;

function tickUntil(sim, predicate, maxTicks = 300, dt = .5) {
  for (let i = 0; i < maxTicks && !predicate(); i += 1) sim.tick(dt);
  assert.ok(predicate(), `Condition was not reached after ${maxTicks * dt} simulated seconds`);
}

function runManaged(sim, pkg, maxTicks = 1200) {
  for (let i = 0; i < maxTicks && pkg.status !== 'delivered'; i += 1) {
    if (pkg.status === 'ready-local' || pkg.status === 'ready-national') {
      const planned = sim.planPackageOnTruck(pkg.id);
      if (planned.ok) sim.dispatchTruck(planned.truck.id);
    }
    sim.tick(.5);
  }
  assert.equal(pkg.status, 'delivered', `${pkg.id} should complete with managed dispatches`);
}

{
  const crew = Object.values(context.CITIES).flatMap(city => city.crew);
  assert.equal(crew.length, 9);
  assert.equal(new Set(crew.map(worker => worker.name)).size, 9, 'Depot crew names must be unique');
  assert.equal(new Set(crew.map(worker => worker.assetKey)).size, 9, 'Depot crew models must be unique');
  const sim = new PostalSimulation({ seed: 9 });
  for (const cityId of context.CITY_IDS) {
    assert.ok(sim.getIncomingPackages(cityId).length >= 4, `${cityId} should open with a visible intake queue`);
  }
  const openingTotal = sim.packages.size;
  tickUntil(sim, () => sim.packages.size >= openingTotal + 2, 20);
}

{
  assert.deepEqual(Object.values(CARRIERS).map(carrier => carrier.name), ['NORDPOST', 'DLH', 'BRUNG', 'STÄNKER']);
  assert.equal(new Set(Object.values(CARRIERS).map(carrier => carrier.rhythm)).size, 4);
  assert.equal(CARRIERS.dlh.service, 'express');
  assert.ok(CARRIERS.stanker.deadline > CARRIERS.brung.deadline);
}

{
  const sim = new PostalSimulation({ seed: 10 });
  const locationlessHold = sim.addPackage({
    id: 'IN-HOLD', origin: { place: 'Hamburg', country: 'Germany' },
    destination: { place: 'Timrå', country: 'Sweden' }, cityId: null,
    location: 'Hamburg partner hub', status: 'held', issue: 'missed-scan'
  });
  assert.equal(locationlessHold.cityId, null);
  const incoming = sim.getIncomingPackages();
  assert.ok(!incoming.some(pkg => pkg.id === locationlessHold.id), 'Locationless inbound holds must not appear in depot intake totals');
  assert.equal(sim.getMetrics().incoming, incoming.length, 'The HUD total must match the packages rendered in depot intake queues');
}

{
  const sim = new PostalSimulation({ seed: 1 });
  sim.spawnEnabled = false;
  const pkg = sim.packages.get('SOR-48219');
  assert.equal(nextLegForPackage(pkg).kind, 'national');
  runManaged(sim, pkg);
  assert.match(pkg.location, /Aarhus/);
  assert.ok(pkg.trace.some(step => step.label === 'National linehaul departed'));
  assert.ok(pkg.trace.some(step => step.label === 'International departure'));
}

{
  const sim = new PostalSimulation({ seed: 2 });
  sim.spawnEnabled = false;
  const pkg = sim.packages.get('US-77104');
  assert.equal(sim.resolveIssue(pkg.id, 'scan-cage').ok, true);
  runManaged(sim, pkg);
  assert.equal(pkg.location, 'Timrå');
  assert.ok(pkg.trace.some(step => step.label === 'Manual cage scan found parcel'));
}

{
  const sim = new PostalSimulation({ seed: 3 });
  const city = sim.cities.stockholm;
  for (const worker of city.workers) { worker.packageId = null; worker.progress = 0; }
  const complaint = sim.packages.get('US-77104');
  complaint.issue = null; complaint.status = 'arrived'; sim._enqueue(complaint);
  const ordinary = sim.addPackage({ id:'TEST-ORD', origin:{place:'Solna',country:'Sweden'}, destination:{place:'Nacka',country:'Sweden'}, cityId:'stockholm', location:'Stockholm terminal', deadline: 500 });
  assert.equal(sim.setFocus('stockholm', 'complaints'), true);
  assert.equal(sim.getFocus('stockholm'), 'complaints');
  assert.equal(sim.getFocus('sundsvall'), 'late', 'Depot focus must be isolated by city');
  assert.ok(packageScore(complaint, sim.getFocus('stockholm'), sim.clock) > packageScore(ordinary, sim.getFocus('stockholm'), sim.clock));
  sim.tick(.1);
  assert.ok(city.workers.some(worker => worker.packageId === complaint.id));
}

{
  const sim = new PostalSimulation({ seed: 12, firstDay: true });
  const pkg = sim.packages.get('DAY1-1001');
  assert.equal(sim.packages.size, 1, 'The first morning should begin with one readable decision');
  assert.equal(pkg.tutorialLock, true);
  assert.equal(sim.startFirstDaySort(), true);
  assert.equal(sim.cities.sundsvall.workers.find(worker => worker.name === 'Leo').packageId, pkg.id, 'Leo should visibly perform the Express tutorial sort');
  tickUntil(sim, () => pkg.status === 'ready-local', 30);
  for (let i = 0; i < 40; i += 1) sim.tick(.5);
  assert.equal(pkg.status, 'ready-local', 'Regional trucks must never auto-depart');
  assert.equal(sim.cities.sundsvall.regionalTrucks.find(truck => truck.to === 'Timrå').departures, 0);
  const planned = sim.planPackageOnTruck(pkg.id);
  assert.equal(planned.ok, true);
  const sent = sim.dispatchTruck(planned.truck.id);
  assert.equal(sent.grade, 'EXPRESS RUN');
  assert.ok(sent.points > 0);
  tickUntil(sim, () => pkg.status === 'delivered', 40);
  assert.equal(sim.releaseFirstDayWave(), true);
  assert.equal(new Set([...sim.packages.values()].filter(item => item.status !== 'delivered').map(item => item.carrier)).size, 4);
  sim.setFocus('sundsvall', 'express');
  assert.equal(sim.releaseChicagoCase(), true);
  const chicago = sim.packages.get('US-77104');
  assert.equal(sim.resolveIssue(chicago.id, 'scan-cage').ok, true);
  runManaged(sim, chicago);
  const checkpoints = Array.from(chicago.trace).filter(step => /linehaul arrived|Delivered/.test(step.label)).map(step => step.place);
  assert.deepEqual(checkpoints, ['Sundsvall terminal', 'Timrå']);
  assert.equal(sim.completeFirstDay(), true);
  assert.equal(sim.spawnEnabled, true);
  assert.ok(sim.getMetrics().score > 0);
}

{
  const sim = new PostalSimulation({ seed: 4 });
  for (let i = 0; i < 600; i += 1) sim.tick(.5);
  const queued = [];
  for (const city of Object.values(sim.cities)) for (const queue of Object.values(city.queues)) queued.push(...queue);
  assert.equal(new Set(queued).size, queued.length);
  for (const id of queued) assert.ok(sim.packages.has(id));
}

console.log('POSTAL model tests passed');
