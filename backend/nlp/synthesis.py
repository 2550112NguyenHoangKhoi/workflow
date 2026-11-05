"""AI Tổng hợp — combine one or more sources into a study document (offline engine).

Formats (the learner picks one):
- outline: hierarchical outline (# document → ## section → bullets with the key sentence and
  concept definitions) ending with "Tổng kết".
- notes:   a complete lesson — objectives, explained sections, important caveats, summary and
  review questions.
- table:   a comparison table — across documents (several sources) or across the key concepts
  of one source.
- custom:  the learner's own request, answered from the sources.

Everything is Markdown (LaTeX passes through untouched) so the UI can render, copy and print it.
"""
import re

from .mindmap import _sections, _doc_title, _concepts, _definition, _first_prose
from .preprocessor import is_prose, clean_text
from .vietnamese import is_vietnamese

FORMATS = ("outline", "notes", "table", "custom")


def _sentences(text: str) -> list[str]:
    body = clean_text(text or "")
    return [" ".join(s.split()) for s in re.split(r"(?<=[.!?])\s+|\n", body) if is_prose(" ".join(s.split()), 6)]


def _ranked(text: str, n: int) -> list[str]:
    try:
        from .notes import extract_notes
        notes = extract_notes(text[:80000])
        pts = [notes.get("summary", "")] + [b for sec in notes.get("sections", []) for b in sec.get("bullet_points", [])]
        out = []
        for p in pts:
            for s in re.split(r"(?<=[.!?])\s+", p or ""):
                s = s.strip()
                if s and s not in out and is_prose(s, 6) and not s.endswith("?"):
                    out.append(s)
        return out[:n]
    except Exception:
        return _sentences(text)[:n]


def _parts(text: str):
    """[(heading, body)] — numbered sections, or the whole text as one part."""
    secs = _sections(text)
    if secs:
        return [(f"{num} {title}", body) for num, title, body, _ in secs[:12]]
    return [("", text)]


_CAVEAT = re.compile(r"(?i)\b(not|never|must|only if|note that|however|careful|common mistake|"
                     r"không|chú ý|lưu ý|cần|phải|tránh|nhầm)\b")
_EXAMPLE = re.compile(r"(?i)\b(for example|for instance|e\.g\.|example|ví dụ|chẳng hạn)\b")
_FORMULA = re.compile(r"[=≤≥→∈∪∩∀∃⇒]|\$[^$]+\$")


def outline(sources: list[dict], vn: bool) -> str:
    md = []
    for src in sources:
        md.append(f"# {_doc_title(src['text'], src.get('title', ''))}")
        for heading, body in _parts(src["text"]):
            if heading:
                md.append(f"## {heading}")
            lead = _first_prose(body)
            if lead:
                md.append(f"- {lead}")
            for c in _concepts(body, 4, exclude=heading):
                d = _definition(c, body)
                md.append(f"  - **{c}**" + (f": {d}" if d and d != lead else ""))
        md.append("")
    key = _ranked("\n\n".join(s["text"] for s in sources), 6)
    md.append("## Tổng kết" if vn else "## Summary")
    md += [f"- {k}" for k in key]
    return "\n".join(md)


def notes(sources: list[dict], vn: bool) -> str:
    text = "\n\n".join(s["text"] for s in sources)
    title = _doc_title(sources[0]["text"], sources[0].get("title", "")) if len(sources) == 1 else ("Bài học tổng hợp" if vn else "Combined lesson")
    parts = [p for src in sources for p in _parts(src["text"])]
    md = [f"# {title}", "", "## Mục tiêu học tập" if vn else "## Learning objectives"]
    raw_heads = [h for h, _ in parts if h][:5] or _concepts(text, 8)
    heads, seen = [], set()
    for h in raw_heads:  # "automata" / "automaton" are one objective
        key = h.lower()[:6]
        if key not in seen:
            seen.add(key)
            heads.append(h)
    heads = heads[:5]
    md += [("- Hiểu và trình bày được: " if vn else "- Understand and explain: ") + h.split(" ", 1)[-1] for h in heads]
    md.append("")
    for heading, body in parts:
        md.append(f"## {heading or ('Nội dung chính' if vn else 'Main content')}")
        for s in _ranked(body, 3):
            md.append(s)
            md.append("")
        ex = next((s for s in _sentences(body) if _EXAMPLE.search(s)), "")
        if ex:
            md.append(("> **Ví dụ:** " if vn else "> **Example:** ") + ex)
            md.append("")
        formulas = [l.strip() for l in body.split("\n") if _FORMULA.search(l) and 8 <= len(l.strip()) <= 120
                    and len(l.split()) <= 14 and not l.strip().endswith("?")][:2]
        if formulas:
            md += [f"- `{f}`" for f in formulas]
            md.append("")
    caveats = [s for s in _sentences(text) if _CAVEAT.search(s)][:5]
    if caveats:
        md.append("## Lưu ý quan trọng" if vn else "## Important notes")
        md += [f"- {c}" for c in caveats]
        md.append("")
    md.append("## Tóm tắt" if vn else "## Summary")
    md += [f"- {k}" for k in _ranked(text, 6)]
    md.append("")
    md.append("## Câu hỏi ôn tập" if vn else "## Review questions")
    qs = [(f"{c} là gì? Cho một ví dụ." if vn else f"What is {c}? Give an example.") for c in _concepts(text, 4)]
    qs += [(f"Trình bày ý chính của phần “{h}”." if vn else f"Summarise the main idea of “{h}”.") for h in heads[:3]]
    md += [f"{i}. {q}" for i, q in enumerate(qs, 1)]
    return "\n".join(md)


def _cell(s: str, n: int = 160) -> str:
    s = (s or "—").replace("|", "\\|").replace("\n", " ")
    return s if len(s) <= n else s[:n - 1] + "…"


def table(sources: list[dict], vn: bool) -> str:
    if len(sources) >= 2:
        cols = [_doc_title(s["text"], s.get("title", "")) for s in sources]
        rows = []
        crit = (["Chủ đề chính", "Ý trọng tâm", "Khái niệm chính", "Công thức / ký hiệu", "Ví dụ", "Độ dài"] if vn
                else ["Main topics", "Core idea", "Key concepts", "Formulas / notation", "Example", "Length"])
        vals = []
        for s in sources:
            parts = [h for h, _ in _parts(s["text"]) if h]
            formula = next((l.strip() for l in s["text"].split("\n") if _FORMULA.search(l) and 8 <= len(l.strip()) <= 90), "")
            example = next((x for x in _sentences(s["text"]) if _EXAMPLE.search(x)), "")
            n_words = len(re.findall(r"\w+", s["text"]))
            core = (_ranked(s["text"], 1) or [_first_prose(s["text"])])[0]
            vals.append(["; ".join(p.split(" ", 1)[-1] for p in parts[:4]) or "—", core,
                         ", ".join(_concepts(s["text"], 5)), formula, example,
                         f"{n_words} {'từ' if vn else 'words'}"])
        for i, c in enumerate(crit):
            rows.append(f"| **{c}** | " + " | ".join(_cell(v[i]) for v in vals) + " |")
        shared = set(x.lower() for x in _concepts(sources[0]["text"], 15))
        for s in sources[1:]:
            shared &= set(x.lower() for x in _concepts(s["text"], 15))
        head = f"| {'Tiêu chí' if vn else 'Criterion'} | " + " | ".join(_cell(c, 60) for c in cols) + " |"
        md = [head, "|" + "---|" * (len(cols) + 1), *rows, ""]
        md.append("## Nhận xét" if vn else "## Comparison notes")
        md.append(("- Khái niệm chung: " if vn else "- Shared concepts: ") + (", ".join(sorted(shared)) or "—"))
        md.append(("- Mỗi tài liệu tập trung vào: " if vn else "- Each source focuses on: ") +
                  "; ".join(f"{c} → {v[2].split(', ')[0] if v[2] else '—'}" for c, v in zip(cols, vals)))
        return "\n".join(md)
    # One source: compare its key concepts.
    text = sources[0]["text"]
    parts = _parts(text)
    concepts = _concepts(text, 10)
    head = ("| Khái niệm | Định nghĩa trong tài liệu | Xuất hiện ở phần | Ví dụ |" if vn
            else "| Concept | Definition in the source | Appears in | Example |")
    md = [head, "|---|---|---|---|"]
    for c in concepts:
        where = [h.split(" ", 1)[0] for h, body in parts if h and c.lower() in body.lower()]
        ex = next((x for x in _sentences(text) if c.lower() in x.lower() and _EXAMPLE.search(x)), "")
        md.append(f"| **{_cell(c, 40)}** | {_cell(_definition(c, text))} | {_cell(', '.join(where[:4]), 40)} | {_cell(ex, 120)} |")
    return "\n".join(md)


def custom(sources: list[dict], instruction: str, vn: bool) -> str:
    """Offline: the most relevant passages for the request, grouped by source."""
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    md = [f"# {instruction.strip()[:120]}", ""]
    for src in sources:
        sents = _sentences(src["text"])
        if not sents:
            continue
        m = TfidfVectorizer(sublinear_tf=True).fit_transform(sents + [instruction])
        sims = cosine_similarity(m[-1], m[:-1]).ravel()
        best = [sents[i] for i in sorted(sims.argsort()[::-1][:6]) if sims[i] > 0.05]
        if best:
            md.append(f"## {_doc_title(src['text'], src.get('title', ''))}")
            md += [f"- {b}" for b in best]
            md.append("")
    if len(md) <= 2:
        md.append("Không tìm thấy nội dung phù hợp với yêu cầu trong tài liệu." if vn else "Nothing in the sources matches this request.")
    return "\n".join(md)


def synthesize(sources: list[dict], fmt: str = "outline", instruction: str = "") -> dict:
    sources = [s for s in sources if (s.get("text") or "").strip()]
    if not sources:
        return {"title": "", "markdown": ""}
    vn = is_vietnamese(" ".join(s["text"][:3000] for s in sources))
    fmt = fmt if fmt in FORMATS else "outline"
    if fmt == "custom" and instruction.strip():
        md = custom(sources, instruction, vn)
    elif fmt == "notes":
        md = notes(sources, vn)
    elif fmt == "table":
        md = table(sources, vn)
    else:
        md = outline(sources, vn)
    labels = {"outline": "Đề cương", "notes": "Bài học", "table": "Bảng so sánh", "custom": "Tổng hợp"}
    title = f"{labels[fmt]} · " + (_doc_title(sources[0]["text"], sources[0].get("title", "")) if len(sources) == 1 else f"{len(sources)} tài liệu")
    return {"title": title, "markdown": md}
