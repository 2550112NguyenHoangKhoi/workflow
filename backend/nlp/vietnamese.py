"""Vietnamese-language NLP helpers (pyvi-based) + language detection.

The deterministic engine defaults to English (spaCy en_core_web_sm + WordNet).
Vietnamese study material (PDFs/notes) is common, so these helpers let the
flashcard / quiz / concept-map generators route VN text through pyvi word
segmentation + POS tagging instead, and filter Vietnamese stopwords.
"""
import re

# Common Vietnamese function words / pronouns / conjunctions to drop from
# concepts, flashcard terms and quiz blanks.
VIETNAMESE_STOPWORDS = {
    "và", "là", "của", "có", "được", "cho", "trong", "một", "các", "những",
    "này", "đó", "với", "để", "khi", "đã", "sẽ", "đang", "thì", "mà", "nếu",
    "nên", "vì", "do", "bởi", "như", "hay", "hoặc", "cũng", "rất", "quá",
    "lại", "còn", "chỉ", "đến", "từ", "ra", "vào", "theo", "về", "trên",
    "dưới", "ngoài", "giữa", "sau", "trước", "tại", "bằng", "làm", "người",
    "việc", "cái", "con", "chiếc", "nó", "họ", "tôi", "chúng", "ta", "mình",
    "bạn", "ai", "gì", "nào", "sao", "đâu", "bao", "nhiêu", "không", "chưa",
    "chẳng", "đừng", "hãy", "phải", "cần", "muốn", "rồi", "nữa", "thêm",
    "mỗi", "mọi", "từng", "tất", "cả", "nhiều", "ít", "vài", "gồm", "gọi",
    "thường", "luôn", "đều", "càng", "hơn", "nhất", "bị", "tự", "vẫn",
    "đây", "kia", "ấy", "điểm", "khái", "niệm",
}

# Precomposed Vietnamese diacritic characters, used for language detection.
_VI_CHARS = set(
    "ăâêôơưđàảãáạằẳẵắặầẩẫấậèẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộờởỡớợùủũúụừửữứựỳỷỹýỵ"
    "ĂÂÊÔƠƯĐÀẢÃÁẠẰẲẴẮẶẦẨẪẤẬÈẺẼÉẸỀỂỄẾỆÌỈĨÍỊÒỎÕÓỌỒỔỖỐỘỜỞỠỚỢÙỦŨÚỤỪỬỮỨỰỲỶỸÝỴ"
)

# pyvi noun POS tags (N: noun, Np: proper noun, Nc: classifier noun, Ny: abbrev noun).
_NOUN_TAGS = {"N", "Np", "Nc", "Ny"}


def is_vietnamese(text: str) -> bool:
    """Heuristic language check: Vietnamese diacritic density or common stopwords."""
    if not text:
        return False
    sample = text[:2000]
    vi_count = sum(1 for ch in sample if ch in _VI_CHARS)
    if vi_count >= 3:
        return True
    low = " " + sample.lower() + " "
    hits = sum(1 for w in ("của", "và", "được", "những", "trong", "là") if f" {w} " in low)
    return hits >= 2


def vi_split_sentences(text: str):
    return [s.strip() for s in re.split(r'(?<=[.!?…])\s+|\n+', text) if len(s.strip()) > 1]


def is_clean_sentence(s: str) -> bool:
    """Heuristic to skip math-heavy or badly-extracted (glued) sentences.

    Dense Vietnamese cheat-sheet / exam PDFs extract with lost spaces
    ("Côngthức") and lots of math symbols; such fragments make poor
    flashcards/quiz items, so we filter them out before generation.
    """
    s = s.strip()
    if not (8 <= len(s) <= 400):
        return False
    letters = sum(ch.isalpha() for ch in s)
    if letters < len(s) * 0.55:                      # too many digits / math symbols
        return False
    if any(len(tok) > 18 for tok in s.split()):      # glued mega-token (PDF lost spaces)
        return False
    return True


def vi_clean_sentences(text: str):
    """Sentences for card/quiz/map generation: de-glue PDF runs, drop math fragments."""
    from .vi_desegment import desegment
    out = []
    for s in vi_split_sentences(text):
        # Re-insert spaces lost during PDF extraction ("Côngthức" -> "Công thức").
        # desegment self-gates per token (valid syllables, pure ASCII and math are
        # left untouched), so it's safe and cheap to run on every sentence. A length
        # gate here is wrong: glued bigrams are only 6-9 chars, well under a single
        # syllable's 7-char max, so they'd never trip a token-length threshold.
        s = desegment(s)
        if is_clean_sentence(s):
            out.append(s)
    return out


def vi_pos(text: str):
    """Return list of (word, tag) using pyvi word segmentation + POS tagging.

    Words are returned with underscores collapsed back to spaces.
    """
    from pyvi import ViTokenizer, ViPosTagger
    words, tags = ViPosTagger.postagging(ViTokenizer.tokenize(text))
    return [(w.replace("_", " ").strip(), t) for w, t in zip(words, tags)]


def vi_nouns(text: str):
    """Multi-syllable Vietnamese noun phrases, stopword-filtered, original order."""
    out = []
    for word, tag in vi_pos(text):
        if tag in _NOUN_TAGS:
            phrase = word.strip()
            if (len(phrase) >= 3 and phrase.lower() not in VIETNAMESE_STOPWORDS
                    and not phrase.replace(" ", "").isdigit()):
                out.append(phrase)
    return out


def vi_keywords(text: str, top_n: int = 12):
    """Most frequent meaningful Vietnamese nouns across the text (ranked)."""
    from collections import Counter
    freq = Counter(n.lower() for n in vi_nouns(text))
    return [w for w, _ in freq.most_common(top_n)]
