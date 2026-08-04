#!/usr/bin/env python3
from pathlib import Path
ROOT = Path(__file__).resolve().parent
frag = (ROOT / "assets/out/animal_sprites_fragment.js").read_text(encoding="utf-8").strip().rstrip(",")
player = (
    'player:{s:3,pal:{X:"#e8c4a0",H:"#3a2a18",S:"#2a5a8a",P:"#1a3a5a",B:"#c45c26",K:"#111"},'
    'frames:[["....HHH....","...HXXXH...","...XXXXX...","....X.X....","...SSSSS...","..SBBBBBS..","..SB.S.BS..","...P...P...","...P...P...","...K...K..."]]}'
)
js = f"""/* Baked from CC0 LPC animals (OGA) + Kenney Animal Pack Redux */
(function (global) {{
  function drawGrid(ctx, grid, palette, s, ox, oy) {{
    ox = ox || 0; oy = oy || 0;
    for (let y = 0; y < grid.length; y++) {{
      const row = grid[y];
      for (let x = 0; x < row.length; x++) {{
        const ch = row[x];
        if (ch === "." || ch === " ") continue;
        const col = palette[ch];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect((ox + x) * s, (oy + y) * s, s, s);
      }}
    }}
  }}
  function clonePal(pal, map) {{
    const out = {{}};
    for (const k in pal) out[k] = map[pal[k]] || pal[k];
    return out;
  }}
  const SPRITES = {{
{player},
{frag}
  }};
  // Big-cat variants from lioness base (saves size, keeps LPC silhouette)
  if (SPRITES.lioness) {{
    const g = SPRITES.lioness.grid, s = SPRITES.lioness.s, p = SPRITES.lioness.pal;
    SPRITES.lion = SPRITES.lioness; // swapped for PostImg sheet when loaded
    SPRITES.cougar = {{ s:s, grid:g, pal:clonePal(p, {{"#af8a35":"#c49a4a","#a2794b":"#b8894a","#946b44":"#8a6a30"}}) }};
    SPRITES.tiger = {{ s:s, grid:g, pal:clonePal(p, {{"#af8a35":"#e07a2a","#a2794b":"#c45c18","#946b44":"#8a4010","#704c2c":"#3a2010"}}) }};
    SPRITES.leopard = {{ s:s, grid:g, pal:clonePal(p, {{"#af8a35":"#c49a4a","#a2794b":"#b8894a"}}) }};
    SPRITES.jaguar = SPRITES.leopard;
    SPRITES.snowleopard = {{ s:s, grid:g, pal:clonePal(p, {{"#af8a35":"#c5d0dc","#a2794b":"#a8b4c0","#946b44":"#7a8898","#704c2c":"#5a6570","#2e1f1c":"#3a4550"}}) }};
  }}
  if (!SPRITES.grizzly) SPRITES.grizzly = SPRITES.wolf;
  function drawSprite(ctx, id, x, y, scale, frame) {{
    const sp = SPRITES[id];
    if (!sp) return;
    const s = (sp.s || 2) * (scale || 1);
    ctx.save();
    ctx.translate(x | 0, y | 0);
    if (sp.frames) drawGrid(ctx, sp.frames[(frame || 0) % sp.frames.length], sp.pal, s | 0 || s);
    else drawGrid(ctx, sp.grid, sp.pal, Math.max(1, s | 0) || s);
    ctx.restore();
  }}
  function spriteSize(id, scale) {{
    const sp = SPRITES[id];
    if (!sp) return {{ w: 16, h: 16 }};
    const s = (sp.s || 2) * (scale || 1);
    const g = sp.frames ? sp.frames[0] : sp.grid;
    return {{ w: g[0].length * s, h: g.length * s }};
  }}
  function paintPreview(canvas, regionId) {{
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const W = canvas.width, H = canvas.height, R = global.PO_DATA[regionId];
    if (!R) return;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, R.sky[0]); g.addColorStop(1, R.sky[2] || R.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = R.ground[0]; ctx.fillRect(0, H * 0.55, W, H * 0.45);
    if (regionId === "africa") {{
      ctx.fillStyle = "#2a4a20";
      for (let i = 0; i < 5; i++) {{
        const x = 30 + i * 60;
        ctx.fillRect(x, H * 0.35, 6, H * 0.25);
        ctx.beginPath(); ctx.ellipse(x + 3, H * 0.35, 22, 10, 0, 0, Math.PI * 2); ctx.fill();
      }}
    }} else if (regionId === "mountains") {{
      ctx.fillStyle = "#4a4a50";
      ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(80, H * 0.25); ctx.lineTo(160, H * 0.55); ctx.lineTo(240, H * 0.2); ctx.lineTo(320, H); ctx.fill();
    }} else {{
      ctx.fillStyle = "#1a3a18";
      for (let i = 0; i < 12; i++) ctx.fillRect(10 + i * 28, H * 0.2, 16, H * 0.45);
    }}
  }}
  global.PO_SPRITES = {{ drawSprite: drawSprite, spriteSize: spriteSize, paintPreview: paintPreview, SPRITES: SPRITES }};
}})(window);
"""
(ROOT / "primal_sprites.js").write_text(js, encoding="utf-8")
print("wrote", len(js))
