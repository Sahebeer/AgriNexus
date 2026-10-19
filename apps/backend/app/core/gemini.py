"""Single source of truth for Gemini settings.

Reads GEMINI_API_KEY / GEMINI_MODEL from the shell environment, or from a `.env`
file at the repo root or in apps/backend (both are git-ignored). Shell values win.

Model choice: Google retires model ids often, and the 2.5 family is restricted to
accounts that already used it. ``resolve_gemini_model()`` tries each candidate
with a tiny request and caches the first one that answers.
"""

import logging
import os
import threading
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)

try:
    from dotenv import load_dotenv

    _backend_dir = Path(__file__).resolve().parents[2]
    for _env_file in (_backend_dir / ".env", _backend_dir.parents[1] / ".env"):
        if _env_file.exists():
            load_dotenv(_env_file, override=False)
except ImportError:
    pass

GEMINI_API_KEY = (os.getenv("GEMINI_API_KEY") or "").strip() or None

# Tried in order: cheapest first, then progressively newer/higher models.
MODEL_CANDIDATES: List[str] = [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
    "gemini-3.8-flash",
    "gemini-flash-latest",
]
_override = (os.getenv("GEMINI_MODEL") or "").strip()
if _override:
    MODEL_CANDIDATES = [_override] + [m for m in MODEL_CANDIDATES if m != _override]

_resolved: Optional[str] = None
_lock = threading.Lock()


def candidate_models() -> List[str]:
    return list(MODEL_CANDIDATES)


def resolve_gemini_model(force: bool = False) -> str:
    """Return the first candidate model that works with this key (cached per process)."""
    global _resolved
    if _resolved and not force:
        return _resolved
    with _lock:
        if _resolved and not force:
            return _resolved
        if not GEMINI_API_KEY:
            return MODEL_CANDIDATES[0]
        import google.generativeai as genai

        genai.configure(api_key=GEMINI_API_KEY)
        for name in MODEL_CANDIDATES:
            try:
                genai.GenerativeModel(name).generate_content(
                    "ping", generation_config={"max_output_tokens": 5},
                    request_options={"timeout": 20},
                )
                _resolved = name
                logger.info("Gemini model selected: %s", name)
                return name
            except Exception as exc:
                logger.warning("Gemini model %s unavailable: %s", name, str(exc)[:200])
        logger.error("No Gemini model candidate worked; falling back to %s", MODEL_CANDIDATES[0])
        return MODEL_CANDIDATES[0]


# Kept for code that only needs a name; prefer resolve_gemini_model() at call time.
GEMINI_MODEL = MODEL_CANDIDATES[0]
