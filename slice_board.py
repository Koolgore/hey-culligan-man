from pathlib import Path
import random

from PIL import Image, ImageDraw


SRC = Path("assets/board.png")
NUMBER_SRC = Path("assets/tile-numbers.png")
OUT = Path("assets/tiles")
OUT_NUMBERS = Path("assets/tile-numbers")

# Seam coordinates measured from the current board source image.
X_SEAMS = [17, 228, 416, 607, 797, 988, 1191]
Y_SEAMS = [19, 212, 405, 596, 790, 984, 1191]

TILE_SIZE = 420
CELL_SIZE = TILE_SIZE // 3
CREAM = (244, 229, 195)
CREAM_RGBA = (*CREAM, 255)


def cardstock_cell():
    """Generate a small paper-textured blank cell for erasing printed numbers."""
    random.seed(8621)
    img = Image.new("RGB", (CELL_SIZE, CELL_SIZE), CREAM)
    pixels = img.load()
    for y in range(CELL_SIZE):
        for x in range(CELL_SIZE):
            noise = random.randint(-5, 5)
            r, g, b = CREAM
            pixels[x, y] = (
                max(0, min(255, r + noise)),
                max(0, min(255, g + noise)),
                max(0, min(255, b + noise)),
            )
    draw = ImageDraw.Draw(img, "RGBA")
    for _ in range(10):
        x = random.randint(-20, CELL_SIZE)
        draw.line(
            (x, 0, x + random.randint(-18, 18), CELL_SIZE),
            fill=(255, 255, 255, 16),
            width=1,
        )
    return img


def slice_tile(source, number_source, row, col, blank):
    x0, x1 = X_SEAMS[col], X_SEAMS[col + 1]
    y0, y1 = Y_SEAMS[row], Y_SEAMS[row + 1]
    raw = source.crop((x0, y0, x1, y1))
    raw_numbers = number_source.crop((x0, y0, x1, y1))

    # Normalize each tile to a true 3x3 square. This gently corrects the scan's
    # uneven cells without inventing new pipe art.
    tile = Image.new("RGB", (TILE_SIZE, TILE_SIZE), CREAM)
    raw_w, raw_h = raw.size
    inset = 8
    number_art = Image.new("RGBA", (CELL_SIZE, CELL_SIZE), (0, 0, 0, 0))
    for cell_row in range(3):
        for cell_col in range(3):
            cx0 = round(cell_col * raw_w / 3)
            cx1 = round((cell_col + 1) * raw_w / 3)
            cy0 = round(cell_row * raw_h / 3)
            cy1 = round((cell_row + 1) * raw_h / 3)
            cell = raw.crop((cx0, cy0, cx1, cy1)).resize(
                (CELL_SIZE, CELL_SIZE),
                Image.Resampling.LANCZOS,
            )
            tile.paste(cell, (cell_col * CELL_SIZE, cell_row * CELL_SIZE))
            if cell_row == 2 and cell_col == 2:
                number_cell = raw_numbers.crop((cx0, cy0, cx1, cy1)).resize(
                    (CELL_SIZE, CELL_SIZE),
                    Image.Resampling.LANCZOS,
                )
                number_y0 = int(CELL_SIZE * 0.36)
                number_x0 = int(CELL_SIZE * 0.15)
                number_crop = number_cell.crop((number_x0, number_y0, CELL_SIZE - inset, CELL_SIZE - inset))
                number_art.paste(number_crop, (number_x0, number_y0), number_crop)

    # Remove only the printed number pixels inside the bottom-right cell. The
    # source art is transparent outside its ink, so using the alpha mask avoids
    # cutting rectangular chunks out of neighboring outlines.
    number_y0 = int(CELL_SIZE * 0.36)
    number_x0 = int(CELL_SIZE * 0.15)
    number_box = (number_x0, number_y0, CELL_SIZE - inset, CELL_SIZE - inset)
    number_mask = number_art.getchannel("A").crop(number_box).point(
        lambda alpha: 255 if alpha > 24 else 0
    )
    tile.paste(
        blank.crop(number_box),
        (2 * CELL_SIZE + number_x0, 2 * CELL_SIZE + number_y0),
        number_mask,
    )
    return tile, number_art


def main():
    original = Image.open(SRC).convert("RGBA")
    number_source = Image.open(NUMBER_SRC).convert("RGBA")
    source = Image.new("RGBA", original.size, CREAM_RGBA)
    source.alpha_composite(original)
    source = source.convert("RGB")
    OUT.mkdir(parents=True, exist_ok=True)
    OUT_NUMBERS.mkdir(parents=True, exist_ok=True)
    for old_file in OUT.glob("*.png"):
        old_file.unlink()
    for old_file in OUT_NUMBERS.glob("*.png"):
        old_file.unlink()

    blank = cardstock_cell()
    for row in range(6):
        for col in range(6):
            tile_number = f"{row + 1}-{col + 1}"
            tile, number_art = slice_tile(source, number_source, row, col, blank)
            tile.save(OUT / f"{tile_number}.png")
            number_art.save(OUT_NUMBERS / f"{tile_number}.png")

    print("Saved exactly 36 tiles to", OUT)
    print("Saved exactly 36 number overlays to", OUT_NUMBERS)


if __name__ == "__main__":
    main()
