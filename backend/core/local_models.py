"""Local AI models — the alternative to a cloud API key.

Two runtimes, both driven through the Google Antigravity agent harness (the same
`Agent` + `localharness` pipeline the Gemini engine uses, so prompts, structured output
and timeouts behave the same):

1. **Built-in Gemma (LiteRT)** — Google's Gemma 4 `.litertlm` models run in-process with
   Google AI Edge LiteRT-LM (`litert-lm-api`). Hardware acceleration:
     • macOS (Apple Silicon): GPU via **Metal** (unified memory).
     • Windows (x64): GPU via **DirectX 12** (LiteRT's WebGPU/Dawn backend → any DX12 GPU:
       NVIDIA, AMD, Intel Arc/iGPU); Intel Core Ultra NPU builds via OpenVINO (experimental).
     • Linux: GPU (CUDA / Vulkan via WebGPU) or CPU.
   CPU (XNNPACK) is always available as a fallback. The engine is loaded ONCE and served on
   a loopback OpenAI-compatible endpoint (the SDK's LiteRT server), then the harness talks
   to it via `LocalOpenAIAgentConfig`. (The SDK's own `LiteRTAgentConfig` reloads the model
   for every agent session — fine for a long coding session, far too slow for an app that
   makes many short calls.)
2. **External server** — any OpenAI-compatible local server: Ollama, LM Studio, llama.cpp
   `llama-server`, vLLM… also through `LocalOpenAIAgentConfig`.

If the harness can't run (e.g. its binary is missing in a custom build) the call goes
straight to the OpenAI-compatible endpoint; if the local model fails entirely the caller
falls back to the offline NLP engine as before.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import platform
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.request

from db.database import DATA_DIR

MODELS_DIR = os.path.join(DATA_DIR, "models")
CONFIG_FILE = os.path.join(DATA_DIR, "local_ai.json")
HF = "https://huggingface.co"

# Gemma 4 instruction-tuned models packaged for LiteRT-LM by Google (litert-community on HF).
# The generic `.litertlm` file is the desktop build (CPU + GPU); Intel NPU builds are separate.
CATALOG = [
    {"id": "gemma-4-e2b", "name": "Gemma 4 E2B", "repo": "litert-community/gemma-4-E2B-it-litert-lm",
     "file": "gemma-4-E2B-it.litertlm", "size": 2588147712, "min_ram_gb": 8,
     "npu_files": {"intel_lnl": "gemma-4-E2B-it_intel_LNL.litertlm", "intel_ptl": "gemma-4-E2B-it_intel_PTL.litertlm"},
     "desc": "Nhẹ, nhanh (≈2,6 GB). Hợp với MacBook Air/laptop 8 GB RAM. Đọc hiểu, tóm tắt, quiz tốt."},
    {"id": "gemma-4-e4b", "name": "Gemma 4 E4B", "repo": "litert-community/gemma-4-E4B-it-litert-lm",
     "file": "gemma-4-E4B-it.litertlm", "size": 3659530240, "min_ram_gb": 12,
     "desc": "Cân bằng (≈3,7 GB). Tiếng Việt và suy luận tốt hơn E2B; cần 12 GB RAM trở lên."},
    {"id": "gemma-4-12b", "name": "Gemma 4 12B", "repo": "litert-community/gemma-4-12B-it-litert-lm",
     "file": "gemma-4-12B-it.litertlm", "size": 6883278368, "min_ram_gb": 16,
     "desc": "Mạnh nhất cho máy cá nhân (≈6,9 GB). Cần Mac 16 GB+ hoặc GPU 8 GB VRAM+."},
]

DEFAULT_CONFIG = {
    "runtime": "builtin",                 # builtin | server
    "model_id": "gemma-4-e2b",
    "backend": "auto",                    # auto | gpu | cpu | npu
    "server_url": "http://127.0.0.1:11434",   # Ollama default; LM Studio: :1234, llama.cpp: :8080
    "server_model": "",
}

SYSTEM_PROMPT = (
    "You are Workflow's study assistant running on the learner's own computer. Answer accurately and "
    "concisely in the language of the question. When study material is provided, base the answer on it; "
    "otherwise answer from general knowledge. "
    "When a structured result is requested, call the finish tool with exactly the requested fields."
)

_log = logging.getLogger("local_models")


# ───────────────────────── config ─────────────────────────

def load_config() -> dict:
    try:
        with open(CONFIG_FILE, encoding="utf-8") as f:
            return {**DEFAULT_CONFIG, **json.load(f)}
    except Exception:
        return dict(DEFAULT_CONFIG)


def save_config(patch: dict) -> dict:
    cfg = {**load_config(), **{k: v for k, v in patch.items() if k in DEFAULT_CONFIG and v is not None}}
    if cfg["runtime"] not in ("builtin", "server"):
        cfg["runtime"] = "builtin"
    if cfg["backend"] not in ("auto", "gpu", "cpu", "npu"):
        cfg["backend"] = "auto"
    cfg["server_url"] = (cfg["server_url"] or "").rstrip("/").removesuffix("/v1")
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    return cfg


# ───────────────────────── hardware ─────────────────────────

def _run(cmd: list[str], timeout: float = 4) -> str:
    try:
        kw = {"creationflags": 0x08000000} if sys.platform == "win32" else {}  # CREATE_NO_WINDOW
        return subprocess.check_output(cmd, stderr=subprocess.DEVNULL, timeout=timeout, **kw).decode(errors="ignore").strip()
    except Exception:
        return ""


def _ram_gb() -> float:
    try:
        import psutil  # type: ignore
        return round(psutil.virtual_memory().total / 1024 ** 3, 1)
    except Exception:
        pass
    if sys.platform == "win32":
        try:
            import ctypes

            class MS(ctypes.Structure):
                _fields_ = [("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong),
                            ("ullTotalPhys", ctypes.c_ulonglong), ("ullAvailPhys", ctypes.c_ulonglong),
                            ("ullTotalPageFile", ctypes.c_ulonglong), ("ullAvailPageFile", ctypes.c_ulonglong),
                            ("ullTotalVirtual", ctypes.c_ulonglong), ("ullAvailVirtual", ctypes.c_ulonglong),
                            ("sullAvailExtendedVirtual", ctypes.c_ulonglong)]
            m = MS()
            m.dwLength = ctypes.sizeof(MS)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m))
            return round(m.ullTotalPhys / 1024 ** 3, 1)
        except Exception:
            return 8.0
    if sys.platform == "darwin":
        out = _run(["sysctl", "-n", "hw.memsize"])
        if out.isdigit():
            return round(int(out) / 1024 ** 3, 1)
    try:
        return round(os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES") / 1024 ** 3, 1)
    except Exception:
        return 8.0


def _windows_gpus() -> list[dict]:
    out = _run(["powershell", "-NoProfile", "-Command",
                "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM | ConvertTo-Json -Compress"], 8)
    gpus = []
    try:
        data = json.loads(out) if out else []
        for g in (data if isinstance(data, list) else [data]):
            name = (g.get("Name") or "").strip()
            if name and "Basic Display" not in name and "Remote" not in name:
                ram = g.get("AdapterRAM") or 0
                gpus.append({"name": name, "vram_gb": round(ram / 1024 ** 3, 1) if ram and ram > 0 else None})
    except Exception:
        pass
    return gpus


def detect_hardware() -> dict:
    """What can run a local model here, and how fast. Used for recommendations in Settings."""
    sysname, arch = platform.system(), platform.machine().lower()
    ram = _ram_gb()
    info = {"os": {"Darwin": "macOS", "Windows": "Windows", "Linux": "Linux"}.get(sysname, sysname),
            "arch": arch, "ram_gb": ram, "chip": "", "gpus": [], "accelerator": "CPU",
            "backends": ["cpu"], "builtin_supported": False, "npu": None, "notes": []}
    if sysname == "Darwin":
        info["chip"] = _run(["sysctl", "-n", "machdep.cpu.brand_string"])
        if arch in ("arm64", "aarch64"):
            info.update(accelerator="Metal (Apple GPU, unified memory)", backends=["gpu", "cpu"], builtin_supported=True)
            info["gpus"] = [{"name": info["chip"] or "Apple Silicon GPU", "vram_gb": ram}]
        else:
            info["notes"].append("Mac Intel: LiteRT-LM chỉ hỗ trợ Apple Silicon — hãy dùng Ollama/LM Studio (máy chủ cục bộ).")
    elif sysname == "Windows":
        info["chip"] = platform.processor() or _run(["powershell", "-NoProfile", "-Command", "(Get-CimInstance Win32_Processor).Name"])
        if arch in ("amd64", "x86_64"):
            info["builtin_supported"] = True
            info["gpus"] = _windows_gpus()
            if info["gpus"]:
                info.update(accelerator="DirectX 12 (WebGPU)", backends=["gpu", "cpu"])
            cpu = info["chip"].lower()
            if "core(tm) ultra" in cpu or "core ultra" in cpu:
                # Lunar Lake = Core Ultra 2xxV; Panther Lake = Core Ultra series 3.
                info["npu"] = "intel_lnl" if re.search(r"ultra \d+ 2\d\dv", cpu) else "intel_ptl" if "ultra x" in cpu or re.search(r"ultra \d+ 3\d\d", cpu) else None
                if info["npu"]:
                    info["backends"].append("npu")
        else:
            info["notes"].append("Windows ARM: chưa có bản LiteRT-LM — hãy dùng Ollama/LM Studio.")
    else:
        info["chip"] = platform.processor()
        info["builtin_supported"] = arch in ("x86_64", "amd64", "aarch64", "arm64")
        if shutil.which("nvidia-smi"):
            name = _run(["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"]).splitlines()
            info["gpus"] = [{"name": n.split(",")[0].strip(), "vram_gb": round(float(n.split(",")[1]) / 1024, 1)} for n in name if "," in n]
            if info["gpus"]:
                info.update(accelerator="GPU (CUDA/Vulkan)", backends=["gpu", "cpu"])
    try:
        import litert_lm  # noqa: F401
        info["runtime_installed"] = True
    except Exception:
        info["runtime_installed"] = False
        if info["builtin_supported"]:
            info["notes"].append("Thiếu thư viện LiteRT-LM (pip install litert-lm-api) — bản cài đặt Workflow đã kèm sẵn.")
    info["builtin_supported"] = info["builtin_supported"] and info["runtime_installed"]
    info.update(recommend(info))
    return info


def recommend(hw: dict) -> dict:
    ram = hw.get("ram_gb") or 8
    vram = max([g.get("vram_gb") or 0 for g in hw.get("gpus", [])] + [0])
    if hw.get("os") == "macOS":          # unified memory: the GPU can use most of the RAM
        pick = "gemma-4-12b" if ram >= 16 else "gemma-4-e4b" if ram >= 12 else "gemma-4-e2b"
    elif vram:                           # discrete GPU: the model should fit in VRAM
        pick = "gemma-4-12b" if vram >= 12 else "gemma-4-e4b" if vram >= 6 else "gemma-4-e2b"
    else:                                # integrated GPU / CPU: small and fast wins
        pick = "gemma-4-e4b" if ram >= 24 else "gemma-4-e2b"
    model = next(m for m in CATALOG if m["id"] == pick)
    backend = "gpu" if "gpu" in hw.get("backends", []) else "cpu"
    accel = hw.get("accelerator", "CPU")
    reason = (f"{hw.get('os')} · {hw.get('chip') or hw.get('arch')} · {ram} GB RAM"
              + (f" · GPU {vram} GB" if vram and hw.get("os") != "macOS" else "")
              + f". Gợi ý {model['name']} chạy bằng {accel if backend == 'gpu' else 'CPU'}.")
    if not hw.get("builtin_supported"):
        reason = "Máy này chưa chạy được Gemma tích hợp. Hãy dùng máy chủ cục bộ (Ollama hoặc LM Studio)."
    return {"recommended_model": pick, "recommended_backend": backend, "reasoning": reason}


# ───────────────────────── downloads ─────────────────────────

_downloads: dict[str, dict] = {}
_dl_lock = threading.Lock()


def model_entry(model_id: str) -> dict | None:
    return next((m for m in CATALOG if m["id"] == model_id), None)


def model_file(model_id: str, variant: str | None = None) -> str | None:
    m = model_entry(model_id)
    if not m:
        return None
    name = (m.get("npu_files") or {}).get(variant) if variant else m["file"]
    return os.path.join(MODELS_DIR, name) if name else None


def is_installed(model_id: str, variant: str | None = None) -> bool:
    p = model_file(model_id, variant)
    return bool(p and os.path.exists(p) and os.path.getsize(p) > 1_000_000)


def list_models() -> list[dict]:
    out = []
    for m in CATALOG:
        d = {k: v for k, v in m.items() if k not in ("npu_files",)}
        d["installed"] = is_installed(m["id"])
        d["npu_variants"] = {v: is_installed(m["id"], v) for v in (m.get("npu_files") or {})}
        d["download"] = _downloads.get(m["id"])
        out.append(d)
    return out


def _opener(local: bool = False):
    # Loopback servers must bypass any HTTP(S) proxy in the environment.
    return urllib.request.build_opener(urllib.request.ProxyHandler({})) if local else urllib.request.build_opener()


def _download_worker(model_id: str, url: str, dest: str, total: int):
    st = _downloads[model_id]
    part = dest + ".part"
    try:
        os.makedirs(MODELS_DIR, exist_ok=True)
        have = os.path.getsize(part) if os.path.exists(part) else 0
        req = urllib.request.Request(url, headers={"Range": f"bytes={have}-"} if have else {})
        with _opener().open(req, timeout=60) as r:
            if have and r.status != 206:      # server ignored the range: start over
                have = 0
            st.update(state="downloading", done=have, total=total)
            with open(part, "ab" if have else "wb") as f:
                t0, last = time.time(), have
                while True:
                    if st.get("cancel"):
                        st.update(state="cancelled")
                        return
                    chunk = r.read(1 << 20)
                    if not chunk:
                        break
                    f.write(chunk)
                    st["done"] += len(chunk)
                    dt = time.time() - t0
                    if dt >= 1:
                        st["speed_mbps"] = round((st["done"] - last) / dt / 1e6, 1)
                        t0, last = time.time(), st["done"]
        if total and os.path.getsize(part) != total:
            raise IOError(f"Tải chưa đủ ({os.path.getsize(part)}/{total} byte) — bấm Tải lại để tiếp tục.")
        os.replace(part, dest)
        st.update(state="done", done=total or st["done"])
    except Exception as e:  # network drop: the .part file stays, so a retry resumes
        st.update(state="error", error=str(e))


def start_download(model_id: str, variant: str | None = None) -> dict:
    m = model_entry(model_id)
    if not m:
        raise KeyError(model_id)
    name = (m.get("npu_files") or {}).get(variant) if variant else m["file"]
    if not name:
        raise KeyError(variant)
    key = model_id if not variant else f"{model_id}:{variant}"
    with _dl_lock:
        cur = _downloads.get(key)
        if cur and cur.get("state") == "downloading":
            return cur
        dest = os.path.join(MODELS_DIR, name)
        if os.path.exists(dest):
            _downloads[key] = {"state": "done", "done": os.path.getsize(dest), "total": os.path.getsize(dest)}
            return _downloads[key]
        _downloads[key] = {"state": "starting", "done": 0, "total": m["size"] if not variant else 0, "file": name}
        threading.Thread(target=_download_worker, args=(key, f"{HF}/{m['repo']}/resolve/main/{name}", dest,
                                                         m["size"] if not variant else 0), daemon=True).start()
        return _downloads[key]


def cancel_download(model_id: str) -> None:
    if model_id in _downloads:
        _downloads[model_id]["cancel"] = True


def delete_model(model_id: str) -> None:
    if RUNTIME.model_id == model_id:
        RUNTIME.unload()
    m = model_entry(model_id) or {}
    for name in [m.get("file")] + list((m.get("npu_files") or {}).values()):
        for p in (os.path.join(MODELS_DIR, name or ""), os.path.join(MODELS_DIR, (name or "") + ".part")):
            if name and os.path.exists(p):
                os.remove(p)
    _downloads.pop(model_id, None)


# ───────────────────────── built-in LiteRT runtime ─────────────────────────

def _prepare_native() -> None:
    """Windows: LiteRT's GPU backend (Dawn/WebGPU over DirectX 12) loads dxcompiler.dll /
    dxil.dll at runtime; they ship next to litert-lm.dll, which is not on the default DLL
    search path inside a packaged (PyInstaller) app."""
    if sys.platform != "win32":
        return
    try:
        import importlib.util
        spec = importlib.util.find_spec("litert_lm")
        for d in (spec.submodule_search_locations or []) if spec else []:
            if os.path.isdir(d):
                os.add_dll_directory(d)
                os.environ["PATH"] = d + os.pathsep + os.environ.get("PATH", "")
    except Exception as e:
        _log.warning("could not register LiteRT DLL directory: %s", e)


def _decode_nested(v):
    """Small Gemma models often emit nested objects inside tool-call arguments as JSON *strings*
    ({"questions": ["{\"question\": …}"]}), which fails the harness's schema check and burns
    its retries. Decode string values that are themselves JSON objects/arrays."""
    if isinstance(v, dict):
        return {k: _decode_nested(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_decode_nested(x) for x in v]
    if isinstance(v, str):
        t = v.strip()
        if (t.startswith("{") and t.endswith("}")) or (t.startswith("[") and t.endswith("]")):
            try:
                return _decode_nested(json.loads(t))
            except Exception:
                try:
                    return _decode_nested(_parse_json(t))
                except Exception:
                    return v
    return v


_PATCHED = False


def _patch_litert_server() -> None:
    """Wrap the SDK LiteRT server's tool-call formatter with `_decode_nested` (once)."""
    global _PATCHED
    if _PATCHED:
        return
    from google.antigravity.connections.local import litert_server
    original = litert_server._format_openai_tool_call

    def formatted(tc, index, timestamp_str):
        out = original(tc, index, timestamp_str)
        try:
            args = json.loads(out["function"]["arguments"] or "{}")
            out["function"]["arguments"] = json.dumps(_decode_nested(args), ensure_ascii=False)
        except Exception:
            pass
        return out
    litert_server._format_openai_tool_call = formatted
    _PATCHED = True


class LiteRTRuntime:
    """One Gemma engine kept in memory and served on a loopback OpenAI-compatible endpoint
    (google.antigravity's LiteRT server). Reloaded only when the model/backend changes."""

    def __init__(self):
        self._lock = threading.Lock()
        self.engine = None
        self._engine_cm = None
        self.server = None
        self.base_url = None
        self.model_id = None
        self.backend = None          # requested
        self.active_backend = None   # actually running (GPU may fall back to CPU)
        self.loaded_at = None
        self.load_seconds = None
        self.last_error = None

    def status(self) -> dict:
        return {"loaded": self.base_url is not None, "model_id": self.model_id, "backend": self.active_backend,
                "load_seconds": self.load_seconds, "error": self.last_error}

    def _backend_obj(self, name: str):
        import litert_lm
        return {"gpu": litert_lm.Backend.GPU, "npu": litert_lm.Backend.NPU}.get(name, litert_lm.Backend.CPU)()

    def ensure(self, model_id: str, backend: str = "auto") -> str:
        """Base URL of a running engine for this model (loading it if needed)."""
        if backend == "auto":
            backend = "gpu" if "gpu" in detect_hardware().get("backends", ["cpu"]) else "cpu"
        with self._lock:
            if self.base_url and self.model_id == model_id and self.backend == backend:
                return self.base_url
            self.unload(locked=True)
            variant = detect_hardware().get("npu") if backend == "npu" else None
            path = model_file(model_id, variant) if variant else model_file(model_id)
            if not path or not os.path.exists(path):
                raise RuntimeError(f"Chưa tải model {model_id}. Vào Cài đặt → Model cục bộ để tải.")
            _prepare_native()
            import litert_lm
            from google.antigravity.connections.local import litert_server
            _patch_litert_server()
            cache = os.path.join(MODELS_DIR, "cache")
            os.makedirs(cache, exist_ok=True)
            t0 = time.time()
            order = [backend] + (["cpu"] if backend != "cpu" else [])
            err = None
            for b in order:
                try:
                    eng = litert_lm.Engine(path, backend=self._backend_obj(b), cache_dir=cache,
                                           max_num_tokens=16384, use_ringbuffers_local_attention=True)
                    self._engine_cm = eng
                    self.engine = eng.__enter__()
                    self.active_backend = b
                    break
                except Exception as e:  # e.g. no Metal/DX12 device, driver too old → CPU
                    err = e
                    _log.warning("LiteRT %s backend failed: %s", b, e)
            if self.engine is None:
                self.last_error = str(err)
                raise RuntimeError(f"Không khởi động được Gemma: {err}")
            self.server = litert_server.LiteRTOpenAIServer(("127.0.0.1", 0), litert_server.LiteRTOpenAIHandler,
                                                           engine=self.engine, model_name=model_id,
                                                           max_output_tokens=4096, thinking_token_budget=None)
            threading.Thread(target=self.server.serve_forever, daemon=True).start()
            self.base_url = f"http://127.0.0.1:{self.server.server_address[1]}"
            self.model_id, self.backend = model_id, backend
            self.loaded_at, self.load_seconds, self.last_error = time.time(), round(time.time() - t0, 1), None
            return self.base_url

    def generate_json(self, prompt: str, schema: dict, max_tokens: int = 3072) -> dict:
        """Structured output with grammar-constrained decoding (LiteRT-LM + llguidance): the
        model can only emit JSON that matches `schema`. Small Gemma models otherwise drift from
        nested schemas (list items as plain strings) and fail the harness's validation."""
        import litert_lm
        from litert_lm._ffi import LiteRtLmConstraintProviderType
        srv = self.server
        if srv is None:
            raise RuntimeError("LiteRT engine is not loaded")
        with srv.engine_lock:                 # the engine is not thread-safe
            srv.close_conversation()          # don't disturb the server's cached chat
            with self.engine.create_conversation(
                    automatic_tool_calling=False, system_message=SYSTEM_PROMPT,
                    constrained_decoding_config=litert_lm.ConstrainedDecodingConfig(
                        enable=True, provider=LiteRtLmConstraintProviderType.LL_GUIDANCE)) as conv:
                msg = conv.send_message(prompt + "\n\nReply with JSON only.",
                                        response_format=litert_lm.ResponseFormat.json(schema),
                                        max_output_tokens=max_tokens)
        text = "".join(getattr(c, "text", "") for c in msg.contents.contents)
        return _decode_nested(_parse_json(text))

    def unload(self, locked: bool = False) -> None:
        def _do():
            if self.server:
                try:
                    self.server.shutdown()
                    self.server.server_close()
                except Exception:
                    pass
            if self._engine_cm is not None:
                try:
                    self._engine_cm.__exit__(None, None, None)
                except Exception:
                    pass
            self.server = self.engine = self._engine_cm = self.base_url = None
            self.model_id = self.backend = self.active_backend = None
        if locked:
            _do()
        else:
            with self._lock:
                _do()


RUNTIME = LiteRTRuntime()


# ───────────────────────── generation (through the harness) ─────────────────────────

def resolve_target(key: str) -> tuple[str, str, str]:
    """(base_url, model_name, label) for the engine key "LOCAL" / legacy "LOCAL:<ollama model>"."""
    cfg = load_config()
    if ":" in key:  # legacy: LOCAL:<model> meant an Ollama model
        return cfg.get("server_url") or DEFAULT_CONFIG["server_url"], key.split(":", 1)[1], "Ollama"
    if cfg["runtime"] == "server":
        model = cfg.get("server_model") or first_server_model(cfg["server_url"])
        return cfg["server_url"], model, "server"
    return RUNTIME.ensure(cfg["model_id"], cfg["backend"]), cfg["model_id"], "litert"


def server_models(base_url: str) -> list[str]:
    url = base_url.rstrip("/").removesuffix("/v1")
    try:
        with _opener(local=True).open(url + "/v1/models", timeout=3) as r:
            return [m.get("id") for m in json.loads(r.read().decode()).get("data", []) if m.get("id")]
    except Exception:
        pass
    try:  # older Ollama without /v1/models
        with _opener(local=True).open(url + "/api/tags", timeout=3) as r:
            return [m.get("name") for m in json.loads(r.read().decode()).get("models", [])]
    except Exception:
        return []


def first_server_model(base_url: str) -> str:
    names = server_models(base_url)
    if not names:
        raise RuntimeError(f"Không thấy model nào ở {base_url}. Hãy mở Ollama/LM Studio và tải một model.")
    return names[0]


def _schema_of(schema):
    try:
        return schema.model_json_schema() if hasattr(schema, "model_json_schema") else schema
    except Exception:
        return None


def _parse_json(text: str):
    """JSON from a small model's reply: strips code fences and prose around the object, and
    trailing commas ("[1, 2,]") — common with 2–4B models."""
    s = (text or "").strip()
    if s.startswith("```"):
        s = s.strip("`")
        s = s[s.find("{"):] if "{" in s else s
    start, end = s.find("{"), s.rfind("}")
    s = s[start:end + 1] if start >= 0 and end > start else s
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        return json.loads(re.sub(r",\s*([}\]])", r"\1", s))


def _direct_chat(base_url: str, model: str, prompt: str, schema, structured: bool, timeout: float):
    """Plain OpenAI-compatible call (fallback when the harness can't run)."""
    sys_msg = SYSTEM_PROMPT
    if structured:
        js = _schema_of(schema)
        sys_msg += "\nRespond with ONLY one JSON object" + (f" matching this JSON schema: {json.dumps(js)}" if js else "") + ". No markdown."
    payload = {"model": model, "stream": False, "messages": [{"role": "system", "content": sys_msg}, {"role": "user", "content": prompt}]}
    if structured:
        payload["response_format"] = {"type": "json_object"}
    req = urllib.request.Request(base_url.rstrip("/") + "/v1/chat/completions", data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    with _opener(local=True).open(req, timeout=timeout) as r:
        text = json.loads(r.read().decode())["choices"][0]["message"].get("content") or ""
    return _decode_nested(_parse_json(text)) if structured else text


_gen_lock = asyncio.Semaphore(1)  # one local generation at a time: GPU memory is shared


async def local_generate(key: str, prompt: str, schema=None, structured: bool = True, timeout: float = 180):
    """Run a prompt on the local model through the Antigravity harness."""
    base_url, model, kind = await asyncio.to_thread(resolve_target, key)   # may load the model (not timed)
    if RUNTIME.active_backend == "cpu" and kind == "litert":
        timeout = max(timeout, 420)   # CPU decoding is ~5–10× slower than Metal / DirectX 12
    async with _gen_lock:
        if kind == "litert" and structured and schema is not None:
            js = _schema_of(schema)
            if js:
                return await asyncio.wait_for(asyncio.to_thread(RUNTIME.generate_json, prompt, js), timeout=timeout)
        try:
            from google.antigravity import Agent, CapabilitiesConfig, types
            from google.antigravity.connections.local.local_openai_connection_config import LocalOpenAIAgentConfig
            work = os.path.join(DATA_DIR, "harness")
            os.makedirs(work, exist_ok=True)
            cfg = LocalOpenAIAgentConfig(
                model=model, base_url=base_url,
                capabilities=CapabilitiesConfig(enable_subagents=False, enabled_tools=[]),
                system_instructions=types.CustomSystemInstructions(text=SYSTEM_PROMPT),
                response_schema=schema if structured else None,
                workspaces=[work], save_dir=work,
                # One retry on a malformed answer: on a CPU each retry is a full generation.
                retry_config=types.RetryConfig(model_output_retry=types.ModelOutputRetryConfig(max_retries=1)),
            )

            async def _call():
                async with Agent(cfg) as agent:
                    resp = await agent.chat(prompt)
                    if structured and schema is not None:
                        out = await resp.structured_output()
                        if out:
                            return out
                    text = await resp.text()
                    return _parse_json(text) if structured else text
            return await asyncio.wait_for(_call(), timeout=timeout)
        except asyncio.TimeoutError:
            raise
        except Exception as e:
            _log.warning("harness local call failed (%s); calling the endpoint directly", e)
            return await asyncio.to_thread(_direct_chat, base_url, model, prompt, schema, structured, timeout)
