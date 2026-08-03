from __future__ import annotations

import json
import shutil
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TURN = ROOT / 'turn'
OFFICIAL_ZIP = 'https://kenney.nl/media/pages/assets/car-kit/1a312ec241-1775131960/kenney_car-kit.zip'
ASSET_NAMES = ('firetruck', 'police', 'ambulance')


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


def download_assets() -> None:
    archive_path = ROOT / '.turn-emergency-assets.zip'
    request = urllib.request.Request(OFFICIAL_ZIP, headers={'User-Agent': 'TURN release automation'})
    with urllib.request.urlopen(request, timeout=90) as response, archive_path.open('wb') as output:
        shutil.copyfileobj(response, output)

    destination = TURN / 'assets' / 'cars'
    destination.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive_path) as archive:
        names = archive.namelist()
        for asset in ASSET_NAMES:
            suffix = f'Models/GLB format/{asset}.glb'
            matches = [name for name in names if name.endswith(suffix)]
            if len(matches) != 1:
                raise RuntimeError(f'Expected one {suffix} in Kenney archive, found {matches}')
            data = archive.read(matches[0])
            if data[:4] != b'glTF' or len(data) < 10_000:
                raise RuntimeError(f'Invalid {asset}.glb from Kenney archive')
            (destination / f'{asset}.glb').write_bytes(data)
    archive_path.unlink(missing_ok=True)

    write('turn/assets/cars/KENNEY-CAR-KIT.md', '''# Kenney Car Kit emergency vehicles

TURN includes these files from Kenney's **Car Kit 3.1**:

- `ambulance.glb`
- `firetruck.glb`
- `police.glb`

Source: https://kenney.nl/assets/car-kit

License: Creative Commons CC0 1.0 Universal. Attribution is not required, but TURN credits Kenney because the work is excellent.
''')


def patch_catalog() -> None:
    path = 'turn/vehicle/catalog.js'
    text = read(path)
    text = replace_once(
        text,
        "const FEATURED_VISUAL_SIZE_MULTIPLIER_BY_ID = Object.freeze({\n  'monster-truck': 1.2\n});",
        "const FEATURED_VISUAL_SIZE_MULTIPLIER_BY_ID = Object.freeze({\n  'monster-truck': 1.2\n});\n\nconst EMERGENCY_SERVICE_BY_ID = Object.freeze({\n  firetruck: 'firetruck',\n  police: 'police',\n  ambulance: 'ambulance'\n});\n\nconst FIXED_LIVERY_IDS = new Set(Object.keys(EMERGENCY_SERVICE_BY_ID));\nconst RETIRED_VEHICLE_REPLACEMENTS = Object.freeze({\n  'suv-luxury': 'firetruck',\n  'hatchback-sports': 'police',\n  'truck-flat': 'ambulance'\n});",
        'catalog emergency metadata'
    )
    text = replace_once(
        text,
        "  ['suv-luxury', 'Luxury SUV', 'car', { speed: 3, acceleration: 3, control: 4, drift: 4, boostPower: 2, boostDuration: 2 }, 1.06, 0, 0.84],\n  ['hatchback-sports', 'Sport Hatch', 'car', { speed: 4, acceleration: 4, control: 5, drift: 2, boostPower: 2, boostDuration: 1 }, 0.96, 0, 1.18],\n  ['truck-flat', 'Flatbed', 'car', { speed: 2, acceleration: 2, control: 3, drift: 5, boostPower: 2, boostDuration: 4 }, 1.12, 0, 0.72],",
        "  ['firetruck', 'Fire Truck', 'car', { speed: 2, acceleration: 2, control: 4, drift: 4, boostPower: 1, boostDuration: 5 }, 1.10, 0, 0.66],\n  ['police', 'Police Car', 'car', { speed: 4, acceleration: 3, control: 3, drift: 2, boostPower: 1, boostDuration: 5 }, 0.98, 0, 1.10],\n  ['ambulance', 'Ambulance', 'car', { speed: 3, acceleration: 2, control: 3, drift: 4, boostPower: 1, boostDuration: 5 }, 1.05, 0, 0.78],",
        'catalog emergency cars'
    )
    text = replace_once(
        text,
        "  secondaryPaint: SECONDARY_PAINT_BY_ID[id] || null,\n  tuning: Object.freeze({",
        "  secondaryPaint: SECONDARY_PAINT_BY_ID[id] || null,\n  emergencyService: EMERGENCY_SERVICE_BY_ID[id] || null,\n  fixedLivery: FIXED_LIVERY_IDS.has(id),\n  tuning: Object.freeze({",
        'catalog emergency fields'
    )
    text = replace_once(
        text,
        "export function normalizeVehicleId(id) {\n  return CAR_BY_ID.has(id) ? id : DEFAULT_VEHICLE_ID;\n}",
        "export function normalizeVehicleId(id) {\n  const replacement = RETIRED_VEHICLE_REPLACEMENTS[id] || id;\n  return CAR_BY_ID.has(replacement) ? replacement : DEFAULT_VEHICLE_ID;\n}",
        'catalog retired selection migration'
    )
    write(path, text)


def patch_lot() -> None:
    path = 'turn/garage/lot-r10.js'
    text = read(path)
    text = replace_once(
        text,
        "  'suv-luxury': 'A large premium SUV with a tall body, wide grille and substantial presence.',\n  'hatchback-sports': 'A compact sporty hatchback with a short rear and planted stance.',\n  'truck-flat': 'A work truck with a cab at the front and an open flatbed behind it.',",
        "  firetruck: 'A heavy fire engine with roof equipment, blue emergency lights and a deep two-tone siren.',\n  police: 'A quick patrol car with a red-and-blue light bar and an urgent electronic siren.',\n  ambulance: 'A stable emergency van with blue roof lights and a clear hi-lo siren.',",
        'lot emergency descriptions'
    )
    text = replace_once(text, '<p>Pick a ride. Then paint it.</p>', '<p>Pick a ride. Then hit the road.</p>', 'lot heading')
    old = """      const paintControls = [makeColorInput({
        label: 'Body',
        value: selectedColor,
        onInput(value) {
          selectedColor = normalizeVehicleColor(value);
          applySelectedPaint();
          updatePaintAccessibleNames();
        }
      })];
      if (car.secondaryPaint) {
        paintControls.push(makeColorInput({
          label: car.secondaryPaint.label,
          value: selectedSecondaryColor,
          secondary: true,
          onInput(value) {
            selectedSecondaryColor = normalizeVehicleSecondaryColor(value);
            applySelectedPaint();
            updatePaintAccessibleNames();
          }
        }));
      }
      colors.replaceChildren(...paintControls);
      updatePaintAccessibleNames();
"""
    new = """      if (car.fixedLivery) {
        const livery = document.createElement('div');
        livery.className = 'lot-color-control lot-fixed-livery';
        livery.innerHTML = '<span>PAINT</span><strong>SERVICE LIVERY</strong>';
        livery.setAttribute('aria-label', `${car.name} uses its fixed service livery`);
        colors.replaceChildren(livery);
        colors.setAttribute('aria-label', 'Fixed service livery');
      } else {
        const paintControls = [makeColorInput({
          label: 'Body',
          value: selectedColor,
          onInput(value) {
            selectedColor = normalizeVehicleColor(value);
            applySelectedPaint();
            updatePaintAccessibleNames();
          }
        })];
        if (car.secondaryPaint) {
          paintControls.push(makeColorInput({
            label: car.secondaryPaint.label,
            value: selectedSecondaryColor,
            secondary: true,
            onInput(value) {
              selectedSecondaryColor = normalizeVehicleSecondaryColor(value);
              applySelectedPaint();
              updatePaintAccessibleNames();
            }
          }));
        }
        colors.replaceChildren(...paintControls);
        colors.setAttribute('aria-label', 'Choose car paint colours');
        updatePaintAccessibleNames();
      }
"""
    text = replace_once(text, old, new, 'lot fixed livery controls')
    write(path, text)

    css_path = 'turn/garage/lot-r10.css'
    css = read(css_path)
    marker = ".lot-color-input {\n"
    addition = """.lot-fixed-livery {
  grid-template-columns: minmax(0, 1fr) auto;
  cursor: default;
}

.lot-fixed-livery strong {
  padding: 5px 7px;
  border: 2px solid var(--ink);
  border-radius: 7px;
  background: var(--cyan);
  font-size: 0.48rem;
  letter-spacing: 0.045em;
  white-space: nowrap;
}

"""
    css = replace_once(css, marker, addition + marker, 'lot fixed livery styles')
    write(css_path, css)


def patch_car_models() -> None:
    path = 'turn/vehicle/car-models.js'
    text = read(path)
    text = replace_once(
        text,
        "    const paintable = !protectedPart && !secondaryPaint && (\n      explicitPaint ||",
        "    const paintable = !car.fixedLivery && !protectedPart && !secondaryPaint && (\n      explicitPaint ||",
        'fixed livery paint protection'
    )
    text = replace_once(
        text,
        "  normalizeModelToGround(model, targetLength * effectiveVisualScale);\n\n  root.userData.turnCarId = car.id;",
        "  normalizeModelToGround(model, targetLength * effectiveVisualScale);\n  if (car.emergencyService && !ghost) installEmergencyLightRig(root, model, car.emergencyService);\n\n  root.userData.turnCarId = car.id;",
        'emergency light rig install'
    )
    marker = "\nexport function recolorCarVisual(root, color, secondaryColor = root?.userData?.turnCarSecondaryColor) {"
    functions = r'''
function installEmergencyLightRig(root, model, service) {
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
    text = replace_once(text, marker, '\n' + functions + marker, 'emergency light functions')
    write(path, text)


def patch_gameplay_audio_bridge() -> None:
    path = 'turn/ui/gameplay-controls.js'
    text = read(path)
    text = replace_once(
        text,
        "      boostActive: boosting,\n      enginePitch: runtimeState?.vehicleTuning?.enginePitch || 1,",
        "      boostActive: boosting,\n      vehicleId: runtimeState?.vehicleId || '',\n      enginePitch: runtimeState?.vehicleTuning?.enginePitch || 1,",
        'audio vehicle identity'
    )
    write(path, text)


def patch_audio() -> None:
    path = 'turn/audio/audio-system.js'
    text = read(path)
    text = replace_once(
        text,
        "const DRIVE_BY_EAR_ENABLED = globalThis.__turnDriveByEarEnabled !== false;",
        "const DRIVE_BY_EAR_ENABLED = globalThis.__turnDriveByEarEnabled !== false;\nconst EMERGENCY_SERVICE_BY_VEHICLE_ID = Object.freeze({\n  firetruck: 'firetruck',\n  police: 'police',\n  ambulance: 'ambulance'\n});",
        'audio emergency identity map'
    )
    text = replace_once(
        text,
        "let boostGain = null;\nlet boostFilter = null;\nlet boostTone = null;",
        "let boostGain = null;\nlet boostFilter = null;\nlet boostTone = null;\n\nlet sirenGain = null;\nlet sirenFilter = null;\nlet sirenTone = null;\nlet sirenHarmonic = null;",
        'audio siren nodes'
    )
    text = replace_once(
        text,
        "  const boostActive = active && Boolean(frame.boostActive);\n  const enginePitch = clamp(",
        "  const boostActive = active && Boolean(frame.boostActive);\n  const emergencyService = EMERGENCY_SERVICE_BY_VEHICLE_ID[String(frame.vehicleId || '')] || null;\n  const sirenActive = boostActive && Boolean(emergencyService);\n  const enginePitch = clamp(",
        'audio siren state'
    )
    text = replace_once(
        text,
        "  smooth(boostTone.frequency, 430 + speedRatio * 430, audioNow, 0.06);\n\n  if (DRIVE_BY_EAR_ENABLED) {",
        "  smooth(boostTone.frequency, 430 + speedRatio * 430, audioNow, 0.06);\n  updateEmergencySiren(sirenActive, emergencyService, audioNow);\n\n  if (DRIVE_BY_EAR_ENABLED) {",
        'audio siren update'
    )
    text = replace_once(
        text,
        "  if (boostActive && !lastBoostActive && safetyMode === 'none') playCueNow('boost-start');",
        "  if (boostActive && !lastBoostActive && safetyMode === 'none' && !emergencyService) playCueNow('boost-start');",
        'audio emergency boost cue'
    )
    text = replace_once(
        text,
        "  hardMute(boostGain.gain, now);\n  if (sliderGain)",
        "  hardMute(boostGain.gain, now);\n  if (sirenGain) hardMute(sirenGain.gain, now);\n  if (sliderGain)",
        'audio silence siren'
    )
    text = replace_once(
        text,
        "  installBoostGraph();\n  if (DRIVE_BY_EAR_ENABLED) installDbeGraphs();",
        "  installBoostGraph();\n  installEmergencySirenGraph();\n  if (DRIVE_BY_EAR_ENABLED) installDbeGraphs();",
        'audio install siren'
    )
    marker = "\nfunction installDbeGraphs() {"
    functions = r'''
function installEmergencySirenGraph() {
  sirenGain = context.createGain();
  sirenGain.gain.value = 0;

  sirenFilter = context.createBiquadFilter();
  sirenFilter.type = 'lowpass';
  sirenFilter.frequency.value = 2400;
  sirenFilter.Q.value = 0.55;

  const fundamentalMix = context.createGain();
  fundamentalMix.gain.value = 0.72;
  const harmonicMix = context.createGain();
  harmonicMix.gain.value = 0.18;

  sirenTone = context.createOscillator();
  sirenTone.type = 'triangle';
  sirenTone.frequency.value = 620;
  sirenTone.connect(fundamentalMix);

  sirenHarmonic = context.createOscillator();
  sirenHarmonic.type = 'sine';
  sirenHarmonic.frequency.value = 930;
  sirenHarmonic.connect(harmonicMix);

  fundamentalMix.connect(sirenFilter);
  harmonicMix.connect(sirenFilter);
  sirenFilter.connect(sirenGain);
  sirenGain.connect(dynamicsBus);
  sirenTone.start();
  sirenHarmonic.start();
}

function updateEmergencySiren(active, service, now) {
  if (!sirenGain || !sirenTone || !sirenHarmonic) return;
  if (!active) {
    smooth(sirenGain.gain, 0, now, 0.09);
    return;
  }

  const frequency = emergencySirenFrequency(service, now);
  const level = service === 'firetruck' ? 0.033 : 0.029;
  smooth(sirenGain.gain, level, now, 0.035);
  smooth(sirenTone.frequency, frequency, now, service === 'police' ? 0.035 : 0.055);
  smooth(sirenHarmonic.frequency, frequency * 1.5, now, 0.045);
  smooth(sirenFilter.frequency, service === 'firetruck' ? 1800 : 2300, now, 0.08);
}

function emergencySirenFrequency(service, now) {
  if (service === 'firetruck') {
    return Math.floor(now / 0.58) % 2 === 0 ? 430 : 570;
  }
  if (service === 'ambulance') {
    return Math.floor(now / 0.42) % 2 === 0 ? 610 : 820;
  }

  const phase = (now % 1.18) / 1.18;
  const triangle = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
  return 710 + triangle * 360;
}
'''
    text = replace_once(text, marker, '\n' + functions + marker, 'audio siren graph')
    write(path, text)


def patch_tests() -> None:
    path = 'turn-lab/tests/garage-production.mjs'
    text = read(path)
    text = replace_once(
        text,
        "  'race-future', 'race', 'sedan-sports', 'sedan', 'suv', 'suv-luxury',\n  'hatchback-sports', 'truck-flat', 'truck', 'van'",
        "  'race-future', 'race', 'sedan-sports', 'sedan', 'suv', 'firetruck',\n  'police', 'ambulance', 'truck', 'van'",
        'garage expected emergency ids'
    )
    write(path, text)

    path = 'turn-lab/tests/car-orientation-production.mjs'
    text = read(path)
    text = replace_once(text, "  ['suv-luxury', 0],\n  ['hatchback-sports', 0],\n  ['truck-flat', 0],", "  ['firetruck', 0],\n  ['police', 0],\n  ['ambulance', 0],", 'orientation emergency ids')
    text = replace_once(text, "  ['suv-luxury', 1.06],\n  ['hatchback-sports', 0.96],\n  ['truck-flat', 1.12],", "  ['firetruck', 1.10],\n  ['police', 0.98],\n  ['ambulance', 1.05],", 'orientation emergency scales')
    write(path, text)

    path = '.github/workflows/turn-lab-tests.yml'
    text = read(path)
    anchor = "      - name: Run compact Lot layout regression\n        run: node turn-lab/tests/lot-layout-production.mjs\n"
    addition = anchor + "\n      - name: Run emergency vehicle regression\n        run: node turn-lab/tests/emergency-vehicles-production.mjs\n"
    text = replace_once(text, anchor, addition, 'CI emergency regression step')
    write(path, text)

    write('turn-lab/tests/emergency-vehicles-production.mjs', r'''import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const turnDir = path.join(root, 'turn');
const catalogSource = await fs.readFile(path.join(turnDir, 'vehicle/catalog.js'), 'utf8');
const catalog = await import(`data:text/javascript;base64,${Buffer.from(catalogSource).toString('base64')}`);

const expected = new Map([
  ['firetruck', { name: 'Fire Truck', stats: { speed: 2, acceleration: 2, control: 4, drift: 4, boostPower: 1, boostDuration: 5 } }],
  ['police', { name: 'Police Car', stats: { speed: 4, acceleration: 3, control: 3, drift: 2, boostPower: 1, boostDuration: 5 } }],
  ['ambulance', { name: 'Ambulance', stats: { speed: 3, acceleration: 2, control: 3, drift: 4, boostPower: 1, boostDuration: 5 } }]
]);

for (const retired of ['suv-luxury', 'hatchback-sports', 'truck-flat']) {
  assert.equal(catalog.CAR_CATALOG.some((car) => car.id === retired), false, `${retired} must be retired from The Lot`);
}

for (const [id, contract] of expected) {
  const car = catalog.CAR_CATALOG.find((candidate) => candidate.id === id);
  assert.ok(car, `${contract.name} must be in The Lot`);
  assert.equal(car.name, contract.name);
  assert.deepEqual(car.stats, contract.stats);
  assert.equal(catalog.getVehicleStatTotal(car.stats), catalog.VEHICLE_STAT_BUDGET);
  assert.equal(car.stats.boostDuration, 5, `${contract.name} needs a full emergency-service boost tank`);
  assert.equal(car.emergencyService, id);
  assert.equal(car.fixedLivery, true);
  const glb = await fs.readFile(path.join(turnDir, `assets/cars/${id}.glb`));
  assert.equal(glb.toString('utf8', 0, 4), 'glTF');
  assert.ok(glb.length > 10_000, `${id}.glb must contain the vendored Kenney model`);
}

assert.equal(catalog.normalizeVehicleId('suv-luxury'), 'firetruck');
assert.equal(catalog.normalizeVehicleId('hatchback-sports'), 'police');
assert.equal(catalog.normalizeVehicleId('truck-flat'), 'ambulance');

const [carModels, lot, lotCss, controls, audio, license] = await Promise.all([
  fs.readFile(path.join(turnDir, 'vehicle/car-models.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'garage/lot-r10.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'garage/lot-r10.css'), 'utf8'),
  fs.readFile(path.join(turnDir, 'ui/gameplay-controls.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'audio/audio-system.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'assets/cars/KENNEY-CAR-KIT.md'), 'utf8')
]);

assert.match(carModels, /!car\.fixedLivery/);
assert.match(carModels, /installEmergencyLightRig/);
assert.match(carModels, /prefers-reduced-motion: reduce/);
assert.match(carModels, /periodMs = reducedMotion \? 1400/);
assert.match(carModels, /globalThis\.__turnBoostActive/);
assert.match(lot, /SERVICE LIVERY/);
assert.match(lotCss, /\.lot-fixed-livery/);
assert.match(controls, /vehicleId: runtimeState\?\.vehicleId/);
assert.match(audio, /EMERGENCY_SERVICE_BY_VEHICLE_ID/);
assert.match(audio, /installEmergencySirenGraph/);
assert.match(audio, /emergencySirenFrequency/);
assert.match(audio, /sirenActive = boostActive/);
assert.match(license, /Creative Commons CC0 1\.0 Universal/);

console.log('TURN emergency vehicles, lights and sirens passed.');
''')


def bump_release() -> None:
    release = {
        'version': '1.4.0',
        'id': '2026.08.03-r125',
        'cacheKey': '20260803-r125'
    }
    (TURN / 'release.json').write_text(json.dumps(release, indent=2) + '\n', encoding='utf-8')


def main() -> None:
    download_assets()
    patch_catalog()
    patch_lot()
    patch_car_models()
    patch_gameplay_audio_bridge()
    patch_audio()
    patch_tests()
    bump_release()
    print('Emergency vehicle implementation applied.')


if __name__ == '__main__':
    main()
