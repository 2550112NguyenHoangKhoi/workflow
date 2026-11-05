"""Is there enough material to plan a whole subject?

A roadmap is a plan for a *subject*. Built from one short handout or a single chapter, it
used to look complete while silently covering a fraction of the course. `assess()` measures
what the sources cover and, when it is not enough, returns the questions the app asks the
learner instead of producing a roadmap (subject, goal, exam date, weekly time, level, the
course outline). Their answers are passed back as `extra` and shape the roadmap.
"""
import re

MIN_WORDS = 400
MIN_TOPICS = 3

_CHAPTER = re.compile(
    r"(?im)^\s*(?:chapter|chương|chuong|lecture|unit|bài giảng|part|phần)\s+(\d{1,2}|[IVXLC]{1,6})\b")
_NUMBERED = re.compile(r"(?m)^\s*(\d{1,2})\.(\d{1,2})(?:\.\d{1,2})?\.?\s+[A-ZÀ-Ỹ]")

_ROMAN = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100}


def _roman(s: str) -> int:
    total, prev = 0, 0
    for ch in reversed(s.upper()):
        v = _ROMAN.get(ch, 0)
        total = total - v if v < prev else total + v
        prev = max(prev, v)
    return total


def chapters_in(text: str) -> list[int]:
    """Chapter numbers a text declares: explicit "Chapter 2" / "Chương 3" markers plus the
    major number of numbered headings ("2.1 Overview", "2.4.1 …")."""
    found = set()
    for m in _CHAPTER.finditer(text or ""):
        line = (text[m.start():text.find("\n", m.end()) if "\n" in text[m.end():] else len(text)]).strip()
        rest = text[m.end():m.end() + 2]
        # Headings only: references ("Chapter 1,2,4 [2nd ed., Cambridge…]", "Chapter 15 Third
        # Edition, Springer (2012)") also start a line in slide decks.
        if (len(line) > 70 or re.match(r"\s*[,&]\s*\d", rest)
                or re.search(r"(?i)\b(ed\.|edition|press|verlag|publisher|nxb)\b|\b(19|20)\d\d\b", line)):
            continue
        tok = m.group(1)
        found.add(int(tok) if tok.isdigit() else _roman(tok))
    majors = {}
    for m in _NUMBERED.finditer(text or ""):
        majors[int(m.group(1))] = majors.get(int(m.group(1)), 0) + 1
    # A major number counts once it heads ≥ 2 numbered sections (one stray "1.5 kg" is noise).
    found |= {n for n, c in majors.items() if c >= 2}
    return sorted(n for n in found if 0 < n < 100)


def _topics(text: str) -> int:
    from .roadmap import _section_outline
    outline = _section_outline(text or "")
    if outline:
        return len(outline)
    try:
        from .concept_map import generate_concept_map
        return len(generate_concept_map((text or "")[:60000]).get("nodes", []))
    except Exception:
        return 0


def _has_extra(extra: dict | None) -> bool:
    return bool(extra) and any(str(v).strip() for k, v in extra.items() if k != "force" and v not in (None, ""))


def questions(subject_hint: str = "", important: set | None = None) -> list[dict]:
    important = important or set()
    q = [
        {"id": "subject", "label": "Môn học / chủ đề cần lập lộ trình", "type": "text",
         "placeholder": "VD: Lý thuyết Automata, Giải tích 1…", "default": subject_hint},
        {"id": "goal", "label": "Mục tiêu", "type": "select",
         "options": ["Thi cuối kỳ", "Thi giữa kỳ", "Nắm vững kiến thức nền", "Ôn một chương cụ thể", "Tự học / dự án"]},
        {"id": "deadline", "label": "Ngày thi / hạn hoàn thành", "type": "date"},
        {"id": "hours_per_week", "label": "Số giờ học mỗi tuần", "type": "number", "default": 6},
        {"id": "level", "label": "Trình độ hiện tại", "type": "select",
         "options": ["Mới bắt đầu", "Đã học qua, cần ôn", "Khá vững, muốn nâng cao"]},
        {"id": "syllabus", "label": "Đề cương môn học (mỗi dòng một chương / chủ đề)", "type": "textarea",
         "placeholder": "Chương 1. Tập hợp và ngôn ngữ\nChương 2. Automata hữu hạn\nChương 3. Biểu thức chính quy\n…"},
    ]
    for item in q:
        item["important"] = item["id"] in important
    return q


def assess(text: str, *, subject: str = "", n_docs: int = 1, extra: dict | None = None) -> dict:
    """{"sufficient", "scope", "reasons": [{code, message}], "questions", "stats"}.

    scope: "subject" (several chapters or documents), "chapter" (one chapter of a larger
    course) or "document" (one document, no chapter structure)."""
    text = text or ""
    words = len(re.findall(r"\w+", text))
    chapters = chapters_in(text)
    topics = _topics(text) if words >= 60 else 0
    if len(chapters) >= 2 or n_docs >= 3:
        scope = "subject"
    elif len(chapters) == 1:
        scope = "chapter"
    else:
        scope = "document"

    reasons, important = [], set()
    if words < MIN_WORDS:
        reasons.append({"code": "too_short", "message": (
            f"Tài liệu chỉ có khoảng {words} từ — quá ít để chia thành một lộ trình học có ý nghĩa.")})
        important |= {"syllabus", "subject"}
    if topics < MIN_TOPICS and words >= 60:
        reasons.append({"code": "few_topics", "message": (
            f"Chỉ tìm thấy {topics} chủ đề/khái niệm chính — chưa đủ để sắp xếp các bước học.")})
        important |= {"syllabus"}
    if scope == "chapter" and n_docs <= 1:
        reasons.append({"code": "single_chapter", "message": (
            f"Tài liệu chỉ là Chương {chapters[0]} của môn học. Một lộ trình cho cả môn cần các chương "
            "còn lại hoặc đề cương môn — nếu bạn chỉ muốn học chương này, hãy cho biết mục tiêu và hạn thi.")})
        important |= {"syllabus", "goal", "deadline"}
    if subject.strip():
        keys = [w for w in re.findall(r"\w{4,}", subject.lower())]
        low = text.lower()
        if keys and not any(k in low for k in keys):
            reasons.append({"code": "off_subject", "message": (
                f"Không thấy nội dung về “{subject.strip()}” trong tài liệu đã tải lên.")})
            important |= {"subject", "syllabus"}

    answered = _has_extra(extra)
    forced = bool((extra or {}).get("force"))
    # Answers (or "use what I have") unblock generation; the reasons stay as caveats. Nothing
    # can be planned from a near-empty source without at least an outline or an AI engine.
    sufficient = not reasons or forced or (answered and (words >= 80 or bool((extra or {}).get("syllabus", "").strip())))
    return {
        "sufficient": sufficient,
        "scope": scope,
        "reasons": reasons,
        "questions": questions(subject, important),
        "stats": {"words": words, "topics": topics, "chapters": chapters, "documents": n_docs},
    }
