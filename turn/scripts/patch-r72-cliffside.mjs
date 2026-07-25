import fs from 'node:fs/promises';

const edits = [
  {
    path: 'turn/vehicle/physics.js',
    replacements: [[
      "    collisionProfile: currentCollisionProfile()\n  });",
      "    collisionProfile: currentCollisionProfile(),\n    dt\n  });"
    ]]
  },
  {
    path: 'turn-lab/tests/multi-track-production.mjs',
    replacements: [
      ["{ id: 'cliffside', difficulty: 'MEDIUM', storageRevision: 'cliffside-r68', freeRoamDistance: 15.7 }", "{ id: 'cliffside', difficulty: 'MEDIUM', storageRevision: 'cliffside-r68', freeRoamDistance: 22.2 }"],
      ["assert.equal(getTrackFreeRoamDistance('cliffside'), 15.7);", "assert.equal(getTrackFreeRoamDistance('cliffside'), 22.2);"],
      ["assert.match(trackDefinitions, /freeRoamDistance: 15\\.7/, 'Cliffside must own its curb-aligned containment envelope');", "assert.match(trackDefinitions, /freeRoamDistance: 22\\.2/, 'Cliffside must own its expanded shoulder-safe containment envelope');"]
    ]
  },
  {
    path: 'turn/tracks/cliffside-world.js',
    replacements: [
      ["const CURB_HEIGHT = 0.17;", "const CURB_HEIGHT = 0.17;\nconst SHOULDER_WIDTH = 4.45;"],
      ["world.name = 'TURN Cliffside r69';", "world.name = 'TURN Cliffside r72';"],
      ["  makeRoad(world, samples, trackWidth);\n  makeGuardrail", "  makeRoad(world, samples, trackWidth);\n  makeShoulders(world, samples, trackWidth);\n  makeGuardrail"],
      ["  makeStartDistrict(world, samples, trackWidth);", "  makeStartArch(world, samples, trackWidth);"],
      ["version: 'r69'", "version: 'r72'"],
      ["{ offset: -(half + 2.8), y: sample.point.y - 0.34 },\n      { offset: half + 3.2, y: sample.point.y - 0.38 },", "{ offset: -(half + 6.3), y: sample.point.y - 0.34 },\n      { offset: half + 6.3, y: sample.point.y - 0.38 },"],
      ["addScaledVector(sample.normal, -(trackWidth / 2 + 2.2))", "addScaledVector(sample.normal, -(trackWidth / 2 + 8.7))"],
      [
        "}\n\nfunction makeCentreLine(world, samples) {",
        `}\n\nfunction makeShoulders(world, samples, trackWidth) {\n  const curbOuter = trackWidth / 2 + 1.65;\n  const shoulderOuter = curbOuter + SHOULDER_WIDTH;\n\n  for (const side of [-1, 1]) {\n    const positions = [];\n    const colors = [];\n    const innerColor = new THREE.Color(side < 0 ? 0xd9c99d : 0xc6b77d);\n    const outerColor = new THREE.Color(side < 0 ? 0xb79f75 : 0xa8a36a);\n\n    for (let index = 0; index < samples.length; index += 1) {\n      const current = samples[index];\n      const next = samples[(index + 1) % samples.length];\n      const a = elevatedOffset(current, side * curbOuter, ROAD_HEIGHT + 0.015);\n      const b = elevatedOffset(current, side * shoulderOuter, ROAD_HEIGHT - 0.015);\n      const c = elevatedOffset(next, side * curbOuter, ROAD_HEIGHT + 0.015);\n      const d = elevatedOffset(next, side * shoulderOuter, ROAD_HEIGHT - 0.015);\n      positions.push(\n        a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z,\n        b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z\n      );\n      for (const color of [innerColor, outerColor, innerColor, outerColor, outerColor, innerColor]) {\n        colors.push(color.r, color.g, color.b);\n      }\n    }\n\n    const geometry = new THREE.BufferGeometry();\n    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));\n    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));\n    geometry.computeVertexNormals();\n    const shoulder = new THREE.Mesh(\n      geometry,\n      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide })\n    );\n    shoulder.receiveShadow = true;\n    world.add(shoulder);\n  }\n}\n\nfunction makeCentreLine(world, samples) {`
      ],
      [
        `function makeStartDistrict(world, samples, trackWidth) {\n  const start = samples[0];\n  const yaw = Math.atan2(start.tangent.x, start.tangent.z);\n  const inner = start.point.clone().addScaledVector(start.normal, trackWidth / 2 + 10);\n  const group = new THREE.Group();\n  group.name = 'Cliffside Summit Start';\n\n  const deck = outlinedBox(34, 1.2, 22, material(0xd8bb89, 0.96));\n  deck.position.copy(inner);\n  const summitDeckY = start.point.y + 3.2;\n  deck.position.y = summitDeckY;\n  deck.rotation.y = yaw;\n  group.add(deck);\n\n  const cafe = outlinedBox(20, 8, 12, material(0xf7d9a6, 0.92));\n  cafe.position.copy(inner).addScaledVector(start.normal, 2);\n  cafe.position.y = summitDeckY + 4.6;\n  cafe.rotation.y = yaw;\n  group.add(cafe);\n\n  const roof = outlinedBox(23, 1.2, 15, material(0xff6b6b, 0.88));\n  roof.position.copy(cafe.position);\n  roof.position.y += 4.8;\n  roof.rotation.y = yaw;\n  group.add(roof);\n\n  const arch = new THREE.Group();`,
        `function makeStartArch(world, samples, trackWidth) {\n  const start = samples[0];\n  const yaw = Math.atan2(start.tangent.x, start.tangent.z);\n  const arch = new THREE.Group();\n  arch.name = 'Cliffside Start Arch';`
      ],
      ["  group.add(arch);\n\n  world.add(group);", "  world.add(arch);"]
    ]
  }
];

for (const edit of edits) {
  let source = await fs.readFile(edit.path, 'utf8');
  for (const [from, to] of edit.replacements) {
    const count = source.split(from).length - 1;
    if (count !== 1) throw new Error(`${edit.path}: expected one match, found ${count}: ${from.slice(0, 80)}`);
    source = source.replace(from, to);
  }
  await fs.writeFile(edit.path, source);
}
