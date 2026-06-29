"""Local LLM engine via Ollama — the "download AI models to run locally" option.

Selected when the UI engine toggle sets the API key to the sentinel "LOCAL". Talks to a
local Ollama server (default http://127.0.0.1:11434). Dependency-free (urllib + asyncio).
If Ollama or the chosen model isn't available, the call raises and the endpoint falls back
to the offline NLP engine — so the app keeps working with zero setup.

User setup (shown in Settings → AI Engine):
  1. Install Ollama from https://ollama.com  (macOS / Windows / Linux)
  2. Pull a model:  `ollama pull llama3.2`   (or qwen2.5, mistral, phi3, ...)
  3. Ollama auto-serves on http://127.0.0.1:11434
Override via env: OLLAMA_URL, OLLAMA_MODEL.
"""
import os
import json
import asyncio
import urllib.request

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")


def _post(path: str, payload: dict, timeout: float):
    req = urllib.request.Request(
        OLLAMA_URL + path,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def _get(path: str, timeout: float):
    with urllib.request.urlopen(OLLAMA_URL + path, timeout=timeout) as r:
        return json.loads(r.read().decode())


def status() -> dict:
    """Report local-model availability — used by the Settings 'Check' button."""
    try:
        data = _get("/api/tags", timeout=3)
        names = [m.get("name", "") for m in data.get("models", [])]
        pulled = any(n == OLLAMA_MODEL or n.startswith(OLLAMA_MODEL + ":") for n in names)
        return {"available": True, "url": OLLAMA_URL, "model": OLLAMA_MODEL,
                "model_pulled": pulled, "models": names}
    except Exception as e:
        return {"available": False, "url": OLLAMA_URL, "model": OLLAMA_MODEL, "error": str(e)}


def _generate_sync(prompt: str, json_mode: bool, timeout: float) -> str:
    payload = {"model": OLLAMA_MODEL, "prompt": prompt, "stream": False}
    if json_mode:
        payload["format"] = "json"
    return _post("/api/generate", payload, timeout).get("response", "")


async def local_generate(prompt: str, structured: bool = True, schema=None, timeout: float = 120):
    """Generate with the local model. Structured calls return a parsed dict; raises on failure
    so the caller can fall back to the offline NLP engine."""
    json_mode = structured or schema is not None
    if schema is not None:
        try:
            schema_json = json.dumps(schema.model_json_schema())
        except Exception:
            schema_json = ""
        prompt = (
            f"{prompt}\n\nRespond with ONLY one valid JSON object"
            + (f" matching this JSON schema:\n{schema_json}" if schema_json else "")
            + "\nNo markdown fences, no commentary."
        )
    text = await asyncio.to_thread(_generate_sync, prompt, json_mode, timeout)
    if not (structured or schema is not None):
        return text
    s = text.strip()
    if s.startswith("```"):                       # strip accidental code fences
        s = s.strip("`")
        s = s[s.find("{"):] if "{" in s else s
    return json.loads(s)
