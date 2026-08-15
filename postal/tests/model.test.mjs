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
const { PostalSimulation, packageScore, nextLegForPackage } = context.POSTAL_MODEL;

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
  sim.paused = false;
  for (let i = 0; i < 4; i++) sim.tick(1);
  assert.ok(sim.packages.size >= openingTotal + 2, 'Incoming packages should arrive in visible waves');
}

{
  const sim = new PostalSimulation({ seed: 1 });
  sim.paused = false;
  const pkg = sim.packages.get('SOR-48219');
  assert.equal(nextLegForPackage(pkg).kind, 'national');
  for (let i = 0; i < 900 && pkg.status !== 'delivered'; i++) sim.tick(.5);
  assert.equal(pkg.status, 'delivered');
  assert.match(pkg.location, /Aarhus/);
  assert.ok(pkg.trace.some(step => step.label === 'National linehaul departed'));
  assert.ok(pkg.trace.some(step => step.label === 'International departure'));
}

{
  const sim = new PostalSimulation({ seed: 2 });
  sim.paused = false;
  const pkg = sim.packages.get('US-77104');
  const result = sim.resolveIssue(pkg.id, 'scan-cage');
  assert.equal(result.ok, true);
  for (let i = 0; i < 900 && pkg.status !== 'delivered'; i++) sim.tick(.5);
  assert.equal(pkg.status, 'delivered');
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
  sim.focus='complaints';
  assert.ok(packageScore(complaint, sim.focus, sim.clock) > packageScore(ordinary, sim.focus, sim.clock));
  sim.paused=false; sim.tick(.1);
  assert.ok(city.workers.some(w => w.packageId === complaint.id));
}

{
  const sim = new PostalSimulation({ seed: 4 });
  sim.paused = false;
  for (let i=0;i<600;i++) sim.tick(.5);
  const queued=[];
  for (const city of Object.values(sim.cities)) for (const queue of Object.values(city.queues)) queued.push(...queue);
  assert.equal(new Set(queued).size, queued.length);
  for (const id of queued) assert.ok(sim.packages.has(id));
}

console.log('POSTAL model tests passed');
