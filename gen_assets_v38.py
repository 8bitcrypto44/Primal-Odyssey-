# -*- coding: utf-8 -*-
"""v38 — high-detail local art for all world objects."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import math
import random

root = Path(__file__).resolve().parent
rnd = random.Random(38)

def hex_rgb(h, a=255):
    h = h.lstrip("#")
    rgb = tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
    return rgb + (a,) if a < 255 else rgb

def save(img, *parts):
    path = root.joinpath(*parts)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")
    return path

def shade(c, f):
    if isinstance(c, str):
        c = hex_rgb(c)
    return tuple(max(0, min(255, int(x * f))) for x in c[:3]) + ((c[3],) if len(c) > 3 else ())

def as_rgb(c):
    if isinstance(c, str):
        return hex_rgb(c)
    return c[:3] if len(c) >= 3 else c

def noise_rect(d, box, base, n=40, jitter=18):
    x0, y0, x1, y1 = box
    base = as_rgb(base) if not isinstance(base, tuple) else (base[:3] if len(base) >= 3 else base)
    if isinstance(base, str):
        base = hex_rgb(base)
    for _ in range(n):
        x = rnd.randint(x0, max(x0, x1 - 1))
        y = rnd.randint(y0, max(y0, y1 - 1))
        f = 1 + (rnd.random() - 0.5) * (jitter / 100)
        col = shade(base, f)
        d.point((x, y), fill=col)

# ========== DETAILED TREES / PROPS ==========
def detailed_tree(kind="tree", w=128, h=160):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # shadow
    d.ellipse([w*0.22, h*0.88, w*0.78, h*0.98], fill=(0, 0, 0, 70))
    trunk = (58, 38, 18) if kind != "baobab" else (90, 60, 30)
    bark = (40, 25, 10)
    # trunk with bark ridges
    tx0, tx1 = int(w*0.44), int(w*0.56)
    if kind == "baobab":
        tx0, tx1 = int(w*0.38), int(w*0.62)
    d.rectangle([tx0, int(h*0.42), tx1, int(h*0.92)], fill=trunk)
    for y in range(int(h*0.44), int(h*0.9), 3):
        d.line([(tx0, y), (tx1, y)], fill=bark)
    noise_rect(d, [tx0, int(h*0.42), tx1, int(h*0.92)], trunk, 80, 25)
    # branches
    d.line([(w*0.5, h*0.48), (w*0.22, h*0.28)], fill=bark, width=3)
    d.line([(w*0.5, h*0.5), (w*0.78, h*0.26)], fill=bark, width=3)
    d.line([(w*0.5, h*0.55), (w*0.18, h*0.4)], fill=bark, width=2)
    d.line([(w*0.5, h*0.52), (w*0.82, h*0.38)], fill=bark, width=2)
    if kind == "acacia":
        greens = [(34, 100, 48), (50, 130, 60), (28, 80, 40)]
        for i, (cx, cy, rx, ry) in enumerate([
            (0.5, 0.28, 0.42, 0.14), (0.32, 0.26, 0.2, 0.1), (0.68, 0.25, 0.22, 0.1),
            (0.45, 0.22, 0.18, 0.08), (0.58, 0.3, 0.16, 0.07)
        ]):
            d.ellipse([w*(cx-rx), h*(cy-ry), w*(cx+rx), h*(cy+ry)], fill=greens[i % 3])
            noise_rect(d, [int(w*(cx-rx)), int(h*(cy-ry)), int(w*(cx+rx)), int(h*(cy+ry))], greens[i % 3], 60, 20)
    elif kind == "baobab":
        canopy = [(100, 70, 35), (120, 85, 45), (80, 55, 25)]
        for i, (cx, cy, rx, ry) in enumerate([
            (0.5, 0.28, 0.32, 0.28), (0.35, 0.22, 0.18, 0.16), (0.65, 0.24, 0.18, 0.16)
        ]):
            d.ellipse([w*(cx-rx), h*(cy-ry), w*(cx+rx), h*(cy+ry)], fill=canopy[i % 3])
    else:  # jungle tree / vine host
        greens = [(20, 80, 35), (30, 110, 50), (12, 55, 25), (45, 130, 60)]
        clusters = [
            (0.5, 0.22, 0.28, 0.22), (0.32, 0.3, 0.2, 0.18), (0.7, 0.28, 0.2, 0.18),
            (0.42, 0.14, 0.16, 0.12), (0.6, 0.16, 0.14, 0.12), (0.5, 0.36, 0.22, 0.14)
        ]
        for i, (cx, cy, rx, ry) in enumerate(clusters):
            d.ellipse([w*(cx-rx), h*(cy-ry), w*(cx+rx), h*(cy+ry)], fill=greens[i % 4])
            noise_rect(d, [int(w*(cx-rx)), int(h*(cy-ry)), int(w*(cx+rx)), int(h*(cy+ry))], greens[i % 4], 50, 22)
        # hanging vines
        for i in range(5):
            x = int(w * (0.3 + i * 0.1))
            d.line([(x, int(h*0.35)), (x + (i % 3) - 1, int(h*0.7))], fill=(20, 70, 30), width=2)
    # highlight leaf speckles
    for _ in range(40):
        d.point((rnd.randint(int(w*0.2), int(w*0.8)), rnd.randint(int(h*0.1), int(h*0.45))),
                fill=(180, 220, 120, 120))
    return img

def detailed_pine(w=112, h=160):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([w*0.28, h*0.9, w*0.72, h*0.98], fill=(0, 0, 0, 65))
    d.rectangle([w*0.46, h*0.62, w*0.54, h*0.94], fill=(55, 38, 20))
    for i, y in enumerate([0.08, 0.2, 0.34, 0.48]):
        top = h * y
        base = h * (y + 0.22)
        spread = 0.38 - i * 0.05
        cols = [(22, 70, 38), (30, 90, 48), (18, 55, 30)]
        d.polygon([
            (w*0.5, top),
            (w*(0.5 - spread), base),
            (w*(0.5 + spread), base)
        ], fill=cols[i % 3])
        # needle texture
        for _ in range(35):
            px = rnd.uniform(0.5 - spread*0.8, 0.5 + spread*0.8)
            py = rnd.uniform(y + 0.04, y + 0.2)
            d.line([(w*px, h*py), (w*px + rnd.uniform(-2, 2), h*py + 4)], fill=(40, 110, 55), width=1)
        # snow dust on mountains fir
        if i < 2:
            d.polygon([
                (w*0.5, top),
                (w*(0.5 - spread*0.5), top + (base-top)*0.35),
                (w*(0.5 + spread*0.5), top + (base-top)*0.35)
            ], fill=(230, 240, 250, 100))
    return img

def detailed_reed(w=96, h=140):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([w*0.2, h*0.9, w*0.8, h*0.98], fill=(0, 0, 0, 50))
    for i in range(14):
        x = int(w * (0.12 + i * 0.055))
        sway = math.sin(i * 0.7) * 4
        h0 = int(h * (0.15 + (i % 5) * 0.04))
        stem = (45 + i % 3 * 10, 95 + i % 4 * 8, 50)
        d.line([(x, h*0.92), (x + sway, h0)], fill=stem, width=2)
        # seed head
        d.ellipse([x + sway - 4, h0 - 6, x + sway + 5, h0 + 4], fill=(70, 110, 55))
        d.ellipse([x + sway - 3, h0 - 10, x + sway + 4, h0 - 2], fill=(90, 130, 70))
        # leaf blade
        d.polygon([
            (x + sway, h0 + 20),
            (x + sway - 8, h0 + 35),
            (x + sway + 2, h0 + 28)
        ], fill=(40, 100, 55))
    return img

def detailed_rock(snow=False, w=120, h=90):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([w*0.15, h*0.78, w*0.85, h*0.95], fill=(0, 0, 0, 60))
    base = (168, 176, 186) if snow else (90, 88, 86)
    mid = (210, 218, 228) if snow else (120, 118, 115)
    dark = (120, 128, 140) if snow else (55, 54, 52)
    # multi-facet boulder
    pts = [(0.12, 0.85), (0.18, 0.45), (0.35, 0.22), (0.55, 0.12), (0.78, 0.3), (0.9, 0.55), (0.85, 0.88)]
    poly = [(w*x, h*y) for x, y in pts]
    d.polygon(poly, fill=base)
    d.polygon([(w*0.18, h*0.45), (w*0.35, h*0.22), (w*0.55, h*0.12), (w*0.48, h*0.5)], fill=mid)
    d.polygon([(w*0.55, h*0.12), (w*0.78, h*0.3), (w*0.7, h*0.55), (w*0.48, h*0.5)], fill=dark)
    # cracks
    d.line([(w*0.3, h*0.4), (w*0.45, h*0.65), (w*0.4, h*0.8)], fill=dark, width=1)
    d.line([(w*0.6, h*0.35), (w*0.68, h*0.7)], fill=dark, width=1)
    noise_rect(d, [int(w*0.15), int(h*0.2), int(w*0.85), int(h*0.85)], base, 120, 15)
    if snow:
        d.polygon([(w*0.35, h*0.22), (w*0.55, h*0.12), (w*0.7, h*0.28), (w*0.5, h*0.32)], fill=(245, 250, 255))
        for _ in range(25):
            d.point((rnd.randint(int(w*0.2), int(w*0.8)), rnd.randint(int(h*0.15), int(h*0.4))), fill=(255, 255, 255))
    else:
        for _ in range(18):
            x = rnd.randint(int(w*0.2), int(w*0.7))
            y = rnd.randint(int(h*0.55), int(h*0.82))
            d.ellipse([x, y, x + 6, y + 4], fill=(45, 100, 45, 150))
    return img

def detailed_grass(kind="grass", w=80, h=96):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if kind == "fern":
        cols = [(26, 110, 55), (40, 140, 70), (20, 90, 45)]
        for i in range(9):
            x = int(w * (0.15 + i * 0.08))
            for j in range(6):
                y = h * 0.85 - j * 10
                d.polygon([
                    (x, y),
                    (x - 8 - j, y - 4),
                    (x, y - 2),
                    (x + 8 + j, y - 4)
                ], fill=cols[j % 3])
            d.line([(x, h*0.9), (x, h*0.25)], fill=(30, 70, 35), width=2)
    elif kind == "africa_thorn":
        for i in range(10):
            x = int(w * (0.1 + i * 0.08))
            col = (110 + i*3, 100, 35)
            d.line([(x, h*0.92), (x + rnd.randint(-3, 3), h*0.2)], fill=col, width=2)
            for t in range(3):
                ty = h * (0.35 + t * 0.15)
                d.line([(x, ty), (x - 5, ty - 3)], fill=(80, 70, 25), width=1)
                d.line([(x, ty), (x + 5, ty - 3)], fill=(80, 70, 25), width=1)
    elif kind == "bush":
        for i, (cx, cy, r) in enumerate([(0.5, 0.55, 0.35), (0.3, 0.6, 0.22), (0.7, 0.58, 0.22), (0.5, 0.4, 0.2)]):
            c = (50 + i*8, 110 + i*5, 35)
            d.ellipse([w*(cx-r), h*(cy-r*0.7), w*(cx+r), h*(cy+r*0.7)], fill=c)
            noise_rect(d, [int(w*(cx-r)), int(h*(cy-r*0.7)), int(w*(cx+r)), int(h*(cy+r*0.7))], c, 40, 18)
    else:
        cols = [(90, 140, 40), (70, 120, 35), (110, 160, 50), (60, 100, 30)]
        for i in range(16):
            x = int(w * (0.08 + i * 0.055))
            tip = h * (0.12 + (i % 4) * 0.05)
            d.line([(x, h*0.95), (x + math.sin(i)*2, tip)], fill=cols[i % 4], width=2)
            d.line([(x, h*0.7), (x - 4, h*0.55)], fill=cols[(i+1) % 4], width=1)
    d.ellipse([w*0.2, h*0.9, w*0.8, h*0.98], fill=(0, 0, 0, 40))
    return img

def detailed_lily(w=96, h=48):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([4, 14, 90, 44], fill=(25, 90, 55, 200))
    d.ellipse([10, 18, 50, 40], fill=(35, 110, 65, 180))
    d.ellipse([40, 16, 88, 42], fill=(20, 80, 50, 180))
    # flower
    for a in range(0, 360, 45):
        rad = math.radians(a)
        cx, cy = 48 + math.cos(rad)*8, 14 + math.sin(rad)*5
        d.ellipse([cx-5, cy-4, cx+5, cy+4], fill=(240, 230, 140))
    d.ellipse([44, 10, 52, 18], fill=(220, 160, 40))
    return img

def detailed_bird(w=48, h=32):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([12, 10, 36, 24], fill=(35, 35, 40))
    d.polygon([(8, 16), (2, 12), (8, 14)], fill=(200, 140, 40))  # beak
    d.ellipse([28, 12, 32, 16], fill=(240, 240, 200))  # eye
    d.polygon([(18, 14), (6, 4), (22, 12)], fill=(50, 50, 60))  # wing
    d.polygon([(18, 14), (4, 22), (22, 16)], fill=(45, 45, 55))
    d.line([(30, 22), (34, 28)], fill=(30, 30, 30), width=1)
    return img

# ========== ANIMALS (detailed walk strips) ==========
def animal_frame(spec, frame, scale=2):
    body, outline, belly, accent, w, h, style = spec
    body, outline, belly, accent = as_rgb(body), as_rgb(outline), as_rgb(belly), as_rgb(accent)
    W, H = w * scale + 20, h * scale + 16
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ox, oy = 10, 6
    stride = int(math.sin(frame * math.pi / 2) * 3 * scale)
    plant = abs(math.cos(frame * math.pi / 2))
    # shadow
    d.ellipse([ox + 4, H - 10, W - 8, H - 2], fill=(0, 0, 0, 55))
    # legs (4)
    legs = [
        (0.25, -stride), (0.4, stride), (0.6, -stride * 0.8), (0.75, stride * 0.8)
    ]
    for lx, off in legs:
        x = ox + int(w * scale * lx)
        y1 = oy + int(h * scale * 0.55)
        y2 = H - 8 + int(off)
        d.line([(x, y1), (x + int(off * 0.3), y2)], fill=outline, width=max(2, scale))
        d.ellipse([x - 2, y2 - 2, x + 3, y2 + 2], fill=outline)
    # body
    bx0, by0 = ox + 2*scale, oy + int(h * scale * 0.25)
    bx1, by1 = ox + w * scale - 2*scale, oy + int(h * scale * 0.75)
    d.ellipse([bx0, by0, bx1, by1], fill=body, outline=outline)
    # belly
    d.ellipse([bx0 + 4*scale, by0 + 4*scale, bx1 - 2*scale, by1 - scale], fill=belly)
    # head
    hx = ox + int(w * scale * 0.78)
    hy = oy + int(h * scale * 0.2) - int(plant)
    d.ellipse([hx, hy, hx + 10*scale, hy + 10*scale], fill=body, outline=outline)
    d.ellipse([hx + 6*scale, hy + 3*scale, hx + 9*scale, hy + 6*scale], fill=accent)  # snout/eye accent
    d.ellipse([hx + 3*scale, hy + 3*scale, hx + 5*scale, hy + 5*scale], fill=(20, 20, 20))  # eye
    d.ellipse([hx + 3*scale + 1, hy + 3*scale + 1, hx + 4*scale, hy + 4*scale], fill=(240, 240, 200))
    # ear
    d.polygon([(hx + 2*scale, hy), (hx + 4*scale, hy - 4*scale), (hx + 6*scale, hy + scale)], fill=outline)
    # tail
    tx = ox + int(w * scale * 0.08)
    ty = oy + int(h * scale * 0.4)
    d.line([(tx + 4*scale, ty), (tx - 2*scale + stride, ty - 4*scale)], fill=outline, width=max(2, scale))
    # pattern
    if style == "stripe":
        for i in range(5):
            x = bx0 + 4*scale + i * 3*scale
            d.line([(x, by0 + 2*scale), (x + scale, by1 - 2*scale)], fill=outline, width=max(1, scale - 1))
    elif style == "spot":
        for i in range(8):
            px = rnd.randint(bx0 + 3, bx1 - 4)
            py = rnd.randint(by0 + 3, by1 - 4)
            d.ellipse([px, py, px+2*scale, py+2*scale], fill=outline)
    elif style == "fur":
        for i in range(20):
            px = rnd.randint(bx0, bx1)
            py = rnd.randint(by0, by1)
            d.point((px, py), fill=shade(body, 0.7))
    # mane for lion-like
    if style == "mane":
        for a in range(0, 360, 30):
            rad = math.radians(a)
            d.ellipse([
                hx + 4*scale + math.cos(rad)*5*scale - 2*scale,
                hy + 4*scale + math.sin(rad)*5*scale - 2*scale,
                hx + 4*scale + math.cos(rad)*5*scale + 2*scale,
                hy + 4*scale + math.sin(rad)*5*scale + 2*scale
            ], fill=(90, 55, 20))
    return img

ANIMALS = {
    "lion": ("#c49a4a", "#5a3810", "#e8c888", "#2a1810", 30, 18, "mane"),
    "tiger": ("#d46820", "#1a0a04", "#f0a060", "#fff4e0", 30, 18, "stripe"),
    "leopard": ("#c49a4a", "#2a1810", "#f5e6c8", "#1a1008", 28, 16, "spot"),
    "jaguar": ("#a87838", "#1a1008", "#e8d0a0", "#0a0804", 28, 16, "spot"),
    "snowleopard": ("#a8b4c0", "#3a4550", "#eef2f6", "#2a3038", 28, 16, "spot"),
    "cougar": ("#c49a4a", "#3a2810", "#e8c888", "#2a1808", 28, 16, "fur"),
    "wolf": ("#7f4c31", "#442725", "#e4a47c", "#ffffff", 26, 16, "fur"),
    "grizzly": ("#6b4423", "#2a1810", "#d4b080", "#1a1008", 32, 20, "fur"),
    "gorilla": ("#3b3939", "#191818", "#ddd3d3", "#121212", 24, 26, "fur"),
    "hippo": ("#4d9bff", "#1b509b", "#f2f9ff", "#133b75", 32, 18, "fur"),
    "rhino": ("#b0a7a7", "#504e4e", "#f4f2f2", "#807777", 34, 18, "fur"),
    "buffalo": ("#533116", "#2a1808", "#e7b389", "#fffde4", 32, 18, "fur"),
    "croc": ("#3a7a40", "#1a3a20", "#6aaa58", "#c8e080", 40, 12, "spot"),
    "anaconda": ("#19ee73", "#008336", "#88ffbc", "#fb3c27", 44, 10, "spot"),
    "eagle": ("#c8712b", "#693309", "#ffeccd", "#ffffff", 30, 20, "fur"),
    "honeybadger": ("#9e9595", "#343434", "#eeebeb", "#ffffff", 22, 14, "fur"),
    "lynx": ("#a8b4c0", "#3a4550", "#eef2f6", "#2a3038", 26, 14, "fur"),
    "ocelot": ("#c49a4a", "#2a1810", "#f5e6c8", "#1a1008", 24, 14, "spot"),
    "manatee": ("#6a9aaa", "#2a4a58", "#d0e8f0", "#1a3038", 34, 16, "fur"),
}

def make_walk(name, spec):
    frames = [animal_frame(spec, f, scale=2) for f in range(4)]
    fw, fh = frames[0].size
    strip = Image.new("RGBA", (fw * 4, fh), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        strip.paste(fr, (i * fw, 0), fr)
    save(strip, "assets", "walk", f"{name}.png")

for n, s in ANIMALS.items():
    make_walk(n, s)

# ========== WALLS ==========
def make_wall(name, base, accent, moss=False):
    img = Image.new("RGB", (256, 256), base)
    d = ImageDraw.Draw(img)
    # mortar grid irregular
    for y in range(0, 256, 20):
        offset = (y // 20) % 2 * 12
        for x in range(-12, 256, 36):
            d.rectangle([x + offset, y, x + offset + 32, y + 18], outline=accent)
            # stone face shading
            d.rectangle([x + offset + 2, y + 2, x + offset + 14, y + 10], fill=shade(base, 1.12))
            d.rectangle([x + offset + 16, y + 8, x + offset + 30, y + 16], fill=shade(base, 0.85))
            if rnd.random() < 0.35:
                d.line([(x + offset + 4, y + 4), (x + offset + 20, y + 14)], fill=shade(accent, 0.8))
    noise_rect(d, [0, 0, 255, 255], base, 400, 12)
    if moss:
        for _ in range(80):
            x, y = rnd.randint(0, 250), rnd.randint(0, 250)
            d.ellipse([x, y, x+8, y+5], fill=(40, 90, 45))
    # wet streak
    for _ in range(12):
        x = rnd.randint(10, 240)
        d.line([(x, 0), (x + rnd.randint(-4, 4), 255)], fill=shade(base, 0.7), width=2)
    save(img, "assets", "walls", f"{name}.png")

make_wall("africa", (110, 95, 65), (60, 48, 28), False)
make_wall("jungle", (45, 75, 48), (25, 45, 28), True)
make_wall("mountains", (120, 130, 145), (70, 78, 90), False)
make_wall("wetlands", (50, 85, 82), (25, 50, 48), True)

# ========== LANDMARKS ==========
def lm_watering():
    img = Image.new("RGBA", (160, 160), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([20, 95, 140, 150], fill=(0, 0, 0, 60))
    # water
    d.ellipse([25, 100, 135, 145], fill=(35, 110, 130))
    d.ellipse([40, 108, 120, 138], fill=(55, 150, 170))
    for i in range(8):
        d.arc([40 + i*3, 110, 110 - i*2, 135], 0, 180, fill=(200, 240, 255, 100))
    # baobab-like shade tree
    d.rectangle([72, 50, 88, 105], fill=(70, 45, 20))
    d.ellipse([35, 20, 125, 75], fill=(90, 65, 30))
    d.ellipse([50, 15, 100, 55], fill=(110, 80, 40))
    # shore grass
    for i in range(10):
        x = 20 + i * 12
        d.line([(x, 130), (x, 110)], fill=(60, 120, 40), width=2)
    return img

def lm_cairn():
    img = Image.new("RGBA", (140, 160), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([30, 140, 110, 155], fill=(0, 0, 0, 55))
    rocks = [
        ([25, 110, 115, 145], (160, 170, 180)),
        ([35, 85, 105, 120], (140, 150, 165)),
        ([45, 60, 95, 95], (180, 190, 200)),
        ([55, 40, 85, 70], (150, 160, 175)),
        ([60, 22, 80, 45], (200, 210, 220)),
    ]
    for box, col in rocks:
        d.ellipse(box, fill=col, outline=(90, 100, 110))
        noise_rect(d, box, col, 30, 10)
    # marker stick
    d.rectangle([68, 8, 74, 40], fill=(90, 60, 30))
    d.polygon([(60, 12), (72, 2), (84, 12)], fill=(180, 40, 40))
    return img

def lm_boardwalk():
    img = Image.new("RGBA", (160, 140), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # water under
    d.ellipse([10, 90, 150, 135], fill=(30, 90, 110, 160))
    # planks
    for i, y in enumerate([70, 82, 94]):
        d.rectangle([15, y, 145, y + 10], fill=(120, 85, 40) if i % 2 == 0 else (100, 70, 30))
        for x in range(20, 140, 14):
            d.line([(x, y), (x, y + 10)], fill=(60, 40, 15))
    # posts + rope
    for x in (22, 138):
        d.rectangle([x, 40, x + 10, 100], fill=(90, 60, 25))
        noise_rect(d, [x, 40, x+10, 100], (90, 60, 25), 20, 15)
    d.arc([22, 35, 148, 70], 200, 340, fill=(70, 50, 25), width=3)
    # reeds beside
    for i in range(6):
        d.line([(8 + i*4, 120), (10 + i*4, 50)], fill=(40, 90, 50), width=2)
    return img

def lm_blind():
    img = Image.new("RGBA", (150, 150), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i in range(18):
        x = 15 + i * 7
        d.line([(x, 140), (x + (i % 3) - 1, 25 + (i % 4) * 5)], fill=(45, 95, 50), width=3)
        d.ellipse([x - 3, 20 + (i % 4) * 5, x + 5, 32 + (i % 4) * 5], fill=(60, 110, 55))
    d.rectangle([35, 55, 115, 95], fill=(35, 60, 40))
    d.rectangle([45, 62, 105, 85], fill=(20, 35, 25))  # viewing slot
    d.rectangle([48, 65, 102, 82], fill=(15, 25, 18))
    return img

def lm_ranger():
    img = Image.new("RGBA", (140, 160), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([30, 140, 110, 155], fill=(0, 0, 0, 55))
    # cabin
    d.rectangle([40, 70, 100, 140], fill=(110, 75, 35))
    for y in range(75, 135, 6):
        d.line([(42, y), (98, y)], fill=(80, 50, 20))
    d.polygon([(30, 75), (70, 30), (110, 75)], fill=(140, 45, 35))
    d.polygon([(38, 75), (70, 40), (102, 75)], fill=(160, 55, 40))
    d.rectangle([58, 100, 78, 140], fill=(50, 30, 15))
    d.rectangle([48, 85, 62, 98], fill=(180, 210, 230))
    d.line([(55, 85), (55, 98)], fill=(80, 60, 30))
    d.line([(48, 91), (62, 91)], fill=(80, 60, 30))
    # flag
    d.line([(100, 50), (100, 75)], fill=(60, 40, 20), width=2)
    d.polygon([(100, 50), (125, 58), (100, 66)], fill=(40, 120, 60))
    return img

def lm_canopy():
    img = Image.new("RGBA", (160, 160), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([72, 80, 88, 150], fill=(55, 35, 15))
    greens = [(15, 70, 30), (25, 100, 45), (10, 55, 25), (35, 120, 55)]
    for i, (cx, cy, r) in enumerate([
        (0.35, 0.35, 0.28), (0.65, 0.32, 0.28), (0.5, 0.22, 0.25),
        (0.4, 0.48, 0.2), (0.6, 0.5, 0.2), (0.5, 0.4, 0.18)
    ]):
        d.ellipse([160*(cx-r), 160*(cy-r), 160*(cx+r), 160*(cy+r)], fill=greens[i % 4])
        noise_rect(d, [int(160*(cx-r)), int(160*(cy-r)), int(160*(cx+r)), int(160*(cy+r))], greens[i % 4], 40, 20)
    # light gap
    d.ellipse([60, 40, 100, 80], fill=(200, 230, 150, 80))
    for i in range(4):
        d.line([(50 + i*20, 90), (45 + i*20, 150)], fill=(20, 80, 35), width=2)
    return img

for name, fn in [
    ("watering_hole", lm_watering), ("cairn", lm_cairn), ("boardwalk", lm_boardwalk),
    ("reed_blind", lm_blind), ("ranger_post", lm_ranger), ("canopy_gap", lm_canopy)
]:
    save(fn(), "assets", "landmarks", f"{name}.png")

# ========== PROPS SAVE ==========
save(detailed_tree("acacia"), "assets", "props", "acacia.png")
save(detailed_tree("baobab"), "assets", "props", "baobab.png")
save(detailed_tree("tree"), "assets", "props", "tree.png")
save(detailed_tree("tree"), "assets", "props", "jungle_vine.png")
save(detailed_pine(), "assets", "props", "pine.png")
save(detailed_pine(), "assets", "props", "mtn_fir.png")
save(detailed_reed(), "assets", "props", "reed.png")
save(detailed_rock(False), "assets", "props", "rock.png")
save(detailed_rock(True), "assets", "props", "snowrock.png")
save(detailed_grass("grass"), "assets", "props", "grass.png")
save(detailed_grass("fern"), "assets", "props", "fern.png")
save(detailed_grass("bush"), "assets", "props", "bush.png")
save(detailed_grass("africa_thorn"), "assets", "props", "africa_thorn.png")
save(detailed_lily(), "assets", "props", "wet_lily.png")
save(detailed_bird(), "assets", "props", "bird.png")
bug = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
bd = ImageDraw.Draw(bug)
bd.ellipse([3, 5, 12, 12], fill=(30, 30, 20))
bd.ellipse([5, 3, 9, 7], fill=(50, 40, 20))
bd.line([(2, 8), (0, 6)], fill=(20, 20, 10))
bd.line([(13, 8), (15, 6)], fill=(20, 20, 10))
save(bug, "assets", "props", "bug.png")

# wall remote prop billboards (detailed cliff face)
for name, base, accent in [
    ("wallafrica", (110, 95, 65), (60, 48, 28)),
    ("walljungle", (45, 75, 48), (25, 45, 28)),
    ("wallmountains", (120, 130, 145), (70, 78, 90)),
]:
    img = Image.new("RGBA", (128, 160), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([20, 145, 108, 158], fill=(0, 0, 0, 60))
    d.polygon([(15, 150), (25, 40), (64, 10), (105, 45), (115, 150)], fill=base)
    d.polygon([(25, 40), (64, 10), (70, 70), (40, 90)], fill=shade(base, 1.15))
    d.polygon([(64, 10), (105, 45), (95, 100), (70, 70)], fill=shade(base, 0.75))
    for y in range(50, 140, 12):
        d.line([(30, y), (100, y + 4)], fill=accent, width=1)
    noise_rect(d, [20, 20, 110, 145], base, 100, 12)
    save(img, "assets", "props", f"{name}.png")

# wetlands cover more detailed
cover = Image.new("RGB", (800, 450), (12, 40, 38))
cd = ImageDraw.Draw(cover)
for y in range(450):
    t = y / 450
    cd.line([(0, y), (800, y)], fill=(
        int(20 + t * 35), int(55 + t * 40), int(60 + t * 35)
    ))
cd.ellipse([180, 30, 620, 180], fill=(140, 180, 190))
cd.ellipse([220, 50, 560, 150], fill=(180, 210, 215))
for i in range(60):
    x = rnd.randint(0, 790)
    h = rnd.randint(40, 160)
    cd.line([(x, 420), (x + rnd.randint(-3, 3), 420 - h)], fill=(40, 90, 55), width=2)
cd.ellipse([60, 280, 280, 360], fill=(25, 80, 100))
cd.ellipse([500, 300, 760, 380], fill=(25, 80, 100))
for i in range(12):
    x0, x1 = 80 + i * 8, 250 - i * 5
    if x1 > x0:
        cd.arc([x0, 290, x1, 350], 0, 180, fill=(180, 220, 230))
save(cover, "assets", "covers", "wetlands.png")

# title cards richer
for rid, title, col, motif in [
    ("africa", "AFRICA", (201, 162, 39), "savanna"),
    ("mountains", "MOUNTAINS", (168, 192, 216), "peaks"),
    ("jungle", "JUNGLE", (61, 155, 95), "canopy"),
    ("wetlands", "WETLANDS", (74, 154, 170), "marsh"),
]:
    img = Image.new("RGB", (640, 220), (8, 18, 12))
    d = ImageDraw.Draw(img)
    d.rectangle([6, 6, 634, 214], outline=col, width=4)
    d.rectangle([14, 14, 626, 206], outline=(45, 107, 69), width=1)
    if motif == "savanna":
        d.ellipse([40, 50, 160, 160], fill=col)
        d.rectangle([200, 100, 220, 180], fill=(60, 40, 15))
        d.ellipse([150, 40, 280, 110], fill=(40, 100, 45))
        for i in range(12):
            d.line([(300 + i*12, 180), (302 + i*12, 120)], fill=(100, 140, 40), width=2)
    elif motif == "peaks":
        d.polygon([(40, 180), (120, 40), (200, 180)], fill=col)
        d.polygon([(140, 180), (240, 55), (340, 180)], fill=(100, 120, 140))
        d.polygon([(120, 40), (150, 80), (100, 80)], fill=(240, 245, 250))
    elif motif == "canopy":
        for x in range(40, 320, 28):
            d.rectangle([x, 90, x+10, 180], fill=(50, 35, 15))
            d.ellipse([x-20, 40, x+30, 110], fill=(20, 90, 40))
    else:
        d.ellipse([40, 100, 260, 180], fill=(35, 100, 120))
        for x in range(280, 400, 10):
            d.line([(x, 180), (x, 60)], fill=(45, 100, 55), width=2)
    d.text((360, 70), title, fill=col)
    d.text((360, 110), "EXPEDITION LOG", fill=(158, 201, 173))
    d.text((360, 140), "Entering biome…", fill=(120, 150, 130))
    save(img, "assets", "titles", f"{rid}.png")

# richer decals
def decal(name, w, h, fn):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    fn(ImageDraw.Draw(img))
    save(img, "assets", "decals", f"{name}.png")

decal("mud", 48, 48, lambda d: (
    d.ellipse([4, 12, 44, 42], fill=(70, 45, 20, 160)),
    d.ellipse([10, 16, 30, 36], fill=(55, 35, 15, 140)),
    *[d.ellipse([rnd.randint(8, 35), rnd.randint(15, 35), 0, 0], fill=(40, 25, 10, 100)) for _ in range(0)]
))
# fix mud speckles
mud = Image.open(root / "assets/decals/mud.png").convert("RGBA")
md = ImageDraw.Draw(mud)
for _ in range(25):
    x, y = rnd.randint(6, 40), rnd.randint(14, 40)
    md.ellipse([x, y, x+3, y+2], fill=(40, 25, 10, 120))
mud.save(root / "assets/decals/mud.png")

decal("leaf", 48, 48, lambda d: (
    d.ellipse([8, 6, 40, 42], fill=(45, 120, 50, 180)),
    d.line([(24, 8), (24, 40)], fill=(30, 80, 35), width=2),
    *[d.line([(24, 12+i*5), (24 + (1 if i%2 else -1)*12, 14+i*5)], fill=(35, 90, 40), width=1) for i in range(5)]
))
decal("crack", 48, 48, lambda d: (
    d.line([(6, 10), (20, 28), (14, 40)], fill=(50, 35, 20, 200), width=2),
    d.line([(20, 28), (38, 18)], fill=(50, 35, 20, 180), width=2),
    d.line([(20, 28), (34, 40)], fill=(40, 28, 15, 160), width=1),
))
decal("lily", 48, 48, lambda d: (
    d.ellipse([4, 16, 44, 42], fill=(30, 100, 60, 180)),
    *[d.ellipse([20+int(math.cos(a)*8)-4, 14+int(math.sin(a)*5)-3,
                 20+int(math.cos(a)*8)+4, 14+int(math.sin(a)*5)+3], fill=(240, 225, 130))
      for a in [i*0.8 for i in range(8)]],
    d.ellipse([17, 11, 23, 17], fill=(220, 150, 40)),
))

# player kit more detailed
hands = Image.new("RGBA", (400, 80), (0, 0, 0, 0))
hd = ImageDraw.Draw(hands)
# left
hd.ellipse([10, 28, 120, 78], fill=(196, 160, 112))
hd.ellipse([20, 35, 50, 60], fill=(180, 140, 95))  # thumb
hd.rectangle([25, 8, 110, 40], fill=(42, 90, 138))
hd.rectangle([30, 12, 105, 22], fill=(60, 110, 160))
# stitching
for x in range(35, 100, 12):
    hd.line([(x, 14), (x+6, 20)], fill=(30, 60, 100), width=1)
# right
hd.ellipse([280, 30, 390, 78], fill=(196, 160, 112))
hd.ellipse([350, 35, 380, 60], fill=(180, 140, 95))
hd.rectangle([290, 10, 375, 42], fill=(42, 90, 138))
save(hands, "assets", "player", "hands.png")

binocs = Image.new("RGBA", (160, 80), (0, 0, 0, 0))
bd = ImageDraw.Draw(binocs)
for ox in (5, 85):
    bd.ellipse([ox, 8, ox+70, 72], outline=(30, 55, 35), width=8)
    bd.ellipse([ox+12, 18, ox+58, 62], fill=(15, 25, 18))
    bd.ellipse([ox+22, 28, ox+48, 52], fill=(40, 80, 100, 100))
bd.rectangle([68, 32, 92, 48], fill=(25, 45, 30))
bd.rectangle([72, 28, 88, 52], fill=(35, 55, 40))
save(binocs, "assets", "player", "binocs.png")

journal = Image.new("RGBA", (64, 84), (0, 0, 0, 0))
jd = ImageDraw.Draw(journal)
jd.rectangle([4, 4, 60, 80], fill=(220, 200, 150), outline=(90, 60, 30), width=2)
jd.rectangle([4, 4, 16, 80], fill=(190, 165, 110))
for y in range(18, 70, 8):
    jd.line([(20, y), (52, y)], fill=(140, 110, 70))
jd.ellipse([28, 22, 44, 38], fill=(30, 110, 55))
jd.text((32, 26), "J", fill=(230, 255, 230))
save(journal, "assets", "player", "journal.png")

# parallax richer
for biome, cols in {
    "africa": [(70, 100, 40), (50, 80, 30), (90, 120, 50)],
    "mountains": [(70, 85, 100), (50, 60, 75), (100, 115, 130)],
    "jungle": [(10, 45, 22), (5, 30, 15), (20, 60, 30)],
    "wetlands": [(25, 70, 68), (15, 45, 48), (35, 90, 85)],
}.items():
    img = Image.new("RGBA", (640, 100), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for layer, col in enumerate(cols):
        ybase = 100
        pts = [(0, 100)]
        for x in range(0, 641, 16):
            h = 25 + layer * 12 + int(18 * abs(math.sin(x * 0.02 + layer)))
            pts.append((x, 100 - h))
        pts.append((640, 100))
        d.polygon(pts, fill=col + (200 - layer * 40,))
        # tree spikes on jungle/wetlands
        if biome in ("jungle", "wetlands", "africa"):
            for x in range(20, 620, 40 + layer * 10):
                h = 20 + (x * 3 + layer * 7) % 30
                d.rectangle([x, 100 - h - 20, x + 3, 100 - 15], fill=col)
    save(img, "assets", "parallax", f"{biome}.png")

print("v38 detailed assets done")
for p in ["walk", "props", "walls", "covers", "parallax", "decals", "landmarks", "player", "titles"]:
    n = len(list((root / "assets" / p).glob("*.png")))
    print(f"  {p}: {n}")
