# -*- coding: utf-8 -*-
"""SMB3-style NES pixel props for every world.

Super Mario Bros. 3 (NES) graphics rules applied here:
  - Screen: 256 x 240
  - Tiles: 8 x 8, metatiles 16 x 16
  - Sprites: commonly 8 x 16 / 16 x 16 / 16 x 32
  - Per-sprite palette: 3 opaque colors + transparent (~4 slots)

Assets are authored at native pixel size, then nearest-neighbor scaled
4x for raycast billboards (still crisp chunky pixels).
"""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent
OUT = root / "assets" / "props"
SCALE = 4  # NES pixels -> display canvas

# Approximate NES-friendly RGB (common SMB3-like greens/browns/grays)
PAL = {
    "africa": {
        "trunk": [(92, 60, 28), (68, 40, 16), (120, 84, 40)],
        "leaf": [(52, 140, 52), (36, 100, 36), (76, 168, 60)],
        "rock": [(140, 116, 84), (100, 80, 52), (68, 52, 32)],
        "grass": [(116, 168, 52), (84, 132, 36), (148, 196, 68)],
        "bush": [(68, 116, 36), (44, 84, 24), (100, 148, 52)],
    },
    "mountains": {
        "trunk": [(72, 48, 28), (48, 32, 16), (96, 68, 40)],
        "leaf": [(28, 92, 52), (16, 64, 36), (48, 120, 68)],
        "rock": [(168, 176, 188), (120, 128, 140), (88, 96, 108)],
        "grass": [(140, 168, 100), (100, 132, 68), (180, 200, 140)],
        "bush": [(52, 100, 60), (36, 72, 44), (80, 128, 76)],
    },
    "jungle": {
        "trunk": [(64, 40, 20), (40, 24, 12), (88, 56, 28)],
        "leaf": [(20, 120, 48), (8, 80, 32), (40, 156, 64)],
        "rock": [(92, 100, 76), (64, 72, 52), (44, 48, 36)],
        "grass": [(36, 148, 68), (20, 108, 48), (60, 180, 88)],
        "bush": [(24, 108, 52), (12, 72, 36), (48, 140, 68)],
    },
    "wetlands": {
        "trunk": [(76, 56, 36), (52, 36, 20), (100, 76, 48)],
        "leaf": [(36, 116, 84), (20, 80, 60), (56, 148, 108)],
        "rock": [(108, 116, 108), (76, 84, 80), (52, 60, 56)],
        "grass": [(68, 140, 92), (44, 108, 68), (96, 168, 116)],
        "bush": [(44, 108, 76), (28, 76, 52), (72, 140, 96)],
    },
}


def save_nn(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    big = img.resize((img.width * SCALE, img.height * SCALE), Image.NEAREST)
    big.save(path, "PNG")
    return path


def px(img, x, y, c):
    if 0 <= x < img.width and 0 <= y < img.height and c is not None:
        img.putpixel((x, y), c + (255,))


def fill_rect(img, x0, y0, w, h, c):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            px(img, x, y, c)


def fill_diamond(img, cx, cy, rx, ry, c):
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            if abs(x - cx) * ry + abs(y - cy) * rx <= rx * ry:
                px(img, x, y, c)


def outline_rect(img, x0, y0, w, h, c):
    for x in range(x0, x0 + w):
        px(img, x, y0, c)
        px(img, x, y0 + h - 1, c)
    for y in range(y0, y0 + h):
        px(img, x0, y, c)
        px(img, x0 + w - 1, y, c)


# ---------- TREES (16x32 NES-ish tall sprites) ----------
def tree_acacia_flat(pal, variant):
    """Flat-top savannah / wetland canopy."""
    img = Image.new("RGBA", (16, 32), (0, 0, 0, 0))
    t, l = pal["trunk"], pal["leaf"]
    # trunk
    fill_rect(img, 7, 16, 2, 14, t[0])
    fill_rect(img, 7, 16, 1, 14, t[1])
    if variant == 1:
        fill_rect(img, 5, 14, 2, 2, t[0])
        fill_rect(img, 9, 13, 2, 2, t[0])
    elif variant == 2:
        fill_rect(img, 4, 15, 3, 2, t[0])
        fill_rect(img, 9, 14, 3, 2, t[0])
        fill_rect(img, 6, 12, 1, 3, t[1])
    else:
        fill_rect(img, 3, 15, 4, 2, t[0])
        fill_rect(img, 9, 14, 4, 2, t[0])
    # flat canopy (SMB3 bush/tree silhouette)
    cy = 10 + (variant % 3)
    fill_rect(img, 1, cy, 14, 5, l[0])
    fill_rect(img, 2, cy - 2, 12, 3, l[1])
    fill_rect(img, 3, cy + 3, 10, 2, l[2])
    for x in range(2, 14, 3):
        px(img, x, cy - 1, l[2])
    # ground shadow pixels
    fill_rect(img, 5, 30, 6, 1, (0, 0, 0))
    return img


def tree_pine(pal, variant):
    """Layered triangle fir / pine."""
    img = Image.new("RGBA", (16, 32), (0, 0, 0, 0))
    t, l = pal["trunk"], pal["leaf"]
    fill_rect(img, 7, 24, 2, 6, t[0])
    fill_rect(img, 7, 24, 1, 6, t[1])
    layers = [
        (8, 4, 3),
        (7, 8, 4),
        (6, 13, 5),
        (5, 18, 6),
    ]
    if variant == 2:
        layers = [(8, 3, 2), (7, 6, 3), (6, 10, 4), (5, 15, 5), (4, 20, 6)]
    elif variant == 3:
        layers = [(8, 5, 3), (6, 10, 5), (4, 16, 6), (5, 22, 5)]
    for i, (cx, top, half) in enumerate(layers):
        col = l[i % 3]
        for row in range(half + 2):
            w = 1 + row * 2
            if w > half * 2 + 1:
                w = half * 2 + 1
            x0 = cx - w // 2
            fill_rect(img, x0, top + row, w, 1, col)
            if row == 0:
                px(img, cx, top - 1, l[2])
    fill_rect(img, 5, 30, 6, 1, (0, 0, 0))
    return img


def tree_jungle(pal, variant):
    """Tall canopy + hanging vine pixels."""
    img = Image.new("RGBA", (16, 32), (0, 0, 0, 0))
    t, l = pal["trunk"], pal["leaf"]
    tw = 3 if variant == 2 else 2
    fill_rect(img, 8 - tw // 2, 14, tw, 16, t[0])
    fill_rect(img, 8 - tw // 2, 14, 1, 16, t[1])
    # roundish canopy blocks
    blobs = [(8, 8, 6), (4, 10, 4), (12, 10, 4), (8, 5, 4)]
    if variant == 1:
        blobs = [(8, 7, 7), (3, 11, 4), (13, 9, 4), (8, 4, 3)]
    elif variant == 3:
        blobs = [(8, 9, 5), (5, 7, 4), (11, 6, 4), (8, 4, 4), (2, 12, 3)]
    for i, (cx, cy, r) in enumerate(blobs):
        fill_diamond(img, cx, cy, r, max(2, r - 1), l[i % 3])
    # vines
    for vx, top, bot in ((4, 12, 22), (11, 11, 24), (6, 13, 20)):
        if variant == 3 and vx == 6:
            continue
        for y in range(top, bot):
            px(img, vx + ((y // 3) % 2), y, l[1])
    fill_rect(img, 5, 30, 6, 1, (0, 0, 0))
    return img


def make_tree(region, n):
    pal = PAL[region]
    if region == "africa":
        return tree_acacia_flat(pal, n)
    if region == "mountains":
        return tree_pine(pal, n)
    if region == "jungle":
        return tree_jungle(pal, n)
    # wetlands: mix mangrove-ish flat + reed trunk
    if n == 1:
        return tree_acacia_flat(pal, 1)
    if n == 2:
        img = tree_jungle(pal, 2)
        return img
    img = tree_acacia_flat(pal, 3)
    # extra root knees
    t = pal["trunk"]
    fill_rect(img, 4, 26, 2, 4, t[0])
    fill_rect(img, 10, 25, 2, 5, t[0])
    return img


# ---------- ROCKS (16x16) ----------
def make_rock(region, n):
    pal = PAL[region]["rock"]
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    shapes = {
        1: [(2, 8, 12, 6), (4, 5, 8, 4), (6, 3, 5, 3)],
        2: [(1, 9, 14, 5), (3, 6, 10, 4), (5, 4, 6, 3), (8, 2, 3, 3)],
        3: [(3, 7, 10, 7), (5, 4, 7, 4), (2, 10, 4, 4)],
        4: [(2, 6, 6, 8), (7, 8, 7, 6), (5, 4, 5, 4)],
        5: [(4, 9, 9, 5), (3, 6, 11, 4), (6, 3, 5, 4), (9, 5, 4, 3)],
    }
    rects = shapes[n]
    for i, (x, y, w, h) in enumerate(rects):
        fill_rect(img, x, y, w, h, pal[i % 3])
    # highlight / crack
    hi, sh = pal[0], pal[2]
    if region == "mountains":
        # snow cap
        fill_rect(img, rects[0][0] + 1, rects[-1][1], max(3, rects[0][2] - 2), 2, (236, 244, 252))
        fill_rect(img, rects[0][0] + 2, rects[-1][1] + 1, max(2, rects[0][2] - 4), 1, (200, 212, 228))
    else:
        px(img, rects[0][0] + 2, rects[0][1] + 1, hi)
        px(img, rects[0][0] + 3, rects[0][1] + 2, hi)
        for y in range(rects[0][1] + 2, 14, 3):
            px(img, 7 + (n % 3), y, sh)
    fill_rect(img, 4, 15, 8, 1, (0, 0, 0))
    return img


# ---------- GRASS (16x16) ----------
def make_grass(region, n):
    pal = PAL[region]["grass"]
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    # blade patterns — distinct silhouettes
    patterns = {
        1: [  # tuft
            (2, 10, 1, 5), (3, 7, 1, 8), (4, 9, 1, 6), (5, 6, 1, 9),
            (6, 8, 1, 7), (7, 5, 1, 10), (8, 7, 1, 8), (9, 9, 1, 6),
            (10, 6, 1, 9), (11, 10, 1, 5), (12, 8, 1, 7),
        ],
        2: [  # short dense
            (1, 11, 1, 4), (2, 9, 1, 6), (3, 10, 1, 5), (4, 8, 1, 7),
            (5, 11, 1, 4), (6, 9, 1, 6), (7, 10, 1, 5), (8, 8, 1, 7),
            (9, 11, 1, 4), (10, 9, 1, 6), (11, 10, 1, 5), (12, 8, 1, 7), (13, 11, 1, 4),
        ],
        3: [  # tall reeds / wild
            (3, 4, 1, 11), (4, 6, 1, 9), (5, 3, 1, 12), (6, 5, 1, 10),
            (7, 2, 1, 13), (8, 5, 1, 10), (9, 3, 1, 12), (10, 6, 1, 9),
            (11, 4, 1, 11), (12, 7, 1, 8),
        ],
    }
    if region == "wetlands" and n == 3:
        patterns[3] = [  # cattail-ish
            (4, 3, 1, 12), (5, 2, 1, 13), (6, 3, 1, 12),
            (9, 4, 1, 11), (10, 3, 1, 12), (11, 4, 1, 11),
        ]
        fill_rect(img, 4, 2, 3, 3, pal[2])
        fill_rect(img, 9, 3, 3, 3, pal[2])
    for i, (x, y, w, h) in enumerate(patterns[n]):
        fill_rect(img, x, y, w, h, pal[i % 3])
        if i % 4 == 0 and y > 2:
            px(img, x, y - 1, pal[2])
    if region == "mountains":
        # frost tips
        for x in range(3, 13, 2):
            px(img, x, 5 + (x % 3), (220, 232, 240))
    return img


# ---------- BUSHES (16x16) ----------
def make_bush(region, n):
    pal = PAL[region]["bush"]
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    if n == 1:
        # round mound
        fill_rect(img, 2, 8, 12, 6, pal[0])
        fill_rect(img, 3, 6, 10, 3, pal[1])
        fill_rect(img, 5, 4, 6, 3, pal[2])
        fill_rect(img, 4, 9, 3, 2, pal[2])
        fill_rect(img, 9, 10, 3, 2, pal[1])
    else:
        # twin hump / berry bush
        fill_rect(img, 1, 9, 7, 5, pal[0])
        fill_rect(img, 8, 8, 7, 6, pal[1])
        fill_rect(img, 3, 6, 5, 4, pal[2])
        fill_rect(img, 9, 5, 5, 4, pal[0])
        # berries / flowers by biome
        berry = {
            "africa": (196, 84, 36),
            "mountains": (220, 80, 100),
            "jungle": (180, 40, 60),
            "wetlands": (220, 180, 60),
        }[region]
        for bx, by in ((4, 8), (7, 10), (11, 7), (10, 11)):
            px(img, bx, by, berry)
            px(img, bx + 1, by, berry)
    fill_rect(img, 4, 15, 8, 1, (0, 0, 0))
    return img


def main():
    count = 0
    legacy = {}  # map old names -> first variant paths for compatibility
    for region in ("africa", "mountains", "jungle", "wetlands"):
        for n in range(1, 4):
            img = make_tree(region, n)
            p = save_nn(img, OUT / f"{region}_tree{n}.png")
            count += 1
            if n == 1:
                legacy[region] = str(p)
        for n in range(1, 6):
            save_nn(make_rock(region, n), OUT / f"{region}_rock{n}.png")
            count += 1
        for n in range(1, 4):
            save_nn(make_grass(region, n), OUT / f"{region}_grass{n}.png")
            count += 1
        for n in range(1, 3):
            save_nn(make_bush(region, n), OUT / f"{region}_bush{n}.png")
            count += 1

    # Refresh classic prop filenames so landmarks / old spawns stay pixel
    aliases = {
        "acacia": ("africa", "tree", 1),
        "baobab": ("africa", "tree", 2),
        "pine": ("mountains", "tree", 1),
        "mtn_fir": ("mountains", "tree", 2),
        "tree": ("jungle", "tree", 1),
        "jungle_vine": ("jungle", "tree", 3),
        "rock": ("africa", "rock", 1),
        "snowrock": ("mountains", "rock", 1),
        "grass": ("africa", "grass", 1),
        "bush": ("africa", "bush", 1),
        "fern": ("jungle", "grass", 2),
        "reed": ("wetlands", "grass", 3),
        "africa_thorn": ("africa", "bush", 2),
    }
    for name, (reg, kind, n) in aliases.items():
        src = OUT / f"{reg}_{kind}{n}.png"
        dst = OUT / f"{name}.png"
        Image.open(src).save(dst)
        count += 1

    # Wetlands mangrove alias as reed companion already; wet_lily stays floral pixel
    lily = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    fill_rect(lily, 2, 10, 12, 4, (28, 100, 68))
    fill_rect(lily, 3, 9, 10, 2, (40, 128, 84))
    for a in range(8):
        ang = a * 0.785
        import math
        x = int(8 + math.cos(ang) * 3)
        y = int(6 + math.sin(ang) * 2)
        px(lily, x, y, (232, 200, 80))
    fill_rect(lily, 7, 5, 2, 2, (200, 120, 30))
    save_nn(lily, OUT / "wet_lily.png")
    count += 1

    print(f"Wrote {count} SMB3-style prop PNGs to {OUT}")


if __name__ == "__main__":
    main()
