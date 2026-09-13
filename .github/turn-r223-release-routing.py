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

shared_start = source.index('function renderSharedResourceImports(source, release) {')
shared_end = source.index('\n}\n', shared_start)
shared = source[shared_start:shared_end]
if 'synchronizeLowGraphicsProducerTargets(importMap, release);' not in shared:
    anchor = '    synchronizeGraphicsRuntimeTarget(importMap, release);\n'
    if anchor not in shared:
        raise AssertionError('shared-resource graphics synchronizer anchor missing')
    shared = shared.replace(
        anchor,
        anchor + '    synchronizeLowGraphicsProducerTargets(importMap, release);\n',
        1
    )
    source = source[:shared_start] + shared + source[shared_end:]

runtime_start = source.index('function synchronizeRuntimeReleaseBoundSpecifiers(importMap, release) {')
runtime_end = source.index('\n}\n\nexport function renderReleaseIndex', runtime_start)
runtime = source[runtime_start:runtime_end]
if 'synchronizeLowGraphicsProducerTargets(importMap, release);' not in runtime:
    anchor = '  synchronizeGraphicsRuntimeTarget(importMap, release);\n'
    if anchor not in runtime:
        raise AssertionError('production release graphics synchronizer anchor missing')
    runtime = runtime.replace(
        anchor,
        anchor + '  synchronizeLowGraphicsProducerTargets(importMap, release);\n',
        1
    )
    source = source[:runtime_start] + runtime + source[runtime_end:]

path.write_text(source)
print('Added release-bound routing for changed LOW GRAPHICS contour producers.')
