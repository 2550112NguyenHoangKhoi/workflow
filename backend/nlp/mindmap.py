"""Mind maps (sơ đồ tư duy), offline.

Two shapes, chosen from what the sources cover:
- **document**: one document (one PDF, one chapter) → the document at the centre, its sections
  as branches, subsections and key concepts as leaves.
- **subject**: the whole subject (several documents, or one book with several chapters) → the
  subject at the centre, one branch per topic/chapter, their sections below, and cross-links
  between topics that share concepts ("mind map between all the topics").

Output (flat, so the UI can lay it out and collapse branches):
  {"mode", "title", "nodes": [{id, label, parent, kind, depth, definition, page?, doc_id?}],
   "links": [{source, target, label}], "hint"?}
"""
import re

from .roadmap import _HEADING

MAX_SECTIONS = 10
MAX_TOPICS = 12


def _clean_title(name: str) -> str:
    name = re.sub(r"\.(pdf|docx?|txt|md|pptx?)$", "", name or "", flags=re.I)
    name = re.sub(r"^[0-9a-f]{6,}-", "", name)  # upload prefixes
    return re.sub(r"[_]+", " ", name).strip() or "Tài liệu"


def _doc_title(text: str, fallback: str) -> str:
    """The title printed on the first page ("AUTOMATA THEORY- For Mathematical Modeling"),
    else the cleaned file name. Upload names are often "Slide_Automatnew.pdf"."""
    lines = [l.strip(" -–:") for l in (text or "")[:600].split("\n") if l.strip()]
    for i, line in enumerate(lines[:8]):
        letters = [c for c in line if c.isalpha()]
        if len(letters) < 6 or len(line) > 70 or re.match(r"(?i)(chapter|chương|lecture|bài)\s+\d", line):
            continue
        if sum(c.isupper() for c in letters) / len(letters) > 0.8:
            title = line.title() if line.isupper() else line
            nxt = lines[i + 1] if i + 1 < len(lines) else ""
            if nxt and len(nxt) < 50 and re.match(r"(?i)(for|of|in|với|cho|trong)\b", nxt):
                title += " " + nxt
            return title
    return _clean_title(fallback)


def _first_prose(text: str, min_words: int = 6) -> str:
    from .preprocessor import clean_text, is_prose
    body = clean_text((text or "")[:5000])
    for s in re.split(r"(?<=[.!?])\s+|\n", body):
        s = " ".join(s.split())
        if is_prose(s, min_words):
            return s[:220]
    return ""


def _headings(text: str):
    """[(number, title, start, end_of_heading_line)] for numbered headings, document order."""
    out, seen = [], set()
    for m in _HEADING.finditer(text or ""):
        num, title = m.group(1), re.sub(r"\s+\d+$", "", m.group(2)).strip()
        if title.endswith((".", ",", ";")) or sum(c.isalpha() for c in title) < 4:
            continue
        if num in seen:  # running headers repeat a section title on every slide
            continue
        seen.add(num)
        out.append((num, title, m.start(), m.end()))
    return out


def _sections(text: str):
    """Top-level numbered sections with their text span and direct subsections:
    [(number, title, body, [(sub_number, sub_title)])]. [] when the text has no structure."""
    hs = _headings(text)
    if not hs:
        return []
    top = min(n.count(".") for n, *_ in hs)
    tops = [h for h in hs if h[0].count(".") == top]
    if len(tops) < 2:
        return []
    out = []
    for i, (num, title, start, end) in enumerate(tops):
        nxt = tops[i + 1][2] if i + 1 < len(tops) else len(text)
        subs = [(n, t) for n, t, s, _ in hs if n.startswith(num + ".") and n.count(".") == top + 1 and start < s < nxt]
        out.append((num, title, text[end:nxt], subs))
    return out


def _concepts(text: str, n: int, exclude: str = "") -> list[str]:
    from .teachback import _key_concepts
    try:
        out = _key_concepts(text, n=n + 3, exclude=exclude)
    except Exception:
        return []
    vague = re.compile(r"(?i)^(following|above|below|given|same|other|such|certain|previous|next|"
                       r"sau|trên|dưới|này|đó)\b")
    # "dfa md": a word plus a 1–2 letter variable name is notation, not a concept.
    return [c for c in out if not vague.match(c) and not re.search(r"\b\w{1,2}$", c.split(" ", 1)[-1] if " " in c else "")][:n]


_norm = lambda s: re.sub(r"\W+", "", s or "").lower()
_SKIP = {}  # id(pages) → page indexes that are a table of contents


def _page_of(pages: list[str] | None, needle: str, start: int = 1) -> int | None:
    if not pages or not needle:
        return None
    key = _norm(needle)[:40]
    if len(key) < 6:
        return None
    skip = _SKIP.get(id(pages), set())
    for i, p in enumerate(pages):
        if i + 1 >= (start or 1) and i not in skip and key in _norm(p):
            return i + 1
    return None


def _mark_toc(pages, titles):
    """Pages naming ≥ 3 of the section titles are a contents/outline slide: cite the section's
    own page instead."""
    if not pages:
        return
    keys = [_norm(t)[:40] for t in titles if len(_norm(t)) >= 6]
    _SKIP[id(pages)] = {i for i, p in enumerate(pages) if sum(k in _norm(p) for k in keys) >= 3}


def _chapters_of(text: str):
    """Split one long source into chapters by the major heading number ("1.x", "2.x", …)."""
    hs = _headings(text)
    majors = []
    for num, title, start, _ in hs:
        major = num.split(".")[0]
        if not majors or majors[-1][0] != major:
            if any(m[0] == major for m in majors):
                continue
            majors.append((major, title, start))
    if len(majors) < 2:
        return []
    out = []
    for i, (major, first_title, start) in enumerate(majors):
        end = majors[i + 1][2] if i + 1 < len(majors) else len(text)
        out.append((major, first_title, text[start:end]))
    return out


class _Builder:
    def __init__(self):
        self.nodes, self.links, self._n = [], [], 0

    def add(self, label, parent=None, kind="concept", definition="", **extra):
        self._n += 1
        nid = "root" if parent is None else f"n{self._n}"
        depth = 0 if parent is None else next(n["depth"] for n in self.nodes if n["id"] == parent) + 1
        node = {"id": nid, "label": label.strip()[:90], "parent": parent, "kind": kind, "depth": depth,
                "definition": (definition or "").strip()}
        node.update({k: v for k, v in extra.items() if v is not None})
        self.nodes.append(node)
        return nid


def _branch_document(b: _Builder, parent: str, text: str, pages=None, doc_id=None, max_sections=MAX_SECTIONS,
                     leaf_concepts=3):
    """Sections → subsections + concepts under `parent`. Without numbered sections, the key
    concepts become the branches (each with its defining sentence)."""
    secs = _sections(text)
    if secs:
        secs = secs[:max_sections]
        _mark_toc(pages, [t for _, t, _, subs in secs] + [st for *_, subs in secs for _, st in subs])
        # Each concept goes under the ONE section where it matters most (highest share of its
        # mentions), and concepts spread evenly over most sections ("string", "language" in an
        # automata deck) are left out: under every branch they say nothing.
        cands = [_concepts(body, 8, exclude=title) if leaf_concepts else [] for _, title, body, _ in secs]
        bodies = [body.lower() for _, _, body, _ in secs]
        home = {}
        for c in {c.lower() for cs in cands for c in cs}:
            counts = [bd.count(c) for bd in bodies]
            spread = sum(1 for k in counts if k) / len(bodies)
            if spread > 0.5 and len(bodies) >= 4:
                continue
            home[c] = max(range(len(bodies)), key=lambda i: (counts[i] / (len(bodies[i]) + 1)))
        last_page = 1
        for i, (num, title, body, subs) in enumerate(secs):
            sec_page = _page_of(pages, title, last_page)
            last_page = sec_page or last_page
            sid = b.add(f"{num} {title}", parent, "section", _first_prose(body), page=sec_page, doc_id=doc_id)
            taken = set()
            for sn, st in subs[:4]:
                # Subsections come after their section (an earlier mention is a forward reference).
                b.add(f"{sn} {st}", sid, "subsection", "", page=_page_of(pages, st, last_page), doc_id=doc_id)
                taken |= set(re.findall(r"\w+", st.lower()))
            added = 0
            for c in cands[i]:
                if added >= leaf_concepts or home.get(c.lower()) != i:
                    continue
                if set(re.findall(r"\w+", c.lower())) <= taken or c.lower() in title.lower():
                    continue
                b.add(c, sid, "concept", _definition(c, body), doc_id=doc_id)
                added += 1
        return
    from .concept_map import generate_concept_map
    cmap = generate_concept_map(text[:60000])
    nodes = cmap.get("nodes", [])[:max_sections]
    by_id = {}
    for n in nodes:
        by_id[n["id"]] = b.add(n.get("label", ""), parent, "section", n.get("definition", ""),
                               page=_page_of(pages, n.get("label", "")), doc_id=doc_id)
    # Strongest relation of each concept as a cross-link, so the map still shows how they connect.
    for e in cmap.get("edges", [])[:12]:
        s, t = by_id.get(e.get("source")), by_id.get(e.get("target"))
        if s and t:
            b.links.append({"source": s, "target": t, "label": ""})


def _definition(term: str, text: str) -> str:
    low = term.lower()
    from .preprocessor import clean_text, is_prose
    for s in re.split(r"(?<=[.!?])\s+|\n", clean_text(text[:20000])):
        s = " ".join(s.split())
        if low in s.lower() and is_prose(s, 6):
            return s[:220]
    return ""


def build_mindmap(sources: list[dict], subject: str = "", scope: str = "auto") -> dict:
    """sources: [{"title", "text", "doc_id"?, "pages"?}] (pages = per-page text, for page refs)."""
    sources = [s for s in sources if (s.get("text") or "").strip()]
    if not sources:
        return {"mode": "document", "title": subject or "Sơ đồ tư duy", "nodes": [], "links": [],
                "hint": "Chưa có tài liệu có nội dung."}

    # Topics of the subject: each document, or each chapter of a single multi-chapter book.
    units = []
    if len(sources) >= 2:
        units = [{"title": _doc_title(s["text"], s.get("title", "")), "text": s["text"], "doc_id": s.get("doc_id"),
                  "pages": s.get("pages")} for s in sources]
    else:
        chapters = _chapters_of(sources[0]["text"])
        if len(chapters) >= 2:
            units = [{"title": f"Chương {major}: {first}", "text": body, "doc_id": sources[0].get("doc_id"),
                      "pages": sources[0].get("pages")} for major, first, body in chapters]

    mode = "subject" if (units and scope != "document") else "document"
    b = _Builder()
    if mode == "document":
        src = sources[0]
        title = _doc_title(src["text"], src.get("title", "")) if len(sources) == 1 else (subject or "Tài liệu")
        root = b.add(title, None, "root", "")
        _branch_document(b, root, "\n\n".join(s["text"] for s in sources), src.get("pages"), src.get("doc_id"))
        hint = ("Sơ đồ của một tài liệu. Tải thêm tài liệu các chương khác vào dự án để có sơ đồ liên kết "
                "các chủ đề của cả môn.") if len(sources) == 1 else ""
        return {"mode": mode, "title": title, "nodes": b.nodes, "links": b.links, "hint": hint}

    title = subject or ("Môn học" if not sources[0].get("title") else _clean_title(sources[0]["title"]) if len(sources) == 1 else "Môn học")
    root = b.add(title, None, "root", "")
    topic_ids, topic_terms = [], []
    for u in units[:MAX_TOPICS]:
        tid = b.add(u["title"], root, "topic", _first_prose(u["text"]), doc_id=u.get("doc_id"),
                    page=_page_of(u.get("pages"), u["title"].split(": ", 1)[-1]))
        _branch_document(b, tid, u["text"], u.get("pages"), u.get("doc_id"), max_sections=8, leaf_concepts=0)
        if not any(n["parent"] == tid for n in b.nodes):  # no sections: list key concepts
            for c in _concepts(u["text"], 5):
                b.add(c, tid, "concept", _definition(c, u["text"]), doc_id=u.get("doc_id"))
        topic_ids.append(tid)
        topic_terms.append({c.lower() for c in _concepts(u["text"], 20)})

    # Cross-topic links: topics that share key concepts are related; the label names them.
    for i in range(len(topic_ids)):
        for j in range(i + 1, len(topic_ids)):
            shared = sorted(topic_terms[i] & topic_terms[j], key=len, reverse=True)
            if shared:
                b.links.append({"source": topic_ids[i], "target": topic_ids[j], "label": ", ".join(shared[:3])})
    return {"mode": mode, "title": title, "nodes": b.nodes, "links": b.links, "hint": ""}
