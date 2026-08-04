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

**Paste only** `godaddy_iframe_snippet.html` (same content as `primal_odyssey_godaddy_block.html`).

Mobile uses a **tall ~560px panel** (same idea as Binary Matrix). Desktop stays **16:9**. Game canvas keeps correct proportions (`object-fit: contain`).

After `python build_game.py`, copy the generated snippet — it includes the current `?v=` cache-bust.
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
