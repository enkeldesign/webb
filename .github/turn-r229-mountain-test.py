from pathlib import Path

p = Path('turn-tests/mountain-track-production.mjs')
s = p.read_text()
anchor = "const [\n  definitions,\n"
if anchor not in s:
    raise SystemExit('release insertion anchor not found')
if "const release = JSON.parse(await fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'));" not in s:
    s = s.replace(
        anchor,
        "const release = JSON.parse(await fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'));\n\n" + anchor,
        1
    )
old = """assert.match(registry, /mountain-world-long\\.js\\?build=20260914-r228/);
assert.match(longWorld, /mountain-world-r3\\.js\\?build=20260914-r228/);
"""
new = """assert.match(registry, new RegExp(`mountain-world-long\\\\.js\\\\?build=${release.cacheKey}`));
assert.match(longWorld, new RegExp(`mountain-world-r3\\\\.js\\\\?build=${release.cacheKey}`));
"""
if old not in s:
    raise SystemExit('stale MOUNTAIN release assertions not found')
s = s.replace(old, new, 1)
p.write_text(s)
