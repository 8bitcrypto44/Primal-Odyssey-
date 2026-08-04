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
Paste this block (frame is drawn *inside* the game so Digistracts can’t clip a side):

```html
<div style="box-sizing:border-box;position:relative;display:block;width:100%;max-width:100%;aspect-ratio:4/5;max-height:720px;margin:0;padding:0;overflow:hidden;background:#030605;line-height:0;border:0;border-radius:12px;box-shadow:0 12px 28px rgba(0,0,0,.4)">
<iframe
  src="https://8bitcrypto44.github.io/Primal-Odyssey-/?embed=1"
  title="Primal Odyssey"
  width="100%"
  height="720"
  style="box-sizing:border-box;position:absolute;inset:0;width:100%;height:100%;border:0;outline:0;display:block;margin:0;padding:0;background:#030605"
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
