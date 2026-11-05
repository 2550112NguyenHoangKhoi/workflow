"""Exam → Word (.docx) for teachers: school header (with logo), candidate fields, questions,
then an answer key with marks and a grading guide for essays. The header/footer/logo come
from a reusable print template the teacher saves in the app.
"""
import base64
import io
import re

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt

LETTERS = "ABCDEFGH"
TYPE_LABEL = {"mcq": "Trắc nghiệm", "true_false": "Đúng/Sai", "short_answer": "Trả lời ngắn", "essay": "Tự luận"}


def _points(questions, total=10.0):
    """Marks per question: essays weigh 3×, short answers 1.5×, the rest 1×; scaled to `total`."""
    w = [3.0 if q.get("type") == "essay" else 1.5 if q.get("type") == "short_answer" else 1.0 for q in questions]
    s = sum(w) or 1
    pts = [round(total * x / s * 4) / 4 for x in w]   # quarter points
    pts[-1] = round(total - sum(pts[:-1]), 2) if pts else 0
    return pts


def _page_number(paragraph):
    run = paragraph.add_run()
    for tag, text in (("begin", None), (None, "PAGE"), ("end", None)):
        if tag:
            el = OxmlElement("w:fldChar")
            el.set(qn("w:fldCharType"), tag)
        else:
            el = OxmlElement("w:instrText")
            el.set(qn("xml:space"), "preserve")
            el.text = text
        run._r.append(el)


def _logo_stream(data_url: str | None):
    if not data_url or not data_url.startswith("data:image/"):
        return None
    try:
        return io.BytesIO(base64.b64decode(data_url.split(",", 1)[1]))
    except Exception:
        return None


def build_exam_docx(title: str, questions: list[dict], template: dict | None = None,
                    answer_key: bool = True, grading_guide: bool = True) -> bytes:
    t = template or {}
    doc = Document()
    sec = doc.sections[0]
    sec.left_margin = sec.right_margin = Cm(2)
    sec.top_margin = sec.bottom_margin = Cm(1.8)
    style = doc.styles["Normal"]
    style.font.name = "Times New Roman"
    style.font.size = Pt(12)

    # Header block: school (left, with logo) | exam info (right).
    tbl = doc.add_table(rows=1, cols=2)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    left, right = tbl.rows[0].cells
    logo = _logo_stream(t.get("logo"))
    lp = left.paragraphs[0]
    lp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if logo:
        try:
            lp.add_run().add_picture(logo, width=Cm(1.8))
            lp = left.add_paragraph()
            lp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        except Exception:
            pass
    lp.add_run((t.get("school") or "TRƯỜNG ………………").upper()).bold = True
    if t.get("department"):
        p = left.add_paragraph(t["department"])
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    rp = right.paragraphs[0]
    rp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    rp.add_run((t.get("exam_name") or title or "ĐỀ KIỂM TRA").upper()).bold = True
    for line in (f"Môn: {t['subject']}" if t.get("subject") else "",
                 f"Thời gian làm bài: {t['duration']} phút" if t.get("duration") else "",
                 t.get("header_note", "")):
        if line:
            p = right.add_paragraph(line)
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph()
    doc.add_paragraph("Họ và tên: ……………………………………………   Lớp: …………   Số báo danh: …………")

    pts = _points(questions)
    for i, q in enumerate(questions):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(8)
        r = p.add_run(f"Câu {i + 1} ({pts[i]:g} điểm). ")
        r.bold = True
        p.add_run(re.sub(r"\s+", " ", q.get("question", "")).strip())
        if q.get("type") in ("mcq", "true_false"):
            for k, o in enumerate(q.get("options") or []):
                op = doc.add_paragraph(f"{LETTERS[k]}. {o.get('text', '')}")
                op.paragraph_format.left_indent = Cm(1)
        elif q.get("type") == "short_answer":
            doc.add_paragraph("Trả lời: " + "…" * 60)
        else:
            for _ in range(6):
                doc.add_paragraph("…" * 90)

    end = doc.add_paragraph("— HẾT —")
    end.alignment = WD_ALIGN_PARAGRAPH.CENTER
    end.runs[0].bold = True

    if answer_key or grading_guide:
        end.add_run().add_break(WD_BREAK.PAGE)
        h = doc.add_paragraph()
        h.alignment = WD_ALIGN_PARAGRAPH.CENTER
        h.add_run("ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM").bold = True
        if answer_key:
            key = doc.add_table(rows=1, cols=4)
            key.style = "Table Grid"
            for c, txt in zip(key.rows[0].cells, ("Câu", "Dạng", "Đáp án", "Điểm")):
                c.paragraphs[0].add_run(txt).bold = True
            for i, q in enumerate(questions):
                row = key.add_row().cells
                if q.get("type") in ("mcq", "true_false"):
                    opts = q.get("options") or []
                    k = next((n for n, o in enumerate(opts) if o.get("id") == q.get("correct_option_id")), None)
                    ans = f"{LETTERS[k]}. {opts[k]['text']}" if k is not None else str(q.get("answer", ""))
                elif q.get("type") == "short_answer":
                    ans = str(q.get("answer", ""))
                else:
                    ans = "Xem hướng dẫn chấm"
                for c, txt in zip(row, (str(i + 1), TYPE_LABEL.get(q.get("type"), ""), ans, f"{pts[i]:g}")):
                    c.text = txt
        if grading_guide:
            essays = [(i, q) for i, q in enumerate(questions) if q.get("type") == "essay"]
            for i, q in essays:
                p = doc.add_paragraph()
                p.paragraph_format.space_before = Pt(10)
                p.add_run(f"Câu {i + 1} — Tự luận ({pts[i]:g} điểm)").bold = True
                ref = str(q.get("answer", "")).replace("Ý chính cần nêu (theo tài liệu):", "").strip()
                half = pts[i] / 2
                for crit, share in ((f"Nêu đúng ý chính: {ref}", half), ("Giải thích bằng lời của mình, lập luận mạch lạc.", pts[i] / 4),
                                    ("Có ví dụ hoặc dẫn chứng cụ thể.", pts[i] / 4)):
                    doc.add_paragraph(f"{crit} ({share:g} điểm)", style="List Bullet")
                if q.get("explanation"):
                    doc.add_paragraph(f"Ghi chú cho giáo viên: {q['explanation']}")
            if not essays and not answer_key:
                doc.add_paragraph("Đề không có câu tự luận.")

    # Footer: template text + page number.
    for s in doc.sections:
        fp = s.footer.paragraphs[0]
        fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        if t.get("footer"):
            fp.add_run(f"{t['footer']}   ·   Trang ")
        else:
            fp.add_run("Trang ")
        _page_number(fp)

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
