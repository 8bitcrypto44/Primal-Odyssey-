#!/usr/bin/env python3
"""Convert CC0 LPC + Kenney animal frames into compact PNG data-URLs for the game."""
from pathlib import Path
from io import BytesIO
import base64
import re
from PIL import Image

ROOT = Path(__file__).resolve().parent
LPC = ROOT / "assets/lpc/lpc animals 2022 v1.1/individual creature spritesheets"
KEN = ROOT / "assets/kenney/PNG/Round (outline)"
OUT = ROOT / "assets/out"
OUT.mkdir(exist_ok=True)

def crop_frame(sheet: Image.Image, fw, fh, col, row):
    sheet = sheet.convert("RGBA")
    return sheet.crop((col * fw, row * fh, (col + 1) * fw, (row + 1) * fh))

def trim(im: Image.Image, pad=1):
    im = im.convert("RGBA")
    bbox = im.split()[-1].getbbox()
    if not bbox:
        return im
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - pad); y0 = max(0, y0 - pad)
    x1 = min(im.width, x1 + pad); y1 = min(im.height, y1 + pad)
    return im.crop((x0, y0, x1, y1))

def fit_square(im: Image.Image, size=48):
    im = trim(im)
    # keep pixel edges crisp where possible
    scale = min(size / im.width, size / im.height)
    nw = max(1, int(im.width * scale))
    nh = max(1, int(im.height * scale))
    # LPC is already pixel art — NEAREST; Kenney is soft — LANCZOS then optional posterize
    resample = Image.NEAREST if max(im.size) <= 96 else Image.LANCZOS
    im = im.resize((nw, nh), resample)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(im, ((size - nw) // 2, size - nh), im)
    return canvas

def recolor(im: Image.Image, mapping):
    """mapping: list of (src_rgb_approx, dst_rgb) soft replace by distance."""
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 20:
                continue
            for (sr, sg, sb), (dr, dg, db) in mapping:
                if abs(r - sr) + abs(g - sg) + abs(b - sb) < 90:
                    px[x, y] = (dr, dg, db, a)
                    break
    return im

def optimize_png(im: Image.Image) -> bytes:
    # quantize with alpha preserved via mask
    alpha = im.split()[-1]
    q = im.convert("RGB").quantize(colors=24, method=Image.MEDIANCUT)
    out = q.convert("RGBA")
    out.putalpha(alpha)
    # hard-edge alpha for crisp billboards
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255 if a > 40 else 0)
    buf = BytesIO()
    out.save(buf, format="PNG", optimize=True)
    return buf.getvalue()

def to_data_url(png: bytes) -> str:
    return "data:image/png;base64," + base64.b64encode(png).decode("ascii")

# --- build frames ---
frames = {}

lion_sheet = Image.open(LPC / "lion.png")
frames["lion"] = fit_square(crop_frame(lion_sheet, 64, 64, 1, 2))  # walk right

lioness = fit_square(crop_frame(Image.open(LPC / "lioness.png"), 64, 64, 1, 2))
frames["cougar"] = recolor(lioness.copy(), [
    ((210, 160, 80), (196, 154, 74)),
    ((180, 120, 50), (160, 110, 55)),
])

tiger = recolor(lioness.copy(), [
    ((210, 160, 80), (224, 122, 42)),
    ((180, 120, 50), (180, 80, 20)),
    ((40, 30, 20), (20, 10, 5)),
])
# add crude stripes
px = tiger.load()
for y in range(tiger.height):
    for x in range(tiger.width):
        r, g, b, a = px[x, y]
        if a and ((x + y * 2) % 7 == 0) and r > 100:
            px[x, y] = (20, 12, 8, a)
frames["tiger"] = tiger

leopard = recolor(lioness.copy(), [
    ((210, 160, 80), (196, 154, 74)),
])
px = leopard.load()
for y in range(3, leopard.height - 3, 4):
    for x in range(3, leopard.width - 3, 5):
        r, g, b, a = px[x, y]
        if a and r > 80:
            px[x, y] = (26, 18, 8, a)
            if x + 1 < leopard.width:
                px[x + 1, y] = (26, 18, 8, a)
frames["leopard"] = leopard
frames["jaguar"] = leopard.copy()

snow = recolor(lioness.copy(), [
    ((210, 160, 80), (200, 210, 220)),
    ((180, 120, 50), (160, 170, 185)),
    ((40, 30, 20), (70, 80, 95)),
])
px = snow.load()
for y in range(4, snow.height - 4, 5):
    for x in range(4, snow.width - 4, 6):
        r, g, b, a = px[x, y]
        if a and r > 140:
            px[x, y] = (70, 80, 95, a)
frames["snowleopard"] = snow

bear = fit_square(crop_frame(Image.open(LPC / "bear, grizzly.png"), 64, 64, 1, 2))
frames["grizzly"] = bear

fox = fit_square(crop_frame(Image.open(LPC / "fox, woods.png"), 64, 64, 1, 2))
# gray wolf-ish recolor
frames["wolf"] = recolor(fox.copy(), [
    ((200, 120, 60), (150, 150, 155)),
    ((180, 90, 40), (110, 110, 115)),
    ((220, 180, 140), (210, 210, 215)),
])

# Kenney animals (CC0)
ken_map = {
    "hippo": "hippo.png",
    "buffalo": "buffalo.png",
    "rhino": "rhino.png",
    "gorilla": "gorilla.png",
    "anaconda": "snake.png",
    "honeybadger": "dog.png",
    "eagle": "owl.png",
    "croc": "crocodile.png",  # leftover ids if any
}
for key, fname in ken_map.items():
    im = Image.open(KEN / fname).convert("RGBA")
    frames[key] = fit_square(im, 48)

# honey badger colors
frames["honeybadger"] = recolor(frames["honeybadger"], [
    ((200, 160, 100), (232, 224, 208)),
    ((120, 90, 60), (26, 26, 26)),
    ((80, 60, 40), (20, 20, 20)),
])

# write preview + data urls
urls = {}
total = 0
for k, im in frames.items():
    png = optimize_png(im)
    (OUT / f"{k}.png").write_bytes(png)
    urls[k] = to_data_url(png)
    total += len(urls[k])
    print(f"{k:12} {len(png):5}d  data {len(urls[k]):5}")

print("TOTAL data chars", total)

js = ["window.PO_IMG={"]
for k, u in urls.items():
    js.append(f'{k}:"{u}",')
js.append("};")
# also credit comment
header = (
    "/* Sprites derived from:\n"
    " * - LPC animals (CC0 portions) https://opengameart.org/content/lpc-bears-deer-lions-and-more\n"
    " * - Kenney Animal Pack Redux (CC0) https://kenney.nl / OpenGameArt\n"
    " */\n"
)
(ROOT / "primal_img.js").write_text(header + "\n".join(js), encoding="utf-8")
print("wrote primal_img.js", (ROOT / "primal_img.js").stat().st_size)
