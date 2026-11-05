"""Regression tests for the bugs fixed in the 2026-11 audit (see AUDIT.md)."""
import datetime
import os
import runpy
import sys

import main
from db import models
from db.database import SessionLocal, UPLOAD_DIR

OFFLINE = {"api_key": "OFFLINE"}


def test_all_routes_registered_when_frozen(monkeypatch):
    """The __main__ block used to sit mid-file, so the frozen build lost ~30 routes."""
    import uvicorn
    seen = {}

    def fake_run(app, **kw):
        seen["paths"] = {getattr(r, "path", "") for r in app.routes}
        raise SystemExit

    monkeypatch.setattr(uvicorn, "run", fake_run)
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "_MEIPASS", os.path.dirname(main.__file__), raising=False)
    try:
        runpy.run_path(main.__file__, run_name="__main__")
    except SystemExit:
        pass
    for path in ("/api/writing/ielts/grade", "/api/vocabulary/generate", "/api/projects/{project_id}/team_messages"):
        assert path in seen["paths"]


def test_vocab_generate_no_longer_500s(client):
    r = client.post("/api/vocabulary/generate", json={"prompt": "travel", **OFFLINE})
    assert r.status_code == 400  # needs an AI engine; used to be 500 "No module named 'core'"


def test_deleted_document_file_never_served_for_new_document(client):
    d = client.post("/api/documents/upload", files={"file": ("secret.pdf", b"%PDF-1.4\n%%EOF", "application/pdf")})
    if d.status_code == 422:  # unparsable stub PDF is rejected: plant the file by hand instead
        did = client.post("/api/documents/upload", files={"file": ("x.txt", b"hello there", "text/plain")}).json()["id"]
        with open(os.path.join(UPLOAD_DIR, f"{did}.pdf"), "wb") as f:
            f.write(b"%PDF-OLD PRIVATE")
    else:
        did = d.json()["id"]
    client.delete(f"/api/documents/{did}")
    assert not [f for f in os.listdir(UPLOAD_DIR) if f.split(".")[0] == str(did)]
    # a stale file left behind by an older version must not leak either
    with open(os.path.join(UPLOAD_DIR, f"{did}.pdf"), "wb") as f:
        f.write(b"%PDF-OLD PRIVATE")
    new = client.post("/api/documents/upload", files={"file": ("n.md", b"# fresh", "text/markdown")}).json()
    body = client.get(f"/api/documents/{new['id']}/file").content
    assert b"OLD PRIVATE" not in body


def test_document_list_is_not_capped_at_100(client):
    from db import crud
    db = SessionLocal()
    before = len(client.get("/api/documents").json()["documents"])
    for i in range(105):
        crud.create_document(db, filename=f"bulk{i}.txt", content="x", kind="document")
    docs = client.get("/api/documents").json()["documents"]
    assert len(docs) == before + 105
    assert docs[-1]["filename"] == "bulk104.txt"


def test_regenerating_flashcards_keeps_review_progress(client, doc):
    body = {"topic_or_text": "x", "document_id": doc["id"], **OFFLINE}
    cards = client.post("/api/generate_flashcards", json=body).json()["flashcards"]
    assert cards and all(c["repetitions"] == 0 for c in cards)
    c0 = cards[0]
    review = client.post("/api/flashcards/review", json={"id": c0["id"], "interval": c0["interval"], "ease": c0["ease"],
                                                          "repetitions": c0["repetitions"], "due": c0["due_date"], "quality": 5}).json()
    assert review["interval"] == 1  # first good review -> 1 day (was 6 when new cards started at rep 1)
    client.post("/api/generate_flashcards", json=body)
    kept = SessionLocal().query(models.Flashcard).filter_by(id=c0["id"]).first()
    assert kept is not None and kept.last_reviewed is not None


def test_shared_quiz_survives_regeneration_and_exams_accumulate(client, doc):
    body = {"topic_or_text": "x", "document_id": doc["id"], **OFFLINE}
    client.post("/api/generate_quiz", json=body)
    quiz_id = [a["id"] for a in client.get(f"/api/documents/{doc['id']}/artifacts").json() if a["type"] == "quiz"][0]
    client.post("/api/share", json={"artifact_id": quiz_id, "owner_email": "a@x", "to_email": "b@x"})
    client.post("/api/generate_quiz", json=body)
    ids = [a["id"] for a in client.get(f"/api/documents/{doc['id']}/artifacts").json() if a["type"] == "quiz"]
    assert quiz_id in ids and len(ids) == 2
    e1 = client.post("/api/exams/generate", json={"title": "A", "document_id": doc["id"], "num_questions": 2, **OFFLINE}).json()["id"]
    client.post("/api/exams/generate", json={"title": "B", "document_id": doc["id"], "num_questions": 2, **OFFLINE})
    assert client.get(f"/api/artifacts/{e1}").status_code == 200


def test_deleting_project_removes_everything(client):
    p = client.post("/api/projects", json={"name": "P"}).json()["id"]
    d = client.post("/api/documents/upload", files={"file": ("a.txt", b"Mitochondria produce ATP.", "text/plain")},
                    data={"project_id": str(p)}).json()["id"]
    client.post("/api/generate_flashcards", json={"topic_or_text": "x", "document_id": d, "project_id": p, **OFFLINE})
    client.post(f"/api/projects/{p}/team_messages", json={"content": "hi"})
    assert client.delete(f"/api/projects/{p}").status_code == 200
    db = SessionLocal()
    assert db.query(models.Document).filter_by(id=d).count() == 0
    assert db.query(models.Flashcard).filter_by(document_id=d).count() == 0
    assert db.query(models.TeamMessage).filter_by(project_id=p).count() == 0
    assert not [f for f in os.listdir(UPLOAD_DIR) if f.split(".")[0] == str(d)]


def test_unreadable_uploads_are_rejected(client):
    assert client.post("/api/documents/upload", files={"file": ("bad.pdf", b"%PDF-1.4 junk")}).status_code == 422
    assert client.post("/api/documents/upload", files={"file": ("deck.pptx", b"PK..")}).status_code == 422
    assert client.post("/api/documents/upload", files={"file": ("bin.txt", b"\x00\x01abc")}).status_code == 422
    ok = client.post("/api/documents/upload", files={"file": ("u16.txt", "Xin chào".encode("utf-16"))})
    assert ok.status_code == 200
    assert client.post("/api/documents/url", json={"url": "ftp://nope"}).status_code == 422


def test_offline_roadmap_is_built_from_the_document(client, doc):
    assert client.post(f"/api/documents/{doc['id']}/roadmap/generate", json={"topic_or_text": "g", **OFFLINE}).status_code == 200
    titles = [i["title"] for i in client.get(f"/api/documents/{doc['id']}/roadmap").json()["items"]]
    assert len(titles) >= 3 and any("Photosynthesis" in t for t in titles)
    empty = client.post("/api/documents/upload", files={"file": ("e.txt", b"   ")}).json()["id"]
    assert client.post(f"/api/documents/{empty}/roadmap/generate", json={"topic_or_text": "g", **OFFLINE}).status_code == 422


def test_project_chat_sees_all_project_documents(client):
    p = client.post("/api/projects", json={"name": "Chat"}).json()["id"]
    a = client.post("/api/documents/upload", files={"file": ("a.txt", b"Photosynthesis converts light energy.")}, data={"project_id": str(p)}).json()["id"]
    client.post("/api/documents/upload", files={"file": ("b.txt", b"Mitochondria produce ATP through respiration.")}, data={"project_id": str(p)})
    r = client.post("/api/chat", json={"message": "How do mitochondria produce ATP?", "project_id": p, "document_id": a, **OFFLINE}).json()
    assert "Mitochondria" in r["response"]


def test_streaks_survive_until_first_session_of_the_day(client):
    db = SessionLocal()
    now = datetime.datetime.utcnow()
    for d in (1, 2):
        db.add(models.WritingAttempt(owner_email="streak@x", mode="sentence", score=8, created_at=now - datetime.timedelta(days=d)))
    db.commit()
    assert client.get("/api/writing/progress?email=streak@x").json()["streak"] == 2
    assert client.get("/api/writing/progress").json()["sessions"] == 0  # no email != everyone


def test_folders_rename_delete_keep_projects(client):
    f = client.post("/api/folders", json={"name": "F"}).json()["id"]
    p = client.post("/api/projects", json={"name": "InF", "folder_id": f}).json()["id"]
    assert client.patch(f"/api/folders/{f}", json={"name": "F2"}).json()["name"] == "F2"
    client.delete(f"/api/folders/{f}")
    proj = [x for x in client.get("/api/projects").json() if x["id"] == p][0]
    assert proj["folder_id"] is None


def test_notes_regenerate_and_errors(client, doc):
    assert client.get(f"/api/documents/{doc['id']}/notes?api_key=OFFLINE").status_code == 200
    assert client.get(f"/api/documents/{doc['id']}/notes?api_key=OFFLINE&regenerate=true").status_code == 200
    n = SessionLocal().query(models.Artifact).filter_by(document_id=doc["id"], type="smart_notes").count()
    assert n == 1
    assert client.get("/api/documents/999999/notes").status_code == 404


def test_api_token_required_when_configured(client, monkeypatch):
    monkeypatch.setattr(main, "_API_TOKEN", "s3cret")
    assert client.get("/api/documents").status_code == 401
    assert client.get("/api/documents", headers={"X-Workflow-Token": "s3cret"}).status_code == 200
    r = client.options("/api/documents", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
    assert r.headers.get("access-control-allow-origin") is None
