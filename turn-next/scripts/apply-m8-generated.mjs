import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

async function update(relativePath, transform) {
  const filePath = path.join(root, relativePath);
  const source = await fs.readFile(filePath, 'utf8');
  const output = transform(source);
  assert.notEqual(output, source, `${relativePath} was not changed.`);
  await fs.writeFile(filePath, output);
}

await update('turn-next/scripts/build-parity-entry.mjs', (source) => {
  const output = source.replaceAll('-m7', '-m8');
  assert.match(output, /app\.js\?source=.*-m8/);
  return output;
});

await update('turn-next/m8-home.js', (source) => {
  let output = source.replace(
    '<h1 id="m8HomeTitle">CHOOSE YOUR TRACK</h1>',
    '<h1 id="m8HomeTitle" tabindex="-1">CHOOSE YOUR TRACK</h1>'
  );
  output = output.replace(
    "  const badge = document.querySelector('.turn-next-badge span');\n  if (badge && !badge.textContent.includes('Home M8')) badge.textContent += ' · Home M8';\n\n",
    ''
  );
  assert.match(output, /m8HomeTitle" tabindex="-1"/);
  return output;
});

for (const script of [
  'turn-next/scripts/build-parity-main.mjs',
  'turn-next/scripts/build-parity-app.mjs',
  'turn-next/scripts/build-parity-entry.mjs'
]) {
  await execFileAsync(process.execPath, [path.join(root, script)], { cwd: root });
}

console.log('Generated TURN NEXT M8 parity files.');
