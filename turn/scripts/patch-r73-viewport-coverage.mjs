import fs from 'node:fs/promises';

const edits = [
  {
    path: 'turn/main.js',
    replacements: [[
      `function getViewportSize() {
  const viewport = window.visualViewport;
  const width = Math.max(1, Math.round(viewport?.width || window.innerWidth));
  const height = Math.max(1, Math.round(viewport?.height || window.innerHeight));
  return { width, height };
}`,
      `function getViewportSize() {
  const viewport = window.visualViewport;
  const root = document.documentElement;
  const width = Math.max(1, Math.round(Math.max(
    Number(viewport?.width) || 0,
    Number(window.innerWidth) || 0,
    Number(root.clientWidth) || 0
  )));
  const height = Math.max(1, Math.round(Math.max(
    Number(viewport?.height) || 0,
    Number(window.innerHeight) || 0,
    Number(root.clientHeight) || 0
  )));
  return { width, height };
}`
    ]]
  },
  {
    path: 'turn/styles.css',
    replacements: [[
      `body {
  position: fixed;
  top: 0;
  left: 0;
  width: var(--app-width);
  height: var(--app-height);
  font-weight: 800;
}`,
      `body {
  position: fixed;
  top: 0;
  left: 0;
  width: var(--app-width);
  min-width: 100vw;
  height: var(--app-height);
  min-height: 100vh;
  font-weight: 800;
}

@supports (height: 100lvh) {
  body {
    min-height: 100lvh;
  }
}`
    ]]
  }
];

for (const edit of edits) {
  let source = await fs.readFile(edit.path, 'utf8');
  for (const [before, after] of edit.replacements) {
    const matches = source.split(before).length - 1;
    if (matches !== 1) throw new Error(`${edit.path}: expected one exact match, found ${matches}`);
    source = source.replace(before, after);
  }
  await fs.writeFile(edit.path, source);
}
