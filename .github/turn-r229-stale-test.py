from pathlib import Path

p = Path('turn-lab/tests/multi-track-production.mjs')
s = p.read_text()
old = "assert.match(registry, /mountain-world-long\\.js\\?build=20260914-r228/);"
new = "assert.match(registry, new RegExp(`mountain-world-long\\\\.js\\\\?build=${release.cacheKey}`));"
if old not in s:
    raise SystemExit('stale MOUNTAIN build assertion anchor not found')
insert = "const release = JSON.parse(await fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'));\n\n"
anchor = "const [\n  definitions,\n"
if anchor not in s:
    raise SystemExit('release insertion anchor not found')
s = s.replace(anchor, insert + anchor, 1)
s = s.replace(old, new, 1)
p.write_text(s)
