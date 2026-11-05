import re
import json

from core.agent import LocalAgentConfig, FAST_CAPS, DEFAULT_MODEL, agent_run
from .vietnamese import is_vietnamese

ROADMAP_PROMPT = """
Bạn là một gia sư chuyên nghiệp. Dựa vào nội dung tài liệu học tập sau đây,
hãy tạo một Giáo Án (Roadmap) gồm các bước học tập logic, theo trình tự từ cơ bản đến nâng cao.

Nội dung tài liệu (trích xuất):
{text}

Trả về kết quả DƯỚI DẠNG MẢNG JSON, mỗi phần tử là một object có:
- "title": Tên của bước học tập (ví dụ: "Khái niệm cơ bản")
- "description": Mô tả ngắn gọn những gì cần học trong bước này (ví dụ: "Thuộc phần: Chương 1 - Giới thiệu")

CHỈ TRẢ VỀ JSON hợp lệ, KHÔNG CÓ markdown format, không có code blocks (```json).
"""


def _parse_items(response_text) -> list | None:
    if isinstance(response_text, list):
        items = response_text
    else:
        s = str(response_text).strip()
        if s.startswith("```"):
            s = s.strip("`")
            s = s[s.find("["):] if "[" in s else s
        items = json.loads(s)
    if isinstance(items, dict):  # some models wrap the list: {"steps": [...]}
        items = next((v for v in items.values() if isinstance(v, list)), None)
    if not isinstance(items, list):
        return None
    out = [{"title": str(i.get("title", "")).strip(), "description": str(i.get("description", "")).strip()}
           for i in items if isinstance(i, dict) and i.get("title")]
    return out or None


_HEADING = re.compile(r"(?m)^\s*(\d{1,2}(?:\.\d{1,2}){1,2})\.?\s+([A-ZÀ-Ỹ][^\n]{3,90})$")


def _section_outline(text: str) -> list:
    """Numbered headings ("2.4 Finite Automata", "2.4.1 Nondeterministic …") as
    [(number, title, subsection titles, first sentence)], top level only, document order.
    Lecture slides and textbooks carry their own structure; the roadmap should follow it."""
    from .preprocessor import is_prose
    found = []  # (number, title, end offset)
    for m in _HEADING.finditer(text or ""):
        num, title = m.group(1), re.sub(r"\s+\d+$", "", m.group(2)).strip()  # drop trailing page no.
        if title.endswith((".", ",", ";")) or sum(c.isalpha() for c in title) < 4:
            continue
        found.append((num, title, m.end()))
    if not found:
        return []
    top_depth = min(n.count(".") for n, _, _ in found)
    sections, seen = [], set()
    for i, (num, title, end) in enumerate(found):
        if num.count(".") != top_depth or num in seen:
            continue
        seen.add(num)
        subs = [t for n, t, _ in found[i + 1:] if n.startswith(num + ".")]
        nxt = next((e for n, _, e in found[i + 1:] if n.count(".") == top_depth and n != num), len(text))
        from .preprocessor import clean_text
        body = clean_text(text[end:nxt][:4000])  # re-join wrapped lines before picking a sentence
        first = next((" ".join(x.split()) for x in re.split(r"(?<=[.!?])\s+|\n", body) if is_prose(x, 6)), "")
        sections.append((num, title, list(dict.fromkeys(subs)), first))
    return sections if len(sections) >= 3 else []


def _base_roadmap(text_content: str) -> list:
    """Deterministic roadmap from the document itself. With numbered sections (slides,
    textbooks): overview → one step per section → review. Otherwise: overview → one step per
    key concept → review. Used without an AI engine."""
    vn = is_vietnamese(text_content or "")
    outline = _section_outline(text_content or "")
    if outline:
        def desc(subs, first):
            parts = []
            if subs:
                parts.append(("Gồm: " if vn else "Covers: ") + "; ".join(subs[:4]) + ".")
            if first:
                parts.append(first[:180])
            return " ".join(parts) or ("Đọc kỹ phần này và làm ví dụ." if vn else "Work through this section and its examples.")
        head = ({"title": "Tổng quan tài liệu", "description": "Đọc lướt toàn bộ tài liệu, nắm cấu trúc và mục tiêu chính."} if vn
                else {"title": "Overview", "description": "Skim the whole document; note its structure and main goals."})
        tail = ({"title": "Ôn tập & tự kiểm tra", "description": "Làm quiz/flashcard, tự giải thích lại các khái niệm bằng lời của bạn."} if vn
                else {"title": "Review & self-test", "description": "Take a quiz / flashcards and explain each concept in your own words."})
        return [head] + [{"title": f"{num} {title}", "description": desc(subs, first)} for num, title, subs, first in outline[:10]] + [tail]
    concepts = []
    try:
        from .concept_map import generate_concept_map
        nodes = generate_concept_map(text_content or "").get("nodes", [])
        # Several labels often share one definition sentence ("Photosynthesis" / "The
        # Process"); keep one step per definition, named after the label it opens with.
        by_def, order = {}, []
        for n in nodes:
            label = (n.get("label") or "").strip()
            definition = (n.get("definition") or "").strip()
            if not label:
                continue
            key = definition.lower() or label.lower()
            pos = definition.lower().find(label.lower())
            rank = pos if pos >= 0 else len(definition) + 1
            if key not in by_def:
                order.append(key)
                by_def[key] = (rank, label, definition)
            elif rank < by_def[key][0]:
                by_def[key] = (rank, label, definition)
        concepts = [(by_def[k][1], by_def[k][2]) for k in order]
        # A roadmap follows the document: order steps by first appearance in the text.
        low = (text_content or "").lower()
        concepts.sort(key=lambda c: low.find(c[0].lower()) if c[0].lower() in low else len(low))
    except Exception as e:
        print(f"[roadmap] offline concept extraction failed: {e}")

    if vn:
        steps = [{"title": "Tổng quan tài liệu", "description": "Đọc lướt toàn bộ tài liệu, nắm cấu trúc và mục tiêu chính."}]
        steps += [{"title": f"Tìm hiểu: {label}", "description": (d[:200] if d else f"Nắm vững khái niệm “{label}” và các ví dụ liên quan.")}
                  for label, d in concepts[:6]]
        steps.append({"title": "Ôn tập & tự kiểm tra", "description": "Làm quiz/flashcard, tự giải thích lại các khái niệm bằng lời của bạn."})
    else:
        steps = [{"title": "Overview", "description": "Skim the whole document; note its structure and main goals."}]
        steps += [{"title": f"Study: {label}", "description": (d[:200] if d else f"Understand “{label}” and its examples.")}
                  for label, d in concepts[:6]]
        steps.append({"title": "Review & self-test", "description": "Take a quiz / flashcards and explain each concept in your own words."})
    return steps


def _tokens(s: str) -> set:
    from .preprocessor import is_prose  # noqa: F401  (keeps import side effects identical)
    stop = {"chapter", "chương", "chuong", "phần", "part", "bài", "and", "the", "of", "for", "với", "và", "các", "của"}
    return {w for w in re.findall(r"[a-zà-ỹ0-9]{3,}", s.lower()) if w not in stop and not w.isdigit()}


def _syllabus_lines(syllabus: str) -> list[str]:
    out = []
    for line in (syllabus or "").splitlines():
        line = re.sub(r"^\s*(?:[-*•]|\d+[.)])\s+", "", line.strip(), flags=re.I).strip()
        if len(line) >= 3:
            out.append(line[:120])
    return out[:20]


def _from_syllabus(text_content: str, syllabus: list[str], vn: bool) -> list:
    """One step per syllabus topic, described from the uploaded material that covers it;
    topics no source covers are flagged so the learner knows what to upload or search."""
    outline = _section_outline(text_content or "")
    sections = [(f"{n} {t}", subs, first) for n, t, subs, first in outline]
    low = (text_content or "").lower()
    steps = []
    for i, topic in enumerate(syllabus, 1):
        tk = _tokens(topic)
        best, best_score = None, 0.0
        for title, subs, first in sections:
            st = _tokens(title + " " + " ".join(subs))
            score = len(tk & st) / max(1, len(tk))
            if score > best_score:
                best, best_score = (title, subs, first), score
        covered_in_text = tk and sum(1 for w in tk if w in low) / len(tk) >= 0.6
        if best and best_score >= 0.5:
            title, subs, first = best
            desc = (("Gồm: " if vn else "Covers: ") + "; ".join(subs[:4]) + ". " if subs else "") + (first[:160] if first else "")
            steps.append({"title": topic, "description": desc.strip() or title, "needs_material": 0})
        elif covered_in_text:
            steps.append({"title": topic, "description": ("Có trong tài liệu đã tải — đọc phần liên quan và làm ví dụ." if vn
                                                       else "Covered in your sources — read the related part and work the examples."),
                          "needs_material": 0})
        else:
            steps.append({"title": topic, "description": ("Chưa có tài liệu cho phần này — hãy tải thêm tài liệu hoặc dùng Tìm tài liệu."
                                                       if vn else "No uploaded source covers this yet — upload material or use Search."),
                          "needs_material": 1})
    return steps


def apply_extra(steps: list, extra: dict | None, vn: bool) -> list:
    """Goal, deadline and weekly time from the learner's answers → dated, timed steps."""
    import datetime as dt
    extra = extra or {}
    steps = [dict(s) for s in steps]
    goal = (extra.get("goal") or "").lower()
    if "thi" in goal or "exam" in goal:
        mock = ({"title": "Làm đề thi thử", "description": "Làm một đề thi thử có bấm giờ, chấm điểm và ôn lại các câu sai."} if vn
                else {"title": "Mock exam", "description": "Take a timed practice exam, mark it and revisit every mistake."})
        insert_at = len(steps) - 1 if steps and steps[-1]["title"].startswith(("Ôn tập", "Review")) else len(steps)
        steps.insert(insert_at, mock)
    level = (extra.get("level") or "").lower()
    if steps and ("mới" in level or "begin" in level):
        steps[0]["description"] = (steps[0].get("description", "") + (" Bắt đầu từ các định nghĩa cơ bản, đừng bỏ qua ví dụ." if vn
                                   else " Start from the basic definitions; do not skip the examples.")).strip()

    today = dt.date.today()
    deadline = None
    try:
        if extra.get("deadline"):
            deadline = dt.date.fromisoformat(str(extra["deadline"])[:10])
    except ValueError:
        deadline = None
    try:
        hours = float(extra.get("hours_per_week") or 0)
    except (TypeError, ValueError):
        hours = 0
    n = len(steps)
    if deadline and deadline > today and n:
        span = (deadline - today).days
        for i, st in enumerate(steps):
            # Evenly spread; the last step (review) lands on the day before the exam.
            day = today + dt.timedelta(days=max(0, round((i + 1) * (span - 1) / n)))
            st["due_date"] = day.isoformat()
        if hours > 0:
            total = hours * max(1.0, span / 7)
            per = max(0.5, round(total / n * 2) / 2)
            for st in steps:
                st["estimated_time"] = f"{per:g} giờ" if vn else f"{per:g} h"
    elif hours > 0 and n:
        for st in steps:
            st["estimated_time"] = (f"{max(1, round(hours / 2))} giờ" if vn else f"{max(1, round(hours / 2))} h")
    return steps


def offline_roadmap(text_content: str, extra: dict | None = None) -> list:
    """Roadmap without an AI engine. With a course outline from the learner, one step per
    outline topic (flagging topics no source covers); otherwise the document's own structure.
    Goal / deadline / weekly time then date and size the steps."""
    vn = is_vietnamese(text_content or "") or is_vietnamese((extra or {}).get("syllabus", "") or "")
    syllabus = _syllabus_lines((extra or {}).get("syllabus", ""))
    if syllabus:
        head = ({"title": "Tổng quan môn học", "description": "Đọc đề cương, nắm mục tiêu từng chương và cách đánh giá."} if vn
                else {"title": "Course overview", "description": "Read the outline; note each chapter's goals and how you are assessed."})
        tail = ({"title": "Ôn tập & tự kiểm tra", "description": "Làm quiz/flashcard, tự giải thích lại các khái niệm bằng lời của bạn."} if vn
                else {"title": "Review & self-test", "description": "Take a quiz / flashcards and explain each concept in your own words."})
        steps = [head] + _from_syllabus(text_content, syllabus, vn) + [tail]
    else:
        steps = _base_roadmap(text_content)
    return apply_extra(steps, extra, vn)


def _extra_prompt(extra: dict | None) -> str:
    if not extra:
        return ""
    labels = {"subject": "Môn học", "goal": "Mục tiêu", "deadline": "Hạn / ngày thi", "hours_per_week": "Giờ học mỗi tuần",
              "level": "Trình độ", "syllabus": "Đề cương môn học"}
    lines = [f"- {labels[k]}: {extra[k]}" for k in labels if str(extra.get(k) or "").strip()]
    if not lines:
        return ""
    return ("\nThông tin người học cung cấp:\n" + "\n".join(lines) +
            "\nNếu có đề cương, mỗi chương là một bước theo đúng thứ tự; chương nào tài liệu chưa có thì ghi rõ "
            "\"Chưa có tài liệu\" trong mô tả. Nếu có mục tiêu thi, thêm bước làm đề thi thử trước bước ôn tập.\n")


async def generate_roadmap(text_content: str, api_key: str | None = None, extra: dict | None = None) -> list:
    """Study roadmap: [{"title", "description", "due_date"?, "estimated_time"?, "needs_material"?}].

    `api_key` must already be resolved with core.agent.get_api_key (None = offline engine)."""
    if api_key:
        try:
            config = LocalAgentConfig(api_key=api_key, model=DEFAULT_MODEL, capabilities=FAST_CAPS)
            prompt = ROADMAP_PROMPT.format(text=text_content[:10000]) + _extra_prompt(extra)
            response = await agent_run(config, prompt, structured=False, timeout=40)
            items = _parse_items(response)
            if items:
                vn = is_vietnamese(text_content or "")
                for it in items:
                    it["needs_material"] = 1 if "chưa có tài liệu" in it["description"].lower() else 0
                return apply_extra(items, {k: v for k, v in (extra or {}).items() if k != "goal"}, vn)
        except Exception as e:
            print(f"[roadmap] AI failed, falling back to offline: {e}")
    return offline_roadmap(text_content, extra)
