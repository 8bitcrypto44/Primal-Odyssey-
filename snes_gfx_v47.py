# -*- coding: utf-8 -*-
"""v47 SNES graphics bakers — LPC animals, biome props, camp props."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance
import collections

root = Path(__file__).resolve().parent
snes = root / "assets" / "snes"
out = snes / "built"
props_dir = root / "assets" / "props"
parallax_dir = root / "assets" / "parallax"
lpc_dir = root / "assets" / "lpc" / "lpc animals 2022 v1.1" / "individual creature spritesheets"

CELL = 48  # animal cell size on sheet
DIRS = ["down", "left", "right", "up"]  # LPC row order (narrow, wide, wide, narrow)


def _scale_fit(im, max_w, max_h):
    im = im.convert("RGBA")
    w, h = im.size
    scale = min(max_w / w, max_h / h, 1.0)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    return im.resize((nw, nh), Image.NEAREST)


def _recolor_keep_value(im, target_rgb, strength=0.55):
    """Shift hue toward target while keeping luminance."""
    im = im.convert("RGBA")
    px = im.load()
    tr, tg, tb = target_rgb
    out_im = im.copy()
    op = out_im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255.0
            nr = int(tr * lum * (1 - strength) + r * strength)
            ng = int(tg * lum * (1 - strength) + g * strength)
            nb = int(tb * lum * (1 - strength) + b * strength)
            # stronger pull for midtones
            nr = int(nr * (1 - strength) + tr * lum * strength)
            ng = int(ng * (1 - strength) + tg * lum * strength)
            nb = int(nb * (1 - strength) + tb * lum * strength)
            op[x, y] = (max(0, min(255, nr)), max(0, min(255, ng)), max(0, min(255, nb)), a)
    return out_im


def _extract_lpc_walk(path, fw=64, fh=64, frames=3):
    """Return dict dir -> [frame images] from LPC walk sheet."""
    im = Image.open(path).convert("RGBA")
    cols = im.width // fw
    rows = min(4, im.height // fh)
    out = {}
    for ri, dname in enumerate(DIRS[:rows]):
        seq = []
        for fi in range(min(frames, cols)):
            fr = im.crop((fi * fw, ri * fh, fi * fw + fw, ri * fh + fh))
            seq.append(fr)
        # pad if short
        while len(seq) < frames:
            seq.append(seq[-1].copy() if seq else Image.new("RGBA", (fw, fh)))
        out[dname] = seq
    return out


def _paint_fallback(aid, body, accent, outline, shape, dname, walk):
    """Procedural 48x40 silhouette when no LPC source."""
    im = Image.new("RGBA", (CELL, 40), (0, 0, 0, 0))
    px = im.load()
    cx, cy = CELL // 2, 24
    face_right = dname == "right"
    face_left = dname == "left"
    hx = 6 if face_right else (-6 if face_left else 0)
    hy = -4 if dname == "up" else (2 if dname == "down" else 0)
    leg = 1 if walk else 0

    def put(x, y, c, r=0):
        for yy in range(y - r, y + r + 1):
            for xx in range(x - r, x + r + 1):
                if 0 <= xx < CELL and 0 <= yy < 40 and (xx - x) ** 2 + (yy - y) ** 2 <= r * r + 0.6:
                    px[xx, yy] = (*c, 255)

    if shape == "bird":
        for dx in range(-14, 15):
            for dy in range(-4, 5):
                if abs(dx) + abs(dy) * 3 < 16:
                    put(cx + dx, cy + dy + hy, body)
        put(cx + hx, cy - 5 + hy, accent, 2)
    elif shape == "long":
        for t in range(-14, 15):
            put(cx + t, cy + (t // 6) + hy, body, 3 if abs(t) < 9 else 2)
        put(cx + (12 if face_right else -12), cy - 1 + hy, accent, 2)
    elif shape == "ape":
        put(cx, cy + 2 + hy, body, 8)
        put(cx + hx // 2, cy - 6 + hy, body, 4)
        put(cx - 7, cy + 2 + leg, accent, 2)
        put(cx + 7, cy + 2 - leg, accent, 2)
    elif shape == "heavy":
        put(cx, cy + 1 + hy, body, 9)
        put(cx + hx, cy - 3 + hy, body, 5)
        put(cx - 7, cy + 7 + leg, accent, 2)
        put(cx + 6, cy + 7 - leg, accent, 2)
    else:
        put(cx, cy + 1 + hy, body, 7)
        put(cx + hx, cy - 4 + hy, body, 4)
        put(cx - 5, cy + 8 + leg, accent, 2)
        put(cx + 2, cy + 8 - leg, accent, 2)
        put(cx + 5, cy + 7 + leg, accent, 2)
        put(cx + hx, cy - 8 + hy, accent, 1)
        if aid == "tiger":
            for sx in range(cx - 6, cx + 7, 3):
                put(sx, cy + hy, outline, 0)
    return im


def make_topdown_animals():
    """Bake LPC walk cycles (+ recolors / procedural) into animals_td.png."""
    # aid -> (lpc filename or None, recolor RGB or None, procedural fallback tuple)
    catalog = {
        "lion": ("lion.png", None, ((180, 140, 60), (90, 60, 30), (40, 30, 20), "quad")),
        "lioness": ("lioness.png", None, ((170, 130, 55), (80, 55, 28), (40, 30, 20), "quad")),
        "grizzly": ("bear, grizzly.png", None, ((100, 70, 40), (50, 35, 20), (30, 20, 12), "heavy")),
        "wolf": ("fox, woods.png", (120, 120, 130), ((140, 140, 150), (60, 60, 70), (40, 40, 45), "quad")),
        "cougar": ("fox, woods.png", (190, 145, 80), ((180, 140, 70), (70, 50, 30), (40, 28, 16), "quad")),
        "lynx": ("fox, woods.png", (175, 150, 110), ((170, 145, 100), (90, 70, 45), (50, 40, 30), "quad")),
        "ocelot": ("fox, woods.png", (210, 165, 95), ((200, 160, 90), (60, 40, 25), (35, 25, 15), "quad")),
        "leopard": ("lioness.png", (200, 165, 90), ((190, 150, 70), (50, 35, 20), (30, 22, 12), "quad")),
        "jaguar": ("lioness.png", (170, 130, 55), ((160, 120, 50), (40, 28, 15), (25, 18, 10), "quad")),
        "tiger": ("lion.png", (220, 110, 40), ((200, 110, 40), (30, 20, 10), (20, 12, 8), "quad")),
        "snowleopard": ("fox, arctic.png", (200, 210, 220), ((190, 200, 210), (80, 90, 100), (50, 55, 60), "quad")),
        "honeybadger": ("fox, woods.png", (170, 165, 160), ((160, 155, 150), (40, 40, 40), (25, 25, 25), "quad")),
        "buffalo": ("bear, black.png", (75, 55, 35), ((70, 50, 30), (40, 30, 20), (25, 18, 12), "heavy")),
        "rhino": ("bear, polar.png", (150, 150, 155), ((150, 150, 150), (90, 90, 90), (60, 60, 60), "heavy")),
        "hippo": ("bear, polar.png", (90, 120, 155), ((80, 110, 160), (40, 60, 100), (30, 45, 70), "heavy")),
        "manatee": ("bear, polar.png", (100, 140, 145), ((90, 130, 140), (50, 80, 90), (35, 55, 60), "heavy")),
        "gorilla": ("bear, black.png", (55, 50, 50), ((50, 48, 48), (30, 28, 28), (20, 18, 18), "ape")),
        "eagle": (None, None, ((180, 160, 130), (90, 50, 20), (40, 30, 20), "bird")),
        "croc": (None, None, ((50, 100, 55), (25, 55, 30), (15, 35, 20), "long")),
        "anaconda": (None, None, ((30, 140, 70), (20, 80, 40), (12, 50, 25), "long")),
    }

    n = len(catalog)
    # 4 dirs x 3 frames
    sheet_w = CELL * 12
    sheet_h = 40 * n
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))
    frames = {}

    for i, (aid, (lpc_name, tint, fallback)) in enumerate(catalog.items()):
        walks = None
        if lpc_name:
            path = lpc_dir / lpc_name
            if path.exists():
                walks = _extract_lpc_walk(path)
                if tint:
                    walks = {
                        d: [_recolor_keep_value(fr, tint, 0.42) for fr in seq]
                        for d, seq in walks.items()
                    }

        for di, dname in enumerate(DIRS):
            for fi in range(3):
                if walks and dname in walks:
                    src = walks[dname][fi]
                    cell = Image.new("RGBA", (CELL, 40), (0, 0, 0, 0))
                    fitted = _scale_fit(src, CELL - 2, 38)
                    ox = (CELL - fitted.width) // 2
                    oy = 40 - fitted.height
                    cell.paste(fitted, (ox, oy), fitted)
                else:
                    body, accent, outline, shape = fallback
                    cell = _paint_fallback(aid, body, accent, outline, shape, dname, fi % 2)
                x = (di * 3 + fi) * CELL
                y = i * 40
                sheet.paste(cell, (x, y), cell)
                key = f"td_{aid}_{dname}_{fi}"
                frames[key] = {"x": x, "y": y, "w": CELL, "h": 40, "solid": False}
                # aliases for older l/r keys
                if dname == "left":
                    frames[f"td_{aid}_l_{min(fi, 1)}"] = frames[key]
                if dname == "right":
                    frames[f"td_{aid}_r_{min(fi, 1)}"] = frames[key]
                if di == 0 and fi == 0:
                    frames[f"td_{aid}"] = frames[key]

    sheet.save(out / "animals_td.png")
    return frames


def load_biome_props():
    """Pack assets/props/* biome art into SNES-sized object frames."""
    objs = {}
    # camp kit
    tent = Image.new("RGBA", (28, 22), (0, 0, 0, 0))
    d = ImageDraw.Draw(tent)
    d.polygon([(2, 18), (14, 2), (26, 18)], fill=(140, 110, 60, 255), outline=(70, 50, 25, 255))
    d.rectangle((10, 12, 18, 18), fill=(60, 40, 20, 255))
    objs["camp_tent"] = tent

    fire = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(fire)
    d.ellipse((2, 10, 14, 15), fill=(70, 55, 40, 255))
    d.polygon([(8, 2), (12, 10), (4, 10)], fill=(255, 160, 40, 255))
    d.polygon([(8, 5), (10, 11), (6, 11)], fill=(255, 220, 80, 255))
    objs["camp_fire"] = fire

    crate = Image.new("RGBA", (14, 12), (0, 0, 0, 0))
    d = ImageDraw.Draw(crate)
    d.rectangle((1, 1, 12, 10), fill=(120, 85, 45, 255), outline=(60, 40, 20, 255))
    d.line((1, 5, 12, 5), fill=(60, 40, 20, 255))
    objs["camp_crate"] = crate

    prefixes = {
        "africa": ["africa_", "baobab", "acacia", "reed"],
        "mountains": ["mountains_", "pine", "mtn_", "snowrock"],
        "jungle": ["jungle_", "fern"],
        "wetlands": ["wetlands_", "wet_", "reed"],
    }
    for biome, prefs in prefixes.items():
        for p in sorted(props_dir.glob("*.png")):
            name = p.stem
            if not any(name.startswith(pref) or name == pref.rstrip("_") for pref in prefs):
                continue
            im = Image.open(p).convert("RGBA")
            # SNES-friendly scale
            max_h = 56 if "tree" in name or "baobab" in name or "pine" in name or "fir" in name else 40
            max_w = 48 if max_h >= 56 else 40
            fitted = _scale_fit(im, max_w, max_h)
            key = f"bp_{biome}_{name}"
            objs[key] = fitted
    return objs


def copy_parallax():
    out.mkdir(parents=True, exist_ok=True)
    urls = {}
    for rid in ("africa", "mountains", "jungle", "wetlands"):
        src = parallax_dir / f"{rid}.png"
        if src.exists():
            dest = out / f"parallax_{rid}.png"
            Image.open(src).convert("RGBA").save(dest)
            urls[rid] = f"assets/snes/built/parallax_{rid}.png?v=47"
    return urls
