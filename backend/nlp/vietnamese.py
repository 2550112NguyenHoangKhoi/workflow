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
    return [s.strip() for s in re.split(r'(?<=[.!?…])\s+', text) if len(s.strip()) > 1]


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
