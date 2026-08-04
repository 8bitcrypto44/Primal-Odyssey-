#!/usr/bin/env python3
"""Bake high-clarity CC0 animal frames (NEAREST) into compact grids."""
from pathlib import Path
from PIL import Image, ImageEnhance
import json

ROOT = Path(__file__).resolve().parent
LPC = ROOT / "assets/lpc/lpc animals 2022 v1.1/individual creature spritesheets"
KEN = ROOT / "assets/kenney/PNG/Round (outline)"
OUT = ROOT / "assets/out"
OUT.mkdir(exist_ok=True)
CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijk"

def crop_frame(sheet, fw, fh, col, row):
    return sheet.convert("RGBA").crop((col * fw, row * fh, (col + 1) * fw, (row + 1) * fh))

def trim(im, pad=1):
    bbox = im.split()[-1].getbbox()
    if not bbox:
        return im
    x0, y0, x1, y1 = bbox
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))

def pixel_fit(im, tw, th):
    """Resize with NEAREST only — keeps LPC edges sharp."""
    im = trim(im.convert("RGBA"))
    scale = min(tw / im.width, th / im.height)
    nw, nh = max(1, int(round(im.width * scale))), max(1, int(round(im.height * scale)))
    im = im.resize((nw, nh), Image.NEAREST)
    canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    canvas.paste(im, ((tw - nw) // 2, th - nh), im)
    # hard alpha
    px = canvas.load()
    for y in range(th):
        for x in range(tw):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255 if a > 60 else 0)
    return canvas

def to_grid(im, max_colors=10):
    px = im.load()
    flat, coords = [], []
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a:
                flat.append((r, g, b))
                coords.append((x, y))
    if not flat:
        return {}, ["."]
    tmp = Image.new("RGB", (len(flat), 1))
    tmp.putdata(flat)
    q = tmp.quantize(colors=min(max_colors, len(set(flat))), method=Image.MEDIANCUT)
    pal = q.getpalette()
    idxs = list(q.getdata())
    used = {}
    for i in idxs:
        if i not in used:
            used[i] = CHARS[len(used)]
    pal_map = {ch: f"#{pal[i*3]:02x}{pal[i*3+1]:02x}{pal[i*3+2]:02x}" for i, ch in used.items()}
    grid = [["." for _ in range(im.width)] for _ in range(im.height)]
    for (x, y), i in zip(coords, idxs):
        grid[y][x] = used[i]
    rows = ["".join(r) for r in grid]
    while rows and set(rows[0]) <= {"."}:
        rows.pop(0)
    while rows and set(rows[-1]) <= {"."}:
        rows.pop()
    left = min((len(row) - len(row.lstrip("."))) if row.strip(".") else len(row) for row in rows)
    right = min((len(row) - len(row.rstrip("."))) if row.strip(".") else len(row) for row in rows)
    rows = [row[left: len(row) - right if right else None] for row in rows]
    return pal_map, rows

def emit(name, pal, rows, s=2):
    pal_js = "{" + ",".join(f'{k}:"{v}"' for k, v in pal.items()) + "}"
    grid_js = "[" + ",".join(json.dumps(r) for r in rows) + "]"
    return f"{name}:{{s:{s},pal:{pal_js},grid:{grid_js}}}"

# Full LPC side-walk frames — keep more pixels
imgs = {
    "lioness": pixel_fit(crop_frame(Image.open(LPC / "lioness.png"), 64, 64, 1, 2), 28, 24),
    "wolf": pixel_fit(crop_frame(Image.open(LPC / "fox, woods.png"), 64, 64, 1, 2), 24, 20),
}

for key, fname in {
    "hippo": "hippo.png", "buffalo": "buffalo.png", "rhino": "rhino.png",
    "gorilla": "gorilla.png", "anaconda": "snake.png", "eagle": "owl.png",
    "honeybadger": "dog.png",
}.items():
    im = ImageEnhance.Contrast(Image.open(KEN / fname).convert("RGBA")).enhance(1.35)
    imgs[key] = pixel_fit(im, 22, 18)

parts = []
for name, im in imgs.items():
    im.save(OUT / f"grid_{name}.png")
    pal, rows = to_grid(im, max_colors=8)
    block = emit(name, pal, rows, s=2)
    parts.append(block)
    print(f"{name:12} {len(rows)}x{len(rows[0])}  {len(block)}c  cols={len(pal)}")

(OUT / "animal_sprites_fragment.js").write_text(",\n".join(parts) + "\n", encoding="utf-8")
print("total", sum(len(p) for p in parts))
