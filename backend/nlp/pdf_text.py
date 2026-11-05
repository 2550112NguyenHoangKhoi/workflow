"""PDF → per-page text, shared by every PDF path (upload, Drive sources, exam sources).

Why not plain `page.extract_text()`:
- LaTeX/Beamer slides are tightly kerned; pdfplumber's fixed 3pt word gap glued whole lines
  together ("Westudythefollowingtopics…"), which broke chat, quizzes, notes and exams.
  A gap relative to the font size (`x_tolerance_ratio`) keeps the words apart.
- Subscripts (q₁) were split onto their own line; a 6pt y-tolerance keeps them inline.
- Math fonts use Unicode "mathematical italic" letters (𝑎, 𝑢, 𝜀); NFKC folds them to a, u, ε
  so search/keywords see normal letters (also unfolds ligatures like "ﬁ").
- Running headers/footers ("MATHEMATICAL MODELING Methods and Application", "2.1. PART A 116")
  repeat on every page and polluted keywords, flashcards and concept maps.
"""
import re
import unicodedata
from collections import Counter

_X_TOLERANCE_RATIO = 0.15
_INVISIBLE = re.compile("[\ufe00-\ufe0f\u200b-\u200d\u2060\ufeff]")


def page_text(page) -> str:
    try:
        # y_tolerance 6: sub/superscripts sit a few points off the baseline and came out as a
        # separate line ("δ(q , 0)" … "1 1"); 6pt keeps them inline ("δ(q1, 0)") while normal
        # line spacing (≥ 10pt) still separates lines.
        text = page.extract_text(x_tolerance_ratio=_X_TOLERANCE_RATIO, y_tolerance=6) or ""
    except TypeError:  # older pdfplumber without the ratio option
        text = page.extract_text(x_tolerance=1.5) or ""
    # NFKC, then drop invisible variation selectors / zero-width chars ("(︀{q1" in math fonts).
    return _INVISIBLE.sub("", unicodedata.normalize("NFKC", text))


def _shape(line: str) -> str:
    return re.sub(r"\d+", "#", line.strip().lower())


def strip_running_lines(pages: list[str], edge: int = 2) -> list[str]:
    """Remove header/footer lines: among the first/last `edge` lines of each page, a line whose
    digit-normalised form appears on at least 3 pages (≥ 5 % of them; section headers recur on a few pages each)."""
    if len(pages) < 3:
        return pages
    edges = []
    for p in pages:
        lines = [l for l in p.split("\n") if l.strip()]
        edges.append({_shape(l) for l in lines[:edge] + lines[-edge:]})
    counts = Counter(s for e in edges for s in e)
    threshold = max(3, int(len(pages) * 0.05))
    running = {s for s, c in counts.items() if c >= threshold and len(s) < 120}
    if not running:
        return pages
    out = []
    for p in pages:
        lines = p.split("\n")
        idx = [i for i, l in enumerate(lines) if l.strip()]
        drop = {i for i in set(idx[:edge] + idx[-edge:]) if _shape(lines[i]) in running}
        # Short pages are mostly "edge" lines: never strip more than a third of a page, so a
        # brief slide whose lines recur elsewhere isn't emptied.
        if len(idx) <= 2 * edge or len(drop) * 3 > len(idx):
            drop = {i for i in drop if i in (idx[0], idx[-1])}  # only the outermost lines
            if len(idx) - len(drop) < 1:
                drop = set()
        out.append("\n".join(l for i, l in enumerate(lines) if i not in drop))
    return out


def extract_pages(pdf) -> list[str]:
    """Per-page text of an open pdfplumber document, cleaned as described above."""
    return strip_running_lines([page_text(p) for p in pdf.pages])
