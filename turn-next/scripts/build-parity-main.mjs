import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const productionMainPath = path.join(repositoryRoot, 'turn', 'main.js');
const releasePath = path.join(repositoryRoot, 'turn', 'release.json');
const outputPath = path.join(repositoryRoot, 'turn-next', 'main.js');

function generatedMain(productionMain, release) {
  return `// Generated from turn/main.js for TURN ${release.id}. Do not edit by hand.\n${productionMain}`;
}

async function main() {
  const [productionMain, releaseSource] = await Promise.all([
    fs.readFile(productionMainPath, 'utf8'),
    fs.readFile(releasePath, 'utf8')
  ]);
  const release = JSON.parse(releaseSource);
  const generated = generatedMain(productionMain, release);

  if (process.argv.includes('--check')) {
    const current = await fs.readFile(outputPath, 'utf8').catch(() => null);
    const currentBody = current?.replace(/^\/\/ Generated from turn\/main\.js for TURN [^\n]+\n/, '');
    assert.equal(currentBody, productionMain, 'turn-next/main.js must remain a byte-for-byte mirror of canonical turn/main.js after its generated header.');
    console.log(`TURN NEXT main mirrors canonical TURN ${release.id}.`);
    return;
  }

  await fs.writeFile(outputPath, generated);
  console.log(`Generated turn-next/main.js from TURN ${release.id}.`);
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) await main();
