#!/usr/bin/env python3
"""Build GitHub Pages multi-file host + Digistracts iframe snippet.

Digistracts/GoDaddy paste limit is ~51KB — the full game does NOT fit.
Only paste the iframe snippet (godaddy_iframe_snippet.html /
primal_odyssey_godaddy_block.html). Full single-file export is optional archive only.
"""
from pathlib import Path
import re

root = Path(__file__).resolve().parent

# Bump on every publish so Pages/CDN do not serve stale JS/CSS
ASSET_VER = "15"
PAGES_URL = "https://8bitcrypto44.github.io/Primal-Odyssey-/"


def clean_text(s):
    return (
        s.replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2014", "-")
        .replace("\u2013", "-")
        .replace("\u2026", "...")
    )

def minify_css(s):
    s = re.sub(r"/\*.*?\*/", "", s, flags=re.S)
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"\s*([{:;,}>~+])\s*", r"\1", s)
    return s

def minify_js(s):
    s = re.sub(r"/\*.*?\*/", "", s, flags=re.S)
    out_lines = []
    for line in s.splitlines():
        if line.strip().startswith("//"):
            continue
        cleaned = []
        i = 0
        in_s = None
        while i < len(line):
            ch = line[i]
            if in_s:
                cleaned.append(ch)
                if ch == "\\" and i + 1 < len(line):
                    cleaned.append(line[i + 1])
                    i += 2
                    continue
                if ch == in_s:
                    in_s = None
                i += 1
                continue
            if ch in ("'", '"', "`"):
                in_s = ch
                cleaned.append(ch)
                i += 1
                continue
            if ch == "/" and i + 1 < len(line) and line[i + 1] == "/":
                break
            cleaned.append(ch)
            i += 1
        line = "".join(cleaned).strip()
        if line:
            out_lines.append(line)
    out, buf = [], ""
    for line in out_lines:
        if len(buf) + len(line) + 1 < 500:
            buf = (buf + " " + line).strip() if buf else line
        else:
            if buf:
                out.append(buf)
            buf = line
    if buf:
        out.append(buf)
    return "\n".join(out)

css = root.joinpath("primal.css").read_text(encoding="utf-8")
body = clean_text(root.joinpath("primal.body.html").read_text(encoding="utf-8"))
data = clean_text(root.joinpath("primal_data.js").read_text(encoding="utf-8"))
sprites = clean_text(root.joinpath("primal_sprites.js").read_text(encoding="utf-8"))
js = clean_text(root.joinpath("primal.js").read_text(encoding="utf-8"))

css_min = minify_css(css)
body_min = re.sub(r">\s+<", "><", body.strip())
js_main = minify_js(js)

# --- GitHub Pages / iframe host: multi-file (no size budget) ---
v = ASSET_VER
pages = (
    "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n"
    "<meta charset=\"UTF-8\">\n"
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover\">\n"
    "<meta name=\"description\" content=\"Primal Odyssey — explore biomes, meet apex animals, open field dossiers.\">\n"
    "<title>Primal Odyssey</title>\n"
    f"<link rel=\"stylesheet\" href=\"primal.css?v={v}\">\n"
    "<style>html,body{{margin:0;height:100%;min-height:100%;background:#030605;}}</style>\n"
    "</head>\n<body>\n"
    + body.strip() + "\n"
    f"<script src=\"primal_data.js?v={v}\"></script>\n"
    f"<script src=\"primal_sprites.js?v={v}\"></script>\n"
    f"<script src=\"primal.js?v={v}\"></script>\n"
    "</body>\n</html>\n"
)
(root / "index.html").write_bytes(pages.replace("\r\n", "\n").replace("\r", "\n").encode("utf-8"))

# --- Digistracts/GoDaddy: SMALL iframe only (fits ~51KB paste limit) ---
# Mobile: tall panel like Binary Matrix (min-height ~560). Desktop: 16:9.
# No vh/dvh — those drift with mobile browser chrome.
iframe_src = f"{PAGES_URL}?embed=1&amp;v={v}"
iframe_snippet = f"""<!-- Digistracts / GoDaddy: paste THIS only. Full game hosts on GitHub Pages. -->
<style>
.po-gd{{box-sizing:border-box;width:100%;max-width:100%;margin:0;padding:3px;background:#2d6b45;border-radius:12px;box-shadow:0 10px 24px rgba(0,0,0,.35)}}
.po-gd-inner{{box-sizing:border-box;position:relative;display:block;width:100%;aspect-ratio:16/9;max-height:720px;margin:0;padding:0;overflow:hidden;background:#030605;line-height:0;border:0;border-radius:9px}}
.po-gd iframe{{box-sizing:border-box;position:absolute;top:0;left:0;right:0;bottom:0;width:100%;height:100%;border:0;outline:0;display:block;margin:0;padding:0;background:#030605}}
@media (max-width:700px){{
  .po-gd-inner{{aspect-ratio:auto;height:560px;min-height:560px;max-height:none}}
}}
</style>
<div class="po-gd">
  <div class="po-gd-inner">
    <iframe
      src="{iframe_src}"
      title="Primal Odyssey"
      width="100%"
      height="560"
      allow="autoplay; fullscreen"
      allowfullscreen
      loading="eager"
      scrolling="no"
      referrerpolicy="no-referrer-when-downgrade"
    ></iframe>
  </div>
</div>
<p style="text-align:center;font-size:12px;margin:8px 0 0;line-height:1.4">
  <a href="{PAGES_URL}?embed=1" target="_blank" rel="noopener">Open Primal Odyssey full screen</a>
</p>
"""
(root / "godaddy_iframe_snippet.html").write_text(iframe_snippet, encoding="utf-8", newline="\n")
# Same stub under the old GoDaddy filename so nobody pastes a 200KB monolith by habit
(root / "primal_odyssey_godaddy_block.html").write_text(
    "<!-- DO NOT paste a full game here — Digistracts ~51KB limit. This IS the paste. -->\n"
    + iframe_snippet,
    encoding="utf-8",
    newline="\n",
)

# --- Optional archive: full single-file (NOT for Digistracts) ---
safe_js = (
    minify_js(data) + "\n" + minify_js(sprites) + "\n"
    + "(function(){function __poStart(){"
    + "if(!document.getElementById('po-canvas')){setTimeout(__poStart,30);return;}"
    + js_main
    + "}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',__poStart);else __poStart();})();"
)
full_block = (
    "<style>\n" + css_min + "\n</style>\n"
    + body_min
    + "\n<script>\n" + safe_js + "\n</script>\n"
).replace("\r\n", "\n").replace("\r", "\n")
(root / "primal_odyssey_full_singlefile.html").write_bytes(full_block.encode("utf-8"))

stub_n = len(iframe_snippet)
full_n = len(full_block)
print("pages index.html", (root / "index.html").stat().st_size, f"asset v={v}")
print("Digistracts iframe stub", stub_n, "bytes (limit ~51375) — OK" if stub_n < 51375 else "TOO BIG")
print("archive full_singlefile", full_n, "| NOT for Digistracts")
assert "SPRITES.cougar" in full_block
assert "iframe" in iframe_snippet
assert stub_n < 51375, "iframe stub must fit Digistracts paste limit"
print("Paste godaddy_iframe_snippet.html (or primal_odyssey_godaddy_block.html) into Digistracts.")
