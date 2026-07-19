#!/usr/bin/env bash
set -euo pipefail

asset_backup="$(mktemp -d)"
trap 'rm -rf "$asset_backup"' EXIT

# Preserve production-local binary assets such as app icons while replacing the runtime.
if [ -d turn ]; then
  while IFS= read -r -d '' file; do
    mkdir -p "$asset_backup/$(dirname "$file")"
    cp "$file" "$asset_backup/$file"
  done < <(find turn -type f \( \
    -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.webp' -o \
    -name '*.svg' -o -name '*.glb' -o -name '*.gltf' -o -name '*.bin' -o \
    -name '*.mp3' -o -name '*.ogg' -o -name '*.wav' \
  \) -print0)
fi

rm -rf turn
cp -R turn-lab turn

# LAB-only development and storage isolation files do not belong in production.
rm -f turn/lab-storage.js turn/package.json
rm -rf turn/tests turn/scripts

# Restore production-local binary assets over the promoted runtime.
if [ -d "$asset_backup/turn" ]; then
  cp -R "$asset_backup/turn/." turn/
fi

node --input-type=module <<'NODE'
import fs from 'node:fs';

const indexPath = 'turn/index.html';
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replaceAll('TURN LAB', 'TURN');
html = html.replace(/^\s*<script src="\.\/lab-storage\.js\?build=20260719-r7"><\/script>\s*$/m, '');
html = html.replace(
  'TURN is an independent snapshot of the working game, ready to be refactored without touching live TURN.',
  'TURN is a motion-controlled arcade drift racer. Turn your device to steer and race your own best laps.'
);
html = html.replace(
  'LAB has its own save data. Your TURN records stay untouched.',
  'Install TURN for the best fullscreen experience. You can also play in your browser.'
);
fs.writeFileSync(indexPath, html);

const manifestPath = 'turn/site.webmanifest';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
Object.assign(manifest, {
  id: '/turn/',
  name: 'TURN',
  short_name: 'TURN',
  description: 'A motion-controlled arcade drift racer where you race your own best laps.',
  start_url: '/turn/',
  scope: '/turn/'
});
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
NODE

# Production identity checks.
grep -q 'TURN v1.0.0 · Build 2026.07.19-r7' turn/index.html
if grep -q 'TURN LAB' turn/index.html; then
  echo 'Production index still contains TURN LAB identity.' >&2
  exit 1
fi
if grep -q 'lab-storage.js' turn/index.html; then
  echo 'Production index still loads LAB storage isolation.' >&2
  exit 1
fi

node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import fs from 'node:fs';
const manifest = JSON.parse(fs.readFileSync('turn/site.webmanifest', 'utf8'));
assert.equal(manifest.id, '/turn/');
assert.equal(manifest.name, 'TURN');
assert.equal(manifest.short_name, 'TURN');
assert.equal(manifest.start_url, '/turn/');
assert.equal(manifest.scope, '/turn/');
NODE

# Every promoted runtime file must remain byte-identical to verified R7 unless it is
# deliberately production-specific or development-only.
while IFS= read -r -d '' source; do
  relative="${source#turn-lab/}"
  case "$relative" in
    index.html|site.webmanifest|lab-storage.js|package.json|tests/*|scripts/*)
      continue
      ;;
  esac

  target="turn/$relative"
  if [ ! -f "$target" ]; then
    echo "Missing promoted runtime file: $target" >&2
    exit 1
  fi
  if ! cmp -s "$source" "$target"; then
    echo "Promoted runtime diverged from verified R7: $relative" >&2
    exit 1
  fi
done < <(find turn-lab -type f -print0)

echo 'TURN R7 production promotion checks passed.'
