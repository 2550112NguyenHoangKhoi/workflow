"""Offline speaking feedback from a transcript (speech → text happens in the browser or via
/api/transcribe).

- score_pronunciation: compare what was recognised with the target sentence word by word —
  a word the recogniser could not hear correctly is the one to practise.
- grade_speaking: IELTS-style estimate for Part 1/2/3 answers: fluency (speed, length,
  fillers), lexical resource (variety, less common words), grammar (complex structures,
  tense variety) and coherence (linking, relevance to the question).
"""
import difflib
import re

_WORD = re.compile(r"[a-zA-Z']+")
_FILLERS = {"um", "uh", "er", "erm", "like", "you know", "i mean", "actually", "basically"}
_LINKERS = ["because", "so", "however", "although", "for example", "for instance", "also", "but", "and then",
            "on the other hand", "in addition", "as a result", "that's why", "which", "while", "whereas", "instead"]
_COMPLEX = re.compile(r"\b(if|when|because|although|though|unless|which|who|that|while|since|whereas)\b", re.I)
_TENSES = {"past": re.compile(r"\b(\w+ed|was|were|went|did|had|saw|got|made|took|came)\b", re.I),
           "future": re.compile(r"\b(will|going to|'ll)\b", re.I),
           "perfect": re.compile(r"\b(have|has|had) (\w+ed|been|done|seen|gone|made|taken)\b", re.I),
           "conditional": re.compile(r"\b(would|could|might)\b", re.I)}
_COMMON = set("""i you he she it we they a an the and or but so to of in on at for with is are was were be been am do does did have has had
not no yes very really good bad big small like love go went get got make made take took see saw say said think know want
because then there here this that these those my your his her our their me him them us one two three time people thing
things lot lots many much more most some any all can could will would should just also about from up out what when where
who why how which if as by than too well""".split())


def _words(s: str) -> list[str]:
    return [w.lower() for w in _WORD.findall(s or "")]


def score_pronunciation(target: str, transcript: str) -> dict:
    """[{word, status: ok|missed|wrong, heard}] + accuracy %, completeness %, feedback."""
    tw, hw = _words(target), _words(transcript)
    out = []
    sm = difflib.SequenceMatcher(a=tw, b=hw, autojunk=False)
    for op, a0, a1, b0, b1 in sm.get_opcodes():
        if op == "equal":
            out += [{"word": w, "status": "ok", "heard": w} for w in tw[a0:a1]]
        elif op == "delete":
            out += [{"word": w, "status": "missed", "heard": ""} for w in tw[a0:a1]]
        elif op == "replace":
            heard = hw[b0:b1]
            for k, w in enumerate(tw[a0:a1]):
                h = heard[k] if k < len(heard) else ""
                close = h and difflib.SequenceMatcher(a=w, b=h).ratio() >= 0.8
                out.append({"word": w, "status": "ok" if close else "wrong", "heard": h})
        # "insert": extra words the speaker added — not penalised
    ok = sum(1 for x in out if x["status"] == "ok")
    accuracy = round(100 * ok / max(1, len(tw)))
    completeness = round(100 * sum(1 for x in out if x["status"] != "missed") / max(1, len(tw)))
    bad = [x["word"] for x in out if x["status"] != "ok"]
    if not hw:
        feedback = "Chưa nghe được gì — hãy nói to, rõ và gần micro hơn."
    elif accuracy >= 90:
        feedback = "Rất tốt! Phát âm rõ ràng, máy nhận đúng gần như toàn bộ câu."
    elif accuracy >= 70:
        feedback = "Khá tốt. Luyện lại các từ được đánh dấu: " + ", ".join(dict.fromkeys(bad))[:120] + "."
    else:
        feedback = "Cần luyện thêm. Nghe mẫu, nói chậm từng cụm và chú ý: " + ", ".join(dict.fromkeys(bad))[:120] + "."
    return {"words": out, "accuracy": accuracy, "completeness": completeness, "feedback": feedback,
            "transcript": transcript}


def _band(x: float) -> float:
    return max(1.0, min(9.0, round(x * 2) / 2))


def grade_speaking(question: str, transcript: str, part: int = 1, duration_sec: float | None = None) -> dict:
    words = _words(transcript)
    n = len(words)
    target = {1: 35, 2: 150, 3: 60}.get(part, 40)
    if n < 4:
        return {"overall": 1.0, "bands": {"fluency": 1.0, "lexical": 1.0, "grammar": 1.0, "coherence": 1.0},
                "feedback": "Câu trả lời quá ngắn để đánh giá — hãy nói ít nhất 2–3 câu.",
                "suggestions": ["Trả lời trực tiếp, rồi thêm lý do và một ví dụ."], "word_count": n}
    text = " " + " ".join(words) + " "
    # Fluency & coherence: length vs what the part expects, speech rate, fillers, linking.
    length = min(1.0, n / target)
    wpm = (n / (duration_sec / 60)) if duration_sec and duration_sec > 3 else None
    rate = 1.0 if wpm is None else (1.0 if 100 <= wpm <= 170 else 0.75 if 70 <= wpm <= 200 else 0.5)
    fillers = sum(text.count(f" {f} ") for f in _FILLERS) / max(1, n)
    linkers = sum(1 for l in _LINKERS if f" {l} " in text)
    # Calibrated so a plain, relevant answer lands around 6–7; the offline estimate tops out
    # near 8 (the AI examiner can go higher).
    fluency = _band(3.5 + 2.5 * length * rate + min(1.0, linkers * 0.25) + (0.5 if wpm and 110 <= wpm <= 160 else 0)
                    - fillers * 20)
    # Lexical resource: variety (type/token ratio is naturally high in short answers, so it
    # is normalised) and less common words (long or academic-suffix words).
    content = [w for w in words if w not in _COMMON]
    ttr = len(set(words[:120])) / max(1, min(n, 120))
    ttr_norm = max(0.0, min(1.0, (ttr - (0.55 if n < 50 else 0.4)) / 0.35))
    rare = len({w for w in content if len(w) >= 9 or re.search(r"(tion|ment|ity|ive|ous|ence|ance|ise|ize)$", w)})
    lexical = _band(3.5 + 2.0 * ttr_norm + min(2.0, rare * 0.35) + 0.5 * length)
    # Grammar: complex structures and tense variety.
    sentences = [s for s in re.split(r"[.!?]+", transcript or "") if s.strip()]
    complex_ = len(_COMPLEX.findall(transcript or ""))
    tenses = sum(1 for p in _TENSES.values() if p.search(transcript or ""))
    grammar = _band(3.5 + min(2.0, complex_ * 0.4) + min(1.5, tenses * 0.4) + (0.5 if len(sentences) >= 3 else 0))
    # Relevance: does the answer pick up the question's content words?
    qwords = {w for w in _words(question) if w not in _COMMON and len(w) > 3}
    relevance = len(qwords & set(words)) / max(1, len(qwords)) if qwords else 1.0
    coherence = _band(3.5 + 2.0 * min(1.0, relevance + 0.3) + min(1.5, linkers * 0.35) + 0.5 * length)
    bands = {"fluency": fluency, "lexical": lexical, "grammar": grammar, "coherence": coherence}
    overall = _band(sum(bands.values()) / 4)
    sugg = []
    if length < 0.7:
        sugg.append({1: "Mở rộng câu trả lời: thêm lý do và ví dụ (khoảng 3–4 câu).",
                     2: "Part 2 cần nói đủ 1–2 phút: đi qua từng gợi ý trên thẻ.",
                     3: "Phát triển ý: nêu quan điểm, giải thích, so sánh và cho ví dụ."}.get(part, "Nói dài hơn."))
    if linkers < 2:
        sugg.append("Dùng từ nối (because, however, for example, as a result) để mạch lạc hơn.")
    if complex_ < 2:
        sugg.append("Thêm câu phức (if/when/although/which…) để nâng điểm ngữ pháp.")
    if ttr < 0.55 or rare < 3:
        sugg.append("Đa dạng từ vựng: tránh lặp từ, dùng từ cụ thể hơn cho chủ đề.")
    if fillers > 0.04:
        sugg.append("Bớt từ đệm (um, uh, like) — dừng ngắn để suy nghĩ thay vì lấp chỗ trống.")
    if wpm is not None and wpm < 90:
        sugg.append(f"Tốc độ khoảng {round(wpm)} từ/phút — luyện nói trôi chảy hơn (khoảng 110–160).")
    feedback = (f"Ước tính band {overall}. " + ("Câu trả lời tự nhiên và phát triển tốt." if overall >= 7 else
                "Trả lời đúng hướng, cần phát triển ý và đa dạng ngôn ngữ hơn." if overall >= 5.5 else
                "Câu trả lời còn ngắn/đơn giản — tập trả lời đầy đủ hơn."))
    return {"overall": overall, "bands": bands, "feedback": feedback, "suggestions": sugg, "word_count": n,
            "wpm": round(wpm) if wpm else None}
