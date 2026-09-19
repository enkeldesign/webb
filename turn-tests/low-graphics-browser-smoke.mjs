import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium, webkit } from 'playwright';

const TARGET = process.env.TURN_LOW_GRAPHICS_URL || 'http://127.0.0.1:8000/turn/';

for (const browserType of [chromium, webkit]) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext();
  await context.addInitScript(() => {
    localStorage.setItem('turn-low-graphics-v1', '1');
  });
  const page = await context.newPage();
  await page.goto(TARGET, { waitUntil: 'domcontentloaded' });

  const result = await page.evaluate(async () => {
    const THREE = await import('three');
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(2);

    const light = new THREE.PointLight(0xffffff, 4, 20, 2);

    const output = {
      lowGraphics: globalThis.__turnGraphicsProfile?.lowGraphics,
      antialias: renderer.getContext().getContextAttributes()?.antialias,
      pixelRatio: renderer.getPixelRatio(),
      shadows: renderer.shadowMap.enabled,
      pointLightVisible: light.visible,
      pointLightIntensity: light.intensity
    };

    renderer.dispose();
    renderer.forceContextLoss?.();
    return output;
  });

  assert.equal(result.lowGraphics, true, `${browserType.name()} loaded the saved LOW GRAPHICS profile.`);
  assert.equal(result.antialias, true, `${browserType.name()} keeps WebGL antialiasing enabled.`);
  assert.ok(result.pixelRatio <= 1, `${browserType.name()} caps renderer DPR at 1.0.`);
  assert.equal(result.shadows, false, `${browserType.name()} keeps shadow rendering disabled.`);
  assert.equal(result.pointLightVisible, false, `${browserType.name()} removes real PointLights from rendering.`);
  assert.equal(result.pointLightIntensity, 0, `${browserType.name()} removes PointLight illumination.`);

  await context.close();
  await browser.close();
}

console.log('LOW GRAPHICS browser WebGL smoke passed in Chromium and WebKit.');

// The same production shadow module is rendered on touch-sized WebKit/Chromium
// surfaces. These are software-browser comparisons, not physical device timings.
const fixtureImportMap = (await fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'))
  .match(/<script type="importmap">[\s\S]*?<\/script>/)[0];
const outputDir = 'supercar-lot-visual-artifact';
await fs.mkdir(outputDir, { recursive: true });
for (const browserType of [chromium, webkit]) {
  const browser = await browserType.launch({ headless: true,
    ...(browserType === chromium ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] } : {}) });
  for (const device of [
    { name: 'iphone', width: 852, height: 393, dpr: 3, low: false },
    { name: 'ipad', width: 1080, height: 810, dpr: 2, low: false },
    { name: 'ipad-low', width: 1080, height: 810, dpr: 2, low: true }
  ]) {
    const context = await browser.newContext({ viewport: { width: device.width, height: device.height },
      deviceScaleFactor: device.dpr, hasTouch: true });
    await context.addInitScript((low) => localStorage.setItem('turn-low-graphics-v1', low ? '1' : '0'), device.low);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/shadow-validation.html', (route) => route.fulfill({ contentType: 'text/html',
      body: `<!doctype html><meta charset="utf-8">${fixtureImportMap}<style>body{margin:0;background:#eee}canvas{display:block}</style>` }));
    await page.goto(new URL('shadow-validation.html', TARGET).href);
    for (const terrain of ['flat', 'steep', 'banked-crest']) {
      const report = await page.evaluate(async ({ terrain, width, height, low }) => {
        const THREE = await import('three');
        const { createCarShadows } = await import('/turn/render/car-shadows.js');
        const { createCarVisual, disposeCarVisual } = await import('/turn/vehicle/car-models.js');
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xdce8ed);
        const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(low ? 1 : 1.25);
        document.body.replaceChildren(renderer.domElement);
        const sun = new THREE.DirectionalLight(0xfff1c1, 4.3);
        sun.position.set(-90, 150, 70);
        scene.add(sun, new THREE.HemisphereLight(0xffffff, 0x5b3a29, 2.7));
        const samples = Array.from({ length: 120 }, (_, i) => {
          const z = i - 60;
          const y = terrain === 'flat' ? 0 : terrain === 'steep' ? z * 0.55 : 6 * Math.cos(z * 0.07);
          const slope = terrain === 'flat' ? 0 : terrain === 'steep' ? 0.55 : -0.42 * Math.sin(z * 0.07);
          const bank = terrain === 'banked-crest' ? 0.25 * Math.sin(z * 0.05 + 1) : 0;
          return { point: new THREE.Vector3(terrain === 'banked-crest' ? 4 * Math.sin(z * 0.04) : 0, y, z),
            tangent: new THREE.Vector3(terrain === 'banked-crest' ? 0.16 * Math.cos(z * 0.04) : 0, slope, 1).normalize(),
            normal: new THREE.Vector3(-1, -bank, 0) };
        });
        const positions = [], indices = [];
        for (const sample of samples) {
          for (const side of [1, -1]) {
            const point = sample.point.clone().addScaledVector(sample.normal, side * 13.5);
            positions.push(point.x, point.y + 0.13, point.z);
          }
        }
        for (let i = 0; i < samples.length - 1; i++) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
        const roadGeometry = new THREE.BufferGeometry();
        roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        roadGeometry.setIndex(indices);
        roadGeometry.computeVertexNormals();
        const road = new THREE.Mesh(roadGeometry, new THREE.MeshStandardMaterial({ color: 0x777777, side: THREE.DoubleSide }));
        scene.add(road);
        const cars = [];
        for (let i = 0; i < 5; i++) {
          const car = new THREE.Group();
          const visual = await createCarVisual({ carId: 'sedan', color: i ? '#38d9ff' : '#ffd43b', ghost: i > 0, targetLength: 5.5 });
          car.add(visual);
          const sample = samples[48 + i * 6];
          car.position.copy(sample.point).addScaledVector(sample.normal, (i % 2 ? -1 : 1) * 3);
          car.position.y += 0.18;
          car.rotation.y = Math.PI + (terrain === 'banked-crest' ? 0.45 : 0);
          scene.add(car);
          cars.push({ car, visual, sample });
        }
        const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 900);
        const centerY = terrain === 'banked-crest' ? 6 : 0;
        camera.position.set(18, centerY + 22, 31);
        camera.lookAt(0, centerY, 0);
        // Reproduce the former 512px touch path in the fixture only.
        renderer.shadowMap.enabled = !low;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        sun.castShadow = !low;
        sun.shadow.mapSize.set(512, 512);
        Object.assign(sun.shadow.camera, { left: -100, right: 100, top: 100, bottom: -100 });
        road.receiveShadow = true;
        cars[0].car.traverse((node) => { if (node.isMesh) node.castShadow = true; });
        renderer.render(scene, camera);
        const legacy = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures };
        renderer.shadowMap.enabled = false;
        sun.castShadow = false;
        road.receiveShadow = false;
        cars[0].car.traverse((node) => { if (node.isMesh) node.castShadow = false; });
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
        const shadows = createCarShadows({ scene, sun, samples, trackWidth: 27 });
        for (const { car, visual } of cars) shadows.setCarSize(car, visual);
        shadows.beginFrame('countryside');
        for (const { car, sample } of cars) shadows.addCar(car, sample);
        shadows.endFrame();
        renderer.render(scene, camera);
        const current = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures };
        const geometryCount = renderer.info.memory.geometries;
        const batch = shadows.mesh;
        for (let restart = 0; restart < 5; restart++) {
          shadows.beginFrame('countryside');
          shadows.endFrame();
          if (batch.count !== 0) throw new Error('Stale shadows after restart');
          shadows.beginFrame('countryside');
          for (const { car, sample } of cars) shadows.addCar(car, sample);
          shadows.endFrame();
          renderer.render(scene, camera);
          if (shadows.mesh !== batch || renderer.info.memory.geometries !== geometryCount) throw new Error('Restart allocated shadow resources');
        }
        const gl = renderer.getContext();
        const pixels = new Uint8Array(renderer.domElement.width * renderer.domElement.height * 4);
        gl.readPixels(0, 0, renderer.domElement.width, renderer.domElement.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        batch.visible = false;
        renderer.render(scene, camera);
        const without = new Uint8Array(pixels.length);
        gl.readPixels(0, 0, renderer.domElement.width, renderer.domElement.height, gl.RGBA, gl.UNSIGNED_BYTE, without);
        let darkenedPixels = 0;
        for (let i = 0; i < pixels.length; i += 4) if (without[i] - pixels[i] > 4) darkenedPixels++;
        batch.visible = true;
        renderer.render(scene, camera);
        // Canvas retains the final inspection frame after resource cleanup.
        shadows.dispose(); shadows.dispose();
        renderer.renderLists.dispose();
        const shadowGeometriesDisposed = renderer.info.memory.geometries === geometryCount - 1;
        for (const { visual } of cars) disposeCarVisual(visual);
        roadGeometry.dispose(); road.material.dispose(); renderer.dispose();
        return { terrain, legacy, current, darkenedPixels, shadowGeometriesDisposed, shadowDrawCalls: 1 };
      }, { terrain, ...device });
      await page.screenshot({ path: `${outputDir}/shadows-${browserType.name()}-${device.name}-${terrain}.png` });
      assert.ok(report.darkenedPixels > 80, `${browserType.name()} ${device.name} ${terrain}: visible road shadows`);
      if (device.low) {
        assert.equal(report.current.calls, report.legacy.calls + 1, 'LOW gains grounding at one shared draw call');
        assert.equal(report.current.textures, report.legacy.textures, 'Projected shadows allocate no textures');
      } else {
        assert.ok(report.current.calls < report.legacy.calls, 'Projected shadows remove legacy shadow-pass draw calls');
        assert.ok(report.current.textures < report.legacy.textures, 'No shadow-map texture remains');
      }
      assert.equal(report.shadowGeometriesDisposed, true);
      assert.deepEqual(errors, [], 'No shader, WebGL or model errors');
      console.log(JSON.stringify({ browser: browserType.name(), device: device.name, ...report }));
      await fs.writeFile(`${outputDir}/shadows-${browserType.name()}-${device.name}-${terrain}.json`, JSON.stringify(report, null, 2));
    }
    await context.close();
  }
  await browser.close();
}
