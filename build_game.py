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
ASSET_VER = "18"
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

# --- Digistracts/GoDaddy: cover card + expand-to-play iframe ---
# Match Digistracts chrome: max-width 920, border 4, padding 10, 16:9 stage (800x450).
iframe_src_attr = f"{PAGES_URL}?embed=1&amp;v={v}"
iframe_snippet = f"""<!-- Digistracts / GoDaddy: Primal Odyssey cover → expand on ENTER -->
<style>
.po-gd{{box-sizing:border-box;width:100%;max-width:920px;margin:0 auto;font-family:"Courier New",Courier,monospace;color:#cfe8d6}}
.po-gd *{{box-sizing:border-box}}
.po-gd-card{{
  border:4px solid #2d6b45;border-radius:12px;padding:10px;overflow:hidden;
  background:linear-gradient(180deg,#030605,#0a140c 55%,#061008);
  box-shadow:0 0 24px rgba(61,155,95,.28),0 12px 28px rgba(0,0,0,.45)
}}
.po-gd-top{{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}}
.po-gd-brand{{font-size:14px;letter-spacing:1px;color:#5dce7a;font-weight:700}}
.po-gd-brand span{{color:#7fa88c;font-weight:400;font-size:12px}}
.po-gd-stage{{position:relative;width:100%;aspect-ratio:16/9;background:#041008;border:2px solid #1a3d28;border-radius:8px;overflow:hidden}}
.po-gd-cover{{position:absolute;inset:0}}
.po-gd-mosaic{{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;width:100%;height:100%;background:#041008}}
.po-gd-mosaic img{{width:100%;height:100%;object-fit:cover;display:block;filter:saturate(1.05) contrast(1.05)}}
.po-gd-veil{{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px;text-align:center;background:linear-gradient(180deg,rgba(2,10,6,.35) 0%,rgba(3,12,8,.72) 45%,rgba(3,6,5,.92) 100%)}}
.po-gd-title{{margin:0;font-family:Papyrus,"Segoe Print","Bradley Hand ITC",fantasy;font-size:clamp(26px,5vw,40px);font-weight:400;letter-spacing:2px;color:#5dce7a;text-shadow:0 0 18px rgba(61,155,95,.55),3px 3px 0 #021208;line-height:1.1}}
.po-gd-tag{{margin:0;font-size:clamp(11px,2.8vw,13px);color:#9ec9ad;letter-spacing:.5px;max-width:28em;line-height:1.4}}
.po-gd-enter{{appearance:none;border:3px solid #5dce7a;border-radius:10px;padding:12px 28px;font:700 15px "Courier New",Courier,monospace;letter-spacing:2px;cursor:pointer;color:#041208;background:linear-gradient(180deg,#5dce7a,#2d6b45);box-shadow:0 0 18px rgba(93,206,122,.35),0 4px 0 #0a1f12;transition:transform .12s,box-shadow .12s}}
.po-gd-enter:hover{{transform:translateY(-2px) scale(1.03);box-shadow:0 0 26px rgba(93,206,122,.5),0 6px 0 #0a1f12}}
.po-gd-enter:active{{transform:scale(.98)}}
.po-gd-play{{display:none;position:absolute;inset:0;background:#030605;line-height:0}}
.po-gd-play iframe{{position:absolute;inset:0;width:100%;height:100%;border:0;display:block;background:#030605}}
.po-gd.is-open .po-gd-cover{{display:none}}
.po-gd.is-open .po-gd-play{{display:block}}
@media (max-width:700px){{
  .po-gd-card{{padding:4px;border-width:2px}}
  .po-gd-top{{margin-bottom:4px}}
  .po-gd-brand{{font-size:13px}}
  .po-gd-enter{{padding:14px 22px;min-height:48px;width:min(100%,280px);font-size:16px}}
  .po-gd-title{{font-size:clamp(28px,9vw,44px)}}
}}
</style>
<div class="po-gd" id="po-gd">
  <div class="po-gd-card">
    <div class="po-gd-top">
      <div class="po-gd-brand">PRIMAL ODYSSEY <span>by 8bitcrypto_44</span></div>
    </div>
    <div class="po-gd-stage">
      <div class="po-gd-cover">
        <div class="po-gd-mosaic" aria-hidden="true">
          <img src="https://i.postimg.cc/D0kDM1Xb/african-cover-image.jpg" alt="" width="320" height="180" loading="lazy">
          <img src="https://i.postimg.cc/L5K7bj11/mountains-cover-image.jpg" alt="" width="320" height="180" loading="lazy">
          <img src="https://i.postimg.cc/VvqTQ5qs/jungle-cover-image.jpg" alt="" width="320" height="180" loading="lazy">
        </div>
        <div class="po-gd-veil">
          <h2 class="po-gd-title">PRIMAL ODYSSEY</h2>
          <p class="po-gd-tag">Africa · Mountains · Jungle — explore apex animals &amp; field dossiers</p>
          <button type="button" class="po-gd-enter" id="po-gd-enter">ENTER EXPEDITION</button>
        </div>
      </div>
      <div class="po-gd-play" id="po-gd-play">
        <iframe
          id="po-gd-frame"
          title="Primal Odyssey"
          width="100%"
          height="450"
          data-src="{iframe_src_attr}"
          allow="autoplay; fullscreen"
          allowfullscreen
          scrolling="no"
          referrerpolicy="no-referrer-when-downgrade"
        ></iframe>
      </div>
    </div>
  </div>
</div>
<script>
(function(){{
  var root=document.getElementById("po-gd");
  var btn=document.getElementById("po-gd-enter");
  var frame=document.getElementById("po-gd-frame");
  if(!root||!btn||!frame)return;
  btn.addEventListener("click",function(){{
    var src=frame.getAttribute("data-src");
    if(src&&!frame.getAttribute("src"))frame.setAttribute("src",src);
    root.classList.add("is-open");
    btn.setAttribute("aria-expanded","true");
    try{{frame.focus();}}catch(e){{}}
  }});
}})();
</script>
"""
(root / "godaddy_iframe_snippet.html").write_text(iframe_snippet, encoding="utf-8", newline="\n")
(root / "primal_odyssey_godaddy_block.html").write_text(
    "<!-- Digistracts paste: cover card + expand. Full game on GitHub Pages. -->\n"
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
