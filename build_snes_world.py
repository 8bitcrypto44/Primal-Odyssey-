# -*- coding: utf-8 -*-
"""Build SNES Mode-1 style worlds from CC0 tilesets.

Real SNES outdoor worlds (LttP / Chrono Trigger / Mario World):
  1) 8x8 CHR tiles grouped as 16x16 metatiles
  2) Tilemap = 2D array of tile indices (not raycast billboards)
  3) BG layers + Y-sorted sprites for tall objects / actors
  4) Transition / shore tiles where biomes meet

Sources:
  - Puny World Overworld by Shade (CC0)
  - Idylwild Foliage Pack (free use)
"""
from pathlib import Path
from PIL import Image
import json
import random
import collections

root = Path(__file__).resolve().parent
snes = root / "assets" / "snes"
out = snes / "built"
out.mkdir(parents=True, exist_ok=True)

puny = Image.open(snes / "punyworld.png").convert("RGBA")
fol = Image.open(snes / "idylwild" / "foliage_pack.png").convert("RGBA")
TW = 16


def tile(img, col, row, w=1, h=1):
    x, y = col * TW, row * TW
    return img.crop((x, y, x + w * TW, y + h * TW))


def recolor(img, hue_shift=0, sat=1.0, bright=1.0):
    px = img.load()
    w, h = img.size
    out_img = img.copy()
    op = out_img.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            if abs(hue_shift) > 0.01:
                if hue_shift > 0:
                    r = min(255, int(r + (g - r) * hue_shift * 0.35 + 20 * hue_shift))
                    g = min(255, int(g * (1 - hue_shift * 0.05)))
                else:
                    hs = -hue_shift
                    b = min(255, int(b + 40 * hs))
                    r = max(0, int(r * (1 - 0.2 * hs)))
            r = max(0, min(255, int(r * bright)))
            g = max(0, min(255, int(g * bright * sat + r * (1 - sat) * 0.2)))
            b = max(0, min(255, int(b * bright)))
            op[x, y] = (r, g, b, a)
    return out_img


# Verified against Puny World sheet (col, row)
GROUND = {
    "grass": (0, 0),
    "grass2": (1, 0),
    "grass3": (2, 0),
    "dirt": (8, 0),
    "dirt2": (13, 0),
    "path": (5, 0),
    "sand": (14, 0),
    "snow": (20, 0),
    "dark_grass": (0, 2),
    "mud": (12, 2),
    # open / deep water (NOT shore fragments)
    "water": (22, 10),
    "water2": (23, 10),
    "water3": (24, 10),
    # grass↔water shores (approx blob edges)
    "shore_n": (2, 10),
    "shore_s": (2, 12),
    "shore_w": (1, 11),
    "shore_e": (3, 11),
    "shore_nw": (1, 10),
    "shore_ne": (3, 10),
    "shore_sw": (1, 12),
    "shore_se": (3, 12),
    "cliff": (0, 6),
    "cliff2": (1, 6),
    "cliff3": (2, 6),
}

SOLID = {"water", "water2", "water3", "cliff", "cliff2", "cliff3"}


def extract_puny_trees():
    """Multi-tile tree sprites from Puny forest band (row ~7)."""
    crops = {
        "ptree_a": (0, 7, 2, 2),
        "ptree_b": (2, 7, 2, 2),
        "ptree_c": (4, 7, 2, 2),
        "ptree_d": (6, 7, 3, 2),
        "ptree_e": (9, 7, 2, 2),
        "ptree_f": (11, 7, 2, 2),
        "ptree_g": (13, 7, 2, 2),
        "ptree_h": (15, 7, 2, 2),
        "ptree_i": (0, 8, 2, 1),
        "ptree_j": (2, 8, 2, 1),
    }
    out_o = {}
    for name, (c, r, w, h) in crops.items():
        im = tile(puny, c, r, w, h)
        # punch black to transparent
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                rr, gg, bb, aa = px[x, y]
                if rr < 12 and gg < 12 and bb < 12:
                    px[x, y] = (0, 0, 0, 0)
        if im.getbbox():
            out_o[name] = im
    return out_o


def extract_idylwild():
    """Connected-component sprites from Idylwild foliage pack."""
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
                minx = min(minx, cx)
                maxx = max(maxx, cx)
                miny = min(miny, cy)
                maxy = max(maxy, cy)
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
    trees, bushes, rocks = [], [], []
    for n, x, y, bw, bh in comps[:40]:
        crop = fol.crop((x, y, x + bw, y + bh))
        aspect = bh / max(1, bw)
        if bh >= 48 and aspect >= 1.1:
            trees.append(crop)
        elif bw <= 40 and bh <= 40 and n < 1200:
            # grayish → rock, else bush
            samp = list(crop.getdata())
            opaque = [p for p in samp if p[3] > 40]
            if not opaque:
                continue
            avg_r = sum(p[0] for p in opaque) / len(opaque)
            avg_g = sum(p[1] for p in opaque) / len(opaque)
            avg_b = sum(p[2] for p in opaque) / len(opaque)
            if avg_g < avg_r + 15 and abs(avg_r - avg_b) < 35 and avg_g < 140:
                rocks.append(crop)
            else:
                bushes.append(crop)
        elif bh >= 28:
            bushes.append(crop)
    for i, im in enumerate(trees[:8]):
        objs[f"tree{i+1}"] = im
    for i, im in enumerate(bushes[:10]):
        objs[f"bush{i+1}"] = im
    for i, im in enumerate(rocks[:6]):
        objs[f"rock{i+1}"] = im
    return objs


def build_atlas(objs):
    frames = {}
    atlas_w = 512
    atlas_h = 768
    atlas = Image.new("RGBA", (atlas_w, atlas_h), (0, 0, 0, 0))
    x = y = 0
    row_h = TW
    for k, (col, row) in GROUND.items():
        t = tile(puny, col, row)
        if x + TW > atlas_w:
            x = 0
            y += row_h
        atlas.paste(t, (x, y))
        frames[k] = {
            "x": x, "y": y, "w": TW, "h": TW,
            "solid": k in SOLID or k.startswith("shore"),
        }
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
            na = Image.new("RGBA", (atlas_w, atlas_h + 256), (0, 0, 0, 0))
            na.paste(atlas, (0, 0))
            atlas = na
            atlas_h = atlas.height
        atlas.paste(im, (x, y), im)
        solid = name.startswith("tree") or name.startswith("ptree") or name.startswith("rock")
        frames[name] = {"x": x, "y": y, "w": w, "h": h, "solid": solid}
        x += w + 2
        row_h = max(row_h, h)
    atlas.save(out / "atlas.png")
    return frames


def shore_pass(ground):
    """Replace water cells that touch land with shore metatiles (simple NES/SNES edge)."""
    H = len(ground)
    W = len(ground[0])
    water = {"water", "water2", "water3"}
    out_g = [row[:] for row in ground]
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            if ground[y][x] not in water:
                continue
            n = ground[y - 1][x] not in water and not ground[y - 1][x].startswith("shore") and ground[y - 1][x] not in SOLID
            s = ground[y + 1][x] not in water and not str(ground[y + 1][x]).startswith("shore") and ground[y + 1][x] not in SOLID
            w = ground[y][x - 1] not in water and not str(ground[y][x - 1]).startswith("shore") and ground[y][x - 1] not in SOLID
            e = ground[y][x + 1] not in water and not str(ground[y][x + 1]).startswith("shore") and ground[y][x + 1] not in SOLID
            # only edge water gets shore art; interior stays open water
            if not (n or s or e or w):
                continue
            if n and w:
                out_g[y][x] = "shore_nw"
            elif n and e:
                out_g[y][x] = "shore_ne"
            elif s and w:
                out_g[y][x] = "shore_sw"
            elif s and e:
                out_g[y][x] = "shore_se"
            elif n:
                out_g[y][x] = "shore_n"
            elif s:
                out_g[y][x] = "shore_s"
            elif w:
                out_g[y][x] = "shore_w"
            elif e:
                out_g[y][x] = "shore_e"
    return out_g


def gen_map(region, frames, seed=42):
    rnd = random.Random(seed + hash(region) % 1000)
    W = H = 64
    if region == "mountains":
        grass_var = ["snow", "dirt", "grass", "snow"]
    elif region == "wetlands":
        grass_var = ["mud", "dark_grass", "grass", "mud"]
    elif region == "jungle":
        grass_var = ["dark_grass", "grass", "grass2", "dark_grass"]
    else:
        grass_var = ["grass", "grass2", "grass3", "dirt"]

    ground = [[grass_var[rnd.randint(0, len(grass_var) - 1)] for _ in range(W)] for _ in range(H)]
    for i in range(W):
        ground[0][i] = ground[H - 1][i] = "cliff"
        ground[i][0] = ground[i][H - 1] = "cliff"

    pools = 4 if region == "wetlands" else (2 if region != "mountains" else 1)
    for _ in range(pools):
        cx, cy = rnd.randint(12, W - 12), rnd.randint(12, H - 12)
        rad = rnd.randint(5, 9 if region == "wetlands" else 6)
        for y in range(cy - rad, cy + rad + 1):
            for x in range(cx - rad, cx + rad + 1):
                if 1 <= x < W - 1 and 1 <= y < H - 1:
                    if (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad:
                        ground[y][x] = ("water", "water2", "water3")[(x + y) % 3]

    # meandering dirt path
    x, y = 8, H // 2
    for _ in range(120):
        if 1 <= x < W - 1 and 1 <= y < H - 1 and ground[y][x] not in SOLID and not str(ground[y][x]).startswith("water"):
            ground[y][x] = "path" if rnd.random() < 0.55 else "dirt"
            if rnd.random() < 0.35 and 1 <= y - 1 < H - 1:
                if ground[y - 1][x] not in SOLID:
                    ground[y - 1][x] = "dirt2"
        x += rnd.choice([-1, 0, 1, 1])
        y += rnd.choice([-1, 0, 0, 1, -1])
        x = max(2, min(W - 3, x))
        y = max(2, min(H - 3, y))

    ground = shore_pass(ground)

    # clear spawn plaza
    sx, sy = W // 2, H // 2
    for yy in range(sy - 3, sy + 4):
        for xx in range(sx - 3, sx + 4):
            if 1 <= xx < W - 1 and 1 <= yy < H - 1:
                ground[yy][xx] = grass_var[0] if abs(xx - sx) + abs(yy - sy) > 1 else "dirt"

    def walkable(tx, ty):
        t = ground[ty][tx]
        return t not in SOLID and not t.startswith("shore")

    # object ids available
    tree_ids = [k for k in frames if k.startswith("ptree") or k.startswith("tree")]
    bush_ids = [k for k in frames if k.startswith("bush")]
    rock_ids = [k for k in frames if k.startswith("rock")]
    if region == "mountains":
        tree_ids = [k for k in tree_ids if "ptree" in k or "tree" in k] or tree_ids
    if region == "africa":
        tree_ids = [k for k in tree_ids if k.startswith("ptree") or k.startswith("tree")][:6] or tree_ids

    objects = []
    clusters = 16 if region == "jungle" else (12 if region == "mountains" else 10)
    for _ in range(clusters):
        cx, cy = rnd.randint(5, W - 6), rnd.randint(5, H - 6)
        for _ in range(rnd.randint(5, 10)):
            tx = cx + rnd.randint(-3, 3)
            ty = cy + rnd.randint(-3, 3)
            if abs(tx - sx) < 4 and abs(ty - sy) < 4:
                continue
            if 2 <= tx < W - 2 and 2 <= ty < H - 2 and walkable(tx, ty) and tree_ids:
                oid = tree_ids[rnd.randint(0, len(tree_ids) - 1)]
                objects.append({"id": oid, "x": tx * TW + 8, "y": ty * TW + 8})

    for _ in range(160):
        tx, ty = rnd.randint(2, W - 3), rnd.randint(2, H - 3)
        if abs(tx - sx) < 4 and abs(ty - sy) < 4:
            continue
        if not walkable(tx, ty):
            continue
        r = rnd.random()
        if r < 0.5 and bush_ids:
            oid = bush_ids[rnd.randint(0, len(bush_ids) - 1)]
        elif r < 0.8 and rock_ids:
            oid = rock_ids[rnd.randint(0, len(rock_ids) - 1)]
        elif bush_ids:
            oid = bush_ids[rnd.randint(0, len(bush_ids) - 1)]
        else:
            continue
        objects.append({"id": oid, "x": tx * TW + 8, "y": ty * TW + 14})

    spawns = []
    for _ in range(60):
        tx, ty = rnd.randint(5, W - 6), rnd.randint(5, H - 6)
        if walkable(tx, ty) and not (abs(tx - sx) < 2 and abs(ty - sy) < 2):
            spawns.append([tx + 0.5, ty + 0.5])
        if len(spawns) >= 16:
            break

    return {
        "w": W, "h": H, "tile": TW,
        "ground": ground,
        "objects": objects,
        "spawns": spawns,
        "start": [sx + 0.5, sy + 0.5],
    }


def main():
    objs = {}
    objs.update(extract_puny_trees())
    objs.update(extract_idylwild())
    print("objects", sorted(objs.keys()))
    frames = build_atlas(objs)
    base = Image.open(out / "atlas.png")
    tints = {
        "africa": (0.22, 1.05, 1.05),
        "mountains": (-0.18, 0.92, 1.06),
        "jungle": (-0.04, 1.12, 0.94),
        "wetlands": (-0.32, 1.0, 0.96),
    }
    for rid, (hue, sat, bri) in tints.items():
        recolor(base, hue, sat, bri).save(out / f"atlas_{rid}.png")

    maps = {}
    for i, rid in enumerate(("africa", "mountains", "jungle", "wetlands")):
        maps[rid] = gen_map(rid, frames, 4200 + i * 17)

    js = []
    js.append("// Auto-built SNES tilemap data — Puny World (CC0) + Idylwild foliage")
    js.append("window.PO_SNES = window.PO_SNES || {};")
    js.append("PO_SNES.TILE = 16;")
    js.append("PO_SNES.frames = " + json.dumps(frames) + ";")
    js.append("PO_SNES.maps = " + json.dumps(maps) + ";")
    js.append("PO_SNES.atlas = {")
    for rid in ("africa", "mountains", "jungle", "wetlands"):
        js.append(f'  {rid}: "assets/snes/built/atlas_{rid}.png",')
    js.append("};")
    (root / "primal_snes_data.js").write_text("\n".join(js), encoding="utf-8")

    (snes / "CREDITS.txt").write_text(
        "Puny World Overworld Tileset by Shade — CC0\n"
        "https://opengameart.org/content/16x16-puny-world-tileset\n\n"
        "Idylwild Foliage Pack — free for any use (attribution appreciated)\n"
        "https://opengameart.org/content/idylwilds-foliage-pack\n",
        encoding="utf-8",
    )
    print("Wrote atlas + maps + primal_snes_data.js")
    print("africa objects", len(maps["africa"]["objects"]))


if __name__ == "__main__":
    main()
