import re

def clean_text(text: str) -> str:
    """
    Normalizes whitespace and removes excessive boilerplate from text.
    """
    # Remove multiple newlines
    text = re.sub(r'\n+', '\n', text)
    # Remove multiple spaces
    text = re.sub(r' +', ' ', text)
    return _mark_headings(text.strip())


_TERMINAL = ('.', '!', '?', '…', ':', ';')


def _mark_headings(text: str) -> str:
    """PDF headings sit on their own line without punctuation, so sentence splitters glued
    them onto the next sentence ("Photosynthesis Photosynthesis is the process…" in quizzes).
    A short unpunctuated line followed by a capitalised line becomes its own sentence; a line
    followed by a lower-case line is a hard wrap and is re-joined."""
    lines = text.split('\n')
    out = []
    for i, line in enumerate(lines):
        cur = line.rstrip()
        nxt = lines[i + 1].lstrip() if i + 1 < len(lines) else ''
        if not cur or not nxt or cur.endswith(_TERMINAL):
            out.append(cur + '\n')
        elif nxt[0].islower() or nxt[0].isdigit() and not re.match(r'\d+[.)]\s', nxt):
            out.append(cur + ' ')            # wrapped line: continue the sentence
        elif len(cur.split()) <= 8 and nxt[0].isupper():
            out.append(cur + '.\n')         # heading: close it as its own sentence
        else:
            out.append(cur + '\n')
    return ''.join(out).strip()

def split_into_sentences_spacy(nlp, text: str) -> list[str]:
    """
    Uses spaCy to split text into robust sentences.
    """
    doc = nlp(text)
    return [sent.text.strip() for sent in doc.sents if len(sent.text.strip()) > 5]


_WORD = re.compile(r"[^\W\d_]{2,}", re.UNICODE)


def is_prose(sentence: str, min_words: int = 5) -> bool:
    """True for a readable sentence; False for slide debris: table cells ("NFA DFA 4."),
    formula fragments ("_ 2.3. I)", "q q q"), lone labels and reference lines. Used by
    chat retrieval, quizzes, exams and notes so math-heavy slides don't produce garbage."""
    s = (sentence or "").strip()
    tokens = s.split()
    if len(tokens) < min_words:
        return False
    words = [t for t in tokens if _WORD.fullmatch(t.strip(".,;:!?()[]{}\"'«»“”"))]
    if len(words) < min_words or len(words) / len(tokens) < 0.55:
        return False
    if s.count("(") != s.count(")") or s.count("[") != s.count("]") or s.count("{") != s.count("}"):
        return False
    if _NAVIGATION.search(s):
        return False
    # Title-page / heading lines are mostly ALL-CAPS words ("AUTOMATA THEORY from …",
    # "MICHAEL HUTH and MARK RYAN"); short acronyms like DFA don't count.
    caps = sum(1 for w in words if len(w) >= 4 and w.isupper())
    if caps / len(words) >= 0.3:
        return False
    return True


# Navigation and reference lines: tables of contents, "see Section 2.5", bibliography entries,
# and bare labels like "♦ EXAMPLE 2.17 (…)". They are not study content, but TextRank ranks a
# table of contents highest (it mentions every concept) and quizzes blanked "Springer-Verlag".
_NAVIGATION = re.compile(
    r"\b(?:in|see)\s+(?:section|chapter|figure|table)\s+\d"
    r"|^\W*courtesy\b|\bwe (?:will )?study the following\b|\bin this (?:chapter|section|lecture)\b"
    r"|\b(?:press|verlag|publishers?|edition|ed\.)\b.*\(?\b(?:19|20)\d\d\b|\bref\.\s*\d"
    r"|^\W*(?:example|definition|theorem|algorithm|lemma|exercise|problem|figure|table|bài|ví dụ|định nghĩa)\s*\d+(?:\.\d+)*\b[^a-z]{0,3}(?:\(|$)",
    re.I)
