import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, releaseSource, main, styles] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/styles.css', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const blockStart = main.indexOf('function isStandaloneDisplayMode()');
const blockEnd = main.indexOf('\nconst initialViewport = getViewportSize();');
assert.ok(blockStart >= 0 && blockEnd > blockStart, 'Production must expose one standalone-aware viewport measurement boundary');
const viewportBlock = main.slice(blockStart, blockEnd);

assert.match(viewportBlock, /window\.visualViewport/, 'TURN must still observe the live visual viewport');
assert.match(viewportBlock, /window\.innerWidth/, 'Width must include the layout viewport');
assert.match(viewportBlock, /window\.innerHeight/, 'Height must include the layout viewport');
assert.match(viewportBlock, /root\.clientWidth/, 'Width must include the document viewport as an iOS rotation fallback');
assert.match(viewportBlock, /root\.clientHeight/, 'Height must include the document viewport as an iOS rotation fallback');
assert.match(viewportBlock, /screen\.width/, 'Installed TURN must be able to recover the complete physical screen width');
assert.match(viewportBlock, /screen\.height/, 'Installed TURN must be able to recover the complete physical screen height');
assert.match(viewportBlock, /navigator\.standalone === true/, 'iOS Home Screen mode must activate complete screen coverage');
assert.match(viewportBlock, /display-mode: standalone/, 'Standards-based standalone mode must activate complete screen coverage');
assert.match(viewportBlock, /display-mode: fullscreen/, 'Fullscreen mode must activate complete screen coverage');
assert.doesNotMatch(viewportBlock, /viewport\?\.height \|\| window\.innerHeight/, 'A temporarily short visual viewport must never expose the cyan page background');

const createViewportFunctions = new Function(
  'window',
  'document',
  'navigator',
  'screen',
  `${viewportBlock}\nreturn { getViewportSize, getStandaloneScreenSize, isStandaloneDisplayMode };`
);

function measure({
  standalone = false,
  fullscreen = false,
  navigatorStandalone = false,
  viewportWidth = 1080,
  viewportHeight = 778,
  innerWidth = viewportWidth,
  innerHeight = viewportHeight,
  clientWidth = viewportWidth,
  clientHeight = viewportHeight,
  screenWidth = 810,
  screenHeight = 1080
} = {}) {
  const windowMock = {
    visualViewport: { width: viewportWidth, height: viewportHeight },
    innerWidth,
    innerHeight,
    matchMedia(query) {
      return {
        matches: query.includes('standalone') ? standalone : query.includes('fullscreen') ? fullscreen : false
      };
    }
  };
  const documentMock = {
    documentElement: {
      clientWidth,
      clientHeight,
      classList: {
        contains(name) {
          return name === 'turn-standalone' && standalone;
        }
      }
    }
  };
  const navigatorMock = { standalone: navigatorStandalone };
  const screenMock = {
    width: screenWidth,
    height: screenHeight,
    availWidth: screenWidth,
    availHeight: screenHeight
  };
  return createViewportFunctions(windowMock, documentMock, navigatorMock, screenMock).getViewportSize();
}

assert.deepEqual(
  measure({ standalone: true }),
  { width: 1080, height: 810 },
  'Installed iPad TURN must cover the full 1080×810 screen even when WebKit reports only 1080×778'
);
assert.deepEqual(
  measure({ standalone: false }),
  { width: 1080, height: 778 },
  'Normal browser play must remain inside the browser viewport rather than extending below its chrome'
);
assert.deepEqual(
  measure({ fullscreen: true }),
  { width: 1080, height: 810 },
  'Fullscreen display mode must receive the same complete-screen coverage as the installed app'
);
assert.deepEqual(
  measure({ navigatorStandalone: true }),
  { width: 1080, height: 810 },
  'Legacy iOS navigator.standalone mode must receive complete-screen coverage'
);
assert.deepEqual(
  measure({
    standalone: true,
    viewportWidth: 778,
    viewportHeight: 1080,
    screenWidth: 810,
    screenHeight: 1080
  }),
  { width: 810, height: 1080 },
  'Portrait mode must map the screen short side to width and long side to height'
);

assert.match(styles, /body \{[\s\S]*min-width: 100vw;[\s\S]*min-height: 100vh;/, 'The app surface must cover the complete layout viewport between resize events');
assert.match(styles, /@supports \(height: 100lvh\) \{[\s\S]*body \{[\s\S]*min-height: 100lvh;/, 'Modern WebKit must retain the stable large viewport coverage floor');
assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`), 'The viewport fix must ship through the current release identity');

console.log(`TURN ${release.id} full standalone iPad screen coverage passed.`);
