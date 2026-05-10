#!/usr/bin/env sh
set -eu

python3 - <<'PY'
from pathlib import Path
import shutil

root = Path(".")
dist = root / "dist"

if dist.exists():
    shutil.rmtree(dist)

(dist / "assets").mkdir(parents=True)

for filename in ["index.html", "style.css", "script.js", "_headers"]:
    shutil.copy2(root / filename, dist / filename)

asset_files = [
    "culligan-banner.png",
    "culligan-table-texture.png",
    "exit.png",
    "help.png",
    "settings.png",
    "shuffle.png",
    "tile-bounds.js",
]

for filename in asset_files:
    shutil.copy2(root / "assets" / filename, dist / "assets" / filename)

for folder in ["tile-labels", "tile-segments", "tiles", "tokens"]:
    shutil.copytree(root / "assets" / folder, dist / "assets" / folder)

unused_segment = dist / "assets" / "tile-segments" / "preview-from-scan.png"
if unused_segment.exists():
    unused_segment.unlink()

print("Built dist/")
PY

