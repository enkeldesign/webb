import fs from 'node:fs';
import assert from 'node:assert/strict';

const viewport = fs.readFileSync('yourturn/viewport-transition-r414.js', 'utf8');
const mapRuntime = fs.readFileSync('yourturn/track-map-r411.js', 'utf8');

assert.match(
  mapRuntime,
  /import '\/yourturn\/viewport-transition-r414\.js\?revision=r414';/,
  'YOUR TURN must install the viewport boundary from an already-loaded challenge module'
);

assert.match(
  viewport,
  /const visual = windowRef\?\.visualViewport;[\s\S]*if \(visualWidth && visualHeight\)/,
  'the reachable viewport must prefer VisualViewport when both axes are available'
);
assert.match(viewport, /source: 'visualViewport'/);
assert.match(viewport, /source: 'innerViewport'/);
assert.match(viewport, /source: 'clientViewport'/);

assert.match(
  viewport,
  /renderer\.setSize = \(requestedWidth, requestedHeight, updateStyle\) => \{[\s\S]*nativeSetSize\(size\.width, size\.height, updateStyle\)/,
  'canonical renderer resizes must be clamped to the reachable YOUR TURN viewport'
);
assert.match(
  viewport,
  /runtime\.camera\.aspect = size\.width \/ size\.height;[\s\S]*runtime\.camera\.updateProjectionMatrix/,
  'camera aspect must be repaired together with renderer size'
);
assert.match(viewport, /--app-width/);
assert.match(viewport, /--app-height/);

for (const delay of ['0', '120', '350', '900', '1500']) {
  assert.match(viewport, new RegExp(`\\b${delay}\\b`), `post-rotation viewport resampling must retain the ${delay}ms checkpoint`);
}
assert.match(viewport, /orientationchange/);
assert.match(viewport, /visual-resize/);
assert.match(viewport, /pageshow/);

assert.doesNotMatch(
  viewport,
  /screen\.(?:width|height|availWidth|availHeight)/,
  'YOUR TURN must not size from the physical screen instead of the reachable browser viewport'
);

console.log('YOUR TURN portrait-to-landscape viewport regression passed.');
