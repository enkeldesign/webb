from pathlib import Path
import json

car_models_path = Path('turn/vehicle/car-models.js')
source = car_models_path.read_text(encoding='utf-8')
old = '''function installEmergencyLightRig(root, model, service) {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const barWidth = Math.max(0.42, size.x * 0.34);
  const lampWidth = barWidth * 0.42;
  const lampHeight = Math.max(0.08, size.y * 0.045);
  const lampDepth = Math.max(0.12, size.z * 0.055);
  const roofY = bounds.max.y + lampHeight * 0.6;
  const roofZ = center.z - size.z * (service === 'firetruck' ? 0.08 : 0.04);
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
  const periodMs = reducedMotion ? 1400 : (service === 'police' ? 720 : 840);
  const colors = service === 'police' ? [0xff264d, 0x168bff] : [0x168bff, 0x168bff];
  const lamps = [];

  colors.forEach((color, index) => {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false
    });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(lampWidth, lampHeight, lampDepth), material);
    lamp.position.set((index === 0 ? -1 : 1) * barWidth * 0.27, roofY, roofZ);
    lamp.visible = true;
    lamp.renderOrder = 40;

    const haloMaterial = material.clone();
    haloMaterial.opacity = 0;
    const halo = new THREE.Mesh(
      new THREE.BoxGeometry(lampWidth * 1.45, lampHeight * 1.7, lampDepth * 1.45),
      haloMaterial
    );
    halo.position.copy(lamp.position);
    halo.visible = false;
    halo.renderOrder = 39;

    root.add(halo, lamp);
    lamps.push({ lamp, material, halo, haloMaterial, index });
  });

  const rig = {
    service,
    lamps,
    periodMs,
    reducedMotion,
    lastFrameAt: -Infinity
  };
  root.userData.turnEmergencyService = service;
  root.userData.turnEmergencyLightRig = rig;
  for (const record of lamps) {
    record.lamp.onBeforeRender = () => updateEmergencyLightRig(rig);
  }
}

function updateEmergencyLightRig(rig) {
  const now = performance.now();
  if (now === rig.lastFrameAt) return;
  rig.lastFrameAt = now;
  const active = Boolean(globalThis.__turnBoostActive);
  const phase = (now % rig.periodMs) / rig.periodMs;
  const firstOn = phase < 0.5;

  for (const record of rig.lamps) {
    const on = record.index === 0 ? firstOn : !firstOn;
    record.lamp.visible = true;
    record.halo.visible = active && !rig.reducedMotion && on;
    record.material.opacity = active ? (on ? 1 : 0.16) : 0;
    record.haloMaterial.opacity = active && on ? 0.24 : 0;
  }
}
'''
new = '''function installEmergencyLightRig(root, model, service) {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const barWidth = Math.max(0.46, size.x * 0.36);
  const lampWidth = barWidth * 0.46;
  const lampHeight = Math.max(0.1, size.y * 0.055);
  const lampDepth = Math.max(0.14, size.z * 0.065);
  const roofY = bounds.max.y + lampHeight * 0.7;
  const roofZ = center.z - size.z * (service === 'firetruck' ? 0.08 : 0.04);
  const lightDistance = Math.max(8, size.z * 3.1);
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
  const periodMs = reducedMotion ? 1400 : (service === 'police' ? 720 : 840);
  const colors = service === 'police' ? [0xff3158, 0x2ab7ff] : [0x2ab7ff, 0x2ab7ff];
  const lamps = [];

  colors.forEach((color, index) => {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(lampWidth, lampHeight, lampDepth), material);
    lamp.position.set((index === 0 ? -1 : 1) * barWidth * 0.27, roofY, roofZ);
    lamp.visible = true;
    lamp.renderOrder = 42;

    const haloMaterial = material.clone();
    haloMaterial.opacity = 0;
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10), haloMaterial);
    halo.position.copy(lamp.position);
    halo.scale.set(lampWidth * 2.3, lampHeight * 5.4, lampDepth * 2.3);
    halo.visible = false;
    halo.renderOrder = 41;

    const wideHaloMaterial = material.clone();
    wideHaloMaterial.opacity = 0;
    const wideHalo = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10), wideHaloMaterial);
    wideHalo.position.copy(lamp.position);
    wideHalo.scale.set(lampWidth * 4.4, lampHeight * 8.2, lampDepth * 4.4);
    wideHalo.visible = false;
    wideHalo.renderOrder = 40;

    const pointLight = new THREE.PointLight(color, 0, lightDistance, 2);
    pointLight.position.copy(lamp.position);
    pointLight.position.y += lampHeight * 1.2;
    pointLight.castShadow = false;

    root.add(pointLight, wideHalo, halo, lamp);
    lamps.push({
      lamp,
      material,
      halo,
      haloMaterial,
      wideHalo,
      wideHaloMaterial,
      pointLight,
      index
    });
  });

  const rig = {
    service,
    lamps,
    periodMs,
    reducedMotion,
    lastFrameAt: -Infinity
  };
  root.userData.turnEmergencyService = service;
  root.userData.turnEmergencyLightRig = rig;
  for (const record of lamps) {
    record.lamp.onBeforeRender = () => updateEmergencyLightRig(rig);
  }
}

function updateEmergencyLightRig(rig) {
  const now = performance.now();
  if (now === rig.lastFrameAt) return;
  rig.lastFrameAt = now;
  const active = Boolean(globalThis.__turnBoostActive);
  const phase = (now % rig.periodMs) / rig.periodMs;
  const firstOn = phase < 0.5;

  for (const record of rig.lamps) {
    const on = record.index === 0 ? firstOn : !firstOn;
    record.lamp.visible = true;
    record.halo.visible = active && on;
    record.wideHalo.visible = active && !rig.reducedMotion && on;
    record.material.opacity = active ? (on ? 1 : 0.08) : 0;
    record.haloMaterial.opacity = active && on ? (rig.reducedMotion ? 0.42 : 0.68) : 0;
    record.wideHaloMaterial.opacity = active && on ? 0.26 : 0;
    record.pointLight.intensity = active && on ? (rig.reducedMotion ? 70 : 110) : 0;
  }
}
'''

if old in source:
    source = source.replace(old, new, 1)
elif 'new THREE.PointLight(color, 0, lightDistance, 2)' not in source:
    raise SystemExit('Emergency light source block did not match current branch')
car_models_path.write_text(source, encoding='utf-8')

test_path = Path('turn-lab/tests/emergency-vehicles-production.mjs')
test_source = test_path.read_text(encoding='utf-8')
anchor = "assert.match(carModels, /installEmergencyLightRig/);\n"
extra = (
    "assert.match(carModels, /THREE\\.AdditiveBlending/);\n"
    "assert.match(carModels, /new THREE\\.PointLight\\(color, 0, lightDistance, 2\\)/);\n"
    "assert.match(carModels, /record\\.wideHalo\\.visible = active/);\n"
    "assert.match(carModels, /record\\.pointLight\\.intensity = active/);\n"
)
if extra not in test_source:
    if anchor not in test_source:
        raise SystemExit('Emergency regression anchor did not match current branch')
    test_source = test_source.replace(anchor, anchor + extra, 1)
test_path.write_text(test_source, encoding='utf-8')

release_path = Path('turn/release.json')
release = json.loads(release_path.read_text(encoding='utf-8'))
release.update({
    'version': '1.4.0',
    'id': '2026.08.03-r126',
    'cacheKey': '20260803-r126'
})
release_path.write_text(json.dumps(release, indent=2) + '\n', encoding='utf-8')

for name in [
    'turn/design.html',
    'turn-tests/design-system-production.mjs',
    'turn-next/index.html'
]:
    path = Path(name)
    text = path.read_text(encoding='utf-8')
    text = text.replace('2026.08.03-r125', '2026.08.03-r126')
    text = text.replace('20260803-r125', '20260803-r126')
    text = text.replace('2026.08.03-R125', '2026.08.03-R126')
    text = text.replace(r'2026\.08\.03-r125', r'2026\.08\.03-r126')
    path.write_text(text, encoding='utf-8')
