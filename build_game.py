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
ASSET_VER = "47"
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
    "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n"
    "<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n"
    "<link href=\"https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap\" rel=\"stylesheet\">\n"
    "<style>html,body{{margin:0;height:100%;min-height:100%;background:#030605;}}</style>\n"
    "</head>\n<body>\n"
    + body.strip() + "\n"
    f"<script src=\"primal_data.js?v={v}\"></script>\n"
    f"<script src=\"primal_sprites.js?v={v}\"></script>\n"
    f"<script src=\"primal_snes_data.js?v={v}\"></script>\n"
    f"<script src=\"primal_snes.js?v={v}\"></script>\n"
    f"<script src=\"primal.js?v={v}\"></script>\n"
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
.po-gd-mosaic{{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:0;width:100%;height:100%;background:#041008}}
.po-gd-mosaic button{{appearance:none;border:0;padding:0;margin:0;cursor:pointer;background:#041008;position:relative;overflow:hidden;opacity:0.7;transition:opacity .6s ease}}
.po-gd-mosaic img{{width:100%;height:100%;object-fit:cover;display:block;filter:saturate(1.05) contrast(1.05);transition:transform .8s ease}}
.po-gd-mosaic button:hover img,.po-gd.is-trailer .po-gd-mosaic img{{transform:scale(1.08)}}
.po-gd-mosaic .po-wet{{filter:hue-rotate(75deg) saturate(1.3) brightness(.85) sepia(.2)}}.po-gd-mosaic button[data-region=wetlands]::after{{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(30,90,100,.2),rgba(10,50,60,.35));pointer-events:none}}
.po-gd-promo{{margin:0;font-size:12px;color:#6a8b75;max-width:32em;line-height:1.4}}
.po-gd-regions{{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}}
.po-gd-regions button{{appearance:none;border:2px solid #2d6b45;border-radius:8px;padding:8px 12px;background:rgba(4,20,10,.85);color:#5dce7a;font:700 13px "Atkinson Hyperlegible","Segoe UI",system-ui,sans-serif;cursor:pointer}}
@keyframes poTrail{{0%,100%{{opacity:.92}}50%{{opacity:1}}}}
.po-gd.is-trailer .po-gd-veil{{animation:poTrail 2.4s ease-in-out infinite}}
.po-gd-veil{{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px;text-align:center;background:linear-gradient(180deg,rgba(2,10,6,.35) 0%,rgba(3,12,8,.72) 45%,rgba(3,6,5,.92) 100%)}}
.po-gd-title{{margin:0;font-family:Papyrus,"Segoe Print","Bradley Hand ITC",fantasy;font-size:clamp(26px,5vw,40px);font-weight:400;letter-spacing:2px;color:#5dce7a;text-shadow:0 0 18px rgba(61,155,95,.55),3px 3px 0 #021208;line-height:1.1}}
.po-gd-tag{{margin:0;font-size:clamp(13px,2.8vw,15px);color:#cfe8d6;letter-spacing:.2px;max-width:28em;line-height:1.45}}
.po-gd-tip{{margin:0;font-size:clamp(12px,2.4vw,14px);color:#a8cbb8;letter-spacing:.2px;max-width:28em;line-height:1.4}}
.po-gd-cover{{transition:opacity .55s ease}}
.po-gd.is-fading .po-gd-cover{{opacity:0}}
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
.po-gd.is-open .po-gd-play{{display:block}}
.po-gd-fs{{
  display:none;position:absolute;left:50%;top:8px;transform:translateX(-50%);z-index:20;
  border:2px solid #5dce7a;border-radius:10px;padding:10px 14px;min-height:44px;
  font:700 13px "Atkinson Hyperlegible","Segoe UI",system-ui,sans-serif;letter-spacing:.2px;cursor:pointer;
  color:#fff;background:rgba(4,20,10,.92);box-shadow:0 0 18px rgba(93,206,122,.35);
  -webkit-tap-highlight-color:transparent;white-space:nowrap
}}
.po-gd.is-open.is-land .po-gd-fs{{display:block}}
.po-gd.is-fs .po-gd-fs{{opacity:.85;font-size:12px;padding:8px 12px;min-height:36px;border-color:#7fa88c;color:#9ec9ad;box-shadow:none}}
.po-gd.is-open.is-land{{
  position:fixed;inset:0;z-index:9999;max-width:none;width:100%;height:100%;height:100dvh;margin:0;
  background:#030605
}}
.po-gd.is-open.is-land .po-gd-card{{
  height:100%;border:0;border-radius:0;padding:0;box-shadow:none;
  display:flex;flex-direction:column;background:#030605
}}
.po-gd.is-open.is-land .po-gd-top{{display:none}}
.po-gd.is-open.is-land .po-gd-stage{{
  flex:1;min-height:0;aspect-ratio:auto;height:auto;border:0;border-radius:0
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
        <div class="po-gd-mosaic" id="po-gd-mosaic">
          <button type="button" data-region="africa" title="Play Africa"><img src="https://i.postimg.cc/D0kDM1Xb/african-cover-image.jpg" alt="Africa" width="320" height="180" loading="lazy"></button>
          <button type="button" data-region="mountains" title="Play Mountains"><img src="https://i.postimg.cc/L5K7bj11/mountains-cover-image.jpg" alt="Mountains" width="320" height="180" loading="lazy"></button>
          <button type="button" data-region="jungle" title="Play Jungle"><img src="https://i.postimg.cc/VvqTQ5qs/jungle-cover-image.jpg" alt="Jungle" width="320" height="180" loading="lazy"></button>
          <button type="button" data-region="wetlands" title="Play Wetlands"><img class="po-wet" src="https://8bitcrypto44.github.io/Primal-Odyssey-/assets/covers/wetlands.png" alt="Wetlands" width="320" height="180" loading="lazy"></button>
        </div>
        <div class="po-gd-veil">
          <h2 class="po-gd-title">PRIMAL ODYSSEY</h2>
          <p class="po-gd-tag">Africa · Mountains · Jungle · Wetlands — apex animals &amp; field dossiers</p>
          <p class="po-gd-tip">Tap a biome — LPC wildlife + parallax biomes (v47)</p>
          <div class="po-gd-regions" id="po-gd-regions">
            <button type="button" data-region="africa">Africa</button>
            <button type="button" data-region="mountains">Mountains</button>
            <button type="button" data-region="jungle">Jungle</button>
            <button type="button" data-region="wetlands">Wetlands</button>
          </div>
          <button type="button" class="po-gd-enter" id="po-gd-enter">Enter expedition</button>
          <p class="po-gd-promo">Also: Thank You For Your Service kids coloring books - Free &amp; Faithful Press</p>
        </div>
      </div>
      <div class="po-gd-play" id="po-gd-play">
        <div class="po-gd-load" id="po-gd-load" aria-live="polite">Loading expedition…</div>
        <button type="button" class="po-gd-fs" id="po-gd-fs" aria-pressed="false">Full screen</button>
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
  var fsBtn=document.getElementById("po-gd-fs");
  if(!root||!btn||!frame)return;
  var playing=false;
  function phone(){{
    return ("ontouchstart" in window)||(navigator.maxTouchPoints>0)||window.innerWidth<=900;
  }}
  function land(){{
    if(window.matchMedia&&window.matchMedia("(orientation: landscape)").matches)return true;
    return window.innerWidth>window.innerHeight;
  }}
  function isFs(){{
    return !!(document.fullscreenElement||document.webkitFullscreenElement);
  }}
  function syncFsBtn(){{
    if(!fsBtn)return;
    var on=isFs();
    root.classList.toggle("is-fs",on);
    fsBtn.setAttribute("aria-pressed",on?"true":"false");
    fsBtn.textContent=on?"Exit full screen":"Full screen";
  }}
  function syncLand(){{
    root.classList.toggle("is-land", root.classList.contains("is-open") && playing && phone() && land());
    syncFsBtn();
  }}
  function enterFs(){{
    if(isFs())return;
    var req=root.requestFullscreen||root.webkitRequestFullscreen;
    if(!req)return;
    try{{
      var p=req.call(root);
      if(p&&p.catch)p.catch(function(){{}});
    }}catch(e){{}}
  }}
  function exitFs(){{
    var exit=document.exitFullscreen||document.webkitExitFullscreen;
    if(exit&&isFs()){{
      try{{
        var p=exit.call(document);
        if(p&&p.catch)p.catch(function(){{}});
      }}catch(e){{}}
    }}
  }}
  var playing=false;
  var baseSrc="https://8bitcrypto44.github.io/Primal-Odyssey-/?embed=1&amp;v={v}".replace(/&amp;/g,"&");
  root.classList.add("is-trailer");
  var tiles=root.querySelectorAll("#po-gd-mosaic button");
  var ti=0;
  if(tiles.length){{
    setInterval(function(){{
      if(!root.classList.contains("is-trailer"))return;
      tiles.forEach(function(b,i){{b.style.opacity=i===ti?"1":"0.55";b.style.zIndex=i===ti?"2":"1";}});
      ti=(ti+1)%tiles.length;
    }},1600);
  }}
  function openGame(region){{
    var src=baseSrc+(region?("&region="+region):"");
    frame.setAttribute("src",src);
    root.classList.add("is-open");
    root.classList.add("is-loading");
    root.classList.add("is-fading");
    root.classList.remove("is-trailer");
    playing=true;
    btn.setAttribute("aria-expanded","true");
    syncLand();
    if(phone()&&land())enterFs();
    try{{frame.focus();}}catch(e){{}}
    setTimeout(function(){{root.classList.remove("is-fading");}},600);
  }}
  btn.addEventListener("click",function(){{
    openGame(null);
  }});
  function wireRegion(el){{
    if(!el)return;
    el.addEventListener("click",function(e){{
      e.preventDefault();
      e.stopPropagation();
      openGame(el.getAttribute("data-region"));
    }});
  }}
  document.querySelectorAll("#po-gd-mosaic [data-region], #po-gd-regions [data-region]").forEach(wireRegion);
  frame.addEventListener("load",function(){{
    root.classList.remove("is-loading");
  }});
  setTimeout(function(){{root.classList.remove("is-loading");}},8000);
  if(fsBtn){{
    fsBtn.addEventListener("click",function(e){{
      e.preventDefault();
      e.stopPropagation();
      if(isFs())exitFs();
      else enterFs();
      setTimeout(syncFsBtn,200);
    }});
  }}
  root.addEventListener("touchstart",function(){{
    if(!root.classList.contains("is-land")||isFs())return;
    enterFs();
  }},{{passive:true}});
  window.addEventListener("message",function(e){{
    if(!e.data)return;
    if(e.data.type==="po-chrome"){{
      /* Stay fullscreen until EXIT FULL SCREEN — dossiers are still in-game */
      if(typeof e.data.inGame==="boolean")playing=!!e.data.inGame;
      else playing=!!e.data.explore;
      syncLand();
    }}
    if(e.data.type==="po-fs")enterFs();
    if(e.data.type==="po-fs-exit")exitFs();
  }});
  function onFsChange(){{syncFsBtn();syncLand();}}
  document.addEventListener("fullscreenchange",onFsChange);
  document.addEventListener("webkitfullscreenchange",onFsChange);
  window.addEventListener("resize",syncLand);
  window.addEventListener("orientationchange",function(){{setTimeout(syncLand,120);}});
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
