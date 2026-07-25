import fs from 'node:fs/promises';

const path = 'turn-lab/tests/multi-track-production.mjs';
let source = await fs.readFile(path, 'utf8');

const replacements = [
  [
    `  [\n    { id: 'countryside', difficulty: 'EASY', storageRevision: 'countryside', freeRoamDistance: 170 },\n    { id: 'airport', difficulty: 'MEDIUM', storageRevision: 'airport-r50', freeRoamDistance: 95 }\n  ],`,
    `  [\n    { id: 'countryside', difficulty: 'EASY', storageRevision: 'countryside', freeRoamDistance: 170 },\n    { id: 'airport', difficulty: 'MEDIUM', storageRevision: 'airport-r50', freeRoamDistance: 95 },\n    { id: 'cliffside', difficulty: 'HARD', storageRevision: 'cliffside-r68', freeRoamDistance: 78 }\n  ],`
  ],
  [
    `assert.equal(getTrackStorageRevision('airport'), 'airport-r50');\nassert.equal(getTrackStorageRevision('future-track'), 'future-track', 'Unregistered future storage must not collapse into another track namespace');\nassert.equal(getTrackFreeRoamDistance('airport'), 95);`,
    `assert.equal(getTrackStorageRevision('airport'), 'airport-r50');\nassert.equal(getTrackStorageRevision('cliffside'), 'cliffside-r68');\nassert.equal(getTrackStorageRevision('future-track'), 'future-track', 'Unregistered future storage must not collapse into another track namespace');\nassert.equal(getTrackFreeRoamDistance('airport'), 95);\nassert.equal(getTrackFreeRoamDistance('cliffside'), 78);`
  ],
  [
    `assert.match(trackDefinitions, /storageRevision: 'airport-r50'/, 'Airport must explicitly own its geometry revision');\nassert.match(trackDefinitions, /freeRoamDistance: 170/, 'Countryside must own its world envelope');\nassert.match(trackDefinitions, /freeRoamDistance: 95/, 'Airport must own its world envelope');`,
    `assert.match(trackDefinitions, /storageRevision: 'airport-r50'/, 'Airport must explicitly own its geometry revision');\nassert.match(trackDefinitions, /storageRevision: 'cliffside-r68'/, 'Cliffside must explicitly own its geometry revision');\nassert.match(trackDefinitions, /freeRoamDistance: 170/, 'Countryside must own its world envelope');\nassert.match(trackDefinitions, /freeRoamDistance: 95/, 'Airport must own its world envelope');\nassert.match(trackDefinitions, /freeRoamDistance: 78/, 'Cliffside must own its world envelope');`
  ],
  [
    `assert.doesNotMatch(trackManager, /nextTrackId === 'airport'|airportTrack|airportWorld|countrysideSamples/, 'The manager must contain no two-track special cases');`,
    `assert.doesNotMatch(trackManager, /nextTrackId === '(?:airport|cliffside)'|airportTrack|airportWorld|cliffsideTrack|cliffsideWorld|countrysideSamples/, 'The manager must contain no track-specific activation cases');`
  ]
];

for (const [before, after] of replacements) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one exact match, found ${count}`);
  source = source.replace(before, after);
}

await fs.writeFile(path, source);
console.log('TURN r68 multi-track test patch applied.');
