import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const productionIndexPath = path.join(repositoryRoot, 'turn', 'index.html');
const releasePath = path.join(repositoryRoot, 'turn', 'release.json');
const outputPath = path.join(repositoryRoot, 'turn-next', 'index.html');

function replaceRequired(source, search, replacement, label) {
  const firstIndex = source.indexOf(search);
  assert.notEqual(firstIndex, -1, `TURN NEXT entry generation could not find ${label}.`);
  assert.equal(
    source.indexOf(search, firstIndex + search.length),
    -1,
    `TURN NEXT entry generation found more than one ${label}.`
  );
  return source.slice(0, firstIndex) + replacement + source.slice(firstIndex + search.length);
}

export function buildTurnNextEntry(productionIndex, release) {
  const sourceTitle = `TURN v${release.version} · Build ${release.id}`;
  const nextTitle = `TURN NEXT · Source ${sourceTitle}`;
  const sourceKicker = `<span class="install-kicker">${sourceTitle}</span>`;
  const nextInstallKicker = `<span class="install-kicker">TURN NEXT · Source ${sourceTitle}</span>`;
  const sourceStartKicker = `<span class="kicker">${sourceTitle}</span>`;
  const nextStartKicker = `<span class="kicker">TURN NEXT · Source ${sourceTitle}</span>`;

  let output = productionIndex;

  output = replaceRequired(
    output,
    '<html lang="en"><head>',
    '<html lang="en" data-turn-deployment="next"><head><base href="/turn/">',
    'document head'
  );
  output = replaceRequired(
    output,
    '<meta name="application-name" content="TURN">',
    '<meta name="application-name" content="TURN NEXT"><meta name="robots" content="noindex,nofollow">',
    'application-name metadata'
  );
  output = replaceRequired(
    output,
    '<meta name="description" content="TURN is a motion-controlled arcade drift racer. Tilt your device to steer, drift and boost through short tracks, then race your own best laps.">',
    '<meta name="description" content="TURN NEXT is the isolated architecture test runtime for TURN.">',
    'description metadata'
  );
  output = replaceRequired(
    output,
    '<link rel="canonical" href="https://enkel.design/turn/">',
    '<link rel="canonical" href="https://enkel.design/turn-next/">',
    'canonical URL'
  );
  output = replaceRequired(
    output,
    '<meta property="og:site_name" content="TURN">',
    '<meta property="og:site_name" content="TURN NEXT">',
    'Open Graph site name'
  );
  output = replaceRequired(
    output,
    '<meta property="og:title" content="TURN — Tilt. Drift. Boost.">',
    '<meta property="og:title" content="TURN NEXT — Architecture test runtime">',
    'Open Graph title'
  );
  output = replaceRequired(
    output,
    '<meta property="og:description" content="A motion-controlled arcade drift racer. Tilt your device to steer and chase your own best laps.">',
    '<meta property="og:description" content="An isolated staging runtime used to verify TURN architecture changes.">',
    'Open Graph description'
  );
  output = replaceRequired(
    output,
    '<meta property="og:url" content="https://enkel.design/turn/">',
    '<meta property="og:url" content="https://enkel.design/turn-next/">',
    'Open Graph URL'
  );
  output = replaceRequired(
    output,
    '<meta name="twitter:title" content="TURN — Tilt. Drift. Boost.">',
    '<meta name="twitter:title" content="TURN NEXT — Architecture test runtime">',
    'Twitter title'
  );
  output = replaceRequired(
    output,
    '<meta name="twitter:description" content="A motion-controlled arcade drift racer. Tilt your device to steer and chase your own best laps.">',
    '<meta name="twitter:description" content="An isolated staging runtime used to verify TURN architecture changes.">',
    'Twitter description'
  );
  output = replaceRequired(
    output,
    '<meta name="apple-mobile-web-app-title" content="TURN">',
    '<meta name="apple-mobile-web-app-title" content="TURN NEXT">',
    'Apple web app title'
  );
  output = replaceRequired(output, `<title>${sourceTitle}</title>`, `<title>${nextTitle}</title>`, 'page title');
  output = replaceRequired(
    output,
    `</script><link rel="icon"`,
    `</script><script src="/turn-next/storage-bootstrap.js?source=${release.cacheKey}"></script><script src="/turn-next/safe-zone-bootstrap.js?source=${release.cacheKey}&stage=safe-zone-m3"></script><link rel="icon"`,
    'staging bootstrap insertion point'
  );
  output = replaceRequired(
    output,
    `<link rel="manifest" href="./site.webmanifest?build=${release.cacheKey}">`,
    `<link rel="manifest" href="/turn-next/site.webmanifest?source=${release.cacheKey}">`,
    'manifest link'
  );
  output = replaceRequired(
    output,
    `<link rel="stylesheet" href="./garage/lot-layout-r60.css?build=${release.cacheKey}">`,
    `<link rel="stylesheet" href="./garage/lot-layout-r60.css?build=${release.cacheKey}"><link rel="stylesheet" href="/turn-next/identity.css?source=${release.cacheKey}"><script defer src="/turn-next/identity.js?source=${release.cacheKey}"></script>`,
    'TURN NEXT identity assets insertion point'
  );
  output = replaceRequired(
    output,
    '</head><body><section class="install-gate"',
    `</head><body><aside class="turn-next-badge" role="note" aria-label="TURN NEXT architecture test runtime. Source ${sourceTitle}."><strong>TURN NEXT</strong><span>Source ${release.id}</span></aside><section class="install-gate"`,
    'body staging badge insertion point'
  );
  output = replaceRequired(output, sourceKicker, nextInstallKicker, 'install build label');
  output = replaceRequired(output, '<h1 id="installTitle">TURN</h1>', '<h1 id="installTitle">TURN NEXT</h1>', 'install heading');
  output = replaceRequired(
    output,
    '<p class="install-copy">TURN is a motion-controlled arcade drift racer. Turn your device to steer and race your own best laps.</p>',
    '<p class="install-copy">This is TURN’s isolated architecture test runtime. It uses production gameplay modules with separate test records.</p>',
    'install description'
  );
  output = replaceRequired(output, '>Install TURN</button>', '>Install TURN NEXT</button>', 'install button label');
  output = replaceRequired(
    output,
    '<p class="install-note" id="installNote">Install TURN for the best fullscreen experience. You can also play in your browser.</p>',
    '<p class="install-note" id="installNote">TURN NEXT cannot overwrite production TURN records. You can install it alongside TURN.</p>',
    'install note'
  );
  output = replaceRequired(
    output,
    '<h2 id="installGuideTitle">Add TURN to your Home Screen</h2>',
    '<h2 id="installGuideTitle">Add TURN NEXT to your Home Screen</h2>',
    'install guide title'
  );
  output = replaceRequired(output, sourceStartKicker, nextStartKicker, 'start build label');
  output = replaceRequired(
    output,
    '<h1 class="start-logo-heading" id="title"><img class="start-logo" src="./icon-512-r45.png" alt="TURN"></h1>',
    '<h1 class="start-logo-heading" id="title"><img class="start-logo" src="./icon-512-r45.png" alt="TURN"><span class="turn-next-card-label">NEXT</span></h1>',
    'start logo heading'
  );
  output = replaceRequired(
    output,
    `<script type="module" src="./app.js?build=${release.cacheKey}"></script>`,
    `<script type="module" src="/turn-next/app.js?source=${release.cacheKey}"></script>`,
    'TURN NEXT bootstrap entry'
  );

  assert.match(output, /<base href="\/turn\/">/);
  assert.match(output, /src="\/turn-next\/safe-zone-bootstrap\.js\?source=.*&stage=safe-zone-m3"/);
  assert.match(output, /src="\/turn-next\/app\.js\?source=/);
  assert.match(output, /src="\/turn-next\/storage-bootstrap\.js/);
  assert.match(output, /href="\/turn-next\/site\.webmanifest/);
  assert.doesNotMatch(output, /turnAppViewport|orientation-preflight|orientation-freeze/);
  assert.doesNotMatch(output, /href="\.\/site\.webmanifest/);
  assert.ok(
    output.indexOf('/turn-next/safe-zone-bootstrap.js') < output.indexOf('./orientation-compat.js'),
    'The motion safe zone must be configured before TURN installs orientation feedback.'
  );

  return output;
}

async function main() {
  const [productionIndex, releaseSource] = await Promise.all([
    fs.readFile(productionIndexPath, 'utf8'),
    fs.readFile(releasePath, 'utf8')
  ]);
  const release = JSON.parse(releaseSource);
  const generated = buildTurnNextEntry(productionIndex, release);

  if (process.argv.includes('--check')) {
    const current = await fs.readFile(outputPath, 'utf8').catch(() => null);
    assert.equal(
      current,
      generated,
      'turn-next/index.html is stale. Run node turn-next/scripts/build-parity-entry.mjs.'
    );
    console.log(`TURN NEXT parity entry matches TURN ${release.id}.`);
    return;
  }

  await fs.writeFile(outputPath, generated);
  console.log(`Generated turn-next/index.html from TURN ${release.id}.`);
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  await main();
}
