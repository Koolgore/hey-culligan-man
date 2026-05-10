from pathlib import Path

from PIL import Image


SRC = Path("assets/fjsdbfwjdfbisdjh.png")
OUT = Path("assets/tile-labels")

LABEL_W = 280
LABEL_H = 112
DIGIT_H = 86
GAP = 13
BLACK = (22, 19, 16)
RED = (213, 35, 29)


def component_boxes(image, predicate):
    rgb = image.convert("RGB")
    pix = rgb.load()
    width, height = rgb.size
    mask = set()
    for y in range(height):
        for x in range(width):
            if predicate(*pix[x, y]):
                mask.add((x, y))

    seen = set()
    boxes = []
    for start in list(mask):
        if start in seen:
            continue
        stack = [start]
        seen.add(start)
        xs = []
        ys = []
        while stack:
            x, y = stack.pop()
            xs.append(x)
            ys.append(y)
            for nx in (x - 1, x, x + 1):
                for ny in (y - 1, y, y + 1):
                    point = (nx, ny)
                    if point in mask and point not in seen:
                        seen.add(point)
                        stack.append(point)
        if len(xs) > 50:
            boxes.append((len(xs), min(xs), min(ys), max(xs) + 1, max(ys) + 1))
    return sorted(boxes, key=lambda box: box[1])


def glyph_crop(image, box, colour):
    pad = 7
    _, x0, y0, x1, y1 = box
    crop = image.crop((max(0, x0 - pad), max(0, y0 - pad), min(image.width, x1 + pad), min(image.height, y1 + pad))).convert("RGBA")
    out = Image.new("RGBA", crop.size, (0, 0, 0, 0))
    src = crop.load()
    dst = out.load()
    for y in range(crop.height):
        for x in range(crop.width):
            r, g, b, _ = src[x, y]
            ink = 238 - max(r, g, b)
            alpha = max(0, min(255, int(ink * 1.65)))
            if alpha > 0:
                dst[x, y] = (*colour, alpha)
    bbox = out.getbbox()
    return out.crop(bbox) if bbox else out


def fit_height(glyph, height):
    scale = height / glyph.height
    width = max(1, round(glyph.width * scale))
    return glyph.resize((width, height), Image.Resampling.LANCZOS)


def paste_centered(base, glyph, x, y):
    base.alpha_composite(glyph, (round(x), round(y)))


def build_label(black_digits, red_digits, black_dash, first, second):
    left = fit_height(black_digits[first], DIGIT_H)
    dash = fit_height(black_dash, round(DIGIT_H * 0.12))
    right = fit_height(red_digits[second], DIGIT_H)

    total_w = left.width + dash.width + right.width + GAP * 2
    label = Image.new("RGBA", (LABEL_W, LABEL_H), (0, 0, 0, 0))
    x = (LABEL_W - total_w) / 2
    y_digit = (LABEL_H - DIGIT_H) / 2
    y_dash = (LABEL_H - dash.height) / 2 + 5
    paste_centered(label, left, x, y_digit)
    x += left.width + GAP
    paste_centered(label, dash, x, y_dash)
    x += dash.width + GAP
    paste_centered(label, right, x, y_digit)
    return label


def main():
    image = Image.open(SRC).convert("RGBA")
    boxes = component_boxes(image, lambda r, g, b: max(r, g, b) < 155)
    digit_boxes = sorted([box for box in boxes if 600 <= box[2] <= 630], key=lambda box: box[1])
    dash_boxes = sorted(
        [
            box
            for box in boxes
            if 815 <= box[2] <= 835 and 34 <= (box[3] - box[1]) <= 70 and (box[4] - box[2]) <= 16
        ],
        key=lambda box: (box[2], box[1]),
    )
    if len(digit_boxes) != 10 or not dash_boxes:
        raise RuntimeError(f"Expected 10 digit glyphs and a dash, found {len(digit_boxes)} digits and {len(dash_boxes)} dashes")

    digit_order = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]
    black = {name: glyph_crop(image, box, BLACK) for name, box in zip(digit_order, digit_boxes)}
    red = {name: glyph_crop(image, box, RED) for name, box in zip(digit_order, digit_boxes)}
    black["-"] = glyph_crop(image, dash_boxes[0], BLACK)

    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.png"):
        old.unlink()

    for first in range(1, 7):
        for second in range(1, 7):
            label = build_label(black, red, black["-"], str(first), str(second))
            label.save(OUT / f"{first}-{second}.png")

    print(f"Saved 36 generated coordinate labels to {OUT}")


if __name__ == "__main__":
    main()
