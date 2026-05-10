"""Slice tokens.png (5 cols x 4 rows of icons) into 20 individual square PNGs.

Each output is a transparent square with the icon centered. Bounding boxes
were detected by scanning the alpha channel for opaque-pixel runs.
"""
from pathlib import Path
from PIL import Image

SRC = Path("assets/tokens.png")
OUT = Path("assets/tokens")
SIZE = 256          # final square size for each icon
PAD_RATIO = 0.10    # padding around icon as a fraction of the icon's longest side

# Detected bounding boxes (left, top, right, bottom) for each icon, in source-px.
# Order: left-to-right, top-to-bottom (5 cols x 4 rows = 20 tokens).
BOXES = [
    (100, 103, 269, 259), (370, 86, 546, 265),  (606, 81, 808, 267),
    (890, 74, 1067, 264), (1141, 90, 1310, 260),
    (83, 338, 283, 540),  (355, 339, 542, 523),  (610, 358, 802, 521),
    (893, 340, 1067, 543),(1126, 343, 1300, 520),
    (78, 672, 281, 745),  (366, 611, 533, 795),  (625, 603, 784, 791),
    (885, 616, 1038, 791),(1118, 625, 1312, 768),
    (82, 858, 279, 1063), (364, 873, 527, 1035), (618, 872, 797, 1040),
    (891, 865, 1013, 1058),(1133, 859, 1298, 1063),
]


def main():
    img = Image.open(SRC).convert("RGBA")
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.png"):
        old.unlink()

    for i, (x0, y0, x1, y1) in enumerate(BOXES):
        icon = img.crop((x0, y0, x1, y1))
        iw, ih = icon.size
        longest = max(iw, ih)
        pad = int(longest * PAD_RATIO)
        side = longest + pad * 2
        canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        canvas.paste(icon, ((side - iw) // 2, (side - ih) // 2), icon)
        canvas = canvas.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
        canvas.save(OUT / f"{i}.png")

    print(f"Saved 20 token PNGs to {OUT}")


if __name__ == "__main__":
    main()
