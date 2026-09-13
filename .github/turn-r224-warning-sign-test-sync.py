from pathlib import Path

path = Path('turn-lab/tests/multi-track-production.mjs')
source = path.read_text()
old = "assert.match(registry, /mountain-world-long\\.js\\?revision=mountain-long-r1/);"
new = "assert.match(registry, /mountain-world-long\\.js\\?build=20260913-r224/);"
if old not in source:
    raise SystemExit('Expected legacy MOUNTAIN registry assertion not found')
path.write_text(source.replace(old, new, 1))
