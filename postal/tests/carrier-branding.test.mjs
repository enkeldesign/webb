import test from 'node:test';
import assert from 'node:assert/strict';
import '../carrier-branding.mjs';
import { ShiftSimulation } from '../sim.mjs';

test('live snapshots expose the intended fictional carrier names and colours', () => {
  const sim = new ShiftSimulation(() => {}, 'friday-surge');
  const jobs = sim.snapshot().jobs;
  const byCarrier = new Map(jobs.map((job) => [job.carrierId, job]));

  assert.equal(byCarrier.get('nordpost').carrierName, 'NordPost');
  assert.equal(byCarrier.get('nordpost').carrierTone, 'blue');

  assert.equal(byCarrier.get('dlh').carrierName, 'DLH');
  assert.equal(byCarrier.get('dlh').carrierCode, 'DLH');
  assert.equal(byCarrier.get('dlh').carrierTone, 'yellow');

  assert.equal(byCarrier.get('brang').carrierName, 'Brang');
  assert.equal(byCarrier.get('brang').carrierTone, 'green');

  assert.equal(byCarrier.get('usp').carrierName, 'DB Stänker');
  assert.equal(byCarrier.get('usp').carrierCode, 'DBS');
  assert.equal(byCarrier.get('usp').carrierTone, 'red');
});

test('branding is reapplied after a shift reset', () => {
  const sim = new ShiftSimulation(() => {}, 'friday-surge');
  sim.snapshot();
  sim.reset();
  const dbs = sim.snapshot().jobs.find((job) => job.carrierId === 'usp');
  assert.equal(dbs.carrierName, 'DB Stänker');
  assert.equal(dbs.carrierCode, 'DBS');
  assert.equal(dbs.carrierTone, 'red');
});
