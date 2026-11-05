"""In-process backend tests (FastAPI TestClient) — no running server needed.

Each test session gets a throwaway data dir so the developer's real DB is never touched.
"""
import os
import sys
import tempfile

import pytest

_DATA_DIR = tempfile.mkdtemp(prefix="workflow-test-")
os.environ["WORKFLOW_DATA_DIR"] = _DATA_DIR
os.environ.pop("WORKFLOW_API_TOKEN", None)
os.environ["GEMINI_API_KEY"] = ""          # never call the real AI from tests
os.environ["VITE_GEMINI_API_KEY"] = ""

BACKEND = os.path.join(os.path.dirname(__file__), "..", "..", "backend")
sys.path.insert(0, os.path.abspath(BACKEND))

import main  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

TEXT = (b"Photosynthesis is the process by which plants convert light energy into chemical energy. "
        b"Chlorophyll is the green pigment that absorbs light. The Calvin cycle uses ATP to fix carbon "
        b"dioxide into glucose. Cellular respiration releases energy from glucose.")


@pytest.fixture(scope="session")
def client():
    return TestClient(main.app)


@pytest.fixture
def doc(client):
    r = client.post("/api/documents/upload", files={"file": ("bio.txt", TEXT, "text/plain")})
    assert r.status_code == 200, r.text
    return r.json()
