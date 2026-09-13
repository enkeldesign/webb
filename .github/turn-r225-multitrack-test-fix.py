from pathlib import Path

path = Path('turn-lab/tests/multi-track-production.mjs')
text = path.read_text()
old = "assert.match(registry, /mountain-world-long\\.js\\?build=20260913-r224/);"
new = "assert.match(registry, /mountain-world-long\\.js\\?build=20260913-r225/);"
if old not in text:
    raise SystemExit('stale r224 MOUNTAIN registry assertion not found')
path.write_text(text.replace(old, new, 1))
