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
