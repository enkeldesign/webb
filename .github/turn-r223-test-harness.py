from pathlib import Path

path = Path('turn-tests/car-visual-lifecycle-production.mjs')
source = path.read_text()

anchor = "const entry = await read('turn/index.html');\n"
insert = "const lowGraphics = process.argv.includes('--low-graphics');\nconst graphicsProfile = Object.freeze({\n  lowGraphics,\n  outlines: !lowGraphics,\n  pointLights: !lowGraphics\n});\n"
if insert not in source:
    if anchor not in source:
        raise AssertionError('car visual lifecycle entry anchor missing')
    source = source.replace(anchor, anchor + insert, 1)

binding = "  THREE, ...catalog, ...gamut, ...wheelRig, ...learner, ...supercar, ...semantic,\n"
replacement = "  THREE, graphicsProfile, ...catalog, ...gamut, ...wheelRig, ...learner, ...supercar, ...semantic,\n"
if replacement not in source:
    if binding not in source:
        raise AssertionError('car-model binding anchor missing')
    source = source.replace(binding, replacement, 1)

source = source.replace(
    "    assert.equal([...resources].filter((resource) => resource.isPointLight).length, 2,\n      'Non-mesh light resources participate in ownership');",
    "    assert.equal([...resources].filter((resource) => resource.isPointLight).length, lowGraphics ? 0 : 2,\n      lowGraphics\n        ? 'LOW GRAPHICS does not construct emergency PointLights'\n        : 'Non-mesh light resources participate in ownership');",
    1
)

outline_assertion = "  if (lowGraphics) {\n    first.traverse((node) => {\n      assert.equal(Boolean(node.userData?.turnOutline), false,\n        'LOW GRAPHICS car factories must not construct turnOutline meshes');\n    });\n  }\n"
needle = "  const resources = visualResources.get(first);\n"
if outline_assertion not in source:
    if needle not in source:
        raise AssertionError('car resource assertion anchor missing')
    source = source.replace(needle, needle + outline_assertion, 1)

path.write_text(source)
print('Adapted car lifecycle harness for normal and LOW GRAPHICS source-level profiles.')
