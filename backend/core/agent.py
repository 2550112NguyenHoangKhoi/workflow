"""Shared AI plumbing: engine selection, the one-shot generation runner and token accounting.

Lives outside main.py so NLP modules (e.g. nlp.roadmap) can use it without importing the
FastAPI app module — `from main import ...` breaks in the PyInstaller build, where the entry
script runs as __main__.
"""
import os
import json
import asyncio

from dotenv import load_dotenv
from google.antigravity import Agent, LocalAgentConfig, CapabilitiesConfig

from db.database import USAGE_FILE

# Load env vars from the repo-root .env when running from source.
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '..', '.env'))

DEFAULT_MODEL = "gemini-3.1-flash-lite"

# Single-shot generation config: disable the agent's builtin tools/subagents so we get a
# fast single model response (~8s) instead of a full coding-agent loop (~40s).
FAST_CAPS = CapabilitiesConfig(enable_subagents=False, enabled_tools=[])

# Server-side fallback key (only used when the UI didn't send one).
ENV_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("VITE_GEMINI_API_KEY")


def get_api_key(x_api_key: str | None) -> str | None:
    """Resolve the engine signal sent by the UI (Settings → AI Engine):
      "OFFLINE"        -> deterministic local NLP engine (returns None)
      "LOCAL[:model]"  -> local Ollama model (routed inside agent_run)
      "AIzaSy…"/"AQ…"  -> the user's Gemini key
      empty/other      -> the server's .env key, if any
    """
    if x_api_key == "OFFLINE":
        return None
    if x_api_key and x_api_key.startswith("LOCAL"):
        return x_api_key
    # Accept both Google AI Studio keys (AIzaSy...) and Antigravity keys (AQ...).
    if x_api_key and x_api_key.startswith(("AIzaSy", "AQ")):
        return x_api_key
    return ENV_API_KEY


# AI-token accounting: a small JSON file in the data dir. Tokens are estimated at ~4
# chars/token from prompt + response; powers GET /api/usage and the "AI TOKENS" widgets.
USAGE_QUOTA = 500_000


def read_usage():
    try:
        with open(USAGE_FILE) as f:
            return json.load(f)
    except Exception:
        return {"used_tokens": 0}


def record_usage(prompt, result):
    data = read_usage()
    data["used_tokens"] = data.get("used_tokens", 0) + int((len(prompt) + len(str(result))) / 4)
    try:
        with open(USAGE_FILE, "w") as f:
            json.dump(data, f)
    except Exception:
        pass  # accounting must never break a generation


async def agent_run(config, prompt, structured=True, timeout=30):
    """Run a one-shot generation with a HARD timeout. Raises on timeout/error so the caller
    can fall back to the offline NLP engine — the app never hangs on a slow AI call.

    Local-LLM engine: a key of "LOCAL" / "LOCAL:<model>" is routed to Ollama instead."""
    if getattr(config, "api_key", None) and config.api_key.startswith("LOCAL"):
        model_name = config.api_key.split(":", 1)[1] if ":" in config.api_key else None
        from nlp.local_llm import local_generate
        schema = getattr(config, "response_schema", None)
        result = await local_generate(prompt, structured=structured, schema=schema,
                                      model_name=model_name,
                                      timeout=max(timeout, 120))
        record_usage(prompt, result)
        return result

    async def _call():
        async with Agent(config) as agent:
            response = await agent.chat(prompt)
            return await (response.structured_output() if structured else response.text())
    result = await asyncio.wait_for(_call(), timeout=timeout)
    record_usage(prompt, result)
    return result


__all__ = ["Agent", "LocalAgentConfig", "CapabilitiesConfig", "FAST_CAPS", "DEFAULT_MODEL",
           "get_api_key", "agent_run", "read_usage", "record_usage", "USAGE_QUOTA"]
