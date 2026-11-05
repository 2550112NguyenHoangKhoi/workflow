"""Exercise library: every offline practice item gets a stable id so attempts can be counted
per exercise ("Attempt: N", "New", "last practised"), filtered and paged.

Exercise ids
  sentence:<lvl>:<category>            one set of sentences (category × level)
  paragraph:<lvl>:<type>:<i>           one paragraph to translate
  ielts2:<question_type>:<i>           IELTS Task 2 prompt (with a band-8 model to translate)
  task1:<chart id>                     IELTS Task 1 chart (data drawn in the app)
  conversation:<dialogue id>           Vietnamese dialogue → English, line by line
  sp1:<topic>:<i> / sp2:<card id>      IELTS Speaking Part 1 question / Part 2 cue card (+ Part 3)
"""
from . import writing as W
from .practice_bank import CONVERSATIONS, TASK1_CHARTS, SPEAKING_PART1, SPEAKING_PART2

LEVEL_CODES = {"beginner": "b", "intermediate": "i", "advanced": "a"}
CEFR = {"b": ("A1", "A2"), "i": ("B1",), "a": ("B2",)}

TASK1_HINTS = [
    "Câu mở đầu: Paraphrase đề bài (biểu đồ thể hiện điều gì).",
    "Câu tổng quan (Overview): Nêu 2-3 xu hướng hoặc đặc điểm nổi bật nhất.",
    "Thân bài 1: So sánh và mô tả số liệu chi tiết phần 1.",
    "Thân bài 2: So sánh và mô tả số liệu chi tiết phần 2 (không đưa ý kiến cá nhân).",
]


def _short(s: str, n: int = 120) -> str:
    s = " ".join((s or "").split())
    return s if len(s) <= n else s[:n - 1] + "…"


def list_exercises(mode: str, level: str = "beginner", category: str = "", task: str = "", chart_type: str = "") -> list[dict]:
    lvl = LEVEL_CODES.get(level, "b")
    out = []
    if mode == "sentence":
        for cat, by in W.SENTENCE_BANK.items():
            if category and cat != category:
                continue
            pairs = by.get(lvl) or []
            if pairs:
                out.append({"id": f"sentence:{lvl}:{cat}", "title": cat, "category": cat, "level": level,
                            "preview": _short(" ".join(vi for vi, _ in pairs[:3])), "items": len(pairs)})
    elif mode == "paragraph":
        for typ, by in W.PARAGRAPH_BANK.items():
            if category and typ != category:
                continue
            for i, para in enumerate(by.get(lvl) or []):
                out.append({"id": f"paragraph:{lvl}:{typ}:{i}", "title": _short(para[0][1], 60), "category": typ, "level": level,
                            "preview": _short(" ".join(vi for vi, _ in para)), "items": len(para)})
    elif mode == "ielts" and task == "task1":
        for c in TASK1_CHARTS:
            if chart_type and c["type"] != chart_type:
                continue
            out.append({"id": f"task1:{c['id']}", "title": _short(c["prompt"], 70), "category": c["type"], "level": level,
                        "preview": c["title"], "chart_type": c["type"]})
    elif mode == "ielts":
        for qt, essays in W.IELTS_MODEL_ESSAYS.items():
            if category and qt != category:
                continue
            for i, e in enumerate(essays):
                out.append({"id": f"ielts2:{qt}:{i}", "title": _short(e["prompt"], 70), "category": qt, "level": level,
                            "preview": _short(e["prompt"], 200)})
    elif mode == "conversation":
        for c in CONVERSATIONS:
            if c["level"] not in CEFR[lvl] or (category and c["topic"] != category):
                continue
            out.append({"id": f"conversation:{c['id']}", "title": c["title"], "category": c["topic"], "level": c["level"],
                        "preview": c["scene"], "items": len(c["lines"])})
    elif mode == "speaking1":
        for topic, qs in SPEAKING_PART1.items():
            if category and topic != category:
                continue
            for i, q in enumerate(qs):
                out.append({"id": f"sp1:{topic}:{i}", "title": topic, "category": topic, "level": "", "preview": q})
    elif mode == "speaking2":
        for c in SPEAKING_PART2:
            if category and c["topic"] != category:
                continue
            out.append({"id": f"sp2:{c['id']}", "title": c["card"], "category": c["topic"], "level": "",
                        "preview": "You should say: " + "; ".join(c["points"])})
    return out


def categories(mode: str, task: str = "") -> list[str]:
    if mode == "sentence":
        return list(W.SENTENCE_BANK)
    if mode == "paragraph":
        return list(W.PARAGRAPH_BANK)
    if mode == "ielts" and task == "task1":
        return ["bar", "pie", "line", "table", "mixed"]
    if mode == "ielts":
        return list(W.IELTS_MODEL_ESSAYS)
    if mode == "conversation":
        return sorted({c["topic"] for c in CONVERSATIONS})
    if mode == "speaking1":
        return list(SPEAKING_PART1)
    if mode == "speaking2":
        return sorted({c["topic"] for c in SPEAKING_PART2})
    return []


def get_exercise(ex_id: str) -> dict | None:
    """The practice payload for an exercise id, in the shape /api/writing/lessons/generate returns
    (plus `chart` for Task 1, `speakers` for conversations, `question(s)` for speaking)."""
    kind, _, rest = ex_id.partition(":")
    try:
        if kind == "sentence":
            lvl, cat = rest.split(":", 1)
            pairs = W.SENTENCE_BANK[cat][lvl]
            level = {v: k for k, v in LEVEL_CODES.items()}[lvl]
            return {"exercise_id": ex_id, "mode": "sentence", "level": level, "category": cat,
                    "sentences": [{"vi": vi, "reference_en": en, "hint": ""} for vi, en in pairs], "ielts_prompt": "", "min_words": 0}
        if kind == "paragraph":
            lvl, typ, i = rest.split(":")
            para = W.PARAGRAPH_BANK[typ][lvl][int(i)]
            level = {v: k for k, v in LEVEL_CODES.items()}[lvl]
            return {"exercise_id": ex_id, "mode": "paragraph", "level": level, "category": typ,
                    "sentences": [{"vi": vi, "reference_en": en, "hint": ""} for vi, en in para], "ielts_prompt": "", "min_words": 0}
        if kind == "ielts2":
            qt, i = rest.split(":")
            e = W.IELTS_MODEL_ESSAYS[qt][int(i)]
            return {"exercise_id": ex_id, "mode": "ielts", "task": "task2", "level": "", "category": "",
                    "sentences": [{"vi": vi, "reference_en": en, "hint": ""} for vi, en in e["sentences"]],
                    "ielts_prompt": e["prompt"], "min_words": 250, "question_type": qt,
                    "structure_hint": W.IELTS_QUESTION_TYPES[qt]["structure_hint"]}
        if kind == "task1":
            c = next(c for c in TASK1_CHARTS if c["id"] == rest)
            return {"exercise_id": ex_id, "mode": "ielts", "task": "task1", "level": "", "category": "",
                    "sentences": [], "ielts_prompt": c["prompt"], "min_words": 150, "question_type": "",
                    "structure_hint": TASK1_HINTS, "chart": c}
        if kind == "conversation":
            c = next(c for c in CONVERSATIONS if c["id"] == rest)
            return {"exercise_id": ex_id, "mode": "conversation", "level": c["level"], "category": c["topic"],
                    "title": c["title"], "scene": c["scene"], "speakers": list(dict.fromkeys(s for s, _, _ in c["lines"])),
                    "sentences": [{"speaker": s, "vi": vi, "reference_en": en, "hint": ""} for s, vi, en in c["lines"]],
                    "ielts_prompt": "", "min_words": 0}
        if kind == "sp1":
            topic, i = rest.rsplit(":", 1)
            return {"exercise_id": ex_id, "mode": "speaking", "part": 1, "topic": topic, "question": SPEAKING_PART1[topic][int(i)]}
        if kind == "sp2":
            c = next(c for c in SPEAKING_PART2 if c["id"] == rest)
            return {"exercise_id": ex_id, "mode": "speaking", "part": 2, "topic": c["topic"], "question": c["card"],
                    "points": c["points"], "part3": c["part3"]}
    except (KeyError, ValueError, IndexError, StopIteration):
        return None
    return None
