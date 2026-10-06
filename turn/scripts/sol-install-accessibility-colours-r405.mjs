import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read = (path) => fs.readFile(path, 'utf8');
const write = (path, content) => fs.writeFile(path, content);

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  assert.notEqual(first, -1, `${label}: source pattern exists`);
  assert.equal(source.indexOf(before, first + before.length), -1, `${label}: source pattern is unique`);
  return `${source.slice(0, first)}${after}${source.slice(first + before.length)}`;
}

const releasePath = 'turn/release.json';
const release = JSON.parse(await read(releasePath));
assert.deepEqual(release, {
  version: '1.36.42',
  id: '2026.10.06-r404',
  cacheKey: '20261006-r404'
}, 'Colour fix must start from the current r404 production release');
await write(releasePath, `${JSON.stringify({
  version: '1.36.43',
  id: '2026.10.06-r405',
  cacheKey: '20261006-r405'
}, null, 2)}\n`);

const tokensPath = 'turn/design-tokens.css';
let tokens = await read(tokensPath);
tokens = replaceOnce(tokens,
  `  --turn-action-information: var(--turn-blue-500);\n  --turn-action-game: var(--turn-blue-500);`,
  `  --turn-action-information: var(--turn-blue-500);\n  --turn-accessibility-mark: #154F91;\n  --turn-action-game: var(--turn-blue-500);`,
  'light accessibility mark token');
tokens = replaceOnce(tokens,
  `:root[data-theme="dark"] {\n  --turn-surface-page: #1c1d20;`,
  `:root[data-theme="dark"] {\n  --turn-accessibility-mark: var(--turn-blue-300);\n  --turn-surface-page: #1c1d20;`,
  'dark accessibility mark token');
await write(tokensPath, tokens);

const cssPath = 'turn/browser-install-r165.css';
let css = await read(cssPath);
css = replaceOnce(css, `/* Keep the original Commons geometry; its visible colour follows TURN's semantic
   information role in both themes, independently of the SVG's source fill. */
.install-accessibility::before {
  content: "";
  display: block;
  width: calc(var(--turn-space-12) + var(--turn-space-12));
  aspect-ratio: 1;
  background: var(--turn-action-information);
  -webkit-mask: url("./assets/icons/accessibility.svg") center / contain no-repeat;
  mask: url("./assets/icons/accessibility.svg") center / contain no-repeat;
}
`, `/* Preserve the Wikimedia mark's original blue in light mode; the semantic token
   maps it to TURN blue-300 in dark mode for legibility on the night surface. */
.install-accessibility::before {
  content: "";
  display: block;
  width: calc(var(--turn-space-12) + var(--turn-space-12));
  aspect-ratio: 1;
  background: var(--turn-accessibility-mark);
  -webkit-mask: url("./assets/icons/accessibility.svg") center / contain no-repeat;
  mask: url("./assets/icons/accessibility.svg") center / contain no-repeat;
}
`, 'theme-specific accessibility mark colour');
await write(cssPath, css);

const aboutTestPath = 'turn-tests/about-history-production.mjs';
let aboutTest = await read(aboutTestPath);
aboutTest = replaceOnce(aboutTest, `assert.match(browserInstallCss, /\\.install-accessibility::before[\\s\\S]*background: var\\(--turn-action-information\\)[\\s\\S]*assets\\/icons\\/accessibility\\.svg/,
  'Both themes must colour the Wikimedia accessibility mark with the semantic information token');`, `assert.match(browserInstallCss, /\\.install-accessibility::before[\\s\\S]*background: var\\(--turn-accessibility-mark\\)[\\s\\S]*assets\\/icons\\/accessibility\\.svg/,
  'The Wikimedia accessibility mark must use its dedicated theme-aware semantic token');`, 'accessibility mark colour regression');
await write(aboutTestPath, aboutTest);

const responsivePath = 'turn-tests/responsive-browser-smoke.mjs';
let responsive = await read(responsivePath);
responsive = replaceOnce(responsive, `            probe.style.backgroundColor = 'var(--turn-action-information)';
            gate.append(probe);
            const information = globalThis.getComputedStyle(probe).backgroundColor;
            probe.remove();
            return { clientWidth: gate.clientWidth, scrollWidth: gate.scrollWidth,
              markColor: mark.backgroundColor, information, mask: mark.webkitMaskImage || mark.maskImage,`, `            probe.style.backgroundColor = document.documentElement.dataset.theme === 'dark'
              ? 'var(--turn-blue-300)' : '#154F91';
            gate.append(probe);
            const expectedMarkColor = globalThis.getComputedStyle(probe).backgroundColor;
            probe.remove();
            return { clientWidth: gate.clientWidth, scrollWidth: gate.scrollWidth,
              markColor: mark.backgroundColor, expectedMarkColor, mask: mark.webkitMaskImage || mark.maskImage,`, 'browser expected accessibility colour');
responsive = replaceOnce(responsive,
  "          assert.equal(facts.markColor, facts.information, `${label}: the mark follows the semantic information colour`);",
  "          assert.equal(facts.markColor, facts.expectedMarkColor, `${label}: the mark uses the theme-specific accessibility colour`);",
  'browser accessibility colour assertion');
responsive = responsive.replace(
  'semantic mark in both themes, and 200% text passed.',
  'theme-specific accessibility mark colours, and 200% text passed.'
);
await write(responsivePath, responsive);
