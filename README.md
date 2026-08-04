# Primal Odyssey

The adventure game — black + forest-green 8-bit exploration.

## Play locally
```
python -m http.server 8780
```
Then open http://localhost:8780/

## Hosted play (recommended)
**GitHub Pages** (no paste size limit):  
https://8bitcrypto44.github.io/Primal-Odyssey-/

Asset URLs are cache-busted (`?v=N` on CSS/JS). Bump `ASSET_VER` in `build_game.py` when publishing.

## Digistracts / GoDaddy — iframe only

Digistracts HTML paste limit is ~**51KB**. The full game is ~200KB+ and **will not fit**.

**Paste only** `godaddy_iframe_snippet.html` (same content as `primal_odyssey_godaddy_block.html`):

```html
<!-- Digistracts / GoDaddy: paste THIS only. Full game hosts on GitHub Pages. -->
<div style="box-sizing:border-box;width:100%;max-width:100%;margin:0;padding:3px;background:#2d6b45;border-radius:12px;box-shadow:0 10px 24px rgba(0,0,0,.35)">
  <div style="box-sizing:border-box;position:relative;display:block;width:100%;aspect-ratio:16/9;max-height:720px;margin:0;padding:0;overflow:hidden;background:#030605;line-height:0;border:0;border-radius:9px">
    <iframe
      src="https://8bitcrypto44.github.io/Primal-Odyssey-/?embed=1&amp;v=14"
      title="Primal Odyssey"
      width="100%"
      height="405"
      style="box-sizing:border-box;position:absolute;top:0;left:0;right:0;bottom:0;width:100%;height:100%;border:0;outline:0;display:block;margin:0;padding:0;background:#030605"
      allow="autoplay; fullscreen"
      allowfullscreen
      loading="eager"
      scrolling="no"
    ></iframe>
  </div>
</div>
```

## Rebuild after edits
```
python build_game.py
```
Writes:
- `index.html` — Pages host (cache-busted assets)
- `godaddy_iframe_snippet.html` / `primal_odyssey_godaddy_block.html` — Digistracts paste (~1KB)
- `primal_odyssey_full_singlefile.html` — archive only, **not** for Digistracts

## Controls
WASD / arrows · Click animals for dossiers · Esc / REGIONS for menu
