#!/usr/bin/env bash
set -euo pipefail

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

CAR_URL='https://kenney.nl/media/pages/assets/car-kit/1a312ec241-1775131960/kenney_car-kit.zip'
TOY_URL='https://kenney.nl/media/pages/assets/toy-car-kit/42e19cc426-1736346027/kenney_toy-car-kit.zip'
BRICK_URL='https://kenney.nl/media/pages/assets/brick-kit/46a22f3d08-1716981002/kenney_brick-kit.zip'

mkdir -p "$work/car" "$work/toy" "$work/brick"

curl -L --fail --retry 4 --retry-delay 2 "$CAR_URL" -o "$work/car.zip"
curl -L --fail --retry 4 --retry-delay 2 "$TOY_URL" -o "$work/toy.zip"
curl -L --fail --retry 4 --retry-delay 2 "$BRICK_URL" -o "$work/brick.zip"

unzip -q "$work/car.zip" -d "$work/car"
unzip -q "$work/toy.zip" -d "$work/toy"
unzip -q "$work/brick.zip" -d "$work/brick"

{
  echo '=== CAR KIT GLB INVENTORY ==='
  find "$work/car" -type f -iname '*.glb' -printf '%f\n' | sort -u
  echo
  echo '=== TOY CAR KIT GLB INVENTORY ==='
  find "$work/toy" -type f -iname '*.glb' -printf '%f\n' | sort -u
  echo
  echo '=== BRICK KIT GLB SAMPLE ==='
  find "$work/brick" -type f -iname '*.glb' -printf '%f\n' | sort -u | head -120
} > turn-garage-inventory.txt

rm -rf turn/assets/cars turn/assets/lot-bricks
mkdir -p turn/assets/cars turn/assets/lot-bricks

python3 - "$work" <<'PY'
from __future__ import annotations

import re
import shutil
import sys
from pathlib import Path

work = Path(sys.argv[1])
out_cars = Path('turn/assets/cars')
out_bricks = Path('turn/assets/lot-bricks')


def norm(value: str) -> str:
    return re.sub(r'[^a-z0-9]+', '', value.lower())


def glbs(root: Path):
    return [p for p in root.rglob('*') if p.is_file() and p.suffix.lower() == '.glb']


def find_exact(root: Path, wanted: str) -> Path:
    matches = [p for p in glbs(root) if norm(p.stem) == wanted]
    if not matches:
        raise SystemExit(f'Could not find GLB normalized as {wanted!r} under {root}. See turn-garage-inventory.txt.')
    matches.sort(key=lambda p: (0 if 'glb' in norm(str(p.parent)) else 1, len(str(p))))
    return matches[0]

cars = [
    ('convertible', work / 'toy', 'vehicleconvertible'),
    ('classic', work / 'toy', 'vehicle'),
    ('vintage-racer', work / 'toy', 'vehiclevintageracer'),
    ('toy-racer', work / 'toy', 'vehicleracer'),
    ('monster-truck', work / 'toy', 'vehiclemonstertruck'),
    ('race-future', work / 'car', 'racefuture'),
    ('race', work / 'car', 'race'),
    ('sedan-sports', work / 'car', 'sedansports'),
    ('sedan', work / 'car', 'sedan'),
    ('suv', work / 'car', 'suv'),
    ('suv-luxury', work / 'car', 'suvluxury'),
    ('hatchback-sports', work / 'car', 'hatchbacksports'),
    ('truck-flat', work / 'car', 'truckflat'),
    ('truck', work / 'car', 'truck'),
    ('van', work / 'car', 'van'),
]

for dest, root, wanted in cars:
    source = find_exact(root, wanted)
    target = out_cars / f'{dest}.glb'
    shutil.copy2(source, target)
    print(f'car {dest}: {source.relative_to(root)} -> {target}')

brick_files = glbs(work / 'brick')
brick_files.sort(key=lambda p: (p.stat().st_size, str(p).lower()))
if len(brick_files) < 8:
    raise SystemExit(f'Expected at least 8 Brick Kit GLBs, found {len(brick_files)}')

pool = brick_files[: max(16, len(brick_files) // 2)]
indices = [0, len(pool)//9, len(pool)*2//9, len(pool)*3//9, len(pool)*4//9,
           len(pool)*5//9, len(pool)*6//9, len(pool)*7//9, len(pool)*8//9]
seen = set()
selected = []
for index in indices:
    candidate = pool[min(index, len(pool)-1)]
    if candidate not in seen:
        seen.add(candidate)
        selected.append(candidate)
for candidate in pool:
    if len(selected) >= 9:
        break
    if candidate not in seen:
        seen.add(candidate)
        selected.append(candidate)

for i, source in enumerate(selected[:9], 1):
    target = out_bricks / f'brick-prop-{i:02d}.glb'
    shutil.copy2(source, target)
    print(f'brick {i:02d}: {source.relative_to(work / "brick")} -> {target}')

Path('turn/assets/KENNEY-ASSETS.md').write_text(
    '# TURN vendored Kenney assets\n\n'
    'The vehicle models in `cars/` are selected from Kenney Car Kit 3.1 and Toy Car Kit 1.2.\n'
    'The scenery pieces in `lot-bricks/` are selected from Kenney Brick Kit 1.0.\n\n'
    'All three packs are released under Creative Commons CC0 1.0. Attribution is not required.\n'
    'Original source: https://kenney.nl/assets\n',
    encoding='utf-8',
)
PY

printf '\nVendored TURN garage assets:\n'
find turn/assets/cars turn/assets/lot-bricks -maxdepth 1 -type f -printf '%p %k KB\n' | sort
