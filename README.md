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
Paste a small HTML block (not the full game):

```html
<iframe
  src="https://8bitcrypto44.github.io/Primal-Odyssey-/"
  title="Primal Odyssey"
  width="100%"
  height="720"
  style="border:0;border-radius:12px;max-width:1100px;min-height:640px"
  allow="autoplay"
  loading="lazy"
></iframe>
```

### Legacy Digistracts paste
`primal_odyssey_godaddy_block.html` is a single-file export. With full dossiers it is **too large** for Digistracts — use the iframe above instead.

## Rebuild after edits
```
python build_game.py
```

## Controls
WASD / arrows · Click animals for dossiers · Esc / REGIONS for menu
