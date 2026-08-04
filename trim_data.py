#!/usr/bin/env python3
from pathlib import Path
import re
p = Path(__file__).resolve().parent / "primal_data.js"
t = p.read_text(encoding="utf-8")
t2 = re.sub(r'\["([^"]*)","[^"]*"\]', r'["\1"]', t)
p.write_text(t2, encoding="utf-8")
print("data", len(t), "->", len(t2))
