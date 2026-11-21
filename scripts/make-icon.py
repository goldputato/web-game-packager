#!/usr/bin/env python3
"""Build a multi-size Windows .ico from a square PNG.

Prefer the game's own PWA icon (/icons/icon-512.png) over an invented mark.

Example:
    python make-icon.py site/icons/icon-512.png app/build/icon.ico
"""

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow required: pip install pillow")

SIZES = [16, 24, 32, 48, 64, 128, 256]


def main() -> None:
    if len(sys.argv) < 3:
        sys.exit("usage: make-icon.py <source.png> <out.ico>")

    src_path, out_path = Path(sys.argv[1]), Path(sys.argv[2])
    img = Image.open(src_path).convert("RGBA")

    if img.width != img.height:
        side = min(img.width, img.height)
        left = (img.width - side) // 2
        top = (img.height - side) // 2
        img = img.crop((left, top, left + side, top + side))

    tiles = {s: img.resize((s, s), Image.LANCZOS) for s in SIZES}
    out_path.parent.mkdir(parents=True, exist_ok=True)
    tiles[256].save(
        out_path, format="ICO",
        sizes=[(s, s) for s in SIZES],
        append_images=[tiles[s] for s in SIZES if s != 256],
    )

    preview = out_path.with_name("_icon-preview.png")
    sheet = Image.new("RGBA", (sum(SIZES) + 12 * (len(SIZES) + 1), 300), (18, 18, 22, 255))
    x = 12
    for s in SIZES:
        sheet.alpha_composite(tiles[s], (x, 20))
        x += s + 12
    sheet.save(preview)

    print(f"icon   : {out_path}")
    print(f"preview: {preview}")


if __name__ == "__main__":
    main()
