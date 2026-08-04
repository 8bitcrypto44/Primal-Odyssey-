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
Paste this small HTML block (max-size embed for phones):

```html
<div style="width:100%;max-width:100%;margin:0;padding:0;line-height:0">
<iframe
  src="https://8bitcrypto44.github.io/Primal-Odyssey-/?embed=1"
  title="Primal Odyssey"
  width="100%"
  height="900"
  style="width:100%;max-width:100%;height:min(92dvh,960px);min-height:75vh;border:0;display:block;margin:0;background:#030605"
  allow="autoplay; fullscreen"
  allowfullscreen
  loading="lazy"
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
