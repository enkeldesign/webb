import fs from 'node:fs/promises';

const path = 'turn/tracks/cliffside-world.js';
let source = await fs.readFile(path, 'utf8');

const replacements = [
  [
    "      { offset: -(half + 24), y: Math.max(SEA_LEVEL + 0.8, sample.point.y - 9.5) },",
    "      { offset: -(half + 18), y: Math.max(SEA_LEVEL + 0.8, sample.point.y - 9.5) },"
  ],
  [
    "      { offset: half + 34, y: sample.point.y + ridgeLift }",
    "      { offset: half + 20, y: sample.point.y + ridgeLift }"
  ],
  [
    "    const currentTop = current.point.clone().addScaledVector(current.normal, -(half + 23.5));\n    const nextTop = next.point.clone().addScaledVector(next.normal, -(half + 23.5));",
    "    const currentTop = current.point.clone().addScaledVector(current.normal, -(half + 17.5));\n    const nextTop = next.point.clone().addScaledVector(next.normal, -(half + 17.5));"
  ],
  [
    "    post.position.y = start.point.y + 5;\n    arch.add(post);",
    "    post.position.y = start.point.y + 5;\n    post.rotation.y = yaw;\n    arch.add(post);"
  ],
  [
    "  banner.position.y = start.point.y + 10;\n  arch.add(banner);\n  arch.rotation.y = yaw;",
    "  banner.position.y = start.point.y + 10;\n  banner.rotation.y = yaw;\n  arch.add(banner);"
  ]
];

for (const [before, after] of replacements) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one exact match, found ${count}`);
  source = source.replace(before, after);
}

await fs.writeFile(path, source);
console.log('TURN r68 Cliffside world patch applied.');
