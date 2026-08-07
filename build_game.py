#!/usr/bin/env python3
"""Build GitHub Pages multi-file host + Digistracts iframe snippet.

Digistracts/GoDaddy paste limit is ~51KB — the full game does NOT fit.
Only paste the iframe snippet (godaddy_iframe_snippet.html /
primal_odyssey_godaddy_block.html). Full single-file export is optional archive only.
"""
from pathlib import Path
import base64
import re

root = Path(__file__).resolve().parent

# Bump on every publish so Pages/CDN do not serve stale JS/CSS
ASSET_VER = "66"
PAGES_URL = "https://8bitcrypto44.github.io/Primal-Odyssey-/"
_brand_logo = root / "assets" / "brand" / "8bitcrypto44_logo.png"
BRAND_LOGO_URI = (
    "data:image/png;base64," + base64.b64encode(_brand_logo.read_bytes()).decode("ascii")
    if _brand_logo.exists()
    else f"{PAGES_URL}assets/brand/8bitcrypto44_logo.png?v={ASSET_VER}"
)


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
    "<script>(function(){var t=(\"ontouchstart\"in window)||navigator.maxTouchPoints>0;var n=false,c=false;"
    "try{n=matchMedia(\"(max-width:700px)\").matches;c=matchMedia(\"(pointer:coarse)\").matches;}catch(e){}"
    "if((t&&c)||n)document.documentElement.classList.add(\"po-mobile\");})();</script>\n"
    "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n"
    "<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n"
    "<link href=\"https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap\" rel=\"stylesheet\">\n"
    "<style>html,body{{margin:0;background:#030605;}}</style>\n"
    "</head>\n<body>\n"
    + body.strip() + "\n"
    f"<script src=\"primal_data.js?v={v}\"></script>\n"
    f"<script src=\"primal_sprites.js?v={v}\"></script>\n"
    f"<script src=\"primal_snes_data.js?v={v}\"></script>\n"
    f"<script src=\"primal_snes.js?v={v}\"></script>\n"
    f"<script src=\"primal.js?v={v}\"></script>\n"
    f"<script src=\"po_viewport.js?v={v}\"></script>\n"
    "<script>if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').catch(function(){})}</script>\n"
    "</body>\n</html>\n"
)
(root / "index.html").write_bytes(pages.replace("\r\n", "\n").replace("\r", "\n").encode("utf-8"))

# --- Digistracts/GoDaddy: cover card + expand-to-play iframe ---
# Match Digistracts chrome; landscape + Fullscreen API (user gesture) like Digistracts.
iframe_src_attr = f"{PAGES_URL}?embed=1&amp;v={v}"
iframe_snippet = f"""<!-- Digistracts / GoDaddy: Primal Odyssey cover → expand on ENTER -->
<style>
.po-gd{{box-sizing:border-box;width:100%;max-width:920px;margin:0 auto;font-family:"Atkinson Hyperlegible","Segoe UI",system-ui,sans-serif;color:#e8f5ec}}
.po-gd *{{box-sizing:border-box}}
.po-gd-card{{
  border:4px solid #2d6b45;border-radius:12px;padding:10px;overflow:hidden;
  background:linear-gradient(180deg,#030605,#0a140c 55%,#061008);
  box-shadow:0 0 24px rgba(61,155,95,.28),0 12px 28px rgba(0,0,0,.45)
}}
.po-gd-top{{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}}
.po-gd-brand{{font-size:15px;letter-spacing:.3px;color:#5dce7a;font-weight:700}}
.po-gd-brand span{{color:#a8cbb8;font-weight:400;font-size:13px}}
.po-gd-stage{{position:relative;width:100%;aspect-ratio:16/9;background:#041008;border:2px solid #1a3d28;border-radius:8px;overflow:hidden}}
.po-gd-cover{{position:absolute;inset:0}}
.po-gd-hero{{position:absolute;inset:0;background:#041008}}
.po-gd-hero img{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity 1.1s ease}}
.po-gd-hero img.is-on{{opacity:1}}
.po-gd-promo{{margin:0;font-size:12px;color:#6a8b75;max-width:32em;line-height:1.4}}
.po-gd-site{{position:absolute;left:10px;bottom:8px;z-index:3;display:inline-flex;flex-direction:column;align-items:flex-start;gap:2px;text-decoration:none;opacity:.9;max-width:40%}}
.po-gd-site img{{width:96px;max-width:100%;height:auto;display:block;image-rendering:pixelated;image-rendering:crisp-edges}}
.po-gd-site span{{font-size:10px;letter-spacing:.4px;color:#5dce7a;text-shadow:0 0 6px rgba(61,155,95,.35)}}
.po-gd-regions{{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}}
.po-gd-regions button{{appearance:none;border:2px solid #2d6b45;border-radius:8px;padding:8px 12px;background:rgba(4,20,10,.85);color:#5dce7a;font:700 13px "Atkinson Hyperlegible","Segoe UI",system-ui,sans-serif;cursor:pointer}}
.po-gd-regions button:hover,.po-gd-regions button.is-sel{{border-color:#5dce7a;background:rgba(20,50,30,.95)}}
@keyframes poTrail{{0%,100%{{opacity:.92}}50%{{opacity:1}}}}
.po-gd.is-trailer .po-gd-veil{{animation:poTrail 2.4s ease-in-out infinite}}
.po-gd-veil{{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px;text-align:center;background:linear-gradient(180deg,rgba(2,10,6,.4) 0%,rgba(3,12,8,.78) 45%,rgba(3,6,5,.94) 100%)}}
.po-gd-title{{margin:0;font-family:Papyrus,"Segoe Print","Bradley Hand ITC",fantasy;font-size:clamp(26px,5vw,40px);font-weight:400;letter-spacing:2px;color:#5dce7a;text-shadow:0 0 18px rgba(61,155,95,.55),3px 3px 0 #021208;line-height:1.1}}
.po-gd-tag{{margin:0;font-size:clamp(13px,2.8vw,15px);color:#cfe8d6;letter-spacing:.2px;max-width:28em;line-height:1.45}}
.po-gd-tip{{margin:0;font-size:clamp(12px,2.4vw,14px);color:#a8cbb8;letter-spacing:.2px;max-width:28em;line-height:1.4}}
.po-gd-cover{{transition:none}}
.po-gd.is-fading .po-gd-cover{{opacity:0;transition:none}}
.po-gd-enter{{appearance:none;border:3px solid #5dce7a;border-radius:10px;padding:12px 28px;font:700 16px "Atkinson Hyperlegible","Segoe UI",system-ui,sans-serif;letter-spacing:.3px;cursor:pointer;color:#041208;background:linear-gradient(180deg,#5dce7a,#2d6b45);box-shadow:0 0 18px rgba(93,206,122,.35),0 4px 0 #0a1f12;transition:transform .12s,box-shadow .12s}}
.po-gd-enter:hover{{transform:translateY(-2px) scale(1.03);box-shadow:0 0 26px rgba(93,206,122,.5),0 6px 0 #0a1f12}}
.po-gd-enter:active{{transform:scale(.98)}}
.po-gd-play{{display:none;position:absolute;inset:0;background:#030605;line-height:0}}
.po-gd-play iframe{{position:absolute;inset:0;width:100%;height:100%;border:0;display:block;background:#030605}}
.po-gd-load{{
  display:none;position:absolute;inset:0;z-index:15;align-items:center;justify-content:center;
  background:rgba(3,6,5,.92);color:#5dce7a;font:700 16px "Atkinson Hyperlegible","Segoe UI",system-ui,sans-serif;
  letter-spacing:.3px;text-align:center;padding:20px
}}
.po-gd.is-loading .po-gd-load{{display:flex}}
.po-gd.is-open .po-gd-cover{{display:none}}
.po-gd.is-open{{overflow:visible}}
.po-gd.is-open .po-gd-play{{display:block;overflow:hidden}}
.po-gd.is-open .po-gd-top{{display:none!important}}
.po-gd.is-open .po-gd-card{{padding:0;display:flex;flex-direction:column;overflow:visible}}
.po-gd.is-open:not(.is-fs-mode):not(.is-land) .po-gd-stage{{
  aspect-ratio:auto!important;border:0!important;border-radius:0!important;overflow:hidden!important
}}
.po-gd.is-open:not(.is-fs-mode):not(.is-land) .po-gd-play{{
  position:relative;inset:auto;overflow:hidden
}}
.po-gd.is-open:not(.is-fs-mode):not(.is-land) .po-gd-play iframe{{
  position:relative;inset:auto;display:block;overflow:hidden;border:0;width:100%
}}
.po-gd.is-open.is-land,.po-gd.is-fs-mode{{
  position:fixed!important;inset:0!important;width:100vw!important;width:100dvw!important;height:100vh!important;height:100dvh!important;
  max-width:none!important;margin:0!important;padding:0!important;z-index:2147483646!important;background:#030605!important;overflow:hidden!important
}}
.po-gd.is-open.is-land .po-gd-card,.po-gd.is-fs-mode .po-gd-card{{
  height:100%!important;width:100%!important;border:0!important;border-radius:0!important;padding:0!important;box-shadow:none!important;
  display:flex!important;flex-direction:column!important;background:#030605!important;overflow:hidden!important
}}
.po-gd.is-open.is-land .po-gd-top,.po-gd.is-fs-mode .po-gd-top{{display:none!important}}
.po-gd.is-open.is-land .po-gd-stage,.po-gd.is-fs-mode .po-gd-stage{{
  flex:1!important;min-height:0!important;aspect-ratio:auto!important;height:auto!important;border:0!important;border-radius:0!important;overflow:hidden!important
}}
.po-gd.is-open.is-land .po-gd-play,.po-gd.is-fs-mode .po-gd-play{{flex:1!important;min-height:0!important;overflow:hidden!important}}
.po-gd.is-open.is-land .po-gd-play iframe,.po-gd.is-fs-mode .po-gd-play iframe{{
  position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-height:0!important;border:0!important
}}
.po-gd.is-mobile.is-open:not(.is-fs-mode):not(.is-land) .po-gd-stage,
.po-gd.is-mobile.is-open:not(.is-fs-mode):not(.is-land) .po-gd-play{{
  min-height:0!important;max-height:none!important
}}
.po-gd.is-mobile.is-open:not(.is-fs-mode):not(.is-land) .po-gd-play iframe{{
  min-height:0!important;max-height:none!important;
  position:relative!important;inset:auto!important;display:block!important;overflow:visible!important;
  width:100%!important;border:0!important
}}
.po-gd.is-mobile.is-open:not(.is-fs-mode):not(.is-land) .po-gd-stage{{overflow:visible!important}}
.po-gd.is-mobile.is-open:not(.is-fs-mode):not(.is-land) .po-gd-play{{overflow:visible!important}}
.po-gd:not(.is-mobile):not(.is-open) .po-gd-card{{overflow:hidden}}
.po-gd:not(.is-mobile):not(.is-open) .po-gd-stage{{
  aspect-ratio:16/9!important;min-height:0!important;height:auto!important;overflow:hidden!important
}}
.po-gd.is-mobile:not(.is-open) .po-gd-card{{overflow:visible}}
.po-gd.is-mobile:not(.is-open) .po-gd-stage{{
  aspect-ratio:auto!important;min-height:0!important;height:auto!important;overflow:visible!important;
  display:flex!important;flex-direction:column!important
}}
.po-gd.is-mobile:not(.is-open) .po-gd-cover{{
  position:relative!important;inset:auto!important;display:flex!important;flex-direction:column!important;min-height:0!important
}}
.po-gd.is-mobile:not(.is-open) .po-gd-hero{{
  position:relative!important;flex:0 0 auto!important;aspect-ratio:16/9!important;
  max-height:38vh!important;min-height:150px!important;width:100%!important;overflow:hidden!important
}}
.po-gd.is-mobile:not(.is-open) .po-gd-veil{{
  position:relative!important;inset:auto!important;flex:0 0 auto!important;min-height:0!important;
  justify-content:flex-start;padding:14px 12px 18px;gap:8px
}}
.po-gd.is-mobile:not(.is-open) .po-gd-site{{
  position:relative!important;left:auto!important;bottom:auto!important;margin-top:10px;align-self:center
}}
.po-gd:fullscreen,.po-gd:-webkit-full-screen{{
  width:100%;height:100%;max-width:none;background:#030605
}}
.po-gd:fullscreen .po-gd-card,.po-gd:-webkit-full-screen .po-gd-card{{
  height:100%;border:0;border-radius:0;padding:0;box-shadow:none;
  display:flex;flex-direction:column
}}
.po-gd:fullscreen .po-gd-top,.po-gd:-webkit-full-screen .po-gd-top{{display:none}}
.po-gd:fullscreen .po-gd-stage,.po-gd:-webkit-full-screen .po-gd-stage{{
  flex:1;min-height:0;aspect-ratio:auto;height:auto;border:0;border-radius:0
}}
@media (max-width:700px){{
  .po-gd-card{{padding:4px;border-width:2px}}
  .po-gd:not(.is-open) .po-gd-card{{overflow:visible}}
  .po-gd:not(.is-open) .po-gd-stage{{
    aspect-ratio:auto!important;min-height:0!important;height:auto!important;overflow:visible!important;
    display:flex!important;flex-direction:column!important
  }}
  .po-gd:not(.is-open) .po-gd-cover{{
    position:relative!important;inset:auto!important;display:flex!important;flex-direction:column!important;min-height:0!important
  }}
  .po-gd:not(.is-open) .po-gd-hero{{
    position:relative!important;flex:0 0 auto!important;aspect-ratio:16/9!important;
    max-height:38vh!important;min-height:150px!important;width:100%!important;overflow:hidden!important
  }}
  .po-gd:not(.is-open) .po-gd-veil{{
    position:relative!important;inset:auto!important;flex:0 0 auto!important;min-height:0!important;
    justify-content:flex-start;padding:14px 12px 18px;gap:8px
  }}
  .po-gd:not(.is-open) .po-gd-site{{
    position:relative!important;left:auto!important;bottom:auto!important;margin-top:8px;align-self:center
  }}
  .po-gd-top{{margin-bottom:4px}}
  .po-gd-brand{{font-size:13px}}
  .po-gd-enter{{padding:14px 22px;min-height:48px;width:min(100%,280px);font-size:16px}}
  .po-gd-title{{font-size:clamp(28px,9vw,44px)}}
  .po-gd-site{{left:8px;bottom:6px}}
  .po-gd-site img{{width:72px}}
  .po-gd-site span{{font-size:9px}}
}}
@media (min-width:701px){{
  .po-gd:not(.is-open) .po-gd-stage{{
    aspect-ratio:16/9!important;min-height:0!important;height:auto!important;overflow:hidden!important
  }}
  .po-gd:not(.is-open) .po-gd-card{{overflow:hidden}}
}}
</style>
<div class="po-gd" id="po-gd">
  <div class="po-gd-card">
    <div class="po-gd-top">
      <div class="po-gd-brand">PRIMAL ODYSSEY <span>by 8bitcrypto_44</span></div>
    </div>
    <div class="po-gd-stage">
      <div class="po-gd-cover">
        <div class="po-gd-hero" id="po-gd-hero" aria-hidden="true">
          <img class="is-on" src="https://i.postimg.cc/D0kDM1Xb/african-cover-image.jpg" alt="" width="920" height="518" decoding="async">
          <img src="https://i.postimg.cc/L5K7bj11/mountains-cover-image.jpg" alt="" width="920" height="518" decoding="async">
          <img src="https://i.postimg.cc/VvqTQ5qs/jungle-cover-image.jpg" alt="" width="920" height="518" decoding="async">
          <img src="https://8bitcrypto44.github.io/Primal-Odyssey-/assets/covers/wetlands.png" alt="" width="920" height="518" decoding="async">
        </div>
        <div class="po-gd-veil">
          <h2 class="po-gd-title">PRIMAL ODYSSEY</h2>
          <p class="po-gd-tag">Africa · Mountains · Jungle · Wetlands — apex animals &amp; field dossiers</p>
          <p class="po-gd-tip">Enter → choose biome · Phone: scroll menu · landscape FS · FS button in-game (v{v})</p>
          <div class="po-gd-regions" id="po-gd-regions">
            <button type="button" data-region="africa">Africa</button>
            <button type="button" data-region="mountains">Mountains</button>
            <button type="button" data-region="jungle">Jungle</button>
            <button type="button" data-region="wetlands">Wetlands</button>
          </div>
          <button type="button" class="po-gd-enter" id="po-gd-enter">Enter expedition</button>
          <p class="po-gd-promo">Also: Thank You For Your Service kids coloring books - Free &amp; Faithful Press</p>
          <a class="po-gd-site" href="https://www.8bitcrypto44.xyz" target="_blank" rel="noopener noreferrer" aria-label="8bitcrypto_44 website">
            <img src="{BRAND_LOGO_URI}" alt="" width="96" height="13" decoding="async">
            <span>www.8bitcrypto44.xyz</span>
          </a>
        </div>
      </div>
      <div class="po-gd-play" id="po-gd-play">
        <div class="po-gd-load" id="po-gd-load" aria-live="polite">Loading expedition…</div>
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
  var playing=false;
  function phone(){{
    try{{
      if(window.matchMedia("(pointer: fine)").matches && !window.matchMedia("(pointer: coarse)").matches)return false;
    }}catch(e){{}}
    var touch=("ontouchstart" in window)||(navigator.maxTouchPoints>0);
    var narrow=false,coarse=false;
    try{{
      narrow=window.matchMedia("(max-width:700px)").matches;
      coarse=window.matchMedia("(pointer: coarse)").matches;
    }}catch(e2){{}}
    return (touch&&coarse)||narrow;
  }}
  function land(){{
    if(window.matchMedia&&window.matchMedia("(orientation: landscape)").matches)return true;
    return window.innerWidth>window.innerHeight;
  }}
  function isFs(){{
    return root.classList.contains("is-fs-mode")||
      !!(document.fullscreenElement||document.webkitFullscreenElement);
  }}
  function syncFsClass(){{
    root.classList.toggle("is-fs", root.classList.contains("is-fs-mode")||isFs());
  }}
  function syncLand(){{
    root.classList.toggle("is-land", root.classList.contains("is-open") && playing && phone() && land());
    syncFsClass();
  }}
  function mobileMode(){{return root.classList.contains("is-mobile")||phone();}}
  function clearCoverHeights(){{
    var st=root.querySelector(".po-gd-stage"),pl=document.getElementById("po-gd-play");
    if(st){{st.style.minHeight="";st.style.height="";st.style.maxHeight="";st.style.aspectRatio="";}}
    if(pl){{pl.style.minHeight="";pl.style.height="";pl.style.maxHeight="";}}
  }}
  function embedDefaultH(){{return 980;}}
  function mobileBootH(){{
    var vh=Math.max(320,Math.round(window.innerHeight||document.documentElement.clientHeight||680));
    return Math.max(680,Math.round(vh*1.05));
  }}
  function openBootH(){{
    var st=root.querySelector(".po-gd-stage"),cov=root.querySelector(".po-gd-cover"),h=0;
    if(st)h=Math.max(h,Math.round(st.scrollHeight||0),Math.round(st.offsetHeight||0),Math.round(st.getBoundingClientRect().height||0));
    if(cov)h=Math.max(h,Math.round(cov.scrollHeight||0),Math.round(cov.offsetHeight||0));
    return Math.max(h,mobileBootH());
  }}
  var lastAppliedH=0;
  function requestChildResize(){{
    // Digistracts pattern: while open on mobile, child drives height — parent pings cause grow loops.
    if(playing&&mobileMode()&&!isFs()&&!root.classList.contains("is-land"))return;
    if(root._poResizeT)clearTimeout(root._poResizeT);
    root._poResizeT=setTimeout(function(){{
      try{{if(frame.contentWindow)frame.contentWindow.postMessage({{type:"po-request-resize"}},"*");}}catch(e){{}}
    }},64);
  }}
  function setFrameHeight(h){{
    if(isFs()||root.classList.contains("is-land"))return;
    if(!root.classList.contains("is-open")){{clearCoverHeights();lastAppliedH=0;return;}}
    var contentH;
    if(mobileMode()&&!root.classList.contains("is-land")){{
      var reported=Math.round(Number(h)||0);
      contentH=reported>0?Math.max(320,reported):mobileBootH();
      if(root.classList.contains("is-loading"))contentH=Math.max(contentH,openBootH());
      frame.setAttribute("scrolling","no");
      root.classList.add("is-mobile");
      h=contentH;
    }}else{{
      contentH=Math.max(680,Math.round(Number(h)||920));
      h=contentH;
      if(!phone())frame.setAttribute("scrolling","no");
    }}
    // Ignore sub-pixel / jitter re-applies (child resize ↔ parent setFrameHeight feedback).
    if(lastAppliedH>0&&Math.abs(h-lastAppliedH)<8)return;
    lastAppliedH=h;
    frame.style.height=h+"px";
    frame.style.minHeight=h+"px";
    frame.style.maxHeight="none";
    var st=root.querySelector(".po-gd-stage");
    var pl=document.getElementById("po-gd-play");
    if(st){{st.style.height="auto";st.style.minHeight="0";st.style.maxHeight="none";st.style.aspectRatio="auto";}}
    if(pl){{pl.style.height="auto";pl.style.minHeight="0";pl.style.maxHeight="none";}}
  }}
  function postFsState(active){{try{{if(frame.contentWindow)frame.contentWindow.postMessage({{type:"po-fs-state",active:!!active}},"*");}}catch(e){{}}}}
  function mountFs(){{
    if(root.dataset.poMounted==="1")return;
    var slot=document.createElement("div");
    slot.setAttribute("data-po-slot","1");
    slot.style.cssText="display:block;width:100%;max-width:920px;margin:0 auto;height:"+Math.max(1,Math.round(root.getBoundingClientRect().height))+"px";
    if(root.parentNode)root.parentNode.insertBefore(slot, root);
    document.body.appendChild(root);
    root.dataset.poMounted="1";
  }}
  function unmountFs(){{
    if(root.dataset.poMounted!=="1")return;
    var slot=document.querySelector("[data-po-slot]");
    if(slot&&slot.parentNode){{
      slot.parentNode.insertBefore(root, slot);
      slot.parentNode.removeChild(slot);
    }}
    delete root.dataset.poMounted;
  }}
  function finishExit(){{
    unmountFs();
    root.classList.remove("is-fs-mode");
    postFsState(false);
    try{{document.documentElement.style.overflow="";document.body.style.overflow="";}}catch(e){{}}
    syncLand();
  }}
  function enterFs(){{
    mountFs();
    root.classList.add("is-fs-mode");
    postFsState(true);
    try{{document.documentElement.style.overflow="hidden";document.body.style.overflow="hidden";}}catch(e){{}}
    var req=frame.requestFullscreen||frame.webkitRequestFullscreen;
    if(req&&!document.fullscreenElement){{
      try{{
        var p=req.call(frame);
        if(p&&p.catch)p.catch(function(){{}});
      }}catch(e){{}}
    }}
  }}
  function exitFs(){{
    root.classList.remove("is-fs-mode");
    var ex=document.exitFullscreen||document.webkitExitFullscreen;
    if(ex&&document.fullscreenElement){{
      try{{
        var p=ex.call(document);
        if(p&&p.then)p.then(finishExit).catch(finishExit);
        else finishExit();
      }}catch(e){{finishExit();}}
    }}else{{
      finishExit();
    }}
  }}
  var playing=false;
  var baseSrc="https://8bitcrypto44.github.io/Primal-Odyssey-/?embed=1&amp;v={v}".replace(/&amp;/g,"&");
  root.classList.add("is-trailer");
  // Soft full-bleed cover crossfade (no mosaic strobe)
  var heroImgs=root.querySelectorAll("#po-gd-hero img");
  var hi=0;
  if(heroImgs.length>1){{
    setInterval(function(){{
      if(!root.classList.contains("is-trailer"))return;
      heroImgs[hi].classList.remove("is-on");
      hi=(hi+1)%heroImgs.length;
      heroImgs[hi].classList.add("is-on");
    }},3200);
  }}
  function openGame(suggest){{
    var src=baseSrc+(suggest?("&region="+suggest):"");
    frame.setAttribute("src",src);
    root.classList.add("is-open");
    root.classList.add("is-loading");
    root.classList.remove("is-trailer");
    playing=true;
    btn.setAttribute("aria-expanded","true");
    if(phone()){{root.classList.add("is-mobile");frame.setAttribute("scrolling","no");if(land())enterFs();}}else{{
      try{{document.documentElement.style.overflow="hidden";document.body.style.overflow="hidden";}}catch(e){{}}
    }}
    setFrameHeight(phone()?openBootH():embedDefaultH());
    syncLand();
    requestChildResize();
    try{{frame.focus();}}catch(e){{}}
  }}
  btn.addEventListener("click",function(){{
    openGame(null);
  }});
  function wireRegion(el){{
    if(!el)return;
    el.addEventListener("click",function(e){{
      e.preventDefault();
      e.stopPropagation();
      root.querySelectorAll("#po-gd-regions [data-region]").forEach(function(b){{b.classList.remove("is-sel");}});
      el.classList.add("is-sel");
      openGame(el.getAttribute("data-region"));
    }});
  }}
  document.querySelectorAll("#po-gd-regions [data-region]").forEach(wireRegion);
  frame.addEventListener("load",function(){{
    root.classList.remove("is-loading");
    requestChildResize();
  }});
  setTimeout(function(){{root.classList.remove("is-loading");}},8000);
  window.addEventListener("message",function(e){{
    if(!e.data)return;
    if(e.data.type==="po-chrome"){{
      if(typeof e.data.inGame==="boolean")playing=!!e.data.inGame;
      else if(typeof e.data.explore==="boolean")playing=!!e.data.explore;
      syncLand();
      if((!e.data.inGame&&!e.data.explore)||!mobileMode()||isFs()||root.classList.contains("is-land"))requestChildResize();
      else setTimeout(requestChildResize,120);
    }}
    if(e.data.type==="po-fs")enterFs();
    if(e.data.type==="po-fs-exit")exitFs();
    if(e.data.type==="po-mobile")root.classList.toggle("is-mobile",!!e.data.active);
    if(e.data.type==="po-resize"&&e.data.height&&!isFs()&&!root.classList.contains("is-land"))setFrameHeight(e.data.height);
  }});
  function onFsChange(){{
    if(!document.fullscreenElement&&!document.webkitFullscreenElement&&root.classList.contains("is-fs-mode")){{
      finishExit();
      return;
    }}
    syncFsClass();syncLand();
  }}
  document.addEventListener("fullscreenchange",onFsChange);
  document.addEventListener("webkitfullscreenchange",onFsChange);
  window.addEventListener("resize",function(){{
    syncLand();
    if(root.classList.contains("is-open")&&!isFs()){{
      lastAppliedH=0;
      requestChildResize();
    }}
  }});
  window.addEventListener("orientationchange",function(){{setTimeout(function(){{
    syncLand();
    lastAppliedH=0;
    if(root.classList.contains("is-open")&&!isFs())requestChildResize();
    else clearCoverHeights();
  }},120);}});
  if(phone())root.classList.add("is-mobile");
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
assert "cougar:{" in full_block or "cougar:{" in sprites
assert "honeybadger" in full_block
assert "iframe" in iframe_snippet
assert stub_n < 51375, "iframe stub must fit Digistracts paste limit"
print("Paste godaddy_iframe_snippet.html (or primal_odyssey_godaddy_block.html) into Digistracts.")
