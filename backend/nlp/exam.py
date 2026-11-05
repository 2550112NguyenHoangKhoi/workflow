"""Offline mixed-type exam generator — the deterministic fallback for /api/exams/generate.

Builds on the MCQ engine in quizzes.py: base cloze questions are derived from the source
text, then converted into the requested question types (trắc nghiệm, đúng/sai, trả lời
ngắn, tự luận) in round-robin order so every enabled type is represented.
"""
import random
from .quizzes import extract_quiz


def _correct_text(q):
    return next((o["text"] for o in q["options"] if o["id"] == q["correct_option_id"]), "")


def _as_mcq(q):
    out = dict(q)
    out["type"] = "mcq"
    return out


def _as_true_false(q):
    correct = _correct_text(q)
    wrongs = [o["text"] for o in q["options"] if o["id"] != q["correct_option_id"]]
    make_true = not wrongs or random.random() < 0.5
    filler = correct if make_true else random.choice(wrongs)
    statement = q["question"].replace("_______", filler, 1)
    return {
        "type": "true_false",
        "question": f"Đúng hay Sai: {statement}",
        "options": [{"id": "a", "text": "Đúng"}, {"id": "b", "text": "Sai"}],
        "correct_option_id": "a" if make_true else "b",
        "answer": "Đúng" if make_true else "Sai",
        "explanation": ("Phát biểu khớp với nội dung tài liệu."
                        if make_true else f"Thuật ngữ đúng phải là '{correct}'."),
    }


def _as_short_answer(q):
    return {
        "type": "short_answer",
        "question": f"Điền vào chỗ trống: {q['question']}",
        "answer": _correct_text(q),
        "explanation": q.get("explanation", ""),
    }


def _as_essay(q):
    statement = q["question"].replace("_______", _correct_text(q), 1)
    return {
        "type": "essay",
        "question": f'Trình bày và giải thích nhận định sau: "{statement}"',
        "answer": q.get("explanation", ""),
        "explanation": q.get("explanation", ""),
    }


_CONVERTERS = {
    "mcq": _as_mcq,
    "true_false": _as_true_false,
    "short_answer": _as_short_answer,
    "essay": _as_essay,
}


def _page_index(text):
    """Split '[Trang N]'-marked text into [(page_no, page_text)] (single page if unmarked)."""
    import re
    parts = re.split(r"^\[Trang (\d+)\]\s*\n?", text, flags=re.MULTILINE)
    if len(parts) == 1:
        return [(None, text)]
    pages = [(None, parts[0])] if parts[0].strip() else []
    for i in range(1, len(parts) - 1, 2):
        pages.append((parts[i], parts[i + 1]))
    return pages


def _find_page(pages, question_text):
    """Page whose text contains the question's source sentence (cloze blank removed)."""
    import re
    probe = [p for p in re.split(r"_{3,}", question_text) if len(p.strip()) >= 12]
    probe = max(probe, key=len).strip() if probe else ""
    if not probe:
        return None
    norm = lambda s: re.sub(r"\s+", " ", s).lower()
    probe = norm(probe)
    for page_no, page_text in pages:
        if page_no and probe in norm(page_text):
            return page_no
    return None


def extract_exam(text: str, num_questions: int = 10, types=None, with_explanation: bool = True):
    types = [t for t in (types or []) if t in _CONVERTERS] or ["mcq"]

    pages = _page_index(text)
    plain = "\n".join(t for _, t in pages)

    base = extract_quiz(plain, num_questions=num_questions).get("questions", [])
    questions = []
    # Round-robin the requested types. If the text yields fewer cloze facts than requested,
    # reuse facts in a DIFFERENT format (e.g. the MCQ fact again as true/false) so the exam
    # still reaches the requested length when several types are enabled.
    max_total = min(num_questions, len(base) * len(types))
    i = 0
    while len(questions) < max_total:
        fact, round_no = i % len(base), i // len(base)
        q = base[fact]
        qtype = types[(fact + round_no) % len(types)]  # each pass shifts every fact to a new type
        converted = _CONVERTERS[qtype](dict(q))
        # Cite the page the fact actually comes from (it used to always be the first page).
        page = _find_page(pages, q.get("question", ""))
        if page:
            ref = f"Trang {page}"
            converted["source_ref"] = ref
            expl = converted.get("explanation")
            if expl and not expl.strip().endswith(f"({ref})"):
                converted["explanation"] = f"{expl.strip()} ({ref})"
        questions.append(converted)
        i += 1

    if not with_explanation:
        for q in questions:
            q.pop("explanation", None)
    return {"title": "Đề thi tự động", "questions": questions}
