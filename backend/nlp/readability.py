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
    
    if not nlp:
        return {"score": 5.0, "level": "Medium", "metrics": {}}

    text = clean_text(text)
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
