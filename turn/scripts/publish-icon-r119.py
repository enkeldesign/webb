from __future__ import annotations

import io
import json
from pathlib import Path

import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
TURN = ROOT / 'turn'
SOURCE = TURN / 'assets' / 'icon-source-r119.svg'
RELEASE = {
    'version': '1.24.8',
    'id': '2026.07.30-r119',
    'cacheKey': '20260730-r119',
}
YELLOW = '#FFD400'


def render(size: int) -> Image.Image:
    data = cairosvg.svg2png(url=str(SOURCE), output_width=size, output_height=size)
    return Image.open(io.BytesIO(data)).convert('RGBA')


def save_png(path: Path, size: int) -> None:
    render(size).save(path, 'PNG', optimize=True)


def save_maskable(path: Path, size: int) -> None:
    safe_size = round(size * 0.78)
    art = render(safe_size)
    canvas = Image.new('RGBA', (size, size), YELLOW)
    offset = (size - safe_size) // 2
    canvas.alpha_composite(art, (offset, offset))
    canvas.save(path, 'PNG', optimize=True)


def replace_required(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'Missing {label}: {old!r}')
    return text.replace(old, new)


def main() -> None:
    save_png(TURN / 'favicon-32-r119.png', 32)
    save_png(TURN / 'apple-touch-icon-r119.png', 180)
    save_png(TURN / 'icon-192-r119.png', 192)
    save_png(TURN / 'icon-512-r119.png', 512)
    save_maskable(TURN / 'icon-maskable-192-r119.png', 192)
    save_maskable(TURN / 'icon-maskable-512-r119.png', 512)

    ico_source = render(256)
    ico_source.save(TURN / 'favicon-r119.ico', 'ICO', sizes=[(16, 16), (32, 32), (48, 48)])

    (TURN / 'release.json').write_text(json.dumps(RELEASE, indent=2) + '\n', encoding='utf-8')

    manifest_icons = [
        {'src': '/turn/icon-192-r119.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'},
        {'src': '/turn/icon-512-r119.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'},
        {'src': '/turn/icon-maskable-192-r119.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'maskable'},
        {'src': '/turn/icon-maskable-512-r119.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
    ]
    for manifest_path in (TURN / 'site.webmanifest', ROOT / 'turn-next' / 'site.webmanifest'):
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
        manifest['background_color'] = YELLOW
        manifest['theme_color'] = YELLOW
        manifest['icons'] = manifest_icons
        manifest_path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')

    index_path = TURN / 'index.html'
    index = index_path.read_text(encoding='utf-8')
    index = replace_required(index, '<meta name="theme-color" content="#38d9ff">', f'<meta name="theme-color" content="{YELLOW}">', 'theme color')
    index = replace_required(index, './favicon-r45.ico', './favicon-r119.ico', 'favicon ICO')
    index = replace_required(index, './favicon-32-r45.png', './favicon-32-r119.png', 'favicon PNG')
    index = replace_required(index, './apple-touch-icon-r45.png', './apple-touch-icon-r119.png', 'Apple touch icon')
    index = replace_required(index, './icon-512-r45.png', './icon-512-r119.png', 'visible TURN icon')
    index_path.write_text(index, encoding='utf-8')

    test_path = ROOT / 'turn-lab' / 'tests' / 'app-icon-production.mjs'
    test = test_path.read_text(encoding='utf-8').replace('r45', 'r119')
    test = replace_required(
        test,
        "  { src: '/turn/icon-512-r119.png', sizes: '512x512', type: 'image/png', purpose: 'any' },\n  { src: '/turn/icon-maskable-512-r119.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }",
        "  { src: '/turn/icon-512-r119.png', sizes: '512x512', type: 'image/png', purpose: 'any' },\n  { src: '/turn/icon-maskable-192-r119.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },\n  { src: '/turn/icon-maskable-512-r119.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }",
        'maskable manifest expectations',
    )
    test = replace_required(
        test,
        "assert.deepEqual(readPngSize('icon-512-r119.png'), [512, 512]);\nassert.deepEqual(readPngSize('icon-maskable-512-r119.png'), [512, 512]);",
        "assert.deepEqual(readPngSize('icon-512-r119.png'), [512, 512]);\nassert.deepEqual(readPngSize('icon-maskable-192-r119.png'), [192, 192]);\nassert.deepEqual(readPngSize('icon-maskable-512-r119.png'), [512, 512]);",
        'maskable PNG size checks',
    )
    marker = "assert.match(index, new RegExp(`<link rel=\"manifest\" href=\"\\.\\/site\\.webmanifest\\?build=${release.cacheKey}\">`));"
    test = replace_required(test, marker, marker + '\nassert.match(index, /<meta name="theme-color" content="#FFD400">/);', 'theme-color regression')
    test_path.write_text(test, encoding='utf-8')


if __name__ == '__main__':
    main()
