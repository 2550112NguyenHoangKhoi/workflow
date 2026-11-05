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


def offline_roadmap(text_content: str) -> list:
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


async def generate_roadmap(text_content: str, api_key: str | None = None) -> list:
    """Study roadmap for a document: [{"title", "description"}, ...].

    `api_key` must already be resolved with core.agent.get_api_key (None = offline engine)."""
    if api_key:
        try:
            config = LocalAgentConfig(api_key=api_key, model=DEFAULT_MODEL, capabilities=FAST_CAPS)
            response = await agent_run(config, ROADMAP_PROMPT.format(text=text_content[:10000]),
                                       structured=False, timeout=40)
            items = _parse_items(response)
            if items:
                return items
        except Exception as e:
            print(f"[roadmap] AI failed, falling back to offline: {e}")
    return offline_roadmap(text_content)
