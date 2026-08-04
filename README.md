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

- **Cover** matches other games (`max-width: 920px`) with a 3-region image mosaic + **ENTER EXPEDITION**
- Clicking Enter expands a tall play panel and loads the GitHub Pages iframe (only then)
- Desktop play area is 16:9; mobile expands to ~560px tall
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
