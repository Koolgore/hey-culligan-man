#!/usr/bin/env sh
set -eu

# ── 1. Copy files into dist/ ─────────────────────────────────────────────────
python3 - <<'PY'
from pathlib import Path
import shutil

root = Path(".")
dist = root / "dist"

if dist.exists():
    shutil.rmtree(dist)

(dist / "assets").mkdir(parents=True)

# HTML is tiny — just copy it
shutil.copy2(root / "index.html", dist / "index.html")
shutil.copy2(root / "_headers",   dist / "_headers")

# JS + CSS are minified below; copy originals as placeholders for now
shutil.copy2(root / "script.js", dist / "script.js")
shutil.copy2(root / "style.css", dist / "style.css")

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
    src = root / "assets" / folder
    if src.exists():
        shutil.copytree(src, dist / "assets" / folder)

unused_segment = dist / "assets" / "tile-segments" / "preview-from-scan.png"
if unused_segment.exists():
    unused_segment.unlink()

print("Copied source files → dist/")
PY

# ── 2. Minify JS ─────────────────────────────────────────────────────────────
echo "Minifying JS..."
npx terser dist/script.js \
  --compress \
  --mangle \
  --output dist/script.js

# ── 3. Minify CSS ────────────────────────────────────────────────────────────
echo "Minifying CSS..."
npx lightningcss-cli \
  --minify \
  --bundle \
  dist/style.css \
  --output-file dist/style.css

# ── 4. Optimise PNGs ─────────────────────────────────────────────────────────
echo "Optimising PNGs..."
pip3 install --quiet pillow
python3 - <<'PY'
from pathlib import Path
from PIL import Image
import io

dist = Path("dist")
pngs = list(dist.rglob("*.png"))
saved_total = 0

for path in pngs:
    original_size = path.stat().st_size
    img = Image.open(path)
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    optimized = buf.getvalue()
    if len(optimized) < original_size:
        path.write_bytes(optimized)
        saved = original_size - len(optimized)
        saved_total += saved

print(f"PNG savings: {saved_total / 1024:.0f} KB across {len(pngs)} files")
PY

# ── 5. Print size summary ─────────────────────────────────────────────────────
echo ""
echo "=== dist/ sizes ==="
du -sh dist/
echo ""
python3 - <<'PY'
from pathlib import Path
dist = Path("dist")
js  = (dist / "script.js").stat().st_size
css = (dist / "style.css").stat().st_size
print(f"  script.js  {js/1024:>7.1f} KB")
print(f"  style.css  {css/1024:>7.1f} KB")
total_png = sum(p.stat().st_size for p in dist.rglob("*.png"))
print(f"  PNGs total {total_png/1024:>7.1f} KB")
PY
echo "Done."
