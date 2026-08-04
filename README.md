# Primal Odyssey

The adventure game — black + forest-green 8-bit exploration.

## Play locally
Open `index.html` (already inlined) or run:
```
python -m http.server 8780
```

## Hosted play (recommended)
This repo is built for **GitHub Pages** (no paste size limit). After Pages is on:
`https://8bitcrypto44.github.io/Primal-Odyssey-/`

### GoDaddy iframe
Paste this small HTML block (framed, stable — no `vh` drift):

```html
<div style="position:relative;width:100%;max-width:100%;aspect-ratio:4/5;max-height:720px;margin:0 auto;padding:0;overflow:hidden;background:#030605;line-height:0;border:3px solid #2d6b45;border-radius:12px;box-shadow:0 0 0 2px #0a1f12,0 0 22px rgba(61,155,95,.28),0 12px 28px rgba(0,0,0,.45)">
<iframe
  src="https://8bitcrypto44.github.io/Primal-Odyssey-/?embed=1"
  title="Primal Odyssey"
  width="100%"
  height="720"
  style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;display:block;margin:0;padding:0;background:#030605;border-radius:9px"
  allow="autoplay; fullscreen"
  allowfullscreen
  loading="eager"
  scrolling="no"
></iframe>
</div>
```

Or copy `godaddy_iframe_snippet.html`.

### Legacy Digistracts paste
`primal_odyssey_godaddy_block.html` is a single-file export. With full dossiers it is **too large** for Digistracts — use the iframe above instead.

## Rebuild after edits
```
python build_game.py
```

## Controls
WASD / arrows · Click animals for dossiers · Esc / REGIONS for menu
