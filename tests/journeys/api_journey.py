"""API journey: every learning flow (document hub, tutor chat, quiz, SM-2 flashcards, concept map,
exam, roadmap, teach-back, writing practice, IELTS grading, vocabulary, web search) with the
OFFLINE engine against a running backend.
Checks output *quality*, not just status codes. Usage: python api_journey.py <pdf>"""
import json, sys, datetime, requests
B = "http://127.0.0.1:8000"
OFF = "OFFLINE"
results = []
def check(ok, name, detail=""):
    results.append((bool(ok), name, detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail and not ok else ""))
def j(r):
    try: return r.json()
    except Exception: return {"_raw": r.text[:300]}
def post(path, body, **kw): return requests.post(B + path, json=body, timeout=180, **kw)
def get(path, **kw): return requests.get(B + path, timeout=180, **kw)

# ---------- Library (omilearn: documents hub) ----------
with open(sys.argv[1], "rb") as f:
    r = requests.post(B + "/api/documents/upload", files={"file": ("biology.pdf", f, "application/pdf")}, timeout=120)
doc = j(r); did = doc.get("id")
check(r.ok and did, "upload PDF", r.text[:200])
d = j(get(f"/api/documents/{did}"))
pages = d.get("pages") or d.get("pages_data") or []
if isinstance(pages, str): pages = json.loads(pages)
check(len(pages) == 3, "PDF keeps 3 pages", f"pages={len(pages)} keys={list(d)[:8]}")
check(get(f"/api/documents/{did}/file").ok, "raw PDF served for the viewer")

# ---------- Chat with document (omilearn: AI tutor) ----------
r = post("/api/chat", {"message": "Where does the Calvin cycle take place?", "document_id": did, "api_key": OFF})
ans = json.dumps(j(r), ensure_ascii=False)
check(r.ok and "stroma" in ans.lower(), "chat answers from the document (Calvin cycle → stroma)", ans[:300])
r = post("/api/chat", {"message": "What does glycolysis produce?", "document_id": did, "api_key": OFF})
ans = json.dumps(j(r), ensure_ascii=False)
check(r.ok and "pyruvate" in ans.lower(), "chat: glycolysis → pyruvate", ans[:300])
h = j(get(f"/api/documents/{did}/messages"))
check(len(h.get("messages", h if isinstance(h, list) else [])) >= 4, "chat history saved", str(h)[:200])

# ---------- Smart notes ----------
r = get(f"/api/documents/{did}/notes", params={"api_key": OFF, "regenerate": "true"})
n = j(r); ns = json.dumps(n, ensure_ascii=False).lower()
check(r.ok and "photosynthesis" in ns and ("respiration" in ns or "calvin" in ns), "smart notes cover the document", ns[:300])

# ---------- Quiz ----------
r = post("/api/generate_quiz", {"topic_or_text": "", "document_id": did, "api_key": OFF})
q = j(r); qs = q.get("questions") or q.get("quiz", {}).get("questions") or []
check(r.ok and len(qs) >= 3, "quiz generated", str(q)[:300])
bad = []
for x in qs:
    ids = [o["id"] for o in x.get("options", [])]
    texts = [o["text"].strip().lower() for o in x.get("options", [])]
    if x.get("correct_option_id") not in ids or len(set(texts)) != len(texts) or len(ids) < 3: bad.append(x.get("question"))
check(not bad, "quiz: answer among options, options distinct, ≥3 options", str(bad)[:300])
r = post("/api/quizzes/submit", {"document_id": did, "score": 3, "total_questions": 5})
check(r.ok, "quiz score saved")
p = j(get(f"/api/documents/{did}/progress"))
check("quiz" in json.dumps(p).lower() or p.get("history") or p.get("scores"), "progress shows quiz history", str(p)[:300])

# ---------- Flashcards + SM-2 (omilearn: spaced repetition) ----------
r = post("/api/generate_flashcards", {"topic_or_text": "", "document_id": did, "api_key": OFF})
fc = j(r); cards = fc.get("flashcards", [])
check(r.ok and len(cards) >= 3, "flashcards generated", str(fc)[:300])
check(all(c.get("front") and c.get("back") and c["front"].strip().lower() != c["back"].strip().lower() for c in cards), "flashcards have distinct front/back")
due = j(get("/api/flashcards/due")).get("flashcards", [])
check(len(due) >= len(cards), "new cards are due today", f"due={len(due)} cards={len(cards)}")
c = due[0]; seq = []
for qual in (5, 5, 5):
    r = post("/api/flashcards/review", {"id": c["id"], "interval": c.get("interval", 1), "ease": c.get("ease", 2.5), "repetitions": c.get("repetitions", 0), "due": c.get("due_date") or "", "quality": qual})
    c = {**c, **(j(r).get("flashcard") or j(r))}; seq.append(c.get("interval"))
check(seq[:3] == [1, 6, 15] or (seq[0] <= seq[1] < seq[2]), "SM-2 intervals grow on 'easy' (1→6→~15)", str(seq))
r = post("/api/flashcards/review", {"id": c["id"], "interval": c["interval"], "ease": c["ease"], "repetitions": c["repetitions"], "due": "", "quality": 1})
c2 = j(r).get("flashcard") or j(r)
check(c2.get("interval") == 1 and c2.get("repetitions") == 0, "SM-2 lapse resets the card", str(c2)[:200])
check(post("/api/flashcards/review", {"id": c["id"], "interval": 1, "ease": 2.5, "repetitions": 0, "due": "", "quality": 9}).status_code == 422, "SM-2 rejects quality 9")

# ---------- Concept map ----------
r = post("/api/generate_map", {"topic_or_text": "", "document_id": did, "api_key": OFF})
m = j(r); nodes = m.get("nodes", []); edges = m.get("edges", [])
ids = {x["id"] for x in nodes}
check(r.ok and len(nodes) >= 4 and edges, "concept map has nodes + edges", str(m)[:300])
check(all(e["source"] in ids and e["target"] in ids for e in edges), "concept map edges reference real nodes")
labels = " ".join(x["label"].lower() for x in nodes)
check(any(k in labels for k in ("photosynthesis", "calvin", "chlorophyll", "respiration", "glucose")), "concept map labels are key concepts", labels[:200])

# ---------- Exam (omilearn: tạo đề thi) ----------
body = {"title": "Kiểm tra sinh học", "num_questions": 8, "question_types": ["mcq", "true_false", "short_answer"], "duration_minutes": 15,
        "sources": [{"type": "document", "value": str(did), "name": "biology.pdf"}], "api_key": OFF, "language": "English"}
r = post("/api/exams/generate", body)
ex = j(r); aid = ex.get("artifact_id") or ex.get("id")
check(r.ok and aid, "exam generated", str(ex)[:300])
a = j(get(f"/api/artifacts/{aid}"))
payload = a.get("content") if isinstance(a.get("content"), dict) else a
if isinstance(payload, str): payload = json.loads(payload)
eq = (payload or {}).get("questions") or []
check(len(eq) == 8, "exam has the requested 8 questions", f"{len(eq)}")
types = {x.get("type") for x in eq}
check(len(types) >= 3, "exam mixes the 3 requested types", str(types))
pg = [x.get("source_ref") for x in eq]
check(pg and all(p and int(p.split()[-1]) in (1, 2, 3) for p in pg), "exam questions cite pages 1–3", str(pg))
mcq_bad = [x["question"] for x in eq if x.get("type") == "mcq" and x.get("answer") not in [o if isinstance(o, str) else o.get("id") for o in x.get("options", [])] and not any((o if isinstance(o,str) else o.get("text","")) == x.get("answer") for o in x.get("options", []))]
check(not mcq_bad, "exam MCQ answers match an option", str(mcq_bad)[:200] + " sample=" + json.dumps(eq[:1], ensure_ascii=False)[:300])
r = post(f"/api/exams/{aid}/questions", {"count": 3, "api_key": OFF})
check(r.ok, "add 3 more questions to the exam", r.text[:200])

r = post("/api/examdocs/generate", {"title": "Ôn thi", "sources": [{"type": "document", "value": str(did)}], "api_key": OFF})
check(r.ok and len(json.dumps(j(r))) > 300, "exam study doc generated", r.text[:200])
for ep in ("generate_study_plan", "generate_exam_prep"):
    r = post(f"/api/{ep}", {"topic_or_text": "", "document_id": did, "api_key": OFF})
    check(r.ok and len(r.text) > 200, ep, r.text[:200])

# ---------- Roadmap ----------
r = post(f"/api/documents/{did}/roadmap/generate", {"topic_or_text": "", "api_key": OFF})
if r.ok and r.json().get("status") == "need_more_info":  # thin source: answer the questions
    check(any(q["id"] == "syllabus" for q in r.json()["questions"]), "thin source → asks for more info")
    r = post(f"/api/documents/{did}/roadmap/generate", {"topic_or_text": "", "api_key": OFF, "goal": "Thi cuối kỳ", "deadline": "2099-01-01"})
rm = j(get(f"/api/documents/{did}/roadmap"))
steps = rm.get("items") or rm.get("roadmap") or rm if isinstance(rm, list) else (rm.get("items") or rm.get("roadmap") or [])
check(r.ok and len(steps) >= 3, "document roadmap generated (≥3 steps)", str(rm)[:300])
proj = j(post("/api/projects", {"name": "Sinh học 10"}))
pid = proj.get("id")
with open(sys.argv[1], "rb") as f:
    requests.post(B + "/api/documents/upload", data={"project_id": str(pid)}, files={"file": ("bio2.pdf", f, "application/pdf")}, timeout=120)
r = post(f"/api/projects/{pid}/roadmap/generate", {"topic_or_text": "Photosynthesis and respiration", "project_id": pid, "api_key": OFF, "force": True})
check(r.ok, "project roadmap generated", r.text[:200])

# ---------- Teach-back (omilearn: active learning / Feynman) ----------
r = post("/api/teachback/start", {"topic": "Photosynthesis", "document_id": did, "api_key": OFF})
tb = j(r)
check(r.ok and tb.get("concept") and tb.get("key_points"), "teach-back prompt", str(tb)[:300])
good = ("Photosynthesis happens in chloroplasts. Chlorophyll absorbs light energy, which is used to split water and release oxygen. "
        "Then the Calvin cycle in the stroma uses ATP and NADPH and carbon dioxide to make glucose.")
badx = "It is when animals eat food."
sg = j(post("/api/teachback/evaluate", {"concept": tb.get("concept", ""), "key_points": tb.get("key_points", []), "explanation": good, "api_key": OFF}))
sb = j(post("/api/teachback/evaluate", {"concept": tb.get("concept", ""), "key_points": tb.get("key_points", []), "explanation": badx, "api_key": OFF}))
check(sg.get("understanding_score", 0) > sb.get("understanding_score", 0) + 20, "teach-back: good explanation scores well above a wrong one", f"good={sg.get('understanding_score')} bad={sb.get('understanding_score')}")

# ---------- Writing practice (datpmt: sentence / paragraph / IELTS) ----------
for mode, extra in (("sentence", {"category": "daily_life"}), ("paragraph", {"category": "story"}), ("ielts", {"task": "task2"}), ("ielts", {"task": "task1"})):
    for level in ("beginner", "intermediate", "advanced"):
        r = post("/api/writing/lessons/generate", {"mode": mode, "level": level, "api_key": OFF, **extra})
        les = j(r)
        ok = r.ok and (les.get("sentences") or les.get("ielts_prompt"))
        check(ok, f"writing lesson offline: {mode}/{extra}/{level}", r.text[:200])
        if mode == "sentence" and level == "beginner" and ok:
            s0 = (les.get("sentences") or les.get("lesson", {}).get("sentences"))[0]
r = post("/api/writing/grade", {"vi": s0["vi"], "reference_en": s0["reference_en"], "user_en": s0["reference_en"], "level": "beginner", "api_key": OFF})
g_ok = j(r)
r = post("/api/writing/grade", {"vi": s0["vi"], "reference_en": s0["reference_en"], "user_en": "banana keyboard purple", "level": "beginner", "api_key": OFF})
g_bad = j(r)
sc = lambda g: g.get("score", g.get("result", {}).get("score", -1))
check(sc(g_ok) >= 8 and sc(g_bad) <= 3, "sentence grading: reference ≥8, nonsense ≤3", f"ok={sc(g_ok)} bad={sc(g_bad)} ref={s0['reference_en']}")
prompt = "Some people think that universities should provide graduates with the knowledge and skills needed in the workplace. Others think that the true function of a university should be to give access to knowledge for its own sake. Discuss both views and give your opinion."
strong = open(sys.argv[2]).read() if len(sys.argv) > 2 else ""
weak = "University is good. I like university. Job is important. " * 5
ielts = lambda e: j(post("/api/writing/ielts/grade", {"prompt": prompt, "essay": e, "task": "task2", "api_key": OFF}))
gs, gw = ielts(strong), ielts(weak)
band = lambda g: g.get("overall_band", g.get("band", g.get("overall", -1)))
check(band(gs) >= 6 and band(gw) <= 4.5, "IELTS: strong essay ≥6, weak ≤4.5", f"strong={band(gs)} weak={band(gw)}")
check(all((band(x) * 2) % 1 == 0 for x in (gs, gw)), "IELTS bands are in 0.5 steps")
crit = [k for k in json.dumps(gs).lower().split('"') if k in ("task_response", "coherence", "lexical", "grammar")]
check(len(set(crit)) >= 4, "IELTS gives the 4 criteria", str(list(gs))[:200])
r = post("/api/writing/word", {"word": "photosynthesis", "sentence_en": "Plants use photosynthesis.", "api_key": OFF})
check(r.ok and len(r.text) > 40, "writing: word lookup", r.text[:200])
r = post("/api/writing/attempts", {"mode": "sentence", "level": "beginner", "score": 8.5, "num_items": 10, "owner_email": "local@workflow"})
pr = j(get("/api/writing/progress", params={"email": "local@workflow"}))
check(r.ok and (pr.get("streak", 0) >= 1 or pr.get("day_streak", 0) >= 1), "writing progress + streak", str(pr)[:300])

# ---------- Vocabulary (datpmt: vocabulary) ----------
r = post("/api/vocabulary/add", {"word": "resilient", "owner_email": "local@workflow", "api_key": OFF})
v = j(r)
check(r.ok and (v.get("meaning_vi") or v.get("word", {}).get("meaning_vi") or "nghĩa" in r.text), "vocab add auto-fills meaning", r.text[:300])
lk = j(get("/api/vocabulary/lookup", params={"word": "abundant", "api_key": OFF}))
check(lk.get("meaning_vi") or lk.get("definition") or lk.get("meanings"), "vocab lookup", str(lk)[:200])
rv = j(get("/api/vocabulary/review", params={"email": "local@workflow"}))
items = rv.get("words") or rv.get("items") or rv.get("review") or []
check(items, "vocab review queue", str(rv)[:200])
if items:
    r = post("/api/vocabulary/grade", {"id": items[0]["id"], "correct": True, "owner_email": "local@workflow"})
    check(r.ok, "vocab grade")
st = j(get("/api/vocabulary/stats", params={"email": "local@workflow"}))
check(st, "vocab stats", str(st)[:200])
banks = j(get("/api/vocabulary/bank"))
check(banks, "vocab banks listed", str(banks)[:200])

# ---------- Web sources (omilearn: search / import from web) ----------
r = post("/api/search", {"query": "photosynthesis calvin cycle"})
sr = j(r)
check(r.ok and (sr.get("results") or []), "web search returns results", r.text[:200])
r = post("/api/documents/url", {"url": "https://en.wikipedia.org/wiki/Calvin_cycle"})
check(r.ok and "calvin" in r.text.lower(), "import a web page", r.text[:200])

print(f"\n{sum(ok for ok,_,_ in results)}/{len(results)} passed")
for ok, n, d in results:
    if not ok: print("  FAIL:", n, "|", d[:400])
