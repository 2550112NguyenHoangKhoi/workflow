import re
import pdfplumber
from dataclasses import dataclass
from typing import List, Optional, Dict, Any

TOC_LINE_RE = re.compile(r"^(?P<title>.+?)\s+\.{2,}\s*(?P<page>\d+)\s*$")
NUMBERED_RE = re.compile(r"^(?P<num>(\d+(\.\d+)*)?)\s*(?P<title>[A-Z].+)$")

@dataclass
class Node:
    id: str
    title: str
    level: int
    page_start: int
    page_end: Optional[int] = None
    children: List["Node"] = None

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "level": self.level,
            "page_start": self.page_start,
            "page_end": self.page_end,
            "children": [c.to_dict() for c in (self.children or [])],
        }

def extract_char_stats(page):
    chars = page.chars
    if not chars:
        return []
    lines = {}
    for ch in chars:
        top = round(ch["top"], 1)
        lines.setdefault(top, []).append(ch)
    rows = []
    for top, items in sorted(lines.items()):
        text = "".join(c["text"] for c in sorted(items, key=lambda x: x["x0"]))
        sizes = [c.get("size", 0) for c in items]
        bold = sum(1 for c in items if "Bold" in str(c.get("fontname", "")))
        rows.append({
            "text": text.strip(),
            "top": top,
            "avg_size": sum(sizes) / max(len(sizes), 1),
            "bold_ratio": bold / max(len(items), 1),
        })
    return rows

def is_heading(line, median_size):
    t = line["text"].strip()
    if not t:
        return False
    if len(t) > 120:
        return False
    if t.endswith("."):
        return False
    if TOC_LINE_RE.match(t):
        return True
    if re.match(r"^(Chapter|CHAPTER)\s+\d+", t):
        return True
    if NUMBERED_RE.match(t) and line["avg_size"] >= median_size * 1.05:
        return True
    if line["avg_size"] >= median_size * 1.20:
        return True
    if line["bold_ratio"] >= 0.35 and len(t.split()) <= 10:
        return True
    return False

def parse_pdf_toc(pdf_path: str) -> Dict[str, Any]:
    with pdfplumber.open(pdf_path) as pdf:
        page_lines = []
        all_sizes = []
        for page_idx, page in enumerate(pdf.pages, start=1):
            rows = extract_char_stats(page)
            for r in rows:
                r["page"] = page_idx
                page_lines.append(r)
                all_sizes.append(r["avg_size"])

        median_size = sorted(all_sizes)[len(all_sizes)//2] if all_sizes else 0
        headings = [r for r in page_lines if is_heading(r, median_size)]
        headings = sorted(headings, key=lambda x: (x["page"], x["top"]))

        nodes = []
        for i, h in enumerate(headings):
            title = TOC_LINE_RE.sub(r"\g<title>", h["text"]).strip()
            title = re.sub(r"^\d+(\.\d+)*\s*", "", title).strip()
            level = 1
            if re.match(r"^\d+\.\d+\.", h["text"]) or re.match(r"^\d+\.\d+\s+", h["text"]):
                level = 2
            elif re.match(r"^\d+\.\d+\.\d+", h["text"]):
                level = 3
            nodes.append(Node(
                id=f"n{i+1}",
                title=title,
                level=level,
                page_start=h["page"],
                children=[]
            ))

        for i, node in enumerate(nodes):
            node.page_end = (nodes[i+1].page_start - 1) if i + 1 < len(nodes) else len(pdf.pages)

        root = {"title": pdf.metadata.get("Title") if pdf.metadata else "Extracted Learning Path", "chapters": [n.to_dict() for n in nodes]}
        return root

def extract_chapter_text(pdf_path: str, page_start: int, page_end: int) -> str:
    parts = []
    with pdfplumber.open(pdf_path) as pdf:
        for p in range(max(0, page_start - 1), min(page_end, len(pdf.pages))):
            txt = pdf.pages[p].extract_text() or ""
            parts.append(txt)
    return "\n".join(parts)
