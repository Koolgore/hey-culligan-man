import json
from pathlib import Path

from PIL import Image


SRC_DIR = Path("assets/tiles")
OUT = Path("assets/tile-bounds.js")
SIZE = 420
EXPECTED_LINES = (SIZE / 3, SIZE * 2 / 3)
# Keep the detector from over-trusting warped AI seams. The game needs the
# playable subtiles to read as real squares first; seam detection is just a
# correction layer for small local offsets.
SEAM_INFLUENCE = 0.42


def is_black_line_pixel(pixel):
    """Return True for the printed black divider ink, not dark colored art."""
    r, g, b = pixel[:3]
    return max(r, g, b) < 78 and (max(r, g, b) - min(r, g, b)) < 45


def dark_counts(image, axis):
    rgb = image.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    margin = 25
    if axis == "x":
        return [
            sum(1 for y in range(margin, height - margin) if is_black_line_pixel(pixels[x, y]))
            for x in range(width)
        ]
    return [
        sum(1 for x in range(margin, width - margin) if is_black_line_pixel(pixels[x, y]))
        for y in range(height)
    ]


def line_groups(values, start=0, end=SIZE, threshold=35):
    groups = []
    group_start = None
    for index in range(start, end):
        if values[index] >= threshold and group_start is None:
            group_start = index
        elif values[index] < threshold and group_start is not None:
            if index - group_start >= 2:
                segment = values[group_start:index]
                groups.append({
                    "start": group_start,
                    "end": index - 1,
                    "peak": max(segment),
                    "center": (group_start + index - 1) / 2,
                })
            group_start = None
    if group_start is not None:
        segment = values[group_start:end]
        groups.append({
            "start": group_start,
            "end": end - 1,
            "peak": max(segment),
            "center": (group_start + end - 1) / 2,
        })
    return groups


def pick_internal_lines(values):
    groups = line_groups(values)
    picked = []
    for expected in EXPECTED_LINES:
        candidates = [
            group for group in groups
            if abs(group["center"] - expected) < 70 and group["peak"] >= 120
        ]
        if not candidates:
            candidates = [
                group for group in groups
                if abs(group["center"] - expected) < 85 and group["peak"] >= 70
            ]
        if not candidates:
            picked.append(expected)
            continue
        best = max(
            candidates,
            key=lambda group: (group["peak"], group["end"] - group["start"], -abs(group["center"] - expected)),
        )
        picked.append(best["center"])
    return picked


def regularize_lines(lines):
    """Blend detected seams back toward equal thirds and enforce sane spacing."""
    blended = [
        expected + ((line - expected) * SEAM_INFLUENCE)
        for line, expected in zip(lines, EXPECTED_LINES)
    ]
    min_cell = SIZE * 0.30
    max_cell = SIZE * 0.37

    first = max(min_cell, min(max_cell, blended[0]))
    second = max(first + min_cell, min(SIZE - min_cell, blended[1]))

    middle = second - first
    if middle > max_cell:
        excess = middle - max_cell
        first += excess / 2
        second -= excess / 2

    if SIZE - second > max_cell:
        second = SIZE - max_cell
    if first > max_cell:
        first = max_cell

    return first, second


def main():
    data = {}
    for path in sorted(SRC_DIR.glob("*.png")):
        image = Image.open(path)
        if image.size != (SIZE, SIZE):
            raise RuntimeError(f"{path} is {image.size}; expected {SIZE}x{SIZE}")
        x1, x2 = regularize_lines(pick_internal_lines(dark_counts(image, "x")))
        y1, y2 = regularize_lines(pick_internal_lines(dark_counts(image, "y")))
        data[path.stem] = {
            "x": [0, round(x1 / SIZE, 5), round(x2 / SIZE, 5), 1],
            "y": [0, round(y1 / SIZE, 5), round(y2 / SIZE, 5), 1],
        }

    OUT.write_text(
        "window.HCM_TILE_BOUNDS = "
        + json.dumps(data, indent=2, sort_keys=True)
        + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUT} for {len(data)} tiles")


if __name__ == "__main__":
    main()
