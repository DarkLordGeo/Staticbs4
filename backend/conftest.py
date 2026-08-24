# app.py and PageBundler.py use bare `from PageBundler import ...`-style
# imports, which only resolve when Controller/ is on sys.path (true when you
# `python Controller/app.py` — Python adds the script's own dir automatically
# — but not for pytest, run from backend/). Fix that up before any test
# module tries to import them.
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "Controller"))
