import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Exercise the real registry through each shipping import map. Reading the legacy
// relative alias alone missed a later absolute key resolving to the unpatched world.
const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png' };
const server = http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const filename = path.resolve(root, `.${pathname}`);
    if (!filename.startsWith(root)) throw new Error('Outside fixture root');
    const body = await fs.readFile(filename);
    response.writeHead(200, { 'content-type': types[path.extname(filename)] || 'application/octet-stream' });
    response.end(body);
  } catch (_) {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const results = [];
try {
  browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  for (const entry of ['turn', 'yourturn']) {
    const source = await fs.readFile(path.join(root, entry, 'index.html'), 'utf8');
    const importMap = source.match(/<script type="importmap">[\s\S]*?<\/script>/)?.[0];
    assert.ok(importMap, `${entry} has its production import map`);
    const context = await browser.newContext({ viewport: { width: 1024, height: 600 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    // YOUR TURN still names the CDN; use the identical vendored Three version
    // so this rendering check has no external network dependency.
    await page.route('https://cdn.jsdelivr.net/npm/three@0.184.0/**', async (route) => {
      const suffix = route.request().url().split('/three@0.184.0/')[1];
      await route.fulfill({ contentType: 'text/javascript',
        body: await fs.readFile(path.join(root, 'turn/vendor/three-0.184.0', suffix)) });
    });
    await page.route('**/harbor-validation.html', (route) => route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><meta charset="utf-8">${importMap}<style>body{margin:0}canvas{display:block}</style>`
    }));
    await page.goto(`${origin}/${entry}/harbor-validation.html`);
    const result = await page.evaluate(async () => {
      const THREE = await import('three');
      const { getTrackRuntimeEntry } = await import('/turn/tracks/registry.js');
      const track = getTrackRuntimeEntry('harbor');
      const { samples } = track.createRuntime();
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(track.sky);
      const world = await track.installWorld({ scene, samples, trackWidth: 27 });
      world.updateMatrixWorld(true);
      const road = world.getObjectByName('Harbor race road');
      const quay = world.children.find((node) => node.geometry?.type === 'BoxGeometry'
        && node.geometry.parameters.width === 620 && node.geometry.parameters.depth === 34);
      const roadY = new THREE.Box3().setFromObject(road).min.y;
      const quayTop = new THREE.Box3().setFromObject(quay).max.y;
      const rays = new THREE.Raycaster();
      let coveredRoadPoints = 0;
      let checkedRoadPoints = 0;
      // Sample the full road width where it crosses the quay, including both
      // sides of the start line. The first surface hit must always be asphalt.
      for (const sample of samples) {
        for (const fraction of [-0.9, -0.5, 0, 0.5, 0.9]) {
          const point = sample.point.clone().addScaledVector(sample.normal, fraction * 27 / 2);
          if (point.x < -310 || point.x > 310 || point.z < -191 || point.z > -157) continue;
          point.y = 20;
          rays.set(point, new THREE.Vector3(0, -1, 0));
          const hits = rays.intersectObjects([road, quay]);
          checkedRoadPoints++;
          if (hits[0]?.object !== road) coveredRoadPoints++;
        }
      }
      scene.add(new THREE.HemisphereLight(0xffffff, 0x536575, 2.4));
      const sun = new THREE.DirectionalLight(0xffffff, 2.5);
      sun.position.set(-50, 110, -80);
      scene.add(sun);
      const camera = new THREE.PerspectiveCamera(65, globalThis.innerWidth / globalThis.innerHeight, 0.1, 1800);
      camera.position.copy(samples[0].point).addScaledVector(samples[0].tangent, -34).setY(14);
      camera.lookAt(samples[0].point.clone().addScaledVector(samples[0].tangent, 52).setY(0));
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
      document.body.append(renderer.domElement);
      renderer.render(scene, camera);
      return { roadY, quayTop, coveredRoadPoints, checkedRoadPoints,
        batching: world.userData.turnHarborArtDirection.containerDrawCallBatching,
        gateRestored: !!world.getObjectByName('Harbor start gate r81') };
    });
    if (process.env.TURN_HARBOR_SCREENSHOT_DIR) {
      await fs.mkdir(process.env.TURN_HARBOR_SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: path.join(process.env.TURN_HARBOR_SCREENSHOT_DIR, `${entry}-harbor.png`) });
    }
    results.push({ entry, ...result, errors });
    await context.close();
  }
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
console.log(JSON.stringify(results, null, 2));
for (const result of results) {
  assert.deepEqual(result.errors, [], `${result.entry}: no runtime errors`);
  assert.ok(result.quayTop < result.roadY, `${result.entry}: quay concrete must remain below asphalt`);
  assert.ok(result.checkedRoadPoints > 50, `${result.entry}: probe the full quayside road section`);
  assert.equal(result.coveredRoadPoints, 0, `${result.entry}: no concrete covers the road`);
  assert.ok(result.gateRestored, `${result.entry}: preserve the start gate's curb clearance`);
  assert.ok(result.batching?.shells > 0 && result.batching.drawGroups < 10,
    `${result.entry}: preserve container batching`);
}
console.log('HARBOR surface browser smoke passed for TURN and YOUR TURN.');
