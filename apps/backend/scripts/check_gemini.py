"""Check the Gemini key and pick a working model: `.venv/bin/python apps/backend/scripts/check_gemini.py`"""
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
logging.basicConfig(level=logging.INFO, format="%(message)s")
from app.core.gemini import GEMINI_API_KEY, candidate_models, resolve_gemini_model  # noqa: E402

if not GEMINI_API_KEY:
    sys.exit("GEMINI_API_KEY not found. Put it in apps/backend/.env as GEMINI_API_KEY=...")

import google.generativeai as genai  # noqa: E402

print(f"key loaded (...{GEMINI_API_KEY[-4:]}); trying in order: {candidate_models()}")
model = resolve_gemini_model()
try:
    reply = genai.GenerativeModel(model).generate_content("In one sentence: best time to sow wheat in Punjab?")
    print(f"OK [{model}] ->", reply.text.strip())
except Exception as exc:
    print("FAILED on every candidate:", exc)
    names = [m.name.split("/")[-1] for m in genai.list_models() if "generateContent" in m.supported_generation_methods]
    print("Models your key lists (put one in apps/backend/.env as GEMINI_MODEL=...):", [n for n in names if "flash" in n])
