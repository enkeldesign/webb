from pathlib import Path

path = Path('turn/scripts/release.mjs')
source = path.read_text()

function_source = '''function synchronizeLowGraphicsProducerTargets(importMap, release) {
  const imports = importMap.imports ||= {};
  const legacySpecifiers = [
    '/turn/tracks/airport-emergency-r493.js?revision=r527-no-finish-sync-wreck',
    '/turn/tracks/airport-world-r50.js?build=20260722-r50',
    '/turn/tracks/airport-world-r53.js?build=20260814-r57',
    '/turn/tracks/cliffside-world.js?base=20260725-r72',
    '/turn/tracks/countryside-world-r531.js?revision=r532-countryside-nature-polish',
    '/turn/tracks/start-area-polish-r519.js?revision=r519-midnight-full-width-accents'
  ];
  const changedPaths = new Set(legacySpecifiers.map((specifier) =>
    new URL(specifier, 'https://enkel.design').pathname
  ));

  // Preserve existing legacy import specifiers for compatibility, but route every
  // active contour producer through the current release build. This avoids inventing
  // another hand-maintained revision namespace while guaranteeing fresh source code.
  for (const specifier of legacySpecifiers) {
    const pathname = new URL(specifier, 'https://enkel.design').pathname;
    imports[specifier] = `${pathname}?build=${release.cacheKey}`;
  }

  for (const [specifier, target] of Object.entries(imports)) {
    if (typeof target !== 'string') continue;
    const url = new URL(target, 'https://enkel.design/turn/');
    if (!changedPaths.has(url.pathname)) continue;
    imports[specifier] = `${url.pathname}?build=${release.cacheKey}`;
  }
}

'''

if 'function synchronizeLowGraphicsProducerTargets' not in source:
    marker = 'function renderSharedResourceImports(source, release) {'
    if marker not in source:
        raise AssertionError('release shared import renderer anchor missing')
    source = source.replace(marker, function_source + marker, 1)

for anchor in [
    '    synchronizeGraphicsRuntimeTarget(importMap, release);\n',
    '  synchronizeGraphicsRuntimeTarget(importMap, release);\n'
]:
    replacement = anchor + anchor[:len(anchor) - len(anchor.lstrip())] + 'synchronizeLowGraphicsProducerTargets(importMap, release);\n'
    if replacement not in source:
        if anchor not in source:
            raise AssertionError(f'release synchronizer call anchor missing: {anchor!r}')
        source = source.replace(anchor, replacement, 1)

path.write_text(source)
print('Added release-bound routing for changed LOW GRAPHICS contour producers.')
