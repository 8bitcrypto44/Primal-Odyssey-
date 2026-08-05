# -*- coding: utf-8 -*-
"""Build SNES Mode-1 worlds — full graphics upgrade (v46).

Implements: water/path/cliff autotiles, animated water frames, hand map chunks,
per-biome tile swaps, Agent Run walk, facing animal sheets, note/landmark props.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import json
import random
import collections

from snes_gfx_v47 import make_topdown_animals, load_biome_props, copy_parallax

root = Path(__file__).resolve().parent
snes = root / "assets" / "snes"
out = snes / "built"
out.mkdir(parents=True, exist_ok=True)

puny = Image.open(snes / "punyworld.png").convert("RGBA")
fol = Image.open(snes / "idylwild" / "foliage_pack.png").convert("RGBA")
TW = 16
MAP_W = MAP_H = 80


def tile(img, col, row, w=1, h=1):
    x, y = col * TW, row * TW
    return img.crop((x, y, x + w * TW, y + h * TW))


def punch_black(im, thr=14):
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if r < thr and g < thr and b < thr:
                px[x, y] = (0, 0, 0, 0)
    return im


def recolor(img, hue_shift=0, sat=1.0, bright=1.0):
    px = img.load()
    out_img = img.copy()
    op = out_img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            if abs(hue_shift) > 0.01:
                if hue_shift > 0:
                    r = min(255, int(r + (g - r) * hue_shift * 0.35 + 18 * hue_shift))
                    g = min(255, int(g * (1 - hue_shift * 0.05)))
                else:
                    hs = -hue_shift
                    b = min(255, int(b + 38 * hs))
                    r = max(0, int(r * (1 - 0.18 * hs)))
            r = max(0, min(255, int(r * bright)))
            g = max(0, min(255, int(g * bright * sat + r * (1 - sat) * 0.2)))
            b = max(0, min(255, int(b * bright)))
            op[x, y] = (r, g, b, a)
    return out_img


# --- Ground catalog (verified Puny coords) ---
GROUND = {
    "grass": (0, 0), "grass2": (1, 0), "grass3": (2, 0),
    "grass4": (0, 1), "grass5": (1, 1), "grass6": (2, 1),
    "dark_grass": (0, 2), "dark_grass2": (1, 2),
    "mud": (12, 2), "mud2": (13, 2),
    "sand": (14, 0), "sand2": (15, 0),
    "snow": (20, 0), "snow2": (22, 0),
    # paths / dirt (autotiled variants)
    "dirt": (8, 0), "dirt2": (8, 1), "path": (5, 1),
    "path_n": (5, 0), "path_s": (5, 2), "path_w": (3, 1), "path_e": (7, 1),
    "path_nw": (3, 0), "path_ne": (6, 0), "path_sw": (3, 2), "path_se": (6, 2),
    "path_nsw": (4, 0), "path_nse": (6, 1), "path_we": (4, 1), "path_full": (8, 1),
    # grass↔dirt field blends (soft edges, not just roads)
    "blend_n": (4, 0), "blend_s": (4, 2), "blend_w": (3, 1), "blend_e": (6, 1),
    "blend_nw": (3, 0), "blend_ne": (6, 0), "blend_sw": (3, 2), "blend_se": (6, 2),
    "blend_spot": (10, 0), "blend_spot2": (11, 0), "blend_spot3": (12, 0),
    # cliffs
    "cliff": (0, 6), "cliff2": (1, 6), "cliff3": (2, 6), "cliff4": (3, 6), "cliff5": (4, 6),
    # extra water shore pieces (tighter lakes)
    "wInNE": (0, 10), "wInNW": (0, 11), "wInSE": (0, 14), "wInSW": (0, 15),
    "wCapN": (5, 10), "wCapS": (5, 14), "wCapE": (4, 11), "wCapW": (1, 11),
    # open / animated water
    "water": (22, 10), "water2": (23, 10), "water3": (24, 10),
    "water_a": (10, 10), "water_b": (11, 10), "water_c": (8, 11),
    # grass↔water shores (4-bit + diagonals)
    "wN": (2, 10), "wE": (3, 11), "wS": (2, 14), "wW": (1, 11),
    "wNE": (3, 10), "wSE": (3, 14), "wSW": (1, 14), "wNW": (1, 10),
    "wNS": (0, 12), "wEW": (2, 11), "wNEW": (2, 10), "wSEW": (2, 14),
    "wNES": (3, 12), "wNWS": (1, 12), "wALL": (5, 11),
    "wN2": (2, 13), "wE2": (3, 13), "wS2": (2, 15), "wW2": (1, 13),
    # sand↔water (africa beaches)
    "swN": (13, 10), "swE": (14, 11), "swS": (13, 14), "swW": (12, 11),
    "swNE": (14, 10), "swSE": (14, 14), "swSW": (12, 14), "swNW": (12, 10),
    "swC": (13, 11),
}

SOLID_GROUND = {
    "cliff", "cliff2", "cliff3", "cliff4", "cliff5",
    "water", "water2", "water3", "water_a", "water_b", "water_c",
}
for k in list(GROUND):
    if k.startswith("w") or k.startswith("sw"):
        SOLID_GROUND.add(k)

WATER_KEYS = {k for k in GROUND if k.startswith("water") or k.startswith("w") or k.startswith("sw")}


def is_waterish(t):
    return t in WATER_KEYS or (isinstance(t, str) and (t.startswith("water") or t.startswith("w") or t.startswith("sw")))


def is_pathish(t):
    return t in ("dirt", "dirt2", "path") or (isinstance(t, str) and t.startswith("path"))


# 4-bit: N=1 E=2 S=4 W=8 — value means that side is LAND (for water cells)
WATER_MASK = {
    0: "water",
    1: "wN", 2: "wE", 4: "wS", 8: "wW",
    3: "wNE", 6: "wSE", 12: "wSW", 9: "wNW",
    5: "wNS", 10: "wEW",
    7: "wNES", 11: "wNEW", 13: "wNWS", 14: "wSEW",
    15: "wALL",
}
# prefer capped / inner tiles for single-edge lakes
WATER_MASK_TIGHT = dict(WATER_MASK)
WATER_MASK_TIGHT.update({1: "wCapN", 2: "wCapE", 4: "wCapS", 8: "wCapW", 15: "wALL"})
SAND_WATER_MASK = {
    0: "water",
    1: "swN", 2: "swE", 4: "swS", 8: "swW",
    3: "swNE", 6: "swSE", 12: "swSW", 9: "swNW",
    5: "swC", 10: "swC",
    7: "swNE", 11: "swNW", 13: "swSW", 14: "swSE",
    15: "swC",
}

# path: N=1 E=2 S=4 W=8 — value means that side IS also path
PATH_MASK = {
    0: "dirt",
    1: "path_s",  # only N path → this is south endcap... actually if only N is path, we're south spur
    2: "path_w",
    4: "path_n",
    8: "path_e",
    5: "path",      # N+S vertical
    10: "path_we",  # E+W horizontal
    3: "path_sw", 6: "path_nw", 12: "path_ne", 9: "path_se",
    7: "path_nsw", 11: "path_nse", 13: "path_we", 14: "path_we",
    15: "path_full",
}


def extract_puny_trees():
    crops = {
        "ptree_a": (0, 7, 3, 3), "ptree_b": (3, 7, 3, 3), "ptree_c": (9, 7, 3, 3),
        "ptree_d": (12, 7, 3, 3), "ptree_e": (8, 7, 1, 3), "ptree_f": (17, 7, 1, 3),
        "ptree_g": (0, 7, 2, 2), "ptree_h": (6, 7, 2, 2),
    }
    out_o = {}
    for name, (c, r, w, h) in crops.items():
        im = punch_black(tile(puny, c, r, w, h))
        if im.getbbox():
            out_o[name] = im
    # landmarks
    out_o["sign"] = punch_black(tile(puny, 19, 4, 1, 2))
    out_o["cave"] = punch_black(tile(puny, 20, 4, 1, 2))
    out_o["bridge"] = punch_black(tile(puny, 6, 6, 1, 1))
    return out_o


def extract_idylwild():
    w, h = fol.size
    px = fol.load()
    vis = [[False] * w for _ in range(h)]
    comps = []
    for y in range(h):
        for x in range(w):
            if vis[y][x] or px[x, y][3] < 40:
                continue
            q = collections.deque([(x, y)])
            vis[y][x] = True
            minx = maxx = x
            miny = maxy = y
            n = 0
            while q:
                cx, cy = q.popleft()
                n += 1
                minx = min(minx, cx); maxx = max(maxx, cx)
                miny = min(miny, cy); maxy = max(maxy, cy)
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < w and 0 <= ny < h and not vis[ny][nx] and px[nx, ny][3] >= 40:
                        vis[ny][nx] = True
                        q.append((nx, ny))
            bw, bh = maxx - minx + 1, maxy - miny + 1
            if n >= 80 and 12 <= bw <= 80 and 12 <= bh <= 110:
                comps.append((n, minx, miny, bw, bh))
    comps.sort(reverse=True)
    objs = {}
    trees, bushes, rocks, details = [], [], [], []
    for n, x, y, bw, bh in comps[:50]:
        crop = fol.crop((x, y, x + bw, y + bh))
        aspect = bh / max(1, bw)
        samp = [p for p in crop.getdata() if p[3] > 40]
        if not samp:
            continue
        avg_r = sum(p[0] for p in samp) / len(samp)
        avg_g = sum(p[1] for p in samp) / len(samp)
        avg_b = sum(p[2] for p in samp) / len(samp)
        grayish = avg_g < avg_r + 15 and abs(avg_r - avg_b) < 35 and avg_g < 140
        if bh >= 48 and aspect >= 1.05:
            trees.append(crop)
        elif bw <= 36 and bh <= 36 and n < 900:
            if grayish:
                rocks.append(crop)
            else:
                details.append(crop)
        elif bh >= 28:
            bushes.append(crop)
        else:
            details.append(crop)
    for i, im in enumerate(trees[:8]):
        objs[f"tree{i+1}"] = im
    for i, im in enumerate(bushes[:10]):
        objs[f"bush{i+1}"] = im
    for i, im in enumerate(rocks[:6]):
        objs[f"rock{i+1}"] = im
    for i, im in enumerate(details[:12]):
        objs[f"detail{i+1}"] = im
    return objs


def make_player_sheet():
    """Assemble CC0 Agent Run walk + Idle still (16x24, 4 dir x 3 frames + idle)."""
    run_dir = snes / "player" / "agent" / "Agent Free Version" / "Run"
    idle_dir = snes / "player" / "agent" / "Agent Free Version" / "Idle"
    # 3 run frames + 1 idle column
    sheet = Image.new("RGBA", (16 * 4, 24 * 4), (0, 0, 0, 0))
    frames = {}
    dirs = [("down", "SOUTH"), ("left", "WEST"), ("right", "EAST"), ("up", "NORTH")]

    def khaki(fr):
        px = fr.load()
        for y in range(fr.height):
            for x in range(fr.width):
                r, g, b, a = px[x, y]
                if a < 8:
                    continue
                if b > r + 20 and b > g and b > 80:
                    px[x, y] = (
                        min(255, int(r * 0.55 + 45)),
                        min(255, int(g * 0.85 + 55)),
                        min(255, int(b * 0.3 + 20)),
                        a,
                    )
        return fr

    for di, (dname, dkey) in enumerate(dirs):
        run = Image.open(run_dir / f"C_Run_{dkey}_strip4.png").convert("RGBA")
        idle_path = idle_dir / f"C_Idle_{dkey}_strip4.png"
        if not idle_path.exists():
            idle_path = snes / "player" / "agent" / "Agent Free Version" / "Walk" / f"C_Idle_{dkey}_strip4.png"
        idle = Image.open(idle_path).convert("RGBA")
        for fi in range(3):
            fr = khaki(run.crop((fi * 16, 0, fi * 16 + 16, 24)))
            sheet.paste(fr, (fi * 16, di * 24), fr)
            frames[f"player_{dname}_{fi}"] = {
                "x": fi * 16, "y": di * 24, "w": 16, "h": 24, "solid": False
            }
        ifr = khaki(idle.crop((0, 0, 16, 24)))
        sheet.paste(ifr, (3 * 16, di * 24), ifr)
        frames[f"player_{dname}_idle"] = {
            "x": 3 * 16, "y": di * 24, "w": 16, "h": 24, "solid": False
        }
    sheet.save(out / "player.png")
    return frames


def make_marker_props():
    """Field note parchment + landmark cairn/flag for SNES world."""
    note = Image.new("RGBA", (14, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(note)
    d.rectangle((1, 1, 12, 14), fill=(232, 214, 170, 255), outline=(90, 60, 30, 255))
    d.line((3, 4, 10, 4), fill=(120, 80, 40, 255))
    d.line((3, 7, 10, 7), fill=(120, 80, 40, 255))
    d.line((3, 10, 8, 10), fill=(120, 80, 40, 255))
    d.polygon([(9, 1), (12, 1), (12, 5)], fill=(200, 170, 110, 255))

    cairn = Image.new("RGBA", (16, 18), (0, 0, 0, 0))
    d = ImageDraw.Draw(cairn)
    d.ellipse((2, 10, 14, 17), fill=(110, 110, 105, 255), outline=(60, 60, 55, 255))
    d.ellipse((4, 6, 12, 13), fill=(130, 125, 118, 255), outline=(70, 68, 60, 255))
    d.ellipse((5, 2, 11, 8), fill=(145, 140, 130, 255), outline=(70, 68, 60, 255))
    d.rectangle((7, 0, 8, 4), fill=(180, 60, 40, 255))

    flag = Image.new("RGBA", (14, 18), (0, 0, 0, 0))
    d = ImageDraw.Draw(flag)
    d.rectangle((2, 0, 3, 17), fill=(90, 70, 40, 255))
    d.polygon([(3, 1), (12, 4), (3, 7)], fill=(61, 155, 95, 255), outline=(20, 80, 40, 255))
    return {"field_note": note, "cairn": cairn, "trail_flag": flag}


# Per-biome ground tile remaps (same frame IDs, different Puny art)
BIOME_TILE_SWAP = {
    "africa": {},
    "mountains": {
        "grass": (20, 0), "grass2": (22, 0), "grass3": (20, 0),
        "grass4": (22, 0), "grass5": (20, 0), "grass6": (22, 0),
        "dark_grass": (8, 0), "dark_grass2": (8, 1),
        "sand": (20, 0), "sand2": (22, 0),
        "mud": (8, 0), "mud2": (8, 1),
    },
    "jungle": {
        "grass": (0, 2), "grass2": (1, 2), "grass3": (0, 2),
        "grass4": (1, 2), "grass5": (0, 2), "grass6": (1, 2),
        "sand": (12, 2), "sand2": (13, 2),
        "dirt": (12, 2), "dirt2": (13, 2),
    },
    "wetlands": {
        "grass": (12, 2), "grass2": (13, 2), "grass3": (0, 2),
        "grass4": (1, 2), "grass5": (12, 2), "grass6": (13, 2),
        "sand": (12, 2), "sand2": (13, 2),
        "dirt": (12, 2), "dirt2": (13, 2),
        "dark_grass": (0, 2), "dark_grass2": (1, 2),
    },
}


def build_atlas(objs, player_frames):
    frames = {}
    atlas_w, atlas_h = 1024, 2400
    atlas = Image.new("RGBA", (atlas_w, atlas_h), (0, 0, 0, 0))
    x = y = 0
    row_h = TW
    for k, (col, row) in GROUND.items():
        t = tile(puny, col, row)
        if x + TW > atlas_w:
            x = 0
            y += row_h
        atlas.paste(t, (x, y))
        frames[k] = {"x": x, "y": y, "w": TW, "h": TW, "solid": k in SOLID_GROUND}
        x += TW
    x = 0
    y += TW + 8
    row_h = 0
    for name, im in objs.items():
        w, h = im.size
        if x + w + 2 > atlas_w:
            x = 0
            y += row_h + 4
            row_h = 0
        if y + h > atlas_h:
            na = Image.new("RGBA", (atlas_w, atlas_h + 320), (0, 0, 0, 0))
            na.paste(atlas, (0, 0))
            atlas = na
            atlas_h = atlas.height
        atlas.paste(im, (x, y), im)
        solid = (
            name.startswith("tree") or name.startswith("ptree") or name.startswith("rock")
            or (name.startswith("bp_") and ("tree" in name or "rock" in name or "baobab" in name or "pine" in name or "fir" in name))
            or name in ("cave", "sign", "cairn", "camp_tent", "camp_crate")
        )
        feet = max(8, min(22, h // 5)) if h >= 64 else max(6, min(14, h // 5))
        canopy = (
            name.startswith("tree") or name.startswith("ptree")
            or (name.startswith("bp_") and ("tree" in name or "baobab" in name or "pine" in name or "fir" in name or "acacia" in name))
        )
        frames[name] = {
            "x": x, "y": y, "w": w, "h": h, "solid": solid,
            "feet": feet, "anchor": h - feet // 2,
            "canopy": canopy, "canopyH": int(h * 0.58) if canopy else 0,
            "anim": name.startswith("bush") or name.startswith("detail") or "bush" in name or "grass" in name or name == "camp_fire",
            "biome": (
                "mountains" if "pine" in name or "mountains" in name or name.startswith("ptree") else
                "africa" if "africa" in name or "baobab" in name or "acacia" in name else
                "jungle" if "jungle" in name else
                "wetlands" if "wetlands" in name or "wet_" in name else
                "any"
            ),
        }
        x += w + 2
        row_h = max(row_h, h)
    # player frames live on separate sheet — store meta only
    frames.update(player_frames)
    atlas.save(out / "atlas.png")
    return frames


def water_autotile(ground, region):
    H, W = len(ground), len(ground[0])
    mask_table = SAND_WATER_MASK if region == "africa" else WATER_MASK_TIGHT
    raw = [[str(ground[y][x]).startswith("water") for x in range(W)] for y in range(H)]
    out_g = [row[:] for row in ground]
    for y in range(H):
        for x in range(W):
            if not raw[y][x]:
                continue
            def land(nx, ny):
                if ny < 0 or nx < 0 or ny >= H or nx >= W:
                    return True
                return not raw[ny][nx]
            bits = 0
            if land(x, y - 1): bits |= 1
            if land(x + 1, y): bits |= 2
            if land(x, y + 1): bits |= 4
            if land(x - 1, y): bits |= 8
            if bits == 0:
                out_g[y][x] = ("water", "water2", "water3", "water_a")[(x + y) % 4]
            else:
                out_g[y][x] = mask_table.get(bits, "water")
    return out_g


def dirt_blend_pass(ground):
    """Soften grass cells that touch dirt/path/sand with blend metatiles."""
    H, W = len(ground), len(ground[0])
    dirtish = set()
    for y in range(H):
        for x in range(W):
            t = ground[y][x]
            if is_pathish(t) or t.startswith("sand") or t.startswith("dirt") or t.startswith("blend"):
                dirtish.add((x, y))
    out_g = [row[:] for row in ground]
    grassish = ("grass", "grass2", "grass3", "grass4", "grass5", "grass6", "dark_grass", "dark_grass2", "mud", "mud2", "snow", "snow2")
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            t = ground[y][x]
            if t not in grassish:
                continue
            n = (x, y - 1) in dirtish
            s = (x, y + 1) in dirtish
            e = (x + 1, y) in dirtish
            w = (x - 1, y) in dirtish
            bits = (1 if n else 0) | (2 if e else 0) | (4 if s else 0) | (8 if w else 0)
            if bits == 0:
                continue
            blend = {
                1: "blend_n", 2: "blend_e", 4: "blend_s", 8: "blend_w",
                3: "blend_ne", 6: "blend_se", 12: "blend_sw", 9: "blend_nw",
                5: "blend_spot", 10: "blend_spot2",
            }.get(bits, "blend_spot3")
            out_g[y][x] = blend
    return out_g


def path_autotile(ground):
    H, W = len(ground), len(ground[0])
    raw = [[is_pathish(ground[y][x]) for x in range(W)] for y in range(H)]
    out_g = [row[:] for row in ground]
    for y in range(H):
        for x in range(W):
            if not raw[y][x]:
                continue
            def p(nx, ny):
                if ny < 0 or nx < 0 or ny >= H or nx >= W:
                    return False
                return raw[ny][nx]
            bits = 0
            if p(x, y - 1): bits |= 1
            if p(x + 1, y): bits |= 2
            if p(x, y + 1): bits |= 4
            if p(x - 1, y): bits |= 8
            out_g[y][x] = PATH_MASK.get(bits, "dirt")
    return out_g


def stamp_rect(ground, x0, y0, x1, y1, tid, only_if=None):
    H, W = len(ground), len(ground[0])
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if 1 <= x < W - 1 and 1 <= y < H - 1:
                if only_if and not only_if(ground[y][x]):
                    continue
                ground[y][x] = tid


def stamp_disk(ground, cx, cy, rad, tid):
    H, W = len(ground), len(ground[0])
    for y in range(cy - rad, cy + rad + 1):
        for x in range(cx - rad, cx + rad + 1):
            if 1 <= x < W - 1 and 1 <= y < H - 1:
                if (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad:
                    ground[y][x] = tid


def chunk_watering_hole(ground, objects, frames, cx, cy, rnd, region):
    rad = rnd.randint(4, 6)
    fill = "water"
    stamp_disk(ground, cx, cy, rad, fill)
    # reeds / details around rim
    bush_ids = [k for k in frames if k.startswith("bush") or k.startswith("detail")]
    for _ in range(12):
        ang = rnd.random() * 6.28
        tx = int(cx + (rad + 1) * __import__("math").cos(ang))
        ty = int(cy + (rad + 1) * __import__("math").sin(ang))
        if bush_ids and 2 <= tx < MAP_W - 2 and 2 <= ty < MAP_H - 2:
            oid = bush_ids[rnd.randint(0, len(bush_ids) - 1)]
            objects.append({"id": oid, "x": tx * TW + 8, "y": ty * TW + 12})


def chunk_grove(ground, objects, frames, cx, cy, rnd, region):
    tree_ids = [k for k in frames if k.startswith("ptree") or k.startswith("tree")]
    if region == "mountains":
        tree_ids = [k for k in tree_ids if "ptree" in k] or tree_ids
    for _ in range(rnd.randint(8, 14)):
        tx = cx + rnd.randint(-4, 4)
        ty = cy + rnd.randint(-4, 4)
        if 3 <= tx < MAP_W - 3 and 3 <= ty < MAP_H - 3 and tree_ids:
            if is_waterish(ground[ty][tx]):
                continue
            oid = tree_ids[rnd.randint(0, len(tree_ids) - 1)]
            objects.append({"id": oid, "x": tx * TW + 8, "y": ty * TW + 8})
            if rnd.random() < 0.4:
                ground[ty][tx] = "dark_grass" if region == "jungle" else "grass2"


def chunk_camp(ground, objects, frames, cx, cy, rnd, region):
    stamp_rect(ground, cx - 3, cy - 3, cx + 3, cy + 3, "dirt")
    stamp_rect(ground, cx - 1, cy - 1, cx + 1, cy + 1, "path")
    # Tent / fire / crates / flag
    for oid, dx, dy in (
        ("camp_tent", -2, -1),
        ("camp_fire", 0, 0),
        ("camp_crate", 2, -1),
        ("camp_crate", 2, 1),
        ("trail_flag", -1, 2),
        ("sign", 2, -2),
    ):
        if oid in frames:
            objects.append({"id": oid, "x": (cx + dx) * TW + 8, "y": (cy + dy) * TW + 10})
    # seating rocks / biome bushes
    rock_ids = [k for k in frames if k.startswith("rock") or k.startswith(f"bp_{region}_") and "rock" in k]
    bush_ids = [k for k in frames if k.startswith(f"bp_{region}_") and ("bush" in k or "grass" in k)]
    if not bush_ids:
        bush_ids = [k for k in frames if k.startswith("bush") or k.startswith("detail")]
    for dx, dy in ((-2, 2), (1, 2), (-3, 0), (3, 0)):
        pool = rock_ids if rnd.random() < 0.55 and rock_ids else bush_ids
        if pool:
            objects.append({"id": pool[rnd.randint(0, len(pool) - 1)],
                            "x": (cx + dx) * TW + 8, "y": (cy + dy) * TW + 12})


def chunk_ridge(ground, objects, frames, cx, cy, rnd, region):
    length = rnd.randint(8, 14)
    for i in range(length):
        tx, ty = cx + i, cy + (i % 3 - 1)
        if 1 <= tx < MAP_W - 1 and 1 <= ty < MAP_H - 1:
            ground[ty][tx] = ("cliff", "cliff2", "cliff3", "cliff4", "cliff5")[i % 5]
    if "cave" in frames and 2 <= cx + length // 2 < MAP_W - 2:
        objects.append({"id": "cave", "x": (cx + length // 2) * TW + 8, "y": cy * TW + 8})


def chunk_oasis(ground, objects, frames, cx, cy, rnd):
    """Africa postcard: sand ring + pond + palms/bushes."""
    stamp_disk(ground, cx, cy, 6, "sand")
    stamp_disk(ground, cx, cy, 3, "water")
    bush_ids = [k for k in frames if k.startswith("bush") or k.startswith("tree")]
    for ang_i in range(8):
        import math
        ang = ang_i * 0.785
        tx = int(cx + 5 * math.cos(ang))
        ty = int(cy + 5 * math.sin(ang))
        if bush_ids and 2 <= tx < MAP_W - 2 and 2 <= ty < MAP_H - 2:
            objects.append({"id": bush_ids[ang_i % len(bush_ids)], "x": tx * TW + 8, "y": ty * TW + 10})


def chunk_lookout(ground, objects, frames, cx, cy, rnd):
    stamp_rect(ground, cx - 1, cy - 4, cx + 6, cy + 1, "cliff")
    for i in range(6):
        if 1 <= cx + i < MAP_W - 1 and 1 <= cy < MAP_H - 1:
            ground[cy][cx + i] = ("cliff", "cliff2", "cliff3")[i % 3]
    if "cave" in frames:
        objects.append({"id": "cave", "x": (cx + 2) * TW + 8, "y": cy * TW + 8})
    if "sign" in frames:
        objects.append({"id": "sign", "x": (cx - 1) * TW + 8, "y": (cy + 2) * TW + 8})
    stamp_rect(ground, cx - 1, cy + 2, cx + 3, cy + 4, "dirt")


def chunk_trail(ground, objects, frames, x0, y0, rnd, steps=40):
    x, y = x0, y0
    for _ in range(steps):
        if 1 <= x < MAP_W - 1 and 1 <= y < MAP_H - 1 and not is_waterish(ground[y][x]):
            ground[y][x] = "path"
            if rnd.random() < 0.35:
                for ox, oy in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                    nx, ny = x + ox, y + oy
                    if 1 <= nx < MAP_W - 1 and 1 <= ny < MAP_H - 1 and not is_waterish(ground[ny][nx]):
                        if ground[ny][nx].startswith("cliff"):
                            continue
                        if rnd.random() < 0.5:
                            ground[ny][nx] = "dirt2"
        x += rnd.choice([-1, 0, 1, 1])
        y += rnd.choice([-1, 0, 0, 1, -1])
        x = max(2, min(MAP_W - 3, x))
        y = max(2, min(MAP_H - 3, y))


def gen_map(region, frames, seed=42):
    rnd = random.Random(seed + hash(region) % 9973)
    W = H = MAP_W

    if region == "mountains":
        grass_var = ["snow", "snow2", "dirt", "grass"]
    elif region == "wetlands":
        grass_var = ["mud", "mud2", "dark_grass", "grass"]
    elif region == "jungle":
        grass_var = ["dark_grass", "dark_grass2", "grass", "grass2"]
    else:  # africa
        grass_var = ["grass", "grass2", "grass3", "grass4", "sand", "dirt"]

    ground = [[grass_var[rnd.randint(0, len(grass_var) - 1)] for _ in range(W)] for _ in range(H)]
    for i in range(W):
        ground[0][i] = ground[H - 1][i] = "cliff"
        ground[i][0] = ground[i][H - 1] = "cliff"

    objects = []

    # biome water count
    pools = {"africa": 2, "mountains": 1, "jungle": 2, "wetlands": 5}[region]
    for _ in range(pools):
        cx, cy = rnd.randint(14, W - 14), rnd.randint(14, H - 14)
        chunk_watering_hole(ground, objects, frames, cx, cy, rnd, region)

    # trails
    chunk_trail(ground, objects, frames, 6, H // 2, rnd, 90)
    chunk_trail(ground, objects, frames, W // 3, 8, rnd, 55)

    # hand chunks
    chunk_camp(ground, objects, frames, W // 2, H // 2, rnd, region)
    chunk_grove(ground, objects, frames, W // 2 + 12, H // 2 - 10, rnd, region)
    chunk_grove(ground, objects, frames, W // 2 - 14, H // 2 + 8, rnd, region)
    if region in ("mountains", "jungle"):
        chunk_ridge(ground, objects, frames, 10, 18, rnd, region)
    if region == "africa":
        chunk_grove(ground, objects, frames, 20, 55, rnd, region)
        # sandy clearing
        stamp_disk(ground, 55, 25, 5, "sand")
        chunk_oasis(ground, objects, frames, 55, 50, rnd)
    if region in ("mountains", "jungle"):
        chunk_lookout(ground, objects, frames, 12, 22, rnd)
    if region == "wetlands":
        for _ in range(3):
            chunk_watering_hole(ground, objects, frames, rnd.randint(15, W - 15), rnd.randint(15, H - 15), rnd, region)

    # extra grove scatter
    for _ in range(4 if region == "jungle" else 2):
        chunk_grove(ground, objects, frames, rnd.randint(10, W - 10), rnd.randint(10, H - 10), rnd, region)

    # clear spawn plaza
    sx, sy = W // 2, H // 2
    for yy in range(sy - 3, sy + 4):
        for xx in range(sx - 3, sx + 4):
            if 1 <= xx < W - 1 and 1 <= yy < H - 1:
                ground[yy][xx] = "dirt" if abs(xx - sx) + abs(yy - sy) <= 2 else grass_var[0]

    ground = water_autotile(ground, region)
    ground = path_autotile(ground)
    ground = dirt_blend_pass(ground)

    def walkable(tx, ty):
        t = ground[ty][tx]
        return t not in SOLID_GROUND and not is_waterish(t) and not str(t).startswith("cliff")

    # scatter bushes/rocks/details (avoid spawn)
    bush_ids = [k for k in frames if k.startswith(f"bp_{region}_") and ("bush" in k or "grass" in k or "thorn" in k or "fern" in k or "vine" in k or "lily" in k)]
    rock_ids = [k for k in frames if (k.startswith(f"bp_{region}_") and "rock" in k) or k.startswith("rock")]
    detail_ids = [k for k in frames if k.startswith("detail") or (k.startswith(f"bp_{region}_") and "grass" in k)]
    tree_ids = [k for k in frames if (k.startswith(f"bp_{region}_") and ("tree" in k or "baobab" in k or "pine" in k or "fir" in k or "acacia" in k)) or k.startswith("ptree") or k.startswith("tree")]
    if not bush_ids:
        bush_ids = [k for k in frames if k.startswith("bush")]
    if not tree_ids:
        tree_ids = [k for k in frames if k.startswith("ptree") or k.startswith("tree")]

    dens = {"africa": 200, "mountains": 180, "jungle": 280, "wetlands": 220}[region]
    for _ in range(dens):
        tx, ty = rnd.randint(2, W - 3), rnd.randint(2, H - 3)
        if abs(tx - sx) < 4 and abs(ty - sy) < 4:
            continue
        if not walkable(tx, ty):
            continue
        r = rnd.random()
        if r < 0.28 and tree_ids:
            oid = tree_ids[rnd.randint(0, len(tree_ids) - 1)]
        elif r < 0.55 and bush_ids:
            oid = bush_ids[rnd.randint(0, len(bush_ids) - 1)]
        elif r < 0.75 and rock_ids:
            oid = rock_ids[rnd.randint(0, len(rock_ids) - 1)]
        elif detail_ids:
            oid = detail_ids[rnd.randint(0, len(detail_ids) - 1)]
        else:
            continue
        objects.append({"id": oid, "x": tx * TW + 8, "y": ty * TW + (14 if "grass" in oid or "detail" in oid or "bush" in oid else 8)})

    # denser ground detail layer
    details = []
    for _ in range(180):
        tx, ty = rnd.randint(2, W - 3), rnd.randint(2, H - 3)
        if walkable(tx, ty) and detail_ids and rnd.random() < 0.75:
            details.append({"id": detail_ids[rnd.randint(0, len(detail_ids) - 1)], "x": tx * TW + 8, "y": ty * TW + 14})

    spawns = []
    for _ in range(80):
        tx, ty = rnd.randint(6, W - 7), rnd.randint(6, H - 7)
        if walkable(tx, ty) and not (abs(tx - sx) < 3 and abs(ty - sy) < 3):
            spawns.append([tx + 0.5, ty + 0.5])
        if len(spawns) >= 18:
            break

    landmarks = [
        {"id": "camp", "x": sx + 0.5, "y": sy + 0.5, "label": "Base Camp"},
    ]
    if "trail_flag" in frames:
        objects.append({"id": "trail_flag", "x": sx * TW + 8, "y": (sy - 2) * TW + 8})
    if "cairn" in frames:
        objects.append({"id": "cairn", "x": (sx + 3) * TW + 8, "y": (sy + 2) * TW + 8})
        landmarks.append({"id": "cairn", "x": sx + 3.5, "y": sy + 2.5, "label": "Trail Cairn"})
    for o in objects:
        if o["id"] in ("cave", "sign"):
            landmarks.append({
                "id": o["id"], "x": o["x"] / TW, "y": o["y"] / TW,
                "label": "Cave Mouth" if o["id"] == "cave" else "Trail Sign",
            })
    # Extra lookout cairns
    if "cairn" in frames:
        for _ in range(2):
            tx, ty = rnd.randint(8, W - 9), rnd.randint(8, H - 9)
            if walkable(tx, ty):
                objects.append({"id": "cairn", "x": tx * TW + 8, "y": ty * TW + 8})
                landmarks.append({"id": "cairn_" + str(len(landmarks)), "x": tx + 0.5, "y": ty + 0.5, "label": "Stone Cairn"})

    return {
        "w": W, "h": H, "tile": TW,
        "ground": ground,
        "objects": objects,
        "details": details,
        "spawns": spawns,
        "start": [sx + 0.5, sy + 0.5],
        "landmarks": landmarks,
        "waterAnim": ["water", "water2", "water3", "water_a"],
    }


def main():
    objs = {}
    objs.update(extract_puny_trees())
    objs.update(extract_idylwild())
    objs.update(make_marker_props())
    objs.update(load_biome_props())
    print("objects", len(objs), sorted(objs.keys())[:24], "...")
    player_frames = make_player_sheet()
    animal_frames = make_topdown_animals()
    frames = build_atlas(objs, player_frames)
    frames.update(animal_frames)
    base = Image.open(out / "atlas.png").convert("RGBA")
    tints = {
        "africa": (0.18, 1.08, 1.04),
        "mountains": (-0.18, 0.9, 1.08),
        "jungle": (-0.06, 1.18, 0.92),
        "wetlands": (-0.32, 1.04, 0.95),
    }
    for rid, (hue, sat, bri) in tints.items():
        atlas = base.copy()
        swaps = BIOME_TILE_SWAP.get(rid, {})
        for k, (col, row) in swaps.items():
            fr = frames.get(k)
            if not fr:
                continue
            t = tile(puny, col, row)
            atlas.paste(t, (fr["x"], fr["y"]))
        recolor(atlas, hue, sat, bri).save(out / f"atlas_{rid}.png")

    maps = {}
    for i, rid in enumerate(("africa", "mountains", "jungle", "wetlands")):
        maps[rid] = gen_map(rid, frames, 5200 + i * 31)
        print(rid, "objs", len(maps[rid]["objects"]), "details", len(maps[rid]["details"]))

    parallax = copy_parallax("48")

    js = []
    js.append("// Auto-built SNES tilemap data v48 — hi-res trees + full canopies")
    js.append("window.PO_SNES = window.PO_SNES || {};")
    js.append("PO_SNES.TILE = 16;")
    js.append("PO_SNES.frames = " + json.dumps(frames) + ";")
    js.append("PO_SNES.maps = " + json.dumps(maps) + ";")
    js.append("PO_SNES.atlas = {")
    for rid in ("africa", "mountains", "jungle", "wetlands"):
        js.append(f'  {rid}: "assets/snes/built/atlas_{rid}.png?v=48",')
    js.append("};")
    js.append("PO_SNES.parallax = " + json.dumps(parallax) + ";")
    js.append('PO_SNES.playerSheet = "assets/snes/built/player.png?v=48";')
    js.append('PO_SNES.animalSheet = "assets/snes/built/animals_td.png?v=48";')
    js.append("PO_SNES.waterAnim = [\"water\",\"water2\",\"water3\",\"water_a\"];")
    (root / "primal_snes_data.js").write_text("\n".join(js), encoding="utf-8")

    (snes / "CREDITS.txt").write_text(
        "Puny World Overworld Tileset by Shade — CC0\n"
        "https://opengameart.org/content/16x16-puny-world-tileset\n\n"
        "Idylwild Foliage Pack — free for any use (attribution appreciated)\n"
        "https://opengameart.org/content/idylwilds-foliage-pack\n\n"
        "RPG Character 'Agent' NES by Chasersgaming — CC0\n"
        "https://opengameart.org/content/rpg-character-agent-nes\n\n"
        "[LPC] bears, deer, lions and more — CC-BY 4.0 / GPL 3.0 / OGA-BY 3.0\n"
        "https://opengameart.org/content/lpc-bears-deer-lions-and-more\n"
        "Derived recolors used for additional wildlife silhouettes.\n",
        encoding="utf-8",
    )
    print("Wrote atlases + LPC animals + biome props + parallax + primal_snes_data.js")


if __name__ == "__main__":
    main()
