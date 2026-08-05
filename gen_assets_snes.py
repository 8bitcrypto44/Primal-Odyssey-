# -*- coding: utf-8 -*-
"""v40b — SNES outdoor quality (Chrono Trigger / Mana / FF6 style).

512x224 Mode 5 target. Organic clumps, bark knots, dithered skies,
16-color-ish palettes, black outlines.
"""
from pathlib import Path
from PIL import Image
import math
import random

root = Path(__file__).resolve().parent
OUTLINE = (12, 10, 8)


def save(img, *parts):
    p = root.joinpath(*parts)
    p.parent.mkdir(parents=True, exist_ok=True)
    img.save(p, "PNG")
    return p


def clamp(v, a=0, b=255):
    return max(a, min(b, int(v)))


def shade(c, f):
    return (clamp(c[0] * f), clamp(c[1] * f), clamp(c[2] * f))


def mix(a, b, t):
    return tuple(clamp(a[i] * (1 - t) + b[i] * t) for i in range(3))


def px(img, x, y, c, a=255):
    if 0 <= x < img.width and 0 <= y < img.height and c is not None:
        if len(c) == 4:
            img.putpixel((x, y), c)
        else:
            img.putpixel((x, y), c + (a,))


def geta(img, x, y):
    if 0 <= x < img.width and 0 <= y < img.height:
        return img.getpixel((x, y))[3]
    return 0


def blob(img, cx, cy, rx, ry, cols, seed=0):
    """Organic filled ellipse with noisy edge + multi shade."""
    rng = random.Random(seed + cx * 17 + cy * 31)
    for y in range(cy - ry - 2, cy + ry + 3):
        for x in range(cx - rx - 2, cx + rx + 3):
            if rx < 1 or ry < 1:
                continue
            nx = (x - cx) / rx
            ny = (y - cy) / ry
            d = nx * nx + ny * ny
            jitter = (rng.random() - 0.5) * 0.35
            if d > 1.0 + jitter:
                continue
            # lighting: top-left highlight
            lit = 0.55 - nx * 0.25 - ny * 0.35 + rng.random() * 0.1
            if lit > 0.72:
                c = cols[0]
            elif lit > 0.45:
                c = cols[1] if (x + y + seed) % 2 == 0 else cols[0]
            elif lit > 0.28:
                c = cols[2]
            else:
                c = cols[3] if len(cols) > 3 else cols[2]
            # edge darken
            if d > 0.78:
                c = cols[-1]
            px(img, x, y, c)


def bark_trunk(img, x0, y0, w, h, cols, seed=0):
    rng = random.Random(seed)
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            u = (x - x0) / max(1, w - 1)
            c = cols[1]
            if u < 0.25:
                c = cols[0]
            elif u > 0.75:
                c = cols[2]
            if y % 5 == 0:
                c = cols[3]
            if rng.random() < 0.08:
                c = cols[3]
            px(img, x, y, c)
    # knots
    for _ in range(max(1, h // 18)):
        kx = x0 + rng.randint(1, max(1, w - 2))
        ky = y0 + rng.randint(4, max(5, h - 4))
        px(img, kx, ky, cols[3])
        px(img, kx + 1, ky, cols[2])


def outline_opaque(img):
    w, h = img.size
    src = img.copy()
    for y in range(h):
        for x in range(w):
            if src.getpixel((x, y))[3] < 16:
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and src.getpixel((nx, ny))[3] > 60:
                        px(img, x, y, OUTLINE)
                        break


def soft_shadow(img, cx, cy, rx, ry):
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            if rx and ry:
                d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
                if d <= 1:
                    a = int(110 * (1 - d))
                    if geta(img, x, y) < 10:
                        px(img, x, y, (0, 0, 0), a)


BIOME = {
    "africa": dict(
        leaf=[(168, 200, 72), (120, 160, 48), (72, 112, 36), (40, 72, 24), (28, 52, 16)],
        trunk=[(160, 112, 56), (112, 72, 36), (72, 44, 20), (48, 28, 12)],
        rock=[(200, 176, 128), (160, 136, 96), (112, 92, 64), (72, 56, 40), (48, 36, 24)],
        grass=[(180, 210, 80), (140, 170, 52), (96, 128, 36), (64, 92, 24), (210, 230, 120)],
        bush=[(100, 148, 48), (72, 112, 36), (48, 80, 24), (28, 52, 16), (200, 100, 40)],
        sky_top=(56, 120, 200), sky_mid=(120, 170, 220), sky_bot=(230, 200, 120),
        ground=[(190, 160, 90), (150, 120, 60), (110, 88, 44), (70, 110, 40), (210, 180, 110)],
        wall=[(170, 140, 90), (120, 95, 60), (80, 60, 40), (50, 38, 24)],
        para=[(90, 110, 50), (60, 80, 35), (120, 140, 70)],
    ),
    "mountains": dict(
        leaf=[(90, 160, 100), (50, 120, 70), (28, 84, 48), (16, 56, 32), (10, 40, 22)],
        trunk=[(120, 84, 48), (84, 56, 32), (56, 36, 20), (36, 24, 12)],
        rock=[(220, 228, 236), (170, 180, 192), (120, 130, 142), (80, 88, 100), (50, 56, 68)],
        grass=[(170, 190, 120), (120, 150, 80), (80, 110, 55), (50, 80, 40), (235, 242, 250)],
        bush=[(70, 120, 80), (48, 90, 58), (32, 64, 40), (20, 44, 28), (210, 90, 110)],
        sky_top=(90, 140, 210), sky_mid=(170, 200, 235), sky_bot=(245, 248, 252),
        ground=[(150, 155, 165), (110, 118, 128), (80, 90, 100), (200, 210, 220), (70, 110, 70)],
        wall=[(140, 148, 158), (100, 108, 118), (70, 78, 88), (210, 220, 230)],
        para=[(70, 80, 100), (45, 55, 75), (100, 110, 130)],
    ),
    "jungle": dict(
        leaf=[(60, 190, 90), (28, 140, 60), (12, 96, 40), (6, 64, 26), (4, 44, 18)],
        trunk=[(110, 70, 36), (76, 48, 24), (48, 30, 14), (28, 16, 8)],
        rock=[(120, 130, 90), (90, 100, 70), (60, 68, 48), (40, 46, 32), (24, 28, 18)],
        grass=[(50, 180, 90), (30, 140, 65), (16, 100, 45), (10, 70, 30), (90, 210, 120)],
        bush=[(40, 140, 70), (24, 100, 50), (14, 70, 34), (8, 48, 22), (190, 50, 70)],
        sky_top=(24, 50, 80), sky_mid=(40, 100, 120), sky_bot=(30, 90, 50),
        ground=[(70, 100, 45), (50, 76, 32), (34, 52, 22), (90, 70, 35), (20, 40, 16)],
        wall=[(90, 60, 35), (60, 40, 22), (40, 26, 14), (24, 14, 8)],
        para=[(12, 45, 22), (6, 30, 14), (24, 70, 36)],
    ),
    "wetlands": dict(
        leaf=[(80, 170, 130), (48, 130, 100), (28, 96, 72), (16, 64, 50), (10, 44, 36)],
        trunk=[(120, 90, 55), (84, 60, 36), (56, 40, 24), (36, 24, 14)],
        rock=[(140, 150, 140), (100, 110, 105), (70, 80, 76), (48, 56, 52), (32, 40, 38)],
        grass=[(90, 170, 120), (60, 130, 90), (40, 100, 70), (24, 70, 48), (210, 190, 80)],
        bush=[(60, 130, 95), (40, 100, 70), (26, 70, 50), (14, 48, 34), (230, 190, 70)],
        sky_top=(70, 130, 170), sky_mid=(120, 170, 185), sky_bot=(180, 210, 180),
        ground=[(80, 110, 75), (55, 85, 60), (40, 70, 85), (100, 120, 80), (30, 55, 70)],
        wall=[(100, 110, 90), (70, 80, 65), (48, 56, 45), (30, 36, 30)],
        para=[(35, 75, 65), (22, 55, 48), (55, 95, 80)],
    ),
}


def make_tree(region, n):
    img = Image.new("RGBA", (80, 112), (0, 0, 0, 0))
    b = BIOME[region]
    leaf, trunk = b["leaf"], b["trunk"]
    soft_shadow(img, 40, 106, 18, 4)

    if region == "mountains":
        # layered fir
        bark_trunk(img, 37, 78, 6, 26, trunk, n * 40)
        tiers = {
            1: [(40, 18, 10, 8), (40, 32, 16, 10), (40, 48, 22, 12), (40, 66, 18, 10)],
            2: [(40, 12, 8, 7), (40, 24, 14, 9), (40, 40, 20, 11), (40, 58, 24, 12), (40, 76, 16, 9)],
            3: [(40, 20, 12, 9), (40, 36, 20, 11), (40, 54, 26, 13), (40, 72, 18, 10)],
        }[n]
        for i, (cx, cy, rx, ry) in enumerate(tiers):
            # triangle-ish via stacked blobs
            for k in range(ry):
                ww = int(rx * (k + 1) / ry)
                blob(img, cx, cy + k, ww, 2, leaf, n * 100 + i * 10 + k)
            # snow
            if i < 2:
                for x in range(cx - 4, cx + 5):
                    px(img, x, cy - 1, (240, 246, 252))
                    if abs(x - cx) < 3:
                        px(img, x, cy, (210, 220, 235))
    elif region == "africa":
        tw = 10 if n == 2 else 6
        bark_trunk(img, 40 - tw // 2, 58, tw, 44, trunk, n * 11)
        # branch arms
        if n != 2:
            bark_trunk(img, 16, 52, 20, 4, trunk, 1)
            bark_trunk(img, 44, 50, 20, 4, trunk, 2)
        else:
            bark_trunk(img, 22, 48, 36, 10, trunk, 3)
            bark_trunk(img, 18, 44, 12, 6, trunk, 4)
            bark_trunk(img, 50, 44, 12, 6, trunk, 5)
        clusters = {
            1: [(40, 34, 26, 14), (22, 36, 14, 10), (58, 34, 14, 10), (40, 22, 12, 8), (30, 28, 10, 7), (50, 28, 10, 7)],
            2: [(40, 32, 20, 18), (26, 26, 14, 12), (54, 28, 14, 12), (40, 18, 12, 10)],
            3: [(40, 32, 22, 12), (18, 38, 12, 9), (62, 36, 12, 9), (32, 22, 10, 7), (48, 22, 10, 7), (40, 42, 14, 8)],
        }[n]
        for i, (cx, cy, rx, ry) in enumerate(clusters):
            blob(img, cx, cy, rx, ry, leaf, 200 + n * 50 + i)
    elif region == "jungle":
        tw = 8 if n == 2 else 6
        bark_trunk(img, 40 - tw // 2, 48, tw, 54, trunk, n * 7)
        clusters = {
            1: [(40, 28, 22, 18), (22, 36, 14, 14), (58, 34, 14, 14), (40, 14, 12, 10), (28, 20, 10, 9), (52, 18, 10, 9)],
            2: [(40, 26, 24, 20), (18, 32, 15, 15), (62, 30, 15, 15), (40, 12, 14, 11)],
            3: [(40, 30, 18, 16), (24, 24, 13, 13), (56, 22, 13, 13), (12, 40, 10, 10), (68, 38, 10, 10), (40, 14, 11, 9)],
        }[n]
        for i, (cx, cy, rx, ry) in enumerate(clusters):
            blob(img, cx, cy, rx, ry, leaf, 300 + n * 40 + i)
        # vines with leaves
        for vi, (vx, top, bot) in enumerate(((20, 40, 85), (58, 38, 90), (30, 44, 80), (50, 42, 88))):
            if n == 1 and vi > 1:
                continue
            for y in range(top, bot):
                px(img, vx + ((y // 5) % 2), y, leaf[2])
                if y % 6 == 0:
                    blob(img, vx, y, 4, 3, leaf, 900 + y)
    else:  # wetlands mangrove
        bark_trunk(img, 37, 55, 7, 42, trunk, n * 9)
        for kx, ky, kw, kh in ((18, 72, 5, 28), (54, 70, 5, 30), (26, 80, 4, 20), (48, 78, 4, 22)):
            if n == 1 and kx in (26, 48):
                continue
            bark_trunk(img, kx, ky, kw, kh, trunk, kx)
        clusters = {
            1: [(40, 34, 22, 12), (22, 38, 12, 9), (58, 36, 12, 9), (40, 24, 11, 8)],
            2: [(40, 32, 20, 15), (24, 30, 13, 11), (56, 30, 13, 11), (40, 18, 11, 9)],
            3: [(40, 36, 18, 11), (20, 40, 11, 8), (60, 38, 11, 8), (32, 26, 9, 7), (48, 26, 9, 7)],
        }[n]
        for i, (cx, cy, rx, ry) in enumerate(clusters):
            blob(img, cx, cy, rx, ry, leaf, 400 + n * 30 + i)
        for x in range(22, 58, 4):
            for y in range(40, 58):
                if (x * 3 + y) % 5 == 0:
                    px(img, x, y, leaf[2])

    outline_opaque(img)
    return img


def make_rock(region, n):
    img = Image.new("RGBA", (56, 48), (0, 0, 0, 0))
    cols = BIOME[region]["rock"]
    soft_shadow(img, 28, 44, 16, 3)
    polys = {
        1: [(8, 22, 20, 14), (18, 12, 16, 16), (28, 20, 18, 16)],
        2: [(6, 24, 22, 12), (16, 14, 18, 14), (30, 10, 14, 16), (34, 24, 14, 12)],
        3: [(10, 18, 18, 18), (22, 10, 16, 14), (4, 26, 14, 12)],
        4: [(4, 16, 16, 20), (16, 20, 20, 16), (28, 12, 14, 14)],
        5: [(12, 22, 20, 14), (8, 14, 24, 12), (20, 6, 16, 14), (30, 16, 14, 12)],
    }[n]
    for i, (x, y, w, h) in enumerate(polys):
        blob(img, x + w // 2, y + h // 2, w // 2, h // 2, cols, 50 + n * 10 + i)
    # cracks
    for y in range(14, 40, 3):
        px(img, 24 + (n % 4), y, cols[-1])
        px(img, 25 + (n % 4), y + 1, cols[-1])
    if region == "mountains":
        for x in range(14, 42):
            if geta(img, x, 12) > 40:
                px(img, x, 10, (245, 250, 255))
                px(img, x, 11, (220, 230, 240))
    outline_opaque(img)
    return img


def make_grass(region, n):
    img = Image.new("RGBA", (48, 56), (0, 0, 0, 0))
    g = BIOME[region]["grass"]
    rng = random.Random(region + str(n))
    count = 18 if n == 2 else (14 if n == 1 else 12)
    for i in range(count):
        x = 6 + (i * 37 + n * 5) % 36
        h = (18 if n == 2 else 28 if n == 1 else 38) - (i % 5) * 2
        y0 = 52 - h
        lean = (i % 3) - 1
        for yy in range(h):
            xx = x + (lean if yy > h // 2 else 0)
            c = g[0] if yy < 4 else (g[1] if yy < h // 2 else g[2])
            if (xx + yy) % 3 == 0:
                c = g[3]
            px(img, xx, y0 + yy, c)
            if yy < 2:
                px(img, xx, y0 + yy, g[4] if region == "mountains" else g[0])
        px(img, x + lean, y0 - 1, g[0])
    if region == "wetlands" and n == 3:
        for bx in (16, 30):
            for yy in range(20, 52):
                px(img, bx, yy, g[2])
            for dy in range(10):
                for dx in range(4):
                    px(img, bx - 1 + dx, 8 + dy, g[4] if dy < 8 else (90, 70, 30))
    outline_opaque(img)
    return img


def make_bush(region, n):
    img = Image.new("RGBA", (56, 48), (0, 0, 0, 0))
    cols = BIOME[region]["bush"]
    soft_shadow(img, 28, 44, 16, 3)
    if n == 1:
        blob(img, 28, 28, 20, 14, cols, 1)
        blob(img, 16, 30, 12, 10, cols, 2)
        blob(img, 40, 29, 12, 10, cols, 3)
        blob(img, 28, 18, 11, 9, cols, 4)
    else:
        blob(img, 18, 28, 14, 12, cols, 5)
        blob(img, 38, 26, 15, 13, cols, 6)
        blob(img, 28, 16, 12, 10, cols, 7)
        berry = cols[4]
        for bx, by in ((14, 26), (22, 32), (34, 20), (42, 30), (28, 24), (18, 20)):
            px(img, bx, by, berry); px(img, bx + 1, by, berry)
            px(img, bx, by + 1, shade(berry, 0.7))
    outline_opaque(img)
    return img


def make_ground(region):
    img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    g = BIOME[region]["ground"]
    rng = random.Random(region)
    for y in range(128):
        for x in range(128):
            # dual-layer 16px tiles
            tx, ty = x % 16, y % 16
            tile = ((x // 16) + (y // 16) * 3) % 4
            c = g[tile % 3]
            # bevel
            if tx == 0 or ty == 0:
                c = shade(c, 0.82)
            if tx == 15 or ty == 15:
                c = shade(c, 1.08)
            # speckles
            if (x * 13 + y * 7) % 29 == 0:
                c = g[3]
            if region == "wetlands" and ((x // 8) + (y // 8)) % 3 == 0 and ty > 9:
                c = mix(c, (40, 85, 105), 0.4)
            if region == "mountains" and (x ^ y) % 19 == 0:
                c = g[3]
            px(img, x, y, c)
    for _ in range(120):
        x, y = rng.randint(0, 127), rng.randint(0, 127)
        px(img, x, y, g[rng.randint(0, 3)])
        if rng.random() < 0.3:
            px(img, x + 1, y, g[1])
    return img


def make_water(frame):
    img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    for y in range(128):
        for x in range(128):
            w1 = math.sin((x + frame * 10) * 0.18 + y * 0.05)
            w2 = math.cos((y + frame * 6) * 0.22 + x * 0.04)
            v = w1 + w2
            if v > 0.8:
                c = (120, 200, 210)
            elif v > 0.2:
                c = (50, 130, 155)
            elif v > -0.4:
                c = (28, 95, 125)
            else:
                c = (16, 65, 95)
            if (x + y * 2 + frame * 3) % 17 == 0:
                c = mix(c, (200, 230, 240), 0.5)
            px(img, x, y, c)
    return img


def make_sky(region):
    img = Image.new("RGBA", (512, 112), (0, 0, 0, 0))
    b = BIOME[region]
    for y in range(112):
        t = y / 111.0
        if t < 0.45:
            c = mix(b["sky_top"], b["sky_mid"], t / 0.45)
        else:
            c = mix(b["sky_mid"], b["sky_bot"], (t - 0.45) / 0.55)
        # horizontal dither band for SNES look
        for x in range(512):
            cc = c
            if abs(t - 0.45) < 0.06 and (x + y) % 2 == 0:
                cc = mix(b["sky_top"], b["sky_bot"], 0.5)
            px(img, x, y, cc)
    # multi-layer clouds
    rng = random.Random(region + "sky")
    for i in range(10):
        cx = (i * 55 + 30) % 512
        cy = 12 + (i % 4) * 12
        cols = [
            mix(b["sky_bot"], (255, 255, 255), 0.7),
            mix(b["sky_mid"], (255, 255, 255), 0.55),
            mix(b["sky_top"], (200, 200, 210), 0.3),
            mix(b["sky_top"], (100, 100, 120), 0.4),
        ]
        blob(img, cx, cy, 28 + (i % 3) * 8, 7 + (i % 2) * 3, cols, 70 + i)
        blob(img, cx + 18, cy + 2, 18, 5, cols, 80 + i)
    # far terrain under sky
    for x in range(512):
        if region == "mountains":
            h = int(18 + 28 * abs(math.sin(x * 0.012)) + 10 * abs(math.sin(x * 0.04)))
            for y in range(112 - h, 112):
                px(img, x, y, mix(b["sky_top"], (50, 60, 80), 0.55 + (y - (112 - h)) * 0.01))
            if h > 30:
                px(img, x, 112 - h, (235, 242, 250))
        elif region in ("jungle", "wetlands"):
            h = 16 + (x * 11) % 36
            for y in range(112 - h, 112):
                px(img, x, y, b["para"][0] if (x + y) % 2 == 0 else b["para"][1])
        else:
            h = int(8 + 12 * abs(math.sin(x * 0.02)))
            for y in range(112 - h, 112):
                px(img, x, y, mix(b["sky_bot"], b["para"][0], 0.5))
    return img


def make_parallax(region):
    img = Image.new("RGBA", (512, 88), (0, 0, 0, 0))
    p = BIOME[region]["para"]
    leaf = BIOME[region]["leaf"]
    for x in range(512):
        h = 20 + int(24 * abs(math.sin(x * 0.018)) + 12 * abs(math.sin(x * 0.05 + 0.7)))
        if region == "mountains":
            h = 28 + int(36 * abs(math.sin(x * 0.013)) + 14 * abs(math.sin(x * 0.037)))
        for y in range(88 - h, 88):
            t = (y - (88 - h)) / max(1, h)
            c = mix(p[0], p[1], t)
            if (x // 3 + y) % 8 == 0:
                c = p[2]
            px(img, x, y, c, 235)
        if region != "mountains" and x % 15 == 0:
            th = 10 + (x % 7) * 2
            bark_trunk(img, x, 88 - h - th, 3, th, BIOME[region]["trunk"], x)
            blob(img, x + 1, 88 - h - th, 7, 5, leaf, x)
        if region == "mountains" and h > 40:
            for yy in range(3):
                px(img, x, 88 - h + yy, (230, 238, 248), 200)
    return img


def make_wall(region):
    img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    w = BIOME[region]["wall"]
    for y in range(128):
        for x in range(128):
            bx, by = x // 16, y // 12
            c = w[(bx + by) % 3]
            tx, ty = x % 16, y % 12
            if tx == 0 or ty == 0:
                c = w[3]
            if tx == 15 or ty == 11:
                c = shade(w[(bx + by) % 3], 1.15)
            if (x * 3 + y * 5) % 17 == 0:
                c = shade(c, 0.85)
            px(img, x, y, c)
    rng = random.Random(region + "wall")
    for _ in range(70):
        x, y = rng.randint(0, 127), rng.randint(0, 127)
        if region == "mountains":
            px(img, x, y, (230, 238, 248)); px(img, x + 1, y, (200, 210, 220))
        elif region == "jungle":
            px(img, x, y, (40, 120, 50)); px(img, x + 1, y, (20, 90, 35))
        elif region == "wetlands":
            px(img, x, y, (40, 100, 80))
        else:
            px(img, x, y, shade(w[0], 1.25))
    return img


def make_lily():
    img = Image.new("RGBA", (48, 40), (0, 0, 0, 0))
    blob(img, 24, 28, 18, 8, [(50, 140, 90), (30, 110, 70), (18, 80, 50), (10, 55, 35)], 1)
    for a in range(8):
        ang = a * math.pi / 4
        blob(img, int(24 + math.cos(ang) * 7), int(14 + math.sin(ang) * 4), 5, 3,
             [(240, 210, 90), (220, 180, 60), (180, 130, 40), (140, 90, 20)], 10 + a)
    blob(img, 24, 14, 4, 4, [(220, 140, 40), (180, 100, 30), (140, 70, 20), (100, 50, 15)], 99)
    outline_opaque(img)
    return img


def make_landmark(kind):
    img = Image.new("RGBA", (96, 72), (0, 0, 0, 0))
    if kind == "watering_hole":
        soft_shadow(img, 48, 58, 30, 6)
        blob(img, 48, 48, 32, 14, [(40, 120, 150), (30, 95, 125), (20, 70, 100), (12, 50, 75)], 1)
        blob(img, 48, 46, 20, 8, [(90, 180, 190), (50, 140, 160), (30, 100, 130), (20, 70, 100)], 2)
        for x in range(20, 76, 5):
            blob(img, x, 36, 3, 6, BIOME["africa"]["grass"], x)
    elif kind == "cairn":
        for i, (cx, cy, rx, ry) in enumerate([(48, 52, 16, 8), (48, 40, 12, 8), (48, 28, 8, 8)]):
            blob(img, cx, cy, rx, ry, BIOME["mountains"]["rock"], 10 + i)
    elif kind == "boardwalk":
        for i in range(7):
            bark_trunk(img, 12 + i * 11, 28, 9, 28, BIOME["wetlands"]["trunk"], i)
        bark_trunk(img, 10, 54, 76, 5, BIOME["wetlands"]["trunk"], 9)
    elif kind == "reed_blind":
        for x in range(18, 78, 3):
            for y in range(12, 60):
                px(img, x, y, BIOME["wetlands"]["grass"][(x + y) % 3])
        bark_trunk(img, 28, 24, 40, 22, BIOME["wetlands"]["trunk"], 1)
    elif kind == "ranger_post":
        bark_trunk(img, 34, 18, 28, 42, BIOME["africa"]["trunk"], 1)
        bark_trunk(img, 28, 12, 40, 10, BIOME["africa"]["trunk"], 2)
        for y in range(30, 42):
            for x in range(42, 52):
                px(img, x, y, (50, 110, 160))
    else:
        blob(img, 48, 30, 34, 22, BIOME["jungle"]["leaf"], 1)
        blob(img, 48, 30, 12, 8, [(40, 70, 120), (30, 55, 95), (20, 40, 70), (12, 28, 50)], 2)
        for x in range(24, 72, 6):
            bark_trunk(img, x, 44, 3, 20, BIOME["jungle"]["trunk"], x)
    outline_opaque(img)
    return img


def main():
    n = 0
    for region in ("africa", "mountains", "jungle", "wetlands"):
        for i in range(1, 4):
            save(make_tree(region, i), "assets", "props", f"{region}_tree{i}.png"); n += 1
        for i in range(1, 6):
            save(make_rock(region, i), "assets", "props", f"{region}_rock{i}.png"); n += 1
        for i in range(1, 4):
            save(make_grass(region, i), "assets", "props", f"{region}_grass{i}.png"); n += 1
        for i in range(1, 3):
            save(make_bush(region, i), "assets", "props", f"{region}_bush{i}.png"); n += 1
        save(make_ground(region), "assets", "ground", f"{region}.png"); n += 1
        save(make_sky(region), "assets", "sky", f"{region}.png"); n += 1
        save(make_parallax(region), "assets", "parallax", f"{region}.png"); n += 1
        save(make_wall(region), "assets", "walls", f"{region}.png"); n += 1
        save(make_wall(region).resize((64, 64), Image.NEAREST), "assets", "props", f"wall{region}.png"); n += 1

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

    bird = Image.new("RGBA", (32, 20), (0, 0, 0, 0))
    blob(bird, 14, 10, 10, 6, [(60, 60, 70), (40, 40, 50), (25, 25, 35), (15, 15, 20)], 1)
    blob(bird, 22, 8, 4, 3, [(230, 230, 210), (200, 200, 180), (160, 160, 140), (100, 100, 90)], 2)
    for x in range(2, 7):
        px(bird, x, 9, (210, 150, 50)); px(bird, x, 10, (180, 120, 30))
    outline_opaque(bird); save(bird, "assets", "props", "bird.png"); n += 1

    print(f"SNES v40b assets: {n}")


if __name__ == "__main__":
    main()
