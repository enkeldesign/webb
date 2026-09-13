import assert from 'node:assert/strict';
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
    const root = new THREE.Group();
    const taggedOutline = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.BackSide })
    );
    taggedOutline.userData.turnOutline = true;
    const legacyOutline = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0x08090a, side: THREE.BackSide })
    );
    root.add(taggedOutline, legacyOutline);
    await Promise.resolve();

    const output = {
      lowGraphics: globalThis.__turnGraphicsProfile?.lowGraphics,
      antialias: renderer.getContext().getContextAttributes()?.antialias,
      pixelRatio: renderer.getPixelRatio(),
      shadows: renderer.shadowMap.enabled,
      pointLightVisible: light.visible,
      pointLightIntensity: light.intensity,
      taggedOutlineVisible: taggedOutline.visible,
      legacyOutlineVisible: legacyOutline.visible
    };

    renderer.dispose();
    renderer.forceContextLoss?.();
    return output;
  });

  assert.equal(result.lowGraphics, true, `${browserType.name()} loaded the saved LOW GRAPHICS profile.`);
  assert.equal(result.antialias, false, `${browserType.name()} disables WebGL antialiasing.`);
  assert.ok(result.pixelRatio <= 1, `${browserType.name()} caps renderer DPR at 1.0.`);
  assert.equal(result.shadows, false, `${browserType.name()} keeps shadow rendering disabled.`);
  assert.equal(result.pointLightVisible, false, `${browserType.name()} removes real PointLights from rendering.`);
  assert.equal(result.pointLightIntensity, 0, `${browserType.name()} removes PointLight illumination.`);
  assert.equal(result.taggedOutlineVisible, false, `${browserType.name()} suppresses tagged TURN outline draw calls.`);
  assert.equal(result.legacyOutlineVisible, false, `${browserType.name()} suppresses legacy black back-face outline draw calls.`);

  await context.close();
  await browser.close();
}

console.log('LOW GRAPHICS browser WebGL smoke passed in Chromium and WebKit.');
