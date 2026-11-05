"""Offline grading of a short essay answer against a rubric.

Default rubric (exam essays, review sets): the main ideas of the source, explained in the
learner's own words, with a concrete example. Each criterion is scored from text evidence:
- main ideas: share of the reference answer's key terms present in the answer;
- own words:  little verbatim copying (long n-grams shared with the reference) and enough length;
- example:    an example marker, numbers or a specific case.
"""
import re

DEFAULT_RUBRIC = [
    "Nêu đúng các ý chính của tài liệu.",
    "Diễn đạt bằng lời của mình.",
    "Có ví dụ hoặc dẫn chứng cụ thể.",
]

_EXAMPLE = re.compile(r"(?i)\b(for example|for instance|e\.g\.|such as|example|ví dụ|chẳng hạn|như là|cụ thể)\b|\d")
_STOP = set("""a an the of to in on for and or is are was were be been with by as at from that this these those it its
có của và là các những một được cho trong khi với để này đó thì mà như về""".split())


def _words(s: str) -> list[str]:
    return re.findall(r"[^\W_]+", (s or "").lower())


def _key_terms(reference: str, question: str) -> list[str]:
    # The reference alone: exam questions carry a Vietnamese prefix ("Trình bày và giải
    # thích: …") that would switch an English source to the Vietnamese keyword path.
    src = reference or re.sub(r'^[^:"“]*[:"“]\s*', "", question)
    try:
        from .teachback import _key_concepts
        terms = [t for t in _key_concepts(src, n=6) if t.lower() not in _STOP]
    except Exception:
        terms = []
    words = [w for w in _words(reference) if len(w) > 3 and w not in _STOP]
    from collections import Counter
    terms += [w for w, _ in Counter(words).most_common(8) if not any(w in t.lower() for t in terms)]
    return list(dict.fromkeys(terms))[:10]


def _present(term: str, answer_words: set, answer: str) -> bool:
    toks = _words(term)
    stem = lambda w: w[:-1] if w.endswith("s") and len(w) > 4 else w
    aw = {stem(w) for w in answer_words}
    return all(stem(t) in aw for t in toks) or term.lower() in answer.lower()


def grade_essay(question: str, answer: str, reference: str = "", rubric: list[str] | None = None) -> dict:
    rubric = [r for r in (rubric or []) if r.strip()] or DEFAULT_RUBRIC
    answer = (answer or "").strip()
    words = _words(answer)
    if len(words) < 5:
        return {"score": 0, "grade": "F", "feedback": "Bài làm quá ngắn để chấm — hãy viết ít nhất vài câu.",
                "suggestions": ["Trình bày ý chính trước, sau đó giải thích và cho ví dụ."],
                "criteria": [{"criterion": r, "met": False, "note": ""} for r in rubric]}
    ref = reference or question
    terms = _key_terms(ref, question)
    aw = set(words)
    hit = [t for t in terms if _present(t, aw, answer)]
    coverage = len(hit) / max(1, len(terms))

    rw = _words(ref)
    grams = lambda ws, n: {" ".join(ws[i:i + n]) for i in range(len(ws) - n + 1)}
    copied = len(grams(words, 6) & grams(rw, 6)) / max(1, len(grams(words, 6)))
    own = max(0.0, 1 - copied * 1.5) * min(1.0, len(words) / 40)
    example = 1.0 if _EXAMPLE.search(answer) else 0.0
    length_ok = min(1.0, len(words) / 60)

    score = round(55 * coverage + 20 * own + 15 * example + 10 * length_ok)
    grade = "A" if score >= 85 else "B" if score >= 70 else "C" if score >= 55 else "D" if score >= 40 else "F"
    missing = [t for t in terms if t not in hit][:4]
    crit_scores = [coverage >= 0.6, own >= 0.6, example >= 1.0]
    criteria = []
    for i, r in enumerate(rubric):
        met = crit_scores[i] if i < len(crit_scores) else coverage >= 0.6
        note = ""
        if i == 0:
            note = f"Đã nêu {len(hit)}/{len(terms)} ý/thuật ngữ chính" + (f"; còn thiếu: {', '.join(missing)}." if missing else ".")
        elif i == 1:
            note = "Chép nguyên văn nhiều từ tài liệu." if copied > 0.4 else ("Bài hơi ngắn." if len(words) < 40 else "Diễn đạt bằng lời của bạn.")
        elif i == 2:
            note = "Có ví dụ/dẫn chứng." if example else "Chưa có ví dụ cụ thể."
        criteria.append({"criterion": r, "met": bool(met), "note": note})
    suggestions = []
    if missing:
        suggestions.append("Bổ sung các ý: " + ", ".join(missing) + ".")
    if copied > 0.4:
        suggestions.append("Viết lại bằng câu của bạn thay vì chép tài liệu.")
    if not example:
        suggestions.append("Thêm một ví dụ cụ thể minh hoạ cho ý chính.")
    if len(words) < 40:
        suggestions.append("Giải thích kỹ hơn (ít nhất 3–4 câu).")
    feedback = ("Bài làm tốt, bao quát gần hết ý chính." if score >= 85 else
                "Bài làm khá, cần bổ sung vài ý." if score >= 70 else
                "Bài làm đạt một phần ý chính." if score >= 55 else
                "Bài làm còn thiếu nhiều ý chính so với tài liệu.")
    return {"score": score, "grade": grade, "feedback": feedback, "suggestions": suggestions, "criteria": criteria}
