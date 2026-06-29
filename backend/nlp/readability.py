import spacy
from typing import Dict

try:
    nlp = spacy.load("en_core_web_sm")
except Exception:
    nlp = None

def score_difficulty(text: str) -> Dict:
    """
    Scores the readability and difficulty of a text based on structural and semantic density.
    """
    from .preprocessor import clean_text
    from .vietnamese import is_vietnamese
    text = clean_text(text)

    if is_vietnamese(text):
        return _vietnamese_difficulty(text)

    if not nlp:
        return {"score": 5.0, "level": "Medium", "metrics": {}}

    doc = nlp(text)
    
    sents = list(doc.sents)
    words = [t for t in doc if t.is_alpha]
    
    if not sents or not words:
        return {"score": 0.0, "level": "Empty", "metrics": {}}
        
    avg_sent_len = len(words) / len(sents)
    ent_density = len(doc.ents) / max(len(words), 1)
    rare_ratio = sum(1 for t in words if len(t.text) > 7) / len(words)
    
    # Formula combining sentence length, entity density, and long words
    raw_score = (avg_sent_len * 0.3) + (ent_density * 40) + (rare_ratio * 15)
    
    # Normalize to a 1-10 scale approximately
    normalized_score = round(min(10.0, max(1.0, raw_score)), 1)
    
    if normalized_score < 4.0:
        level = "Beginner"
    elif normalized_score < 7.0:
        level = "Intermediate"
    else:
        level = "Advanced"
        
    return {
        "score": normalized_score,
        "level": level,
        "metrics": {
            "avg_sentence_length": round(avg_sent_len, 1),
            "entity_density": round(ent_density, 3),
            "rare_word_ratio": round(rare_ratio, 3)
        }
    }


def _vietnamese_difficulty(text: str) -> Dict:
    """Vietnamese readability without English NER: sentence length + lexical diversity + compound density."""
    from .vietnamese import vi_split_sentences, vi_pos
    from .vi_desegment import desegment
    sentences = vi_split_sentences(text)
    # De-glue PDF-extracted runs per sentence so glued syllables ("Côngthức") are
    # counted as two words, matching how the other generators see the text.
    # (desegment per sentence, not whole-text: it collapses newlines, which would
    # merge sentences and inflate the word/sentence ratio.)
    words = [w for s in sentences for (w, t) in vi_pos(desegment(s))]
    if not sentences or not words:
        return {"score": 0.0, "level": "Empty", "metrics": {}}
    avg_sentence_length = len(words) / len(sentences)
    lexical_diversity = len(set(w.lower() for w in words)) / len(words)
    compound_ratio = sum(1 for w in words if " " in w) / len(words)  # multi-syllable compounds = denser vocab
    score = round(min(10.0, max(1.0, avg_sentence_length * 0.25 + lexical_diversity * 6 + compound_ratio * 8)), 1)
    level = "Beginner" if score < 4 else "Intermediate" if score < 7 else "Advanced"
    return {
        "score": score,
        "level": level,
        "metrics": {
            "avg_sentence_length": round(avg_sentence_length, 1),
            "lexical_diversity": round(lexical_diversity, 3),
            "compound_ratio": round(compound_ratio, 3)
        }
    }
