"""Regression tests for the bugs fixed in the 2026-11 audit (see AUDIT.md)."""
import json
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
    # Four sentences are too little to plan from: it asks first; "use what I have" builds it.
    first = client.post(f"/api/documents/{doc['id']}/roadmap/generate", json={"topic_or_text": "g", **OFFLINE}).json()
    assert first["status"] == "need_more_info"
    assert client.post(f"/api/documents/{doc['id']}/roadmap/generate",
                       json={"topic_or_text": "g", "force": True, **OFFLINE}).json()["status"] == "ok"
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


# ── Offline NLP quality ──────────────────────────────────────────────────────

def test_quiz_distractors_come_from_the_document():
    from nlp.quizzes import extract_quiz
    text = ("Isaac Newton published the Principia in 1687 in London. Charles Darwin published On the "
            "Origin of Species in 1859 in England. Albert Einstein developed the theory of relativity in "
            "1905 in Switzerland. Marie Curie won the Nobel Prize in Physics in 1903 in Stockholm.")
    for q in extract_quiz(text, 4)["questions"]:
        for o in q["options"]:
            assert o["text"] not in ("Microsoft", "The United Nations", "The united nations")


def test_exam_cites_the_right_page_and_mixes_types():
    from nlp.exam import extract_exam
    text = ("[Trang 1]\nPhotosynthesis is the process by which plants convert light energy into chemical energy in leaves.\n\n"
            "[Trang 2]\nChlorophyll is the green pigment that absorbs light in the chloroplasts of plant cells.\n\n"
            "[Trang 3]\nThe Calvin cycle uses ATP and NADPH to fix carbon dioxide into glucose molecules.")
    qs = extract_exam(text, 6, ["mcq", "true_false"])["questions"]
    assert len(qs) == 6
    assert {q["source_ref"] for q in qs} == {"Trang 1", "Trang 2", "Trang 3"}
    pairs = [(q["type"], q["source_ref"]) for q in qs]
    assert len(pairs) == len(set(pairs))


def test_vietnamese_compounds_are_not_split():
    from nlp.vietnamese import vi_nouns
    assert "năng lượng hóa học" in vi_nouns("Quang hợp chuyển hóa năng lượng ánh sáng thành năng lượng hóa học.")


def test_offline_ielts_band_rejects_nonsense():
    from nlp.writing import grade_ielts
    prompt = "Some people believe that university education should be free for all students. Do you agree?"
    assert grade_ielts(prompt, "banana " * 260, "task2")["band"] <= 3.0
    assert grade_ielts(prompt, "University should be free. I agree.", "task2")["band"] <= 3.5


def test_difficulty_ranks_texts_sensibly():
    from nlp.readability import score_difficulty
    kids = "The cat sat on the mat. It was a sunny day. The dog ran to the park. Tom saw a red ball."
    bio = ("Photosynthesis is the process by which plants convert light energy into chemical energy. "
           "Chlorophyll is the green pigment that absorbs light. The Calvin cycle uses ATP to fix carbon dioxide into glucose.")
    academic = ("Notwithstanding the considerable heterogeneity of experimental methodologies employed across longitudinal "
                "investigations, the preponderance of empirical evidence substantiates the hypothesis that socioeconomic "
                "stratification significantly moderates intergenerational occupational mobility.")
    k, b, a = (score_difficulty(t)["score"] for t in (kids, bio, academic))
    assert k < b < a
    assert score_difficulty(bio)["level"] == "Intermediate"  # was 'Advanced' (entity density x40)


def test_drive_sources_use_the_users_google_token(monkeypatch):
    """Exam sources from the user's private Drive: the OAuth token is sent, and Google Docs
    are exported to text instead of the alt=media download (which Google rejects for Docs)."""
    import io
    import json as _json
    import urllib.request
    seen = []

    class Resp(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    def fake_urlopen(req, timeout=None, context=None):
        url = req.full_url if hasattr(req, "full_url") else req
        seen.append((url, dict(req.header_items()) if hasattr(req, "header_items") else {}))
        if "fields=" in url:
            return Resp(_json.dumps({"id": "d1", "mimeType": "application/vnd.google-apps.document"}).encode())
        return Resp("Nội dung tài liệu Google Docs".encode())

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    text = main._fetch_drive_text("d1", api_key="", access_token="tok-123")
    assert text == "Nội dung tài liệu Google Docs"
    assert all(h.get("Authorization") == "Bearer tok-123" for _, h in seen)
    assert "/d1/export?mimeType=text/plain" in seen[-1][0]
    assert "supportsAllDrives=true" in seen[-1][0]


def test_offline_chat_keeps_wrapped_pdf_sentences_whole(client):
    """PDF text is hard-wrapped; the offline answer used to stop mid-sentence at each line
    break and dropped the pronoun sentence that carries the answer."""
    db = SessionLocal()
    try:
        text = ("Glycolysis is the first stage of respiration and happens in the cytoplasm.\n"
                "It splits glucose into two\nmolecules of pyruvate.\nThe Calvin cycle takes place in the stroma.")
        answer = main.offline_doc_answer("What does glycolysis produce?", db, context=text)
    finally:
        db.close()
    assert "It splits glucose into two molecules of pyruvate." in answer


def test_concept_map_from_document_id(client):
    d = client.post("/api/documents/upload", files={"file": ("cm.txt", b"Photosynthesis converts light energy into chemical energy. "
        b"Chlorophyll absorbs light in the chloroplast. The Calvin cycle fixes carbon dioxide into glucose. "
        b"Cellular respiration releases energy from glucose in the mitochondria.", "text/plain")}).json()
    r = client.post("/api/generate_map", json={"topic_or_text": "", "document_id": d["id"], **OFFLINE})
    assert r.status_code == 200 and len(r.json()["nodes"]) >= 3


def test_web_import_uses_proxy_aware_download(client, monkeypatch):
    """trafilatura's downloader ignores HTTPS proxies; pages are now fetched with requests."""
    import requests

    class Resp:
        status_code = 200
        headers = {"Content-Type": "text/html; charset=utf-8"}
        encoding = "utf-8"
        apparent_encoding = "utf-8"

        class raw:
            @staticmethod
            def read(n, decode_content=True):
                return ("<html><head><title>Calvin cycle</title></head><body><article><h1>Calvin cycle</h1>"
                        + "<p>The Calvin cycle is the set of light-independent reactions of photosynthesis that "
                          "fix carbon dioxide into sugar in the stroma of chloroplasts.</p>" * 5
                        + "</article></body></html>").encode()

    seen = {}
    monkeypatch.setattr(requests, "get", lambda url, **kw: seen.setdefault("url", url) and Resp())
    r = client.post("/api/documents/url", json={"url": "https://example.org/calvin"})
    assert r.status_code == 200, r.text
    assert seen["url"] == "https://example.org/calvin"
    assert r.json()["filename"] == "Calvin cycle"


def test_teachback_key_points_are_concepts_not_filler_words():
    """Offline key points were frequency-ranked single words, so verbs like 'happens' (and
    single Vietnamese syllables) became points the learner was asked to explain."""
    from nlp.teachback import make_prompt, evaluate
    ctx = ("Photosynthesis happens in chloroplasts. Chlorophyll absorbs light. The light-dependent reactions "
           "split water and release oxygen. The Calvin cycle in the stroma uses ATP and NADPH to fix carbon dioxide into glucose.")
    kp = make_prompt("Photosynthesis", ctx)["key_points"]
    assert "happens" not in kp and "photosynthesis" not in kp
    assert "calvin cycle" in kp
    # A phrase point isn't covered by one shared word.
    assert evaluate("Photosynthesis", ["calvin cycle"], "Water goes round in a cycle.")["gaps"] == ["calvin cycle"]


def test_offline_exam_questions_read_cleanly():
    """PDF headings were glued onto the next sentence ("Photosynthesis Photosynthesis is…"),
    distractors were generic words ("Place", "Process"), and an internal field leaked."""
    from nlp.exam import extract_exam
    text = ("[Trang 1]\nPhotosynthesis\nPhotosynthesis is the process by which green plants and some bacteria convert light energy "
            "into chemical energy stored in glucose.\nThe process takes place mainly in the chloroplasts of leaf cells, where\n"
            "chlorophyll absorbs red and blue light.\n[Trang 2]\nCellular respiration\nAerobic respiration requires oxygen and occurs "
            "in the mitochondria of the cell.\nGlycolysis is the first stage of respiration and happens in the cytoplasm of the cell.\n"
            "During fermentation, yeast produces ethanol and carbon dioxide from glucose in the absence of oxygen.")
    qs = main._normalize_exam_questions(extract_exam(text, num_questions=6, types=["mcq", "true_false"])["questions"])
    assert qs
    for q in qs:
        assert "Photosynthesis Photosynthesis" not in q["question"] and "respiration Aerobic" not in q["question"]
        assert "\n" not in q["question"] and "terms" not in q
        if q["type"] == "mcq":
            opts = {o["text"].lower() if isinstance(o, dict) else o.lower() for o in q["options"]}
            assert not opts & {"place", "process", "product", "way", "part"}


def test_slide_pdf_text_extraction():
    """LaTeX slides: words were glued ("Westudythefollowing"), math letters were Unicode
    italics (𝑎), subscripts split onto their own line, and the running footer repeated on every
    page. Uses a generated PDF with tight spacing, a subscript and a footer."""
    import io
    import pdfplumber
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    from nlp.pdf_text import extract_pages
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    for page in range(4):
        t = c.beginText(60, 780); t.setFont("Helvetica", 11); t.setCharSpace(-0.6)
        t.textOut(f"We study the following topics in this chapter, part {'ABCD'[page]}.")
        c.drawText(t)
        c.setFont("Helvetica", 11); c.drawString(60, 740, "State q"); c.setFont("Helvetica", 8); c.drawString(97, 738.5, "1")  # LaTeX-like subscript
        c.setFont("Helvetica", 11); c.drawString(104, 740, f"is initial. Page {page}")
        c.drawString(60, 60, "MATHEMATICAL MODELING Methods and Application")
        c.showPage()
    c.save()
    with pdfplumber.open(io.BytesIO(buf.getvalue())) as pdf:
        pages = extract_pages(pdf)
    assert "We study the following topics" in pages[0]
    assert "q1" in pages[0].replace(" ", "")  and "\n1\n" not in pages[0]
    assert all("Methods and Application" not in p for p in pages)
    import unicodedata
    assert unicodedata.normalize("NFKC", "𝑎𝑢𝜀") == "auε"


def test_offline_tools_on_slide_debris():
    """Chat, notes and quizzes skipped definitions and served slide debris instead."""
    from nlp.preprocessor import is_prose
    assert not is_prose("NFA DFA 4.") and not is_prose("On the alphabet Σ = {a, b}")
    assert not is_prose("Finite Automata- Basic Problems, in Section 2.5.")
    assert not is_prose("Mathematical Logic for Computer Science, Chapter 15 Third Edition, Springer-Verlag (2012).")
    assert is_prose("An alphabet Σ is a finite and non-empty set of symbols (or characters).")
    db = SessionLocal()
    try:
        text = ("On the alphabet Σ = {a, b}\nOn the alphabet Σ = {a, b}\nSet alphabet Σ = {0, 1}\n"
                "An alphabet Σ is a finite and non-empty set of symbols (or characters).\n"
                "Which alphabet is used in the next exercise?\nA string over Σ is a finite sequence of symbols.")
        answer = main.offline_doc_answer("What is an alphabet?", db, context=text)
    finally:
        db.close()
    first = answer.split("\n")[2]
    assert "finite and non-empty set of symbols" in first


def test_roadmap_follows_numbered_sections():
    from nlp.roadmap import offline_roadmap
    text = "\n".join(f"2.{i} {name}\nThis section explains {name.lower()} with several worked examples and exercises."
                     for i, name in enumerate(["Overview", "Regular Expressions", "Finite Automata", "Minimization"], 1))
    titles = [s["title"] for s in offline_roadmap(text)]
    assert titles[1:5] == ["2.1 Overview", "2.2 Regular Expressions", "2.3 Finite Automata", "2.4 Minimization"]


def test_chat_followup_pills_use_previous_question(client):
    d = client.post("/api/documents/upload", files={"file": ("ex.txt", (
        "A finite automaton is a machine with a finite set of states. "
        "For example, a turnstile is a finite automaton with two states, locked and unlocked. "
        "Regular expressions describe regular languages. ").encode(), "text/plain")}).json()
    client.post("/api/chat", json={"message": "What is a finite automaton?", "document_id": d["id"], **OFFLINE})
    r = client.post("/api/chat", json={"message": "Cho ví dụ", "document_id": d["id"], **OFFLINE}).json()
    assert "turnstile" in r["response"]


def test_exam_from_library_sources_links_the_document(client):
    from conftest import TEXT
    d = client.post("/api/documents/upload", files={"file": ("src.txt", TEXT, "text/plain")}).json()
    ex = client.post("/api/exams/generate", json={"num_questions": 3, "question_types": ["mcq"],
                     "sources": [{"type": "document", "value": str(d["id"])}], **OFFLINE}).json()
    art = client.get(f"/api/artifacts/{ex['id']}").json()
    assert art.get("document_id") == d["id"]


CHAPTER2 = "Chapter 2\nAUTOMATA THEORY\n" + "\n".join(
    f"2.{i} {name}\n" + " ".join(f"The {name.lower()} topic is studied with worked example number {k} and an exercise."
                                for k in range(12))
    for i, name in enumerate(["Overview", "Regular Expressions", "Finite Automata", "Minimization"], 1)) + \
    "\nReferences: Chapter 1,2,4 [2nd ed., Cambridge University Press 2004]\nChapter 15 Third Edition, Springer (2012)."


def test_roadmap_asks_for_more_info_when_sources_cover_one_chapter(client):
    """A single chapter (or a thin handout) is not enough to plan a subject: the generator
    returns questions instead of a roadmap, then uses the answers (dates, syllabus gaps)."""
    from nlp.coverage import assess, chapters_in
    assert chapters_in(CHAPTER2) == [2]          # bibliography lines are not chapters
    assert assess(CHAPTER2)["reasons"][0]["code"] == "single_chapter"
    assert assess("Too short.")["sufficient"] is False

    r = client.post("/api/documents/upload", files={"file": ("ch2.txt", CHAPTER2.encode(), "text/plain")})
    did = r.json()["id"]
    body = client.post(f"/api/documents/{did}/roadmap/generate", json=OFFLINE).json()
    assert body["status"] == "need_more_info"
    assert {q["id"] for q in body["questions"]} >= {"subject", "goal", "deadline", "syllabus"}
    assert client.get(f"/api/documents/{did}/roadmap").json()["items"] == []   # nothing stored

    answers = {"goal": "Thi cuối kỳ", "deadline": "2099-01-31", "hours_per_week": 6,
               "syllabus": "Chương 1. Sets and logic\nChương 2. Finite automata\nChương 3. Turing machines"}
    body = client.post(f"/api/documents/{did}/roadmap/generate", json={**OFFLINE, **answers}).json()
    assert body["status"] == "ok"
    items = client.get(f"/api/documents/{did}/roadmap").json()["items"]
    titles = [i["title"] for i in items]
    assert "Chương 2. Finite automata" in titles and "Làm đề thi thử" in titles
    assert all(i["due_date"] for i in items) and items[-1]["due_date"] < "2099-01-31"
    missing = {i["title"] for i in items if i["needs_material"]}
    assert "Chương 3. Turing machines" in missing and "Chương 2. Finite automata" not in missing

    forced = client.post(f"/api/documents/{did}/roadmap/generate", json={**OFFLINE, "force": True}).json()
    assert forced["status"] == "ok" and forced["caveats"]

    # The "Roadmap" study plan used to plan from the file name alone (a generic template).
    path = client.post("/api/generate_path", json={"topic": "ch2", "document_id": did}).json()
    assert path["status"] == "need_more_info"
    path = client.post("/api/generate_path", json={"topic": "ch2", "document_id": did, "force": True}).json()
    assert "History and Evolution" not in json.dumps(path)
    assert any("Finite Automata" in t["title"] for m in path["modules"] for t in m["topics"])


def test_mindmap_for_a_document_and_for_a_subject(client):
    # One document → its sections are the branches.
    did = client.post("/api/documents/upload", files={"file": ("ch2.txt", CHAPTER2.encode(), "text/plain")}).json()["id"]
    m = client.post("/api/mindmap", json={"document_id": did, **OFFLINE}).json()
    assert m["mode"] == "document" and m["hint"]
    root = [n for n in m["nodes"] if n["parent"] is None]
    assert len(root) == 1 and root[0]["label"] == "Automata Theory"
    branches = [n["label"] for n in m["nodes"] if n["parent"] == root[0]["id"]]
    assert branches == ["2.1 Overview", "2.2 Regular Expressions", "2.3 Finite Automata", "2.4 Minimization"]

    # A project with several chapters → the subject at the centre, one branch per topic,
    # and cross-links between topics sharing concepts.
    pid = client.post("/api/projects", json={"name": "Automata"}).json()["id"]
    ch3 = ("Chapter 3\nPUSHDOWN AUTOMATA\n3.1 Grammars\n" + "A context-free grammar generates a language from productions. " * 8 +
           "\n3.2 Pushdown automata\n" + "A pushdown automaton is a finite automaton with a stack that accepts a language. " * 8 +
           "\n3.3 Regular Expressions\n" + "Every regular expression describes a regular language accepted by a finite automaton. " * 6)
    for name, text in [("ch2.txt", CHAPTER2), ("ch3.txt", ch3)]:
        client.post("/api/documents/upload", files={"file": (name, text.encode(), "text/plain")}, data={"project_id": pid})
    m = client.post("/api/mindmap", json={"project_id": pid, **OFFLINE}).json()
    assert m["mode"] == "subject" and m["title"] == "Automata"
    topics = [n for n in m["nodes"] if n["kind"] == "topic"]
    assert [t["label"] for t in topics] == ["Automata Theory", "Pushdown Automata"]
    assert m["links"] and {m["links"][0]["source"], m["links"][0]["target"]} == {t["id"] for t in topics}
    ids = {n["id"] for n in m["nodes"]}
    assert all(n["parent"] in ids for n in m["nodes"] if n["parent"])


def test_study_tools_synthesis_essay_flashcards_citations_feedback(client):
    pid = client.post("/api/projects", json={"name": "Tools"}).json()["id"]
    ids = []
    for name, text in [("ch2.txt", CHAPTER2),
                       ("ch3.txt", "Chapter 3\nPUSHDOWN AUTOMATA\n3.1 Grammars\n" + "A context-free grammar generates a language from productions. " * 6 +
                        "\n3.2 Stacks\n" + "A pushdown automaton is a finite automaton extended with a stack. For example it accepts a^n b^n. " * 5)]:
        ids.append(client.post("/api/documents/upload", files={"file": (name, text.encode(), "text/plain")}, data={"project_id": pid}).json()["id"])

    # AI Tổng hợp: outline / lesson / comparison table / custom, saved as a notes artifact.
    for fmt, marker in [("outline", "## 2.2 Regular Expressions"), ("notes", "## Review questions"), ("table", "| **Key concepts** |")]:
        r = client.post("/api/synthesize", json={"document_ids": ids, "format": fmt, **OFFLINE})
        assert r.status_code == 200 and marker in r.json()["markdown"], (fmt, r.json()["markdown"][:400])
    assert "0 words" not in client.post("/api/synthesize", json={"document_ids": ids, "format": "table", **OFFLINE}).json()["markdown"]
    custom = client.post("/api/synthesize", json={"document_ids": ids, "format": "custom", "instruction": "stack", **OFFLINE}).json()
    assert "stack" in custom["markdown"].lower()
    assert client.post("/api/synthesize", json={"document_ids": ids, "format": "custom", **OFFLINE}).status_code == 422
    assert any(a["type"] == "notes" for a in client.get(f"/api/projects/{pid}/artifacts").json())

    # Essay grading: a good answer beats a vague one; criteria follow the rubric.
    q = {"question": 'Trình bày và giải thích nhận định sau: "A pushdown automaton is a finite automaton extended with a stack."',
         "reference": "A pushdown automaton is a finite automaton extended with a stack.", **OFFLINE}
    good = client.post("/api/essay/grade", json={**q, "answer": "A pushdown automaton is a finite automaton that also has a stack, "
                                                 "which gives it unbounded memory. For example it recognises a^n b^n by pushing a's and popping on b's."}).json()
    vague = client.post("/api/essay/grade", json={**q, "answer": "It is a kind of machine used in computer science theory."}).json()
    assert good["score"] > vague["score"] + 25 and len(good["criteria"]) == 3 and good["criteria"][2]["met"]

    # Hand-made flashcards (PDF selection, missed quiz questions); duplicates skipped.
    cards = [{"front": "What is a stack?", "back": "LIFO memory"}, {"front": "What is a stack?", "back": "dup"}]
    assert client.post("/api/flashcards", json={"cards": cards, "document_id": ids[1]}).json()["count"] == 1

    # Chat answers carry page citations.
    pdf_id = client.post("/api/documents/upload", files={"file": ("slides.pdf", _two_page_pdf(), "application/pdf")}).json()["id"]
    chat = client.post("/api/chat", json={"message": "What is a pushdown automaton?", "document_id": pdf_id, **OFFLINE}).json()
    assert chat["citations"] and chat["citations"][0]["page"] == 2

    # Feedback is stored (the button used to do nothing).
    assert client.post("/api/feedback", json={"message": "Nút X không chạy", "page": "#/writing"}).status_code == 200
    assert client.get("/api/feedback").json()[0]["page"] == "#/writing"


def _two_page_pdf() -> bytes:
    from reportlab.pdfgen import canvas
    import io
    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    c.drawString(72, 750, "Finite automata read input symbols and change state on each symbol they read.")
    c.showPage()
    c.drawString(72, 750, "A pushdown automaton is a finite automaton extended with a stack memory.")
    c.save()
    return buf.getvalue()


def test_branching_chat_and_child_teachback(client):
    did = client.post("/api/documents/upload", files={"file": ("pda.txt", (
        "A pushdown automaton is a finite automaton extended with a stack. "
        "A context-free grammar is a grammar whose productions have one nonterminal on the left. "
        "Closure properties: context-free languages are closed under union and concatenation.").encode(), "text/plain")}).json()["id"]
    ask = lambda q, parent=None: client.post("/api/chat", json={"message": q, "document_id": did, "parent_id": parent, **OFFLINE}).json()
    a1 = ask("What is a pushdown automaton?")
    a2 = ask("What are closure properties?", a1["id"])
    b1 = ask("Cho ví dụ", a1["id"])            # a second branch from the first answer
    msgs = {m["id"]: m for m in client.get(f"/api/documents/{did}/messages").json()["messages"]}
    assert msgs[a2["user_id"]]["parent_id"] == a1["id"] and msgs[b1["user_id"]]["parent_id"] == a1["id"]
    assert msgs[b1["id"]]["parent_id"] == b1["user_id"]
    # "Cho ví dụ" in the new branch refers to that branch's question, not the latest one overall.
    assert "closure" not in b1["response"].lower()

    from nlp.teachback import evaluate
    r = evaluate("Pushdown automaton", ["stack", "finite automaton", "context-free language"], "It has a stack.")
    assert r["child_question"] and r["gaps"]


def test_practice_library_conversation_task1_and_speaking(client):
    email = "lib@test.local"
    # Library: conversations by CEFR band, attempts counted per exercise.
    lib = client.get("/api/practice/library", params={"mode": "conversation", "level": "beginner", "email": email}).json()
    assert lib["total"] >= 2 and all(i["level"] in ("A1", "A2") for i in lib["items"]) and lib["items"][0]["is_new"]
    ex_id = lib["items"][0]["id"]
    ex = client.get(f"/api/practice/exercise/{ex_id}").json()
    assert ex["mode"] == "conversation" and ex["sentences"][0]["speaker"] and len(ex["speakers"]) == 2
    client.post("/api/writing/attempts", json={"owner_email": email, "mode": "conversation", "score": 8, "num_items": 7, "exercise_id": ex_id})
    item = next(i for i in client.get("/api/practice/library", params={"mode": "conversation", "level": "beginner", "email": email}).json()["items"] if i["id"] == ex_id)
    assert item["attempts"] == 1 and not item["is_new"] and item["last_practiced"]

    # Task 1: filter by chart type; every exercise carries its data.
    pies = client.get("/api/practice/library", params={"mode": "ielts", "task": "task1", "chart_type": "pie"}).json()
    assert pies["total"] == 2 and {"bar", "pie", "line", "table", "mixed"} == set(pies["categories"])
    chart = client.get(f"/api/practice/exercise/{pies['items'][0]['id']}").json()["chart"]
    assert chart["type"] == "pie" and abs(sum(chart["series"][0]["values"]) - 100) < 1
    random_t1 = client.post("/api/writing/lessons/generate", json={"mode": "ielts", "task": "task1", **OFFLINE}).json()
    assert random_t1.get("chart")

    # Pronunciation: the misheard word is flagged.
    r = client.post("/api/pronunciation/score", json={"target": "Nice to meet you.", "transcript": "nice to meat you"}).json()
    assert [w["status"] for w in r["words"]] == ["ok", "ok", "wrong", "ok"] and r["accuracy"] == 75

    # IELTS Speaking: a developed answer scores clearly above a two-word one; history kept.
    q = "What do you like most about your hometown?"
    good = client.post("/api/speaking/grade", json={"part": 1, "question": q, "owner_email": email, "duration_sec": 20, "transcript":
        "I really like my hometown because it is peaceful and the people are friendly. For example, when I was a child "
        "my neighbours often invited us for dinner. However, it has changed a lot recently, which makes me a little sad."}).json()
    weak = client.post("/api/speaking/grade", json={"part": 1, "question": q, "owner_email": email, "transcript": "It is good. I like it."}).json()
    assert 5.5 <= good["overall"] <= 8 and weak["overall"] <= 4.5
    hist = client.get("/api/speaking/history", params={"email": email}).json()["history"]
    assert hist[0]["question"] == q and hist[0]["transcript"]
    # Local profiles that never went through /api/auth still get stats (was 404).
    assert client.get("/api/user/stats", params={"email": "nobody@local"}).status_code == 200
