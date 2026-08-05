# -*- coding: utf-8 -*-
"""v41 — Real SNES outdoor tiles (16x16 motifs → atlases) + detailed sprites.

Why prior art looked empty/choppy:
  - sparse billboards on a barren floor
  - blob ellipses instead of 16x16 tile craft
  - Mode-5 512x224 stretched raycaster floors (artifacts mush)

This pack paints Chrono Trigger / LttP style 16x16 tiles, stamps them into
256x256 grounds, and builds denser multi-clump trees with 8+ shades.
"""
from pathlib import Path
from PIL import Image
import math
import random

root = Path(__file__).resolve().parent
OUT = (12, 10, 8)


def save(img, *parts):
    p = root.joinpath(*parts)
    p.parent.mkdir(parents=True, exist_ok=True)
    img.save(p, "PNG")
    return p


def clamp(v, a=0, b=255):
    return max(a, min(b, int(v)))


def mix(a, b, t):
    return tuple(clamp(a[i] * (1 - t) + b[i] * t) for i in range(3))


def shade(c, f):
    return (clamp(c[0] * f), clamp(c[1] * f), clamp(c[2] * f))


def px(img, x, y, c, a=255):
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), (c[0], c[1], c[2], a) if len(c) == 3 else c)


def outline(img):
    w, h = img.size
    src = img.copy()
    for y in range(h):
        for x in range(w):
            if src.getpixel((x, y))[3] < 20:
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and src.getpixel((nx, ny))[3] > 80:
                        px(img, x, y, OUT)
                        break


# ---------- 16x16 TILE CRAFT ----------
def tile_grass(pal, variant, seed):
    """SNES outdoor grass — blades, dirt pockets, flowers."""
    rng = random.Random(seed)
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    base, mid, dark, hi, accent = pal
    for y in range(16):
        for x in range(16):
            c = base
            if (x + y * 3 + variant) % 5 == 0:
                c = mid
            if (x * 2 + y) % 7 == 0:
                c = dark
            px(img, x, y, c)
    # vertical blade strokes
    for i in range(10):
        x = (i * 3 + variant * 2) % 16
        h = 4 + (i + variant) % 5
        y0 = 16 - h
        for yy in range(h):
            px(img, x, y0 + yy, hi if yy < 2 else mid)
            if yy == 0 and rng.random() < 0.4:
                px(img, x, y0 - 1 if y0 > 0 else 0, accent)
    # dirt pocket
    if variant % 2 == 0:
        for y in range(10, 15):
            for x in range(4, 9):
                if (x + y) % 2 == 0:
                    px(img, x, y, dark)
    # flower / pebble
    if variant == 1:
        px(img, 11, 5, accent); px(img, 12, 5, accent); px(img, 11, 6, shade(accent, 0.7))
    if variant == 2:
        px(img, 3, 8, hi); px(img, 4, 8, mid)
    return img


def tile_dirt(pal, seed):
    rng = random.Random(seed)
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    a, b, c, d, _ = pal
    for y in range(16):
        for x in range(16):
            col = a
            if (x ^ y) & 1:
                col = b
            if (x + y * 2) % 9 == 0:
                col = c
            px(img, x, y, col)
    for _ in range(8):
        px(img, rng.randint(0, 15), rng.randint(0, 15), d)
    # edge bevel like SNES path tiles
    for i in range(16):
        px(img, i, 0, shade(a, 1.15))
        px(img, i, 15, shade(a, 0.75))
        px(img, 0, i, shade(a, 1.1))
        px(img, 15, i, shade(a, 0.8))
    return img


def tile_stone(pal, seed):
    rng = random.Random(seed)
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    a, b, c, d, e = pal
    for y in range(16):
        for x in range(16):
            px(img, x, y, a if ((x // 4) + (y // 4)) % 2 == 0 else b)
    # cracks
    for y in range(2, 14):
        px(img, 7 + (y % 3), y, c)
    for _ in range(6):
        px(img, rng.randint(1, 14), rng.randint(1, 14), d)
    for i in range(16):
        px(img, i, 0, e); px(img, 0, i, e)
    return img


def stamp_atlas(tiles, size=256):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    n = size // 16
    for ty in range(n):
        for tx in range(n):
            t = tiles[(tx + ty * 3) % len(tiles)]
            img.paste(t, (tx * 16, ty * 16))
            # break grid: occasional flip via redraw noise
            if (tx + ty) % 5 == 0:
                for yy in range(16):
                    for xx in range(2):
                        p = t.getpixel((xx, yy))
                        if p[3] > 0:
                            img.putpixel((tx * 16 + 14 + xx, ty * 16 + yy), p)
    return img


# ---------- DETAILED SPRITES ----------
def leaf_clump(img, cx, cy, r, cols, seed):
    rng = random.Random(seed)
    for i in range(r * r * 3):
        ang = rng.random() * math.pi * 2
        rad = rng.random() ** 0.6 * r
        x = int(cx + math.cos(ang) * rad)
        y = int(cy + math.sin(ang) * rad * 0.75)
        # lighting
        lit = 0.5 - math.cos(ang) * 0.2 - math.sin(ang) * 0.25 + rng.random() * 0.1
        if lit > 0.7:
            c = cols[0]
        elif lit > 0.45:
            c = cols[1]
        elif lit > 0.25:
            c = cols[2]
        else:
            c = cols[3]
        if rad > r * 0.85:
            c = cols[4]
        px(img, x, y, c)
        if rng.random() < 0.25:
            px(img, x + 1, y, c)


def bark(img, x0, y0, w, h, cols, seed):
    rng = random.Random(seed)
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            u = (x - x0) / max(1, w - 1)
            c = cols[1]
            if u < 0.2:
                c = cols[0]
            elif u > 0.8:
                c = cols[2]
            if y % 4 == 0:
                c = cols[3]
            if rng.random() < 0.06:
                c = cols[3]
            px(img, x, y, c)
    for _ in range(max(2, h // 12)):
        kx = x0 + rng.randint(1, max(1, w - 2))
        ky = y0 + rng.randint(3, max(4, h - 3))
        px(img, kx, ky, cols[3])
        px(img, kx + 1, ky, cols[2])
        px(img, kx, ky + 1, cols[2])


BIOMES = {
    "africa": {
        "grass": [(168, 190, 70), (130, 155, 50), (90, 115, 35), (200, 215, 100), (220, 160, 50)],
        "dirt": [(180, 145, 85), (150, 120, 65), (110, 85, 45), (70, 50, 30), (200, 170, 110)],
        "stone": [(170, 145, 105), (130, 110, 80), (90, 75, 55), (60, 48, 35), (200, 180, 140)],
        "leaf": [(190, 210, 80), (145, 175, 55), (100, 135, 40), (60, 95, 28), (35, 60, 18)],
        "trunk": [(165, 115, 55), (120, 80, 40), (80, 50, 25), (50, 30, 15)],
        "sky": [(70, 130, 210), (140, 180, 230), (235, 205, 130)],
        "para": [(100, 125, 55), (70, 95, 40), (130, 150, 70)],
        "wall": [(160, 130, 85), (115, 90, 55), (75, 55, 35), (45, 32, 20)],
    },
    "mountains": {
        "grass": [(150, 175, 110), (110, 140, 80), (75, 100, 55), (190, 205, 150), (235, 242, 250)],
        "dirt": [(140, 145, 155), (105, 112, 122), (75, 82, 92), (50, 55, 65), (190, 198, 210)],
        "stone": [(200, 208, 220), (150, 160, 175), (105, 115, 130), (70, 78, 90), (235, 242, 250)],
        "leaf": [(80, 150, 95), (45, 115, 70), (25, 80, 48), (14, 55, 32), (8, 38, 22)],
        "trunk": [(130, 95, 55), (95, 65, 38), (60, 40, 22), (38, 24, 12)],
        "sky": [(100, 150, 215), (175, 205, 240), (245, 248, 252)],
        "para": [(75, 85, 105), (50, 60, 80), (110, 120, 140)],
        "wall": [(145, 152, 165), (105, 112, 125), (70, 78, 90), (210, 220, 230)],
    },
    "jungle": {
        "grass": [(45, 140, 65), (28, 105, 48), (16, 75, 32), (70, 175, 95), (30, 90, 40)],
        "dirt": [(85, 65, 35), (60, 45, 25), (40, 28, 15), (25, 16, 8), (110, 85, 45)],
        "stone": [(100, 110, 75), (70, 80, 55), (45, 52, 35), (28, 34, 22), (130, 140, 100)],
        "leaf": [(55, 185, 85), (30, 140, 60), (14, 100, 42), (8, 70, 28), (4, 45, 18)],
        "trunk": [(120, 80, 40), (85, 55, 28), (55, 35, 16), (32, 18, 8)],
        "sky": [(30, 55, 85), (45, 100, 115), (35, 95, 55)],
        "para": [(15, 50, 25), (8, 35, 16), (30, 80, 40)],
        "wall": [(95, 65, 35), (65, 42, 22), (40, 26, 12), (22, 14, 8)],
    },
    "wetlands": {
        "grass": [(80, 155, 110), (55, 120, 85), (35, 90, 60), (110, 180, 130), (210, 190, 70)],
        "dirt": [(75, 95, 70), (55, 75, 60), (40, 70, 85), (30, 50, 65), (100, 115, 85)],
        "stone": [(125, 135, 125), (90, 100, 95), (60, 70, 65), (40, 48, 44), (160, 168, 160)],
        "leaf": [(70, 165, 125), (45, 125, 95), (28, 95, 70), (16, 65, 48), (10, 45, 34)],
        "trunk": [(130, 100, 60), (95, 70, 40), (60, 45, 25), (38, 28, 14)],
        "sky": [(80, 140, 175), (130, 175, 190), (185, 215, 185)],
        "para": [(40, 80, 70), (25, 58, 50), (60, 100, 85)],
        "wall": [(105, 115, 95), (75, 85, 70), (50, 58, 48), (32, 38, 32)],
    },
}


def make_ground(region):
    b = BIOMES[region]
    tiles = []
    for v in range(6):
        tiles.append(tile_grass(b["grass"], v, hash(region) + v * 17))
    for v in range(3):
        tiles.append(tile_dirt(b["dirt"], hash(region) + 100 + v))
    for v in range(2):
        tiles.append(tile_stone(b["stone"], hash(region) + 200 + v))
    # weight grass heavier by duplicating
    tiles = tiles[:6] * 2 + tiles[6:]
    return stamp_atlas(tiles, 256)


def make_tree(region, n):
    img = Image.new("RGBA", (112, 144), (0, 0, 0, 0))
    b = BIOMES[region]
    leaf, trunk = b["leaf"], b["trunk"]
    # shadow
    for y in range(136, 142):
        for x in range(30, 82):
            if ((x - 56) / 26) ** 2 + ((y - 138) / 3) ** 2 < 1:
                px(img, x, y, (0, 0, 0), 100)

    if region == "mountains":
        bark(img, 52, 95, 8, 40, trunk, n)
        tiers = {
            1: [(56, 28, 14), (56, 48, 22), (56, 72, 28), (56, 96, 22)],
            2: [(56, 18, 12), (56, 36, 18), (56, 56, 26), (56, 80, 32), (56, 104, 20)],
            3: [(56, 30, 16), (56, 52, 24), (56, 78, 30), (56, 102, 22)],
        }[n]
        for i, (cx, cy, r) in enumerate(tiers):
            # triangular fir: fill wedge
            for row in range(r):
                w = 1 + row * 2
                if w > r * 2:
                    w = r * 2
                for x in range(cx - w // 2, cx + w // 2 + 1):
                    c = leaf[0] if row < r // 3 else (leaf[1] if (x + row) % 2 == 0 else leaf[2])
                    if row > r * 0.75:
                        c = leaf[3]
                    px(img, x, cy + row, c)
            if i < 2:
                for x in range(cx - 4, cx + 5):
                    px(img, x, cy, (245, 250, 255))
                    px(img, x, cy + 1, (220, 230, 240))
    else:
        tw = 14 if (region == "africa" and n == 2) else (10 if region == "jungle" else 8)
        bark(img, 56 - tw // 2, 70, tw, 65, trunk, n * 9)
        if region == "africa":
            if n != 2:
                bark(img, 22, 68, 28, 5, trunk, 1)
                bark(img, 62, 66, 28, 5, trunk, 2)
            else:
                bark(img, 30, 62, 52, 12, trunk, 3)
            clumps = {
                1: [(56, 42, 28), (32, 48, 16), (80, 46, 16), (56, 28, 14), (42, 36, 12), (70, 36, 12)],
                2: [(56, 40, 24), (36, 34, 16), (76, 36, 16), (56, 22, 14)],
                3: [(56, 44, 26), (28, 52, 14), (84, 50, 14), (44, 30, 12), (68, 30, 12)],
            }[n]
        elif region == "jungle":
            clumps = {
                1: [(56, 38, 26), (30, 48, 18), (82, 46, 18), (56, 20, 14), (40, 28, 12), (72, 26, 12)],
                2: [(56, 36, 30), (26, 44, 18), (86, 42, 18), (56, 16, 16)],
                3: [(56, 40, 24), (34, 32, 16), (78, 30, 16), (18, 54, 12), (94, 52, 12), (56, 18, 12)],
            }[n]
            # vines
            for vx, top, bot in ((28, 55, 115), (84, 52, 120), (42, 58, 110), (70, 56, 118)):
                if n == 1 and vx in (42, 70):
                    continue
                for y in range(top, bot):
                    px(img, vx + ((y // 6) % 2), y, leaf[2])
                    if y % 7 == 0:
                        leaf_clump(img, vx, y, 4, leaf, y)
        else:  # wetlands
            bark(img, 28, 100, 6, 32, trunk, 11)
            bark(img, 78, 98, 6, 34, trunk, 12)
            clumps = {
                1: [(56, 46, 26), (32, 52, 14), (80, 50, 14), (56, 32, 12)],
                2: [(56, 42, 24), (34, 40, 16), (78, 40, 16), (56, 24, 14)],
                3: [(56, 48, 22), (30, 54, 12), (82, 52, 12), (44, 34, 10), (68, 34, 10)],
            }[n]
        for i, (cx, cy, r) in enumerate(clumps):
            leaf_clump(img, cx, cy, r, leaf, 500 + n * 40 + i)

    outline(img)
    return img


def make_rock(region, n):
    img = Image.new("RGBA", (64, 56), (0, 0, 0, 0))
    cols = BIOMES[region]["stone"]
    # treat stone palette as leaf-like shades for clump
    c5 = list(cols)
    shapes = {
        1: [(32, 30, 22), (22, 34, 12), (42, 32, 12)],
        2: [(32, 28, 24), (18, 32, 12), (46, 30, 12), (32, 18, 10)],
        3: [(30, 32, 18), (40, 28, 14), (20, 36, 10)],
        4: [(24, 30, 16), (40, 32, 16), (32, 20, 12)],
        5: [(32, 30, 20), (20, 26, 12), (44, 26, 12), (32, 16, 10)],
    }[n]
    for i, (cx, cy, r) in enumerate(shapes):
        leaf_clump(img, cx, cy, r, c5, 70 + n * 10 + i)
    if region == "mountains":
        for x in range(16, 48):
            if img.getpixel((x, 16))[3] > 40:
                px(img, x, 14, (245, 250, 255))
                px(img, x, 15, (220, 230, 240))
    outline(img)
    return img


def make_grass(region, n):
    img = Image.new("RGBA", (56, 64), (0, 0, 0, 0))
    g = BIOMES[region]["grass"]
    rng = random.Random(region + str(n) + "g")
    blades = 22 if n != 3 else 14
    for i in range(blades):
        x = 6 + (i * 41 + n * 7) % 44
        h = (22 if n == 2 else 32 if n == 1 else 48) - (i % 6) * 2
        lean = (i % 3) - 1
        for yy in range(h):
            xx = x + (lean if yy > h * 0.4 else 0) + (1 if yy > h * 0.7 and lean else 0)
            c = g[0] if yy < 3 else (g[1] if yy < h // 2 else g[2])
            if (xx + yy) % 4 == 0:
                c = g[3]
            px(img, xx, 60 - h + yy, c)
        px(img, x + lean, 60 - h - 1, g[0])
    if region == "wetlands" and n == 3:
        for bx in (18, 34):
            for yy in range(16, 60):
                px(img, bx, yy, g[2])
            for dy in range(12):
                for dx in range(5):
                    px(img, bx - 1 + dx, 6 + dy, g[4] if dy < 9 else (100, 75, 35))
    outline(img)
    return img


def make_bush(region, n):
    img = Image.new("RGBA", (64, 56), (0, 0, 0, 0))
    leaf = BIOMES[region]["leaf"]
    if n == 1:
        leaf_clump(img, 32, 32, 22, leaf, 1)
        leaf_clump(img, 18, 34, 12, leaf, 2)
        leaf_clump(img, 46, 33, 12, leaf, 3)
        leaf_clump(img, 32, 20, 12, leaf, 4)
    else:
        leaf_clump(img, 22, 32, 16, leaf, 5)
        leaf_clump(img, 42, 30, 16, leaf, 6)
        leaf_clump(img, 32, 18, 12, leaf, 7)
        berry = BIOMES[region]["grass"][4]
        for bx, by in ((16, 28), (26, 36), (38, 22), (48, 34), (32, 28)):
            px(img, bx, by, berry); px(img, bx + 1, by, berry)
            px(img, bx, by + 1, shade(berry, 0.7))
    outline(img)
    return img


def make_sky(region):
    img = Image.new("RGBA", (256, 112), (0, 0, 0, 0))
    top, mid, bot = BIOMES[region]["sky"]
    for y in range(112):
        t = y / 111
        c = mix(top, mid, t / 0.5) if t < 0.5 else mix(mid, bot, (t - 0.5) / 0.5)
        for x in range(256):
            # SNES dither band
            if 0.42 < t < 0.58 and (x + y) % 2 == 0:
                c2 = mix(top, bot, 0.5)
                px(img, x, y, c2)
            else:
                px(img, x, y, c)
    # clouds — multi-pixel fluffy
    rng = random.Random(region + "sky41")
    for i in range(7):
        cx = 20 + i * 36
        cy = 14 + (i % 3) * 10
        for _ in range(80):
            x = cx + rng.randint(-18, 18)
            y = cy + rng.randint(-5, 5)
            px(img, x % 256, y, mix(bot, (255, 255, 255), 0.65))
        for _ in range(40):
            x = cx + 8 + rng.randint(-12, 12)
            y = cy + 2 + rng.randint(-3, 3)
            px(img, x % 256, y, mix(mid, (220, 220, 230), 0.4))
    # far hills
    para = BIOMES[region]["para"]
    for x in range(256):
        if region == "mountains":
            h = int(14 + 26 * abs(math.sin(x * 0.04)) + 10 * abs(math.sin(x * 0.11)))
        elif region in ("jungle", "wetlands"):
            h = 12 + (x * 9) % 28
        else:
            h = int(6 + 10 * abs(math.sin(x * 0.05)))
        for y in range(112 - h, 112):
            px(img, x, y, para[0] if (x + y) % 2 == 0 else para[1])
        if region == "mountains" and h > 22:
            px(img, x, 112 - h, (240, 246, 252))
    return img


def make_parallax(region):
    # Wide detailed midground — trees/peaks as pixel columns
    img = Image.new("RGBA", (512, 96), (0, 0, 0, 0))
    p = BIOMES[region]["para"]
    leaf = BIOMES[region]["leaf"]
    trunk = BIOMES[region]["trunk"]
    for x in range(512):
        h = 22 + int(28 * abs(math.sin(x * 0.02)) + 14 * abs(math.sin(x * 0.055 + 1)))
        if region == "mountains":
            h = 30 + int(40 * abs(math.sin(x * 0.015)) + 16 * abs(math.sin(x * 0.04)))
        for y in range(96 - h, 96):
            t = (y - (96 - h)) / max(1, h)
            px(img, x, y, mix(p[0], p[1], t), 240)
        if region != "mountains" and x % 12 == 0:
            th = 14 + (x % 9)
            bark(img, x, 96 - h - th, 3, th, trunk, x)
            leaf_clump(img, x + 1, 96 - h - th, 8, leaf, x)
        if region == "mountains" and h > 45:
            for yy in range(4):
                px(img, x, 96 - h + yy, (235, 242, 250), 220)
    return img


def make_wall(region):
    b = BIOMES[region]
    tiles = [tile_stone(b["wall"] + [b["wall"][0]], hash(region) + i) for i in range(8)]
    # expand wall palette to 5
    return stamp_atlas(tiles, 128)


def make_water(frame):
    img = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    for y in range(256):
        for x in range(256):
            w1 = math.sin((x + frame * 12) * 0.12 + y * 0.04)
            w2 = math.cos((y + frame * 7) * 0.15)
            v = w1 + w2
            if v > 1.0:
                c = (140, 210, 220)
            elif v > 0.3:
                c = (55, 140, 165)
            elif v > -0.4:
                c = (28, 100, 130)
            else:
                c = (14, 70, 100)
            if (x + y + frame * 4) % 19 == 0:
                c = mix(c, (210, 235, 245), 0.55)
            px(img, x, y, c)
    return img


def make_lily():
    img = Image.new("RGBA", (48, 40), (0, 0, 0, 0))
    leaf = [(55, 150, 95), (35, 120, 75), (20, 90, 55), (12, 60, 38), (8, 40, 26)]
    leaf_clump(img, 24, 26, 16, leaf, 1)
    for a in range(8):
        ang = a * math.pi / 4
        leaf_clump(img, int(24 + math.cos(ang) * 7), int(14 + math.sin(ang) * 4), 5,
                   [(245, 215, 90), (220, 180, 55), (180, 130, 35), (130, 90, 20), (90, 60, 15)], 10 + a)
    outline(img)
    return img


def make_landmark(kind):
    img = Image.new("RGBA", (112, 80), (0, 0, 0, 0))
    if kind == "watering_hole":
        leaf_clump(img, 56, 52, 30, [(50, 140, 170), (35, 110, 140), (22, 80, 110), (12, 55, 80), (8, 40, 60)], 1)
        leaf_clump(img, 56, 48, 18, [(100, 190, 200), (60, 150, 170), (35, 110, 140), (20, 80, 110), (12, 55, 80)], 2)
        for x in range(24, 88, 4):
            leaf_clump(img, x, 38, 4, BIOMES["africa"]["leaf"], x)
    elif kind == "cairn":
        for i, (cx, cy, r) in enumerate([(56, 58, 16), (56, 44, 12), (56, 32, 9)]):
            leaf_clump(img, cx, cy, r, list(BIOMES["mountains"]["stone"]), 10 + i)
    elif kind == "boardwalk":
        for i in range(8):
            bark(img, 14 + i * 12, 30, 10, 32, BIOMES["wetlands"]["trunk"], i)
        bark(img, 12, 58, 88, 6, BIOMES["wetlands"]["trunk"], 9)
    elif kind == "reed_blind":
        g = BIOMES["wetlands"]["grass"]
        for x in range(20, 92, 2):
            for y in range(10, 68):
                px(img, x, y, g[(x + y) % 3])
        bark(img, 32, 28, 48, 24, BIOMES["wetlands"]["trunk"], 1)
    elif kind == "ranger_post":
        bark(img, 40, 18, 32, 48, BIOMES["africa"]["trunk"], 1)
        bark(img, 34, 12, 44, 10, BIOMES["africa"]["trunk"], 2)
        for y in range(32, 44):
            for x in range(50, 62):
                px(img, x, y, (55, 120, 170))
    else:
        leaf_clump(img, 56, 34, 36, BIOMES["jungle"]["leaf"], 1)
        leaf_clump(img, 56, 34, 12, [(45, 75, 130), (30, 55, 100), (20, 40, 75), (12, 28, 50), (8, 18, 35)], 2)
        for x in range(28, 84, 6):
            bark(img, x, 48, 3, 22, BIOMES["jungle"]["trunk"], x)
    outline(img)
    return img


def main():
    n = 0
    for region in ("africa", "mountains", "jungle", "wetlands"):
        save(make_ground(region), "assets", "ground", f"{region}.png"); n += 1
        save(make_sky(region), "assets", "sky", f"{region}.png"); n += 1
        save(make_parallax(region), "assets", "parallax", f"{region}.png"); n += 1
        # wall: expand palette to 5 entries
        wpal = BIOMES[region]["wall"]
        while len(wpal) < 5:
            wpal = list(wpal) + [wpal[-1]]
        BIOMES[region]["wall5"] = wpal
        tiles = [tile_stone(tuple(wpal), hash(region) + i) for i in range(8)]
        save(stamp_atlas(tiles, 128), "assets", "walls", f"{region}.png"); n += 1
        save(stamp_atlas(tiles, 128).resize((64, 64), Image.NEAREST), "assets", "props", f"wall{region}.png"); n += 1
        for i in range(1, 4):
            save(make_tree(region, i), "assets", "props", f"{region}_tree{i}.png"); n += 1
        for i in range(1, 6):
            save(make_rock(region, i), "assets", "props", f"{region}_rock{i}.png"); n += 1
        for i in range(1, 4):
            save(make_grass(region, i), "assets", "props", f"{region}_grass{i}.png"); n += 1
        for i in range(1, 3):
            save(make_bush(region, i), "assets", "props", f"{region}_bush{i}.png"); n += 1

    for f in range(3):
        save(make_water(f), "assets", "ground", f"water{f}.png"); n += 1

    aliases = {
        "acacia": ("africa", "tree", 1), "baobab": ("africa", "tree", 2),
        "pine": ("mountains", "tree", 1), "mtn_fir": ("mountains", "tree", 2),
        "tree": ("jungle", "tree", 1), "jungle_vine": ("jungle", "tree", 3),
        "rock": ("africa", "rock", 1), "snowrock": ("mountains", "rock", 1),
        "grass": ("africa", "grass", 1), "bush": ("africa", "bush", 1),
        "fern": ("jungle", "grass", 2), "reed": ("wetlands", "grass", 3),
        "africa_thorn": ("africa", "bush", 2),
    }
    for name, (reg, kind, i) in aliases.items():
        Image.open(root / "assets" / "props" / f"{reg}_{kind}{i}.png").save(
            root / "assets" / "props" / f"{name}.png"); n += 1
    save(make_lily(), "assets", "props", "wet_lily.png"); n += 1
    for lm in ("watering_hole", "cairn", "boardwalk", "reed_blind", "ranger_post", "canopy_gap"):
        save(make_landmark(lm), "assets", "landmarks", f"{lm}.png"); n += 1

    print(f"v41 SNES tile assets: {n}")
    # verify detail
    g = Image.open(root / "assets" / "ground" / "africa.png")
    t = Image.open(root / "assets" / "props" / "africa_tree1.png")
    print("ground", g.size, "colors", len({p[:3] for p in g.getdata()}))
    print("tree", t.size, "colors", len({p[:3] for p in t.getdata() if p[3] > 10}))


if __name__ == "__main__":
    main()
