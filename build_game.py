#!/usr/bin/env python3
"""Build GitHub Pages multi-file index + optional oversized GoDaddy paste block."""
from pathlib import Path
import re

root = Path(__file__).resolve().parent

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
pages = (
    "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n"
    "<meta charset=\"UTF-8\">\n"
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover\">\n"
    "<meta name=\"description\" content=\"Primal Odyssey — explore biomes, meet apex animals, open field dossiers.\">\n"
    "<title>Primal Odyssey</title>\n"
    "<link rel=\"stylesheet\" href=\"primal.css?v=13\">\n"
    "<style>html,body{margin:0;height:100%;min-height:100%;background:#030605;}</style>\n"
    "</head>\n<body>\n"
    + body.strip() + "\n"
    "<script src=\"primal_data.js?v=13\"></script>\n"
    "<script src=\"primal_sprites.js?v=13\"></script>\n"
    "<script src=\"primal.js?v=13\"></script>\n"
    "</body>\n</html>\n"
)
(root / "index.html").write_bytes(pages.replace("\r\n", "\n").replace("\r", "\n").encode("utf-8"))

# --- Optional single-file paste (may exceed Digistracts) ---
safe_js = (
    minify_js(data) + "\n" + minify_js(sprites) + "\n"
    + "(function(){function __poStart(){"
    + "if(!document.getElementById('po-canvas')){setTimeout(__poStart,30);return;}"
    + js_main
    + "}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',__poStart);else __poStart();})();"
)
block = (
    "<style>\n" + css_min + "\n</style>\n"
    + body_min
    + "\n<script>\n" + safe_js + "\n</script>\n"
).replace("\r\n", "\n").replace("\r", "\n")
(root / "primal_odyssey_godaddy_block.html").write_bytes(block.encode("utf-8"))

n = len(block)
nl = block.count("\n")
print("pages index.html", (root / "index.html").stat().st_size)
print("godaddy block", n, "| CRLF", n + nl)
print("Digistracts tip ~51375; left", 51375 - n)
assert "SPRITES.cougar" in block
assert "// swapped" not in block
if n + nl > 51375:
    print("NOTE: paste block too large for Digistracts — iframe GitHub Pages index.html instead")
