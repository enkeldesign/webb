from pathlib import Path

path = Path('turn/scripts/release.mjs')
source = path.read_text()
old = '''    .replace(/((?:href|src)="\\.\\/[^"?]+\\?build=)\\d{8}-r\\d+/g, `$1${release.cacheKey}`);'''
new = '''    .replace(/((?:href|src)="\\.\\/[^"?]+\\?build=)\\d{8}-r\\d+/g, `$1${release.cacheKey}`)
    .replace(
      /(src="\\.\\/tracks\\/kenney-track-landmarks-r517\\.js\\?revision=r532-countryside-nature-polish)(?:&build=\\d{8}-r\\d+)?"/,
      `$1&build=${release.cacheKey}"`
    );'''
if old not in source:
    raise SystemExit('Production release-index build replacement anchor not found')
path.write_text(source.replace(old, new, 1))
