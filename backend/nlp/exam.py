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


def extract_exam(text: str, num_questions: int = 10, types=None, with_explanation: bool = True):
    import re
    types = [t for t in (types or []) if t in _CONVERTERS] or ["mcq"]

    source_ref = None
    try:
        match = re.search(r"\[Trang (\d+)\]", text)
        n = match.group(1) if match else "1"
        source_ref = f"Trang {n}"
        text = re.sub(r"^\[Trang \d+\]\s*\n?", "", text, flags=re.MULTILINE)
    except Exception:
        pass

    base = extract_quiz(text, num_questions=num_questions)
    questions = []
    for i, q in enumerate(base.get("questions", [])[:num_questions]):
        converted = _CONVERTERS[types[i % len(types)]](dict(q))
        if source_ref:
            try:
                converted["source_ref"] = source_ref
                expl = converted.get("explanation")
                if expl and not expl.strip().endswith(f"({source_ref})"):
                    converted["explanation"] = f"{expl.strip()} ({source_ref})"
            except Exception:
                pass
        questions.append(converted)

    if not with_explanation:
        for q in questions:
            q.pop("explanation", None)
    return {"title": base.get("title", "Đề thi tự động"), "questions": questions}
