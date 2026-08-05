# -*- coding: utf-8 -*-
"""Generate Primal Odyssey v37 local art packs (walk sheets, props, covers, etc.)."""
from pathlib import Path
from PIL import Image, ImageDraw
import math
import random

root = Path(__file__).resolve().parent
rnd = random.Random(37)

def ensure(*parts):
    p = root.joinpath(*parts)
    p.mkdir(parents=True, exist_ok=True)
    return p

def save(img, *parts):
    path = root.joinpath(*parts)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")
    return path

# --- animal walk strips (4 frames, side view pixel) ---
ANIMALS = {
    "lion": ("#c49a4a", "#8a6020", "#2a1810", 28, 18),
    "tiger": ("#d46820", "#1a0a04", "#fff4e0", 28, 18),
    "leopard": ("#c49a4a", "#2a1810", "#f5e6c8", 26, 16),
    "jaguar": ("#a87838", "#1a1008", "#e8d0a0", 26, 16),
    "snowleopard": ("#a8b4c0", "#3a4550", "#eef2f6", 26, 16),
    "cougar": ("#c49a4a", "#3a2810", "#e8c888", 26, 16),
    "wolf": ("#7f4c31", "#442725", "#ffffff", 24, 16),
    "grizzly": ("#6b4423", "#2a1810", "#d4b080", 30, 20),
    "gorilla": ("#3b3939", "#191818", "#ddd3d3", 22, 24),
    "hippo": ("#4d9bff", "#1b509b", "#f2f9ff", 30, 18),
    "rhino": ("#b0a7a7", "#504e4e", "#ffffff", 32, 18),
    "buffalo": ("#533116", "#79441c", "#fffde4", 30, 18),
    "croc": ("#3a7a40", "#1a3a20", "#c8e080", 36, 12),
    "anaconda": ("#19ee73", "#008336", "#fb3c27", 40, 10),
    "eagle": ("#c8712b", "#693309", "#ffffff", 28, 20),
    "honeybadger": ("#9e9595", "#343434", "#ffffff", 20, 14),
    "lynx": ("#a8b4c0", "#3a4550", "#eef2f6", 24, 14),
    "ocelot": ("#c49a4a", "#2a1810", "#f5e6c8", 22, 14),
    "manatee": ("#6a9aaa", "#2a4a58", "#d0e8f0", 32, 16),
}

def draw_animal_frame(body, outline, accent, w, h, frame, stride):
    img = Image.new("RGBA", (w + 12, h + 10), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ox, oy = 6 + stride, 4
    # legs
    leg = [(2, h - 2), (6, h - 2), (w - 6, h - 2), (w - 2, h - 2)]
    for i, lx in enumerate(leg):
        off = int(math.sin((frame + i) * 1.2) * 2)
        d.rectangle([ox + lx[0], oy + lx[1] - 4 + off, ox + lx[0] + 2, oy + h], fill=outline)
    # body
    d.ellipse([ox + 2, oy + 4, ox + w - 2, oy + h - 4], fill=body, outline=outline)
    # head
    hx = ox + w - 8
    d.ellipse([hx, oy + 2, hx + 10, oy + 12], fill=body, outline=outline)
    d.ellipse([hx + 6, oy + 5, hx + 8, oy + 7], fill=accent)
    # ear / mane hint
    d.rectangle([hx + 1, oy, hx + 4, oy + 3], fill=outline)
    # spots / stripes
    if body in ("#d46820", "#a87838", "#c49a4a"):
        for i in range(4):
            d.point((ox + 6 + i * 4, oy + 8 + (i % 2) * 2), fill=outline)
    return img

def make_walk_strip(name, spec):
    body, outline, accent, w, h = spec
    frames = []
    for f in range(4):
        stride = int(math.sin(f * math.pi / 2) * 3)
        frames.append(draw_animal_frame(body, outline, accent, w, h, f, stride))
    fw, fh = frames[0].size
    strip = Image.new("RGBA", (fw * 4, fh), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        strip.paste(fr, (i * fw, 0), fr)
    save(strip, "assets", "walk", f"{name}.png")

for name, spec in ANIMALS.items():
    make_walk_strip(name, spec)

# --- biome props ---
def prop_tree(canopy, trunk="#3a2a10", w=64, h=96, flat=False):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([w * 0.2, h * 0.85, w * 0.8, h * 0.98], fill=(0, 0, 0, 60))
    d.rectangle([w * 0.45, h * 0.4, w * 0.55, h * 0.9], fill=trunk)
    if flat:
        d.ellipse([w * 0.1, h * 0.15, w * 0.9, h * 0.45], fill=canopy)
    else:
        d.ellipse([w * 0.15, h * 0.08, w * 0.85, h * 0.55], fill=canopy)
        d.ellipse([w * 0.25, h * 0.05, w * 0.55, h * 0.35], fill=canopy)
    return img

def prop_pine():
    img = Image.new("RGBA", (64, 96), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([28, 70, 36, 92], fill="#3a2a18")
    for i, y in enumerate([10, 28, 46]):
        d.polygon([(32, y), (8 + i * 4, y + 28), (56 - i * 4, y + 28)], fill="#1a4a28")
    return img

def prop_reed():
    img = Image.new("RGBA", (48, 80), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i in range(7):
        x = 6 + i * 6
        d.line([(x, 75), (x + (i % 3) - 1, 10 + (i % 4) * 4)], fill="#3a6a40", width=2)
        d.ellipse([x - 3, 8 + (i % 4) * 4, x + 4, 16 + (i % 4) * 4], fill="#4a7a48")
    return img

def prop_rock(snow=False):
    img = Image.new("RGBA", (64, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c1 = "#c8d0d8" if snow else "#5a5858"
    c2 = "#e8eef4" if snow else "#7a7878"
    d.polygon([(8, 44), (14, 18), (32, 8), (52, 20), (58, 44)], fill=c1)
    d.polygon([(14, 18), (32, 8), (36, 28), (20, 34)], fill=c2)
    return img

def prop_grass(col="#6a9a30"):
    img = Image.new("RGBA", (40, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i in range(6):
        x = 4 + i * 6
        d.line([(x, 44), (x + 1, 8 + (i % 3) * 4)], fill=col, width=2)
    return img

PROPS = {
    "acacia": prop_tree("#2a6a34", flat=True),
    "baobab": prop_tree("#5a3a18", trunk="#4a3010"),
    "pine": prop_pine(),
    "tree": prop_tree("#1a5a28"),
    "reed": prop_reed(),
    "fern": prop_grass("#2a8a50"),
    "grass": prop_grass("#6a9a30"),
    "bush": prop_grass("#4a7a28"),
    "rock": prop_rock(False),
    "snowrock": prop_rock(True),
    "africa_thorn": prop_grass("#8a7a30"),
    "jungle_vine": prop_tree("#0a4020"),
    "wet_lily": None,
    "mtn_fir": prop_pine(),
}
# lily
lily = Image.new("RGBA", (48, 24), (0, 0, 0, 0))
ld = ImageDraw.Draw(lily)
ld.ellipse([4, 6, 44, 22], fill="#2a6a40")
ld.ellipse([18, 2, 30, 12], fill="#e8e0a0")
PROPS["wet_lily"] = lily

for name, img in PROPS.items():
    if img:
        save(img, "assets", "props", f"{name}.png")

# walls
def make_wall(base, accent, name):
    img = Image.new("RGB", (128, 128), base)
    d = ImageDraw.Draw(img)
    for y in range(0, 128, 16):
        for x in range(0, 128, 24):
            d.rectangle([x + (y // 16) % 2 * 8, y, x + 20, y + 14], outline=accent)
            if rnd.random() < 0.3:
                d.point((x + 6, y + 6), fill=accent)
    save(img, "assets", "walls", f"{name}.png")

make_wall("#6a5a40", "#3a3020", "africa")
make_wall("#2a4a30", "#1a3020", "jungle")
make_wall("#6a7080", "#3a4050", "mountains")
make_wall("#3a5a58", "#1a3030", "wetlands")

# ground / sky wetlands cover
cover = Image.new("RGB", (640, 360), "#0a3028")
cd = ImageDraw.Draw(cover)
for y in range(360):
    t = y / 360
    col = (
        int(30 + t * 40),
        int(70 + t * 50),
        int(80 + t * 40),
    )
    cd.line([(0, y), (640, y)], fill=col)
cd.ellipse([200, 40, 480, 160], fill="#7aa0a8")
for i in range(30):
    x = rnd.randint(0, 620)
    cd.rectangle([x, 200 + rnd.randint(0, 120), x + 3, 340], fill="#2a5a40")
cd.ellipse([80, 260, 200, 300], fill="#1a4a60")
cd.ellipse([400, 280, 560, 320], fill="#1a4a60")
save(cover, "assets", "covers", "wetlands.png")

def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

# parallax bands
for biome, cols in {
    "africa": ["#4a6a28"],
    "mountains": ["#4a5568"],
    "jungle": ["#0a3018"],
    "wetlands": ["#1a4a48"],
}.items():
    img = Image.new("RGBA", (512, 80), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    fill = hex_rgb(cols[0]) + (220,)
    for i in range(0, 512, 40):
        h = 20 + (i * 7) % 40
        d.polygon([(i, 80), (i + 20, 80 - h), (i + 40, 80)], fill=fill)
    save(img, "assets", "parallax", f"{biome}.png")

# decals
def decal(name, draw_fn, size=(32, 32)):
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(img))
    save(img, "assets", "decals", f"{name}.png")

decal("mud", lambda d: d.ellipse([2, 10, 30, 28], fill=(60, 40, 20, 140)))
decal("leaf", lambda d: d.ellipse([6, 4, 26, 28], fill=(40, 100, 40, 160)))
decal("crack", lambda d: (d.line([(4, 8), (16, 20), (28, 10)], fill=(40, 30, 20, 180), width=2)))
decal("lily", lambda d: (d.ellipse([2, 8, 30, 28], fill=(30, 90, 60, 160)), d.ellipse([12, 4, 20, 12], fill=(220, 210, 120, 200))))

# landmarks
def landmark(name, fn):
    img = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    fn(ImageDraw.Draw(img), img)
    save(img, "assets", "landmarks", f"{name}.png")

landmark("watering_hole", lambda d, i: (
    d.ellipse([10, 50, 86, 86], fill="#2a6a7a"),
    d.ellipse([20, 55, 76, 80], fill="#3a8aaa"),
    d.rectangle([44, 20, 52, 55], fill="#3a2a10"),
    d.ellipse([20, 8, 76, 40], fill="#2a6a34"),
))
landmark("cairn", lambda d, i: (
    d.polygon([(20, 80), (30, 40), (48, 20), (70, 45), (78, 80)], fill="#a8b0b8"),
    d.rectangle([42, 8, 54, 22], fill="#c8d0d8"),
))
landmark("boardwalk", lambda d, i: (
    d.rectangle([8, 60, 88, 78], fill="#6a4a22"),
    *[d.line([(x, 60), (x, 78)], fill="#3a2a10") for x in range(12, 88, 10)],
    d.rectangle([14, 30, 22, 60], fill="#5a3a18"),
    d.rectangle([74, 30, 82, 60], fill="#5a3a18"),
))
landmark("reed_blind", lambda d, i: (
    *[d.line([(10 + i * 8, 85), (12 + i * 8, 20)], fill="#3a6a40", width=3) for i in range(10)],
    d.rectangle([20, 35, 76, 55], fill="#2a4a30"),
))
landmark("ranger_post", lambda d, i: (
    d.rectangle([30, 35, 66, 85], fill="#5a3a18"),
    d.polygon([(24, 40), (48, 12), (72, 40)], fill="#8a2020"),
    d.rectangle([42, 55, 54, 85], fill="#2a1a08"),
))
landmark("canopy_gap", lambda d, i: (
    d.ellipse([5, 5, 50, 50], fill="#1a5a28"),
    d.ellipse([46, 8, 90, 55], fill="#0a4020"),
    d.rectangle([44, 50, 52, 90], fill="#3a2a10"),
))

# player kit
hands = Image.new("RGBA", (200, 60), (0, 0, 0, 0))
hd = ImageDraw.Draw(hands)
hd.ellipse([5, 20, 70, 58], fill="#c4a070")
hd.rectangle([10, 5, 65, 30], fill="#2a5a8a")
hd.ellipse([130, 22, 195, 58], fill="#c4a070")
hd.rectangle([135, 8, 190, 32], fill="#2a5a8a")
save(hands, "assets", "player", "hands.png")

binocs = Image.new("RGBA", (120, 60), (0, 0, 0, 0))
bd = ImageDraw.Draw(binocs)
bd.ellipse([5, 5, 55, 55], outline="#2a4a30", width=6)
bd.ellipse([65, 5, 115, 55], outline="#2a4a30", width=6)
bd.rectangle([50, 25, 70, 35], fill="#1a3020")
save(binocs, "assets", "player", "binocs.png")

journal = Image.new("RGBA", (48, 64), (0, 0, 0, 0))
jd = ImageDraw.Draw(journal)
jd.rectangle([4, 4, 44, 60], fill="#dcc896", outline="#6a4a22", width=2)
jd.rectangle([4, 4, 12, 60], fill="#c9b078")
for y in range(16, 52, 8):
    jd.line([(16, y), (38, y)], fill="#8a6a40")
save(journal, "assets", "player", "journal.png")

# title cards
for rid, title, col in [
    ("africa", "AFRICA", "#c9a227"),
    ("mountains", "MOUNTAINS", "#a8c0d8"),
    ("jungle", "JUNGLE", "#3d9b5f"),
    ("wetlands", "WETLANDS", "#4a9aaa"),
]:
    img = Image.new("RGB", (480, 160), "#0a140c")
    d = ImageDraw.Draw(img)
    d.rectangle([8, 8, 472, 152], outline=col, width=3)
    d.rectangle([16, 16, 464, 144], outline="#2d6b45", width=1)
    # simple biome motif
    if rid == "africa":
        d.ellipse([40, 50, 100, 110], fill=col)
        d.rectangle([200, 70, 280, 120], fill="#2a6a34")
    elif rid == "mountains":
        d.polygon([(40, 120), (90, 40), (140, 120)], fill=col)
        d.polygon([(100, 120), (160, 50), (220, 120)], fill="#6a8090")
    elif rid == "jungle":
        for x in range(40, 200, 25):
            d.rectangle([x, 50, x + 8, 120], fill="#1a5a28")
    else:
        d.ellipse([40, 70, 160, 120], fill="#2a6a7a")
        for x in range(180, 280, 12):
            d.line([(x, 120), (x, 50)], fill="#3a6a40", width=2)
    # title text as blocks (PIL default font)
    d.text((220, 60), title, fill=col)
    d.text((220, 90), "EXPEDITION LOG", fill="#9ec9ad")
    save(img, "assets", "titles", f"{rid}.png")

# tiny bird / bug scale anchors
bird = Image.new("RGBA", (24, 16), (0, 0, 0, 0))
bd = ImageDraw.Draw(bird)
bd.polygon([(2, 8), (12, 2), (22, 8), (12, 10)], fill="#2a2a2a")
save(bird, "assets", "props", "bird.png")
bug = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
bd = ImageDraw.Draw(bug)
bd.ellipse([1, 2, 6, 6], fill="#1a1a10")
save(bug, "assets", "props", "bug.png")

print("v37 assets generated")
for p in ["walk", "props", "walls", "covers", "parallax", "decals", "landmarks", "player", "titles"]:
    n = len(list((root / "assets" / p).glob("*.png")))
    print(f"  assets/{p}: {n} png")
