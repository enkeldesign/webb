import fs from 'node:fs';

function replaceOnce(path, from, to) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one occurrence of ${JSON.stringify(from)}, found ${count}`);
  fs.writeFileSync(path, source.replace(from, to));
}

function replaceAllRequired(path, from, to, minimum = 1) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(from).length - 1;
  if (count < minimum) throw new Error(`${path}: expected at least ${minimum} occurrences of ${JSON.stringify(from)}, found ${count}`);
  fs.writeFileSync(path, source.split(from).join(to));
}

replaceOnce(
  'turn/ui/gameplay-controls.js',
  `    const previousZone = driveZone;\n    driveZone = nextZone;`,
  `    const previousZone = driveZone;\n    if (previousZone === 'boost' && nextZone !== 'boost') boostExhausted = false;\n    driveZone = nextZone;`
);

replaceOnce(
  'turn/drive-pad.css',
  `.drive-pad .drive-gas-zone {\n  position: relative;\n  overflow: hidden;`,
  `.drive-pad .drive-gas-zone {\n  position: relative;\n  overflow: hidden;\n  display: grid;\n  place-items: center;\n  text-align: center;`
);
replaceOnce('turn/drive-pad.css', '  content: "LIFT";', '  content: "LEAVE";');

replaceAllRequired('turn/index.html', 'v1.2.0', 'v1.2.1', 3);
replaceAllRequired('turn/index.html', '2026.07.19-r13', '2026.07.20-r14', 3);
replaceAllRequired('turn/index.html', '20260719-r13', '20260720-r14', 10);
replaceAllRequired('turn/index.html', 'TURN r13 Unified drive pad', 'TURN r14 Drive pad rearm');

replaceAllRequired('turn-lab/tests/manual-steering-production.mjs', '20260719-r13', '20260720-r14');
replaceAllRequired('turn-lab/tests/garage-production.mjs', 'TURN v1\\.2\\.0 · Build 2026\\.07\\.19-r13', 'TURN v1\\.2\\.1 · Build 2026\\.07\\.20-r14');
replaceAllRequired('turn-lab/tests/garage-production.mjs', 'build=20260719-r13', 'build=20260720-r14');
replaceAllRequired('turn-lab/tests/drive-pad-production.mjs', 'TURN v1\\.2\\.0 · Build 2026\\.07\\.19-r13', 'TURN v1\\.2\\.1 · Build 2026\\.07\\.20-r14');
replaceAllRequired('turn-lab/tests/drive-pad-production.mjs', 'build=20260719-r13', 'build=20260720-r14');

replaceOnce(
  'turn-lab/tests/drive-pad-production.mjs',
  `assert.match(controls, /boostRequested && !boostExhausted/, 'Boost must stay locked after exhaustion');\nassert.doesNotMatch(controls, /if \\(!inBoostZone\\) boostExhausted = false/, 'Sliding away from exhausted Boost must not re-arm it without lifting');`,
  `assert.match(controls, /boostRequested && !boostExhausted/, 'Boost must stay locked while the thumb remains in Boost after exhaustion');\nassert.match(controls, /previousZone === 'boost' && nextZone !== 'boost'\\) boostExhausted = false/, 'Leaving Boost for Gas or Drift must re-arm Boost without requiring pointer release');`
);

replaceOnce(
  'turn-lab/tests/drive-pad-production.mjs',
  `assert.match(css, /\\.drive-pad \\{/);\nassert.match(css, /\\.brake-reverse \\{/);`,
  `assert.match(css, /\\.drive-pad \\{/);\nassert.match(css, /place-items: center/, 'Gas label must be vertically and horizontally centered');\nassert.match(css, /content: "LEAVE"/, 'Boost lock hint must explain that leaving the Boost zone re-arms it');\nassert.match(css, /\\.brake-reverse \\{/);`
);

console.log('TURN r14 drive pad rearm patch applied.');
