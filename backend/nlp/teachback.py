import re
from collections import Counter

STOPWORDS = {
    'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'what', 'which', 'this', 'that', 'these', 'those', 'then',
    'so', 'than', 'such', 'both', 'through', 'about', 'for', 'is', 'of', 'while', 'during', 'to', 'what', 'which', 'is',
    'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
    'should', 'can', 'could', 'may', 'might', 'must', 'ought', "i'm", "you're", "he's", "she's", "it's", "we're", "they're",
    "i've", "you've", "we've", "they've", "i'd", "you'd", "he'd", "she'd", "we'd", "they'd", "i'll", "you'll", "he'll",
    "she'll", "we'll", "they'll", "isn't", "aren't", "wasn't", "weren't", "hasn't", "haven't", "hadn't", "doesn't", "don't",
    "didn't", "won't", "wouldn't", "shan't", "shouldn't", "can't", "cannot", "couldn't", "mustn't", "let's", "that's",
    "who's", "what's", "here's", "there's", "when's", "where's", "why's", "how's", 'một', 'là', 'và', 'của', 'các', 'có',
    'được', 'cho', 'trong', 'đã', 'người', 'không', 'với', 'khi', 'này', 'những', 'để', 'như', 'trên', 'sẽ', 'từ', 'rằng',
    'tại', 'nhưng', 'cũng', 'theo', 'đến', 'ra', 'nhiều', 'chỉ', 'nếu', 'hoặc', 'vì', 'rất', 'về', 'lại', 'có_thể', 'vẫn',
    'sự', 'hơn', 'sau', 'việc', 'bởi', 'thì', 'làm', 'vào', 'phải', 'đều', 'đang', 'nên'
}

def _keywords(text: str, n: int = 8) -> list[str]:
    # lowercase, tokenize on \w+, drop stopwords and tokens < 3 chars, rank by frequency,
    # return the top n distinct keywords.
    words = re.findall(r'\w+', text.lower())
    filtered = [w for w in words if len(w) >= 3 and w not in STOPWORDS]
    counts = Counter(filtered)
    return [word for word, count in counts.most_common(n)]

_spacy = None
# Vietnamese nouns too generic to be a "key point" on their own.
_VI_GENERIC = {"quá trình", "vấn đề", "trường hợp", "phương pháp", "cách thức", "hiện tượng", "đặc điểm", "khái niệm", "nội dung", "thông tin"}


def _key_concepts(text: str, n: int = 5, exclude: str = "") -> list[str]:
    """Concepts worth explaining, most frequent first: noun phrases in English (spaCy),
    compound nouns in Vietnamese (pyvi). Frequency-ranked single words picked verbs and
    filler ("happens"), and Vietnamese single syllables, as "key points". Falls back to
    `_keywords` when the language models are unavailable."""
    ex = (exclude or "").strip().lower()
    try:
        from nlp.vietnamese import is_vietnamese, vi_keywords
        if is_vietnamese(text):
            out = [k for k in vi_keywords(text, n + 6) if " " in k and k != ex and k not in _VI_GENERIC]
            if len(out) >= 2:
                return out[:n]
        else:
            global _spacy
            if _spacy is None:
                import spacy
                _spacy = spacy.load("en_core_web_sm", disable=["ner"])
            counts, first = Counter(), {}
            from .quizzes import GENERIC_NOUNS
            # The topic itself is not a key point: its words, singulars and acronym
            # ("Deterministic finite automaton" → deterministic, finite, automaton, dfa).
            tw = re.findall(r"\w+", ex)
            topic_words = {w for w in tw} | {w.rstrip("s") for w in tw}
            if len(tw) >= 2:
                topic_words.add("".join(w[0] for w in tw))
            for chunk in _spacy(text[:20000]).noun_chunks:
                # Single letters are variables ("automaton M", "string w"), not part of a concept.
                toks = [t for t in chunk if t.pos_ not in ("DET", "PRON", "NUM", "PUNCT", "SYM") and not t.is_stop
                        and len(t.text) > 1 and re.fullmatch(r"[^\W\d_]+(?:[-/][^\W\d_]+)*", t.text)]
                if not toks or toks[-1].pos_ not in ("NOUN", "PROPN"):
                    continue
                toks = toks[-3:]  # keep the head phrase: "the green pigment chlorophyll" → 3 words max
                phrase = " ".join(t.lemma_.lower() if t is toks[-1] and t.pos_ == "NOUN" else t.text.lower() for t in toks)
                if (len(phrase) < 3 or phrase in STOPWORDS or phrase in GENERIC_NOUNS
                        or set(phrase.split()) <= topic_words):
                    continue
                counts[phrase] += 1
                first.setdefault(phrase, len(first))
            # Frequency first; on ties a specific multi-word term beats a single word.
            ranked = sorted(counts, key=lambda k: (-counts[k], -min(2, len(k.split())), first[k]))
            # Drop a single word already contained in a higher-ranked phrase ("cycle" vs "calvin cycle").
            out = []
            for k in ranked:
                if not any(k in o.split() or o in k.split() for o in out):
                    out.append(k)
            if len(out) >= 2:
                return out[:n]
    except Exception:
        pass
    return [k for k in _keywords(text, n + 1) if k != ex][:n]


def _stem(w: str) -> str:
    for suf in ("ies", "es", "s"):
        if len(w) > 4 and w.endswith(suf):
            return w[: -len(suf)] + ("y" if suf == "ies" else "")
    return w


def _focus(context: str, topic: str, keep: int = 30) -> str:
    """The part of a long document that is about `topic`: its most similar sentences (TF-IDF),
    with the topic's acronym counted too ("Deterministic finite automaton" ↔ "DFA"). Key points
    for "DFA" used to come from the whole deck (grammar, language, …)."""
    if not topic or len(context) < 3000:
        return context
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
        sents = [x.strip() for x in re.split(r"(?<=[.!?])\s+|\n+", context) if len(x.split()) >= 4]
        words = re.findall(r"\w+", topic)
        query = topic + (" " + "".join(w[0] for w in words).upper() if len(words) >= 2 else "")
        m = TfidfVectorizer(stop_words="english").fit_transform(sents + [query])
        sims = cosine_similarity(m[-1], m[:-1]).flatten()
        # Where the topic is *defined* ("A deterministic finite automaton is …", "DFA: …") is
        # the best source of key points: take that sentence and the lines that follow it.
        # Scattered matching sentences mostly compared the topic with others (DFA vs NFA).
        defines = re.compile(r"\b(is|are|consists of|is defined as|là|gồm)\b|:\s", re.I)
        order = [int(i) for i in sims.argsort()[::-1] if sims[int(i)] > 0]
        if not order:
            return context
        best = order[0]
        names = [topic.lower()] + ([query.split()[-1].lower()] if len(words) >= 2 else [])
        exact = [i for i in order[:40] if any(re.search(r"\b" + re.escape(n) + r"s?\b", sents[i].lower()) for n in names)]
        from .preprocessor import is_prose
        alt = "|".join(re.escape(n) for n in names)
        definition = re.compile(r"^\W*(?:\S+\s){0,4}?(?:" + alt + r")s?\b[^.?]{0,60}?\b(is|are|consists?|involves?|denotes?|means|là|gồm)\b", re.I)
        picked = next((i for i in exact if definition.search(sents[i]) and is_prose(sents[i], 6)), None)
        if picked is None:
            picked = next((i for i in exact + order[:8] if defines.search(sents[i]) and is_prose(sents[i], 6)), best)
        best = picked
        return "\n".join(sents[best:best + 12])
    except Exception:
        return context


def make_prompt(topic: str, context: str = "", level: str = "") -> dict:
    concept = topic if topic else "Chủ đề"
    if context:
        kws = _key_concepts(_focus(context, topic), 5, exclude=topic)
        key_points = kws if len(kws) >= 3 else kws + ["định nghĩa", "ví dụ thực tế", "tại sao quan trọng"]
        key_points = key_points[:6]
    else:
        kws = _keywords(topic, 3)
        key_points = kws + ["định nghĩa", "ví dụ thực tế", "tại sao quan trọng"]
        key_points = key_points[:6]

    question_vi = f"Hãy giải thích '{concept}' bằng lời của chính bạn, như thể bạn đang dạy cho một người bạn chưa biết gì về chủ đề này. Dùng ví dụ đơn giản."

    return {
        "concept": concept,
        "key_points": key_points,
        "question_vi": question_vi
    }

def evaluate(concept: str, key_points: list[str], explanation: str, context: str = "") -> dict:
    expl_words = set(_keywords(explanation, 40))
    explanation_lower = explanation.lower()
    
    covered = []
    gaps = []
    
    for kp in key_points:
        kp_words = set(_keywords(kp, 5))
        is_covered = False
        
        if re.search(r'\b' + re.escape(kp.lower()) + r'\b', explanation_lower):
            is_covered = True
        elif kp_words:
            # A phrase point ("calvin cycle") needs most of its words, not just any one;
            # plurals count ("chloroplasts" covers "chloroplast").
            expl_stems = {_stem(w) for w in expl_words} | {_stem(w) for w in re.findall(r'\w+', explanation_lower)}
            hits = sum(1 for w in kp_words if _stem(w) in expl_stems)
            is_covered = hits >= -(-len(kp_words) * 3 // 5)  # at least 60%: 2 of 2, 2 of 3, 3 of 4
        
        if is_covered:
            covered.append(kp)
        else:
            gaps.append(kp)
            
    coverage = len(covered) / max(1, len(key_points))
    
    word_count = len(re.findall(r'\w+', explanation))
    length_factor = 1.0
    if word_count < 10:
        length_factor = 0.3
    elif word_count < 25:
        length_factor = 0.6
        
    understanding_score = int(round(min(100, coverage * 100) * length_factor))
    misconceptions = []
    
    if gaps:
        followup_question = f"Bạn chưa đề cập tới '{gaps[0]}'. Bạn có thể giải thích thêm về điều này không?"
    else:
        followup_question = "Bạn có thể cho một ví dụ thực tế khác để chứng minh bạn đã hiểu sâu không?"
        
    feedback_vi = (
        f"Mức độ hiểu: {understanding_score}%\n"
        f"Đã đề cập: {len(covered)}/{len(key_points)} điểm chính.\n"
    )
    if understanding_score >= 70:
        feedback_vi += "Rất tốt! Bạn đã nắm bắt được ý chính.\n"
    else:
        feedback_vi += "Hãy xem lại những phần còn thiếu để hiểu sâu hơn.\n"
        
    feedback_vi += "\n(Lưu ý: Đánh giá offline chỉ kiểm tra từ khóa. Hãy bật Cloud AI để nhận nhận xét chi tiết hơn.)"
    
    return {
        "understanding_score": understanding_score,
        "covered": covered,
        "gaps": gaps,
        "misconceptions": misconceptions,
        "followup_question": followup_question,
        "feedback_vi": feedback_vi
    }
