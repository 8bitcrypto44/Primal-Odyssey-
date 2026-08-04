#!/usr/bin/env python3
from PIL import Image
from pathlib import Path
from io import BytesIO
import base64

ROOT = Path(__file__).resolve().parent / "assets/user"
OUT = ROOT / "keyed"
OUT.mkdir(exist_ok=True)
urls = {}
total = 0
for name in ["lion", "grizzly", "anaconda", "rhino", "croc"]:
    im = Image.open(ROOT / f"{name}.jpg").convert("RGBA")
    im = im.resize((96, 96), Image.NEAREST)
    px = im.load()
    for y in range(96):
        for x in range(96):
            r, g, b, a = px[x, y]
            if r > 245 and g > 245 and b > 245:
                px[x, y] = (0, 0, 0, 0)
            elif r > 232 and g > 232 and b > 232:
                t = max(0, 255 - int((r + g + b - 696) * 3))
                px[x, y] = (r, g, b, t)
    buf = BytesIO()
    im.save(buf, "PNG", optimize=True)
    data = buf.getvalue()
    (OUT / f"{name}.png").write_bytes(data)
    b64 = base64.b64encode(data).decode()
    urls[name] = "data:image/png;base64," + b64
    total += len(urls[name])
    print(name, len(data), "b64", len(urls[name]))

print("TOTAL", total)
lines = ["window.PO_REMOTE={"]
for k, v in urls.items():
    lines.append(f'{k}:"{v}",')
lines.append("};")
out = Path(__file__).resolve().parent / "primal_remote.js"
out.write_text("\n".join(lines), encoding="utf-8")
print("wrote", out, out.stat().st_size)
