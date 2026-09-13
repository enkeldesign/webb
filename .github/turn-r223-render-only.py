from pathlib import Path
import json
import re

ROOT = Path('.')
BUILD = '20260913-r223'
RELEASE_ID = '2026.09.13-r223'
VERSION = '1.19.9'


def read(path):
    return (ROOT / path).read_text()


def write(path, source):
    (ROOT / path).write_text(source)


def replace_once(path, old, new):
    source = read(path)
    if new in source:
        return
    if old not in source:
        raise AssertionError(f'{path}: expected source fragment not found: {old[:100]!r}')
    write(path, source.replace(old, new, 1))


def ensure_graphics_import(path):
    source = read(path)
    line = "import { graphicsProfile } from '/turn/graphics-profile.js';"
    if line in source:
        return
    anchor = "import * as THREE from 'three';"
    if anchor not in source:
        raise AssertionError(f'{path}: Three import missing')
    write(path, source.replace(anchor, anchor + '\n' + line, 1))


def function_open(source, function_name):
    start = source.find(f'function {function_name}(')
    if start < 0:
        raise AssertionError(f'function {function_name} not found')
    paren = source.find('(', start)
    depth = 0
    quote = None
    escape = False
    for index in range(paren, len(source)):
        ch = source[index]
        if quote:
            if escape:
                escape = False
            elif ch == '\\':
                escape = True
            elif ch == quote:
                quote = None
            continue
        if ch in "'\"`":
            quote = ch
            continue
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
            if depth == 0:
                brace = source.find('{', index)
                if brace < 0:
                    raise AssertionError(f'function {function_name}: opening brace missing')
                return brace + 1
    raise AssertionError(f'function {function_name}: unterminated signature')


def inject_function(path, function_name, insertion, marker=None):
    source = read(path)
    marker = marker or insertion.strip().splitlines()[0]
    start = source.find(f'function {function_name}(')
    if start < 0:
        raise AssertionError(f'{path}: function {function_name} missing')
    if marker in source[start:start + 1400]:
        return
    position = function_open(source, function_name)
    write(path, source[:position] + '\n' + insertion.rstrip() + source[position:])


def add_build_to_script(path, module_path):
    source = read(path)
    pattern = re.compile(rf'(src="\./{re.escape(module_path)}\?[^\"]*)(")')
    match = pattern.search(source)
    if not match:
        return
    if 'build=' in match.group(1):
        updated = re.sub(r'build=\d{8}-r\d+', f'build={BUILD}', match.group(1))
    else:
        updated = match.group(1) + f'&build={BUILD}'
    write(path, source[:match.start()] + updated + match.group(2) + source[match.end():])


# Release metadata.
write('turn/release.json', json.dumps({
    'version': VERSION,
    'id': RELEASE_ID,
    'cacheKey': BUILD
}, indent=2) + '\n')

# LOW GRAPHICS is render-cost only. World content remains exactly the normal profile.
replace_once(
    'turn/ui/low-graphics-setting.js',
    'Uses lower resolution, no shadows, fewer real lights and no outline draw calls. Antialiasing and full track scenery stay on. Restart TURN to apply changes.',
    'Uses lower resolution, no shadows, no contours and cheaper lighting. Antialiasing and all track scenery stay unchanged. Restart TURN to apply changes.'
)

# Contours must be prevented at their producers, not created and hidden afterwards.
producer_imports = [
    'turn/main.js',
    'turn/world-art-pass.js',
    'turn/track-identity.js',
    'turn/vehicle/car-models.js',
    'turn/tracks/airport-world.js',
    'turn/tracks/airport-world-r50.js',
    'turn/tracks/airport-world-r53.js',
    'turn/tracks/cliffside-world.js',
    'turn/tracks/countryside-bella-r166.js',
    'turn/tracks/airport-emergency-r493.js',
    'turn/tracks/kenney-track-landmarks-r517.js',
    'turn/tracks/countryside-world-r531.js',
    'turn/tracks/start-area-polish-r519.js'
]
for path in producer_imports:
    ensure_graphics_import(path)

inject_function('turn/main.js', 'outlinedMesh', '''  if (!graphicsProfile.outlines) {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return group;
  }''', 'if (!graphicsProfile.outlines)')

for path in ['turn/tracks/airport-world.js', 'turn/tracks/airport-world-r50.js']:
    inject_function(path, 'outlinedMesh', '''  if (!graphicsProfile.outlines) {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(geometry, meshMaterial);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    group.add(mesh);
    return group;
  }''', 'if (!graphicsProfile.outlines)')

inject_function('turn/tracks/cliffside-world.js', 'outlinedBox', '''  if (!graphicsProfile.outlines) {
    const group = new THREE.Group();
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geometry, meshMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return group;
  }''', 'if (!graphicsProfile.outlines)')

for path, name, material_name, surface_name in [
    ('turn/tracks/countryside-bella-r166.js', 'outlinedPrimitive', 'fillMaterial', 'fill'),
    ('turn/tracks/airport-emergency-r493.js', 'outlinedPrimitive', 'fillMaterial', 'fill'),
    ('turn/tracks/kenney-track-landmarks-r517.js', 'outlinedPrimitive', 'surfaceMaterial', 'surface')
]:
    inject_function(path, name, f'''  if (!graphicsProfile.outlines) {{
    const root = new THREE.Group();
    const {surface_name} = new THREE.Mesh(geometry, {material_name});
    {surface_name}.castShadow = true;
    {surface_name}.receiveShadow = true;
    {surface_name}.userData.turnOutlined = true;
    root.add({surface_name});
    return root;
  }}''', 'if (!graphicsProfile.outlines)')

for path, function_name, result in [
    ('turn/vehicle/car-models.js', 'addOutlines', 'return;'),
    ('turn/tracks/kenney-track-landmarks-r517.js', 'addInkOutline', 'return;'),
    ('turn/tracks/countryside-world-r531.js', 'addInkOutline', 'return;'),
    ('turn/tracks/start-area-polish-r519.js', 'addInkContour', 'return false;'),
    ('turn/world-art-pass.js', 'addContour', 'return;'),
    ('turn/world-art-pass.js', 'contourObject', 'return;'),
    ('turn/world-art-pass.js', 'applyWorldContours', 'return;'),
    ('turn/world-art-pass.js', 'addRoadOuterContour', 'return;'),
    ('turn/track-identity.js', 'thinContours', 'return;')
]:
    inject_function(path, function_name, f'  if (!graphicsProfile.outlines) {result}', 'if (!graphicsProfile.outlines)')

# Imported aircraft outlines are also constructed explicitly.
replace_once(
    'turn/tracks/airport-world-r53.js',
    '  if (outline) {\n    for (const mesh of meshes) {',
    '  if (outline && graphicsProfile.outlines) {\n    for (const mesh of meshes) {'
)

# The art pass still installs every normal world feature. Only its contour geometry is skipped.
art = read('turn/world-art-pass.js')
art = re.sub(
    r"const OUTLINE_MATERIAL = new THREE\.MeshBasicMaterial\((\{[\s\S]*?\})\);",
    r"const OUTLINE_MATERIAL = graphicsProfile.outlines\n  ? new THREE.MeshBasicMaterial(\1)\n  : null;",
    art,
    count=1
)
if 'const OUTLINE_MATERIAL = graphicsProfile.outlines' not in art:
    raise AssertionError('turn/world-art-pass.js: outline material was not made conditional')
art = art.replace(
    '  const blackMaterial = new THREE.MeshBasicMaterial({ color: INK, side: THREE.DoubleSide });',
    '  const blackMaterial = graphicsProfile.outlines\n    ? new THREE.MeshBasicMaterial({ color: INK, side: THREE.DoubleSide })\n    : null;',
    1
)
art = art.replace(
    '  world.add(makeRibbon(blackOuter, shoreOuter, 0.038, blackMaterial));',
    '  if (graphicsProfile.outlines) world.add(makeRibbon(blackOuter, shoreOuter, 0.038, blackMaterial));',
    1
)
art = art.replace(
    '  world.add(makeRibbon(shoreInner, waterOuter, 0.047, blackMaterial));',
    '  if (graphicsProfile.outlines) world.add(makeRibbon(shoreInner, waterOuter, 0.047, blackMaterial));',
    1
)
art = art.replace(
    "  const black = makeShape(ellipse(20, 13), new THREE.MeshBasicMaterial({ color: INK, side: THREE.DoubleSide }), 0.058);",
    "  const black = graphicsProfile.outlines\n    ? makeShape(ellipse(20, 13), new THREE.MeshBasicMaterial({ color: INK, side: THREE.DoubleSide }), 0.058)\n    : null;",
    1
)
art = art.replace(
    '  world.add(black, sand, grass);',
    '  if (black) world.add(black);\n  world.add(sand, grass);',
    1
)
art = art.replace(
    '  addDistantMountains(world, samples);\n\n  applyWorldContours(world);',
    "  addDistantMountains(world, samples);\n\n  if (!graphicsProfile.outlines) {\n    console.info('TURN: bold surroundings art pass loaded without contour construction.');\n    return;\n  }\n\n  applyWorldContours(world);",
    1
)
write('turn/world-art-pass.js', art)

# Keep LOW GRAPHICS lighting cheap before scene insertion. Visible emissive/halo geometry is unchanged.
car_models = read('turn/vehicle/car-models.js')
old_light = '''    const pointLight = ownResource(new THREE.PointLight(0xffffff, 0, lightDistance, 2));
    setThreeColor(pointLight.color, colorSpec);
    pointLight.position.copy(lamp.position);
    pointLight.position.y += lampHeight * 1.2;
    pointLight.castShadow = false;

    root.add(pointLight, wideHalo, halo, lamp);'''
new_light = '''    let pointLight = null;
    if (graphicsProfile.pointLights) {
      pointLight = ownResource(new THREE.PointLight(0xffffff, 0, lightDistance, 2));
      setThreeColor(pointLight.color, colorSpec);
      pointLight.position.copy(lamp.position);
      pointLight.position.y += lampHeight * 1.2;
      pointLight.castShadow = false;
      root.add(pointLight);
    }

    root.add(wideHalo, halo, lamp);'''
if old_light not in car_models and new_light not in car_models:
    raise AssertionError('turn/vehicle/car-models.js: emergency point-light block missing')
car_models = car_models.replace(old_light, new_light, 1)
car_models = car_models.replace(
    '    record.pointLight.intensity = active && on ? (rig.reducedMotion ? 70 : 110) : 0;',
    '    if (record.pointLight) record.pointLight.intensity = active && on ? (rig.reducedMotion ? 70 : 110) : 0;',
    1
)
write('turn/vehicle/car-models.js', car_models)

# The Three wrapper now handles only renderer cost and lighting. It never creates/hides/removes contours.
write('turn/three-runtime.js', '''import * as NativeThree from 'three-native';
import { graphicsProfile, graphicsPixelRatio } from '/turn/graphics-profile.js';

export * from 'three-native';

export class PointLight extends NativeThree.PointLight {
  constructor(...args) {
    super(...args);
    if (graphicsProfile.lowGraphics) {
      // Disable real point-light illumination before the light can enter a scene.
      // Visible lamp meshes, emissive materials and halos remain untouched.
      this.visible = false;
      this.intensity = 0;
      this.userData.turnLowGraphicsDisabledLight = true;
    }
  }
}

export class WebGLRenderer extends NativeThree.WebGLRenderer {
  constructor(parameters = {}) {
    const rendererParameters = graphicsProfile.lowGraphics
      ? { ...parameters, antialias: true }
      : parameters;
    super(rendererParameters);

    if (!graphicsProfile.lowGraphics) return;

    const nativeSetPixelRatio = this.setPixelRatio.bind(this);
    this.setPixelRatio = (value) => nativeSetPixelRatio(graphicsPixelRatio(value));
    this.setPixelRatio(globalThis.devicePixelRatio || 1);

    this.shadowMap.enabled = false;
    try {
      Object.defineProperty(this.shadowMap, 'enabled', {
        configurable: true,
        enumerable: true,
        get: () => false,
        set: () => false
      });
    } catch (_) {}
  }
}
''')

# Make direct module entry identities release-bound once; the release generator will advance existing build values later.
for module in [
    'tracks/kenney-track-landmarks-r517.js',
    'tracks/start-area-polish-r519.js'
]:
    add_build_to_script('turn/index.html', module)

# Release-facing history: r223 defines LOW GRAPHICS as a render-cost profile only.
history = read('turn/content/about-history-current.js')
if 'LOW_GRAPHICS_RENDER_ONLY_HISTORY' not in history:
    block = '''const LOW_GRAPHICS_RENDER_ONLY_HISTORY = Object.freeze({
  period: '13 September',
  title: 'LOW GRAPHICS changes rendering, not the world',
  paragraphs: Object.freeze([
    'TURN 1.19.9 makes LOW GRAPHICS a rendering-cost profile only. The same track scenery, world-beauty and art passes run in both graphics modes; antialiasing also remains enabled.',
    'The low profile keeps DPR capped at 1.0, disables shadow rendering, avoids constructing TURN contour meshes at their producers, and reduces real point-light illumination while leaving visible lamps, emissive surfaces and halos intact.'
  ]),
  milestones: Object.freeze([
    'World content identical between normal and LOW GRAPHICS',
    'Contours skipped before mesh construction instead of hidden afterwards',
    'TURN 1.19.9 · 2026.09.13-r223'
  ])
});

'''
    history = history.replace('const previousLatest = BASE_CHANGELOG.at(-1);', block + 'const previousLatest = BASE_CHANGELOG.at(-1);', 1)
    history = history.replace('  LOW_GRAPHICS_TUNING_HISTORY\n]);', '  LOW_GRAPHICS_TUNING_HISTORY,\n  LOW_GRAPHICS_RENDER_ONLY_HISTORY\n]);', 1)
    history = history.replace(
        "      Object.freeze(['Tuned low profile', 'Retains DPR 1.0, disabled shadows, fewer real lights and suppressed outline draw calls while restoring those visual-quality features.'])",
        "      Object.freeze(['Tuned low profile', 'Retains DPR 1.0, disabled shadows, fewer real lights and suppressed outline draw calls while restoring those visual-quality features.']),\n      Object.freeze(['1.19.9 r223', 'Defines LOW GRAPHICS as rendering-only: identical world content, DPR 1.0, no shadows, no constructed TURN contours and cheaper real lighting.']),\n      Object.freeze(['No post-hoc contour removal', 'Contour producers now skip their outline meshes before allocation; the shared Three runtime no longer traverses the scene to hide them.'])",
        1
    )
history = re.sub(
    r"export const CURRENT_RELEASE = Object\.freeze\(\{[\s\S]*?\}\);",
    "export const CURRENT_RELEASE = Object.freeze({\n  version: '1.19.9',\n  build: '2026.09.13-r223',\n  note: 'TURN 1.19.9 makes LOW GRAPHICS a rendering-only performance profile.'\n});",
    history,
    count=1
)
write('turn/content/about-history-current.js', history)

# Browser smoke now checks renderer/lighting behavior. Contour construction is enforced statically at producers.
browser = read('turn-tests/low-graphics-browser-smoke.mjs')
start = browser.find('    const light = new THREE.PointLight')
end = browser.find('    const output = {', start)
if start < 0 or end < 0:
    raise AssertionError('low-graphics-browser-smoke: setup block missing')
browser = browser[:start] + "    const light = new THREE.PointLight(0xffffff, 4, 20, 2);\n\n" + browser[end:]
browser = browser.replace(
    '      pointLightIntensity: light.intensity,\n      taggedOutlineVisible: taggedOutline.visible,\n      legacyOutlineVisible: legacyOutline.visible',
    '      pointLightIntensity: light.intensity'
)
browser = browser.replace("  assert.equal(result.taggedOutlineVisible, false, `${browserType.name()} suppresses tagged TURN outline draw calls.`);\n", '')
browser = browser.replace("  assert.equal(result.legacyOutlineVisible, false, `${browserType.name()} suppresses legacy black back-face outline draw calls.`);\n", '')
write('turn-tests/low-graphics-browser-smoke.mjs', browser)

# Expand the production contract so future work cannot reintroduce create-then-hide contours.
test = read('turn-tests/low-graphics-production.mjs')
test = test.replace("assert.equal(release.version, '1.19.8');", "assert.equal(release.version, '1.19.9');")
test = test.replace("assert.equal(release.id, '2026.09.13-r222');", "assert.equal(release.id, '2026.09.13-r223');")
test = test.replace("assert.equal(release.cacheKey, '20260913-r222');", "assert.equal(release.cacheKey, '20260913-r223');")
test = test.replace('build=20260913-r222', 'build=20260913-r223')
old_runtime_assertions = '''assert.match(runtimeSource, /function isTurnOutline\\(node\\)/);
assert.match(runtimeSource, /node\\.userData\\?\\.turnOutline/);
assert.match(runtimeSource, /node\\.userData\\?\\.turnStartBannerContour/);
assert.match(runtimeSource, /candidate\\?\\.side === NativeThree\\.BackSide/);
assert.match(runtimeSource, /candidate\\?\\.color\\?\\.getHex\\?\\.\\(\\) === TURN_INK/);
assert.match(runtimeSource, /node\\.visible = false/);'''
new_runtime_assertions = '''assert.doesNotMatch(runtimeSource, /turnLowGraphicsHiddenOutline|isTurnOutline|Object3D\\.prototype\\.add|queueMicrotask/,
  'LOW GRAPHICS must not create contours and then hide/remove them in the shared Three runtime.');
assert.match(runtimeSource, /class PointLight extends NativeThree\\.PointLight/);
assert.match(runtimeSource, /this\\.visible = false/);
assert.match(runtimeSource, /this\\.intensity = 0/);'''
if old_runtime_assertions not in test:
    raise AssertionError('low-graphics-production: old runtime assertions missing')
test = test.replace(old_runtime_assertions, new_runtime_assertions, 1)
# Extend file reads with source producers.
test = test.replace(
    '  worldSource\n] = await Promise.all([',
    '  worldSource,\n  artPassSource,\n  carModelsSource,\n  mainSource,\n  landmarksSource,\n  countrysideSource,\n  bellaSource,\n  airportWorldSource,\n  airportAircraftSource,\n  airportEmergencySource,\n  cliffsideSource,\n  startAreaSource\n] = await Promise.all(['
)
test = test.replace(
    "  fs.readFile(new URL('../turn/render/world.js', import.meta.url), 'utf8')\n]);",
    "  fs.readFile(new URL('../turn/render/world.js', import.meta.url), 'utf8'),\n  fs.readFile(new URL('../turn/world-art-pass.js', import.meta.url), 'utf8'),\n  fs.readFile(new URL('../turn/vehicle/car-models.js', import.meta.url), 'utf8'),\n  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8'),\n  fs.readFile(new URL('../turn/tracks/kenney-track-landmarks-r517.js', import.meta.url), 'utf8'),\n  fs.readFile(new URL('../turn/tracks/countryside-world-r531.js', import.meta.url), 'utf8'),\n  fs.readFile(new URL('../turn/tracks/countryside-bella-r166.js', import.meta.url), 'utf8'),\n  fs.readFile(new URL('../turn/tracks/airport-world-r50.js', import.meta.url), 'utf8'),\n  fs.readFile(new URL('../turn/tracks/airport-world-r53.js', import.meta.url), 'utf8'),\n  fs.readFile(new URL('../turn/tracks/airport-emergency-r493.js', import.meta.url), 'utf8'),\n  fs.readFile(new URL('../turn/tracks/cliffside-world.js', import.meta.url), 'utf8'),\n  fs.readFile(new URL('../turn/tracks/start-area-polish-r519.js', import.meta.url), 'utf8')\n]);"
)
contract = '''

const producerContracts = [
  [mainSource, 'main outlinedMesh'],
  [carModelsSource, 'car outlines'],
  [landmarksSource, 'landmark outlines'],
  [countrysideSource, 'Countryside authored outlines'],
  [bellaSource, 'Bella primitive outlines'],
  [airportWorldSource, 'Airport primitive outlines'],
  [airportAircraftSource, 'Airport aircraft outlines'],
  [airportEmergencySource, 'Airport emergency outlines'],
  [cliffsideSource, 'Cliffside outlines'],
  [startAreaSource, 'start-area contours']
];
for (const [source, label] of producerContracts) {
  assert.match(source, /graphicsProfile\\.outlines/,
    `${label} must check the shared graphics profile before constructing contour meshes.`);
}
assert.match(artPassSource, /if \\(!graphicsProfile\\.outlines\\) return;/,
  'The art pass contour helpers must return before contour construction in LOW GRAPHICS.');
assert.match(artPassSource, /const OUTLINE_MATERIAL = graphicsProfile\\.outlines/,
  'The art pass must not allocate its outline material in LOW GRAPHICS.');
assert.match(artPassSource, /bold surroundings art pass loaded without contour construction/,
  'The full art pass remains installed while late contour sweeps are skipped.');
assert.doesNotMatch(runtimeSource, /turnOutline|TURN_INK|BackSide/,
  'The shared runtime must not be responsible for post-hoc contour suppression.');
'''
test = test.replace("\nconsole.log('LOW GRAPHICS production contract passed.');", contract + "\nconsole.log('LOW GRAPHICS production contract passed.');", 1)
write('turn-tests/low-graphics-production.mjs', test)

# Ensure the visual workflow notices producer/test changes.
workflow = read('.github/workflows/turn-supercar-lot-visual-smoke.yml')
for entry in [
    "      - 'turn/world-art-pass.js'\n",
    "      - 'turn/vehicle/car-models.js'\n",
    "      - 'turn/tracks/kenney-track-landmarks-r517.js'\n",
    "      - 'turn/tracks/countryside-world-r531.js'\n"
]:
    if entry not in workflow:
        workflow = workflow.replace("      - 'turn/render/world.js'\n", "      - 'turn/render/world.js'\n" + entry, 1)
write('.github/workflows/turn-supercar-lot-visual-smoke.yml', workflow)

print('Applied TURN 1.19.9 / r223 LOW GRAPHICS rendering-only profile.')
