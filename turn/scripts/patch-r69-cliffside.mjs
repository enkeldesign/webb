import fs from 'node:fs/promises';

const patches = new Map([
  ['turn/tracks/cliffside-world.js', [
    ["world.name = 'TURN Cliffside r68';", "world.name = 'TURN Cliffside r69';"],
    ["version: 'r68',", "version: 'r69',"],
    [
      "const inner = start.point.clone().addScaledVector(start.normal, trackWidth / 2 + 25);",
      "const inner = start.point.clone().addScaledVector(start.normal, trackWidth / 2 + 10);"
    ],
    [
      "deck.position.y = start.point.y - 0.1;",
      "const summitDeckY = start.point.y + 3.2;\n  deck.position.y = summitDeckY;"
    ],
    [
      "cafe.position.y = start.point.y + 4.5;",
      "cafe.position.y = summitDeckY + 4.6;"
    ]
  ]],
  ['turn-tests/cliffside-production.mjs', [
    ["{ id: 'cliffside', difficulty: 'HARD' }", "{ id: 'cliffside', difficulty: 'MEDIUM' }"],
    ["/id: 'cliffside'[\\s\\S]*difficulty: 'HARD'/", "/id: 'cliffside'[\\s\\S]*difficulty: 'MEDIUM'/"]
  ]],
  ['turn-lab/tests/multi-track-production.mjs', [
    ["{ id: 'cliffside', difficulty: 'HARD', storageRevision: 'cliffside-r68', freeRoamDistance: 78 }", "{ id: 'cliffside', difficulty: 'MEDIUM', storageRevision: 'cliffside-r68', freeRoamDistance: 15.7 }"],
    ["assert.equal(getTrackFreeRoamDistance('cliffside'), 78);", "assert.equal(getTrackFreeRoamDistance('cliffside'), 15.7);"]
  ]]
]);

for (const [path, replacements] of patches) {
  let source = await fs.readFile(path, 'utf8');
  for (const [from, to] of replacements) {
    const matches = source.split(from).length - 1;
    if (matches !== 1) throw new Error(`${path}: expected one match for ${JSON.stringify(from)}, found ${matches}`);
    source = source.replace(from, to);
  }
  await fs.writeFile(path, source);
}
