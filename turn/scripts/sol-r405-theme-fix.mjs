import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

async function replaceOnce(path, before, after, label) {
  const source = await fs.readFile(path, 'utf8');
  const first = source.indexOf(before);
  assert.notEqual(first, -1, `${label}: source exists`);
  assert.equal(source.indexOf(before, first + before.length), -1, `${label}: source is unique`);
  await fs.writeFile(path, `${source.slice(0, first)}${after}${source.slice(first + before.length)}`);
}

const release = JSON.parse(await fs.readFile('turn/release.json', 'utf8'));
assert.deepEqual(release, {
  version: '1.36.43',
  id: '2026.10.06-r405',
  cacheKey: '20261006-r405'
});

await replaceOnce(
  'turn/design-tokens.css',
  `:root[data-theme="dark"] {\n  --turn-accessibility-mark: var(--turn-blue-300);\n  --turn-surface-page: #1c1d20;`,
  `:root[data-theme="dark"] {\n  --turn-surface-page: #1c1d20;`,
  'global dark-theme accessibility override'
);

await replaceOnce(
  'turn/browser-install-r165.css',
  `/* Preserve the Wikimedia mark's original blue in light mode; the semantic token\n   maps it to TURN blue-300 in dark mode for legibility on the night surface. */\n.install-accessibility::before {\n  content: "";\n  display: block;\n  width: calc(var(--turn-space-12) + var(--turn-space-12));\n  aspect-ratio: 1;\n  background: var(--turn-accessibility-mark);\n  -webkit-mask: url("./assets/icons/accessibility.svg") center / contain no-repeat;\n  mask: url("./assets/icons/accessibility.svg") center / contain no-repeat;\n}\n`,
  `/* Preserve the Wikimedia mark's original blue in light mode. Dark mode uses TURN's\n   lighter blue locally so the global theme remains limited to neutral roles. */\n.install-accessibility::before {\n  content: "";\n  display: block;\n  width: calc(var(--turn-space-12) + var(--turn-space-12));\n  aspect-ratio: 1;\n  background: var(--turn-accessibility-mark);\n  -webkit-mask: url("./assets/icons/accessibility.svg") center / contain no-repeat;\n  mask: url("./assets/icons/accessibility.svg") center / contain no-repeat;\n}\n\n:root[data-theme="dark"] .install-accessibility::before {\n  background: var(--turn-blue-300);\n}\n`,
  'install accessibility mark styles'
);

await replaceOnce(
  'turn-tests/about-history-production.mjs',
  `assert.match(browserInstallCss, /\\.install-accessibility::before[\\s\\S]*background: var\\(--turn-accessibility-mark\\)[\\s\\S]*assets\\/icons\\/accessibility\\.svg/,\n  'The Wikimedia accessibility mark must use its dedicated theme-aware semantic token');`,
  `assert.match(browserInstallCss, /\\.install-accessibility::before[\\s\\S]*background: var\\(--turn-accessibility-mark\\)[\\s\\S]*assets\\/icons\\/accessibility\\.svg/,\n  'Light mode must preserve the Wikimedia accessibility mark source-blue token');\nassert.match(browserInstallCss, /:root\\[data-theme="dark"\\] \\.install-accessibility::before[\\s\\S]*background: var\\(--turn-blue-300\\)/,\n  'Dark mode must recolour the accessibility mark with TURN blue-300');`,
  'install accessibility colour assertions'
);
