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

## Digistracts / GoDaddy — cover then expand

Paste `godaddy_iframe_snippet.html` (same as `primal_odyssey_godaddy_block.html`).

- Same width/chrome as Digistracts: `max-width:920px`, 4px border, 10px padding, **16:9** stage (matches Digistracts 800×450 canvas)
- Cover mosaic + **ENTER EXPEDITION**; iframe loads only after click
- Play panel stays 16:9 so height stays aligned with Digistracts
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
