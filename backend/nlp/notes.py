import spacy
import pytextrank
from typing import Dict

try:
    nlp = spacy.load("en_core_web_sm")
    # Add pytextrank to the spaCy pipeline
    nlp.add_pipe("textrank")
except Exception:
    nlp = None

def extract_notes(text: str) -> Dict:
    """
    Algorithmically extracts a smart summary and key bullet points using TextRank graph ranking.
    """
    from .preprocessor import clean_text
    from .vietnamese import is_vietnamese
    text = clean_text(text)

    if is_vietnamese(text):
        return _vietnamese_notes(text)

    if not nlp:
        return _fallback_notes(text)

    doc = nlp(text)
    
    # TextRank provides a summary method that yields the highest ranked sentences
    # based on the eigenvalue centrality of the phrases they contain.
    top_sentences = [sent.text.strip() for sent in doc._.textrank.summary(limit_sentences=8)]
    
    if len(top_sentences) == 0:
        return _fallback_notes(text)
        
    summary = " ".join(top_sentences[:2])
    
    key_points = top_sentences[2:6] if len(top_sentences) > 2 else top_sentences
    additional_points = top_sentences[6:] if len(top_sentences) > 6 else []
    
    sections = []
    if key_points:
        sections.append({"heading": "Key Information (TextRank Highest Centrality)", "bullet_points": key_points})
    if additional_points:
        sections.append({"heading": "Additional Salient Details", "bullet_points": additional_points})
        
    return {
        "title": "Algorithmically Extracted Notes",
        "summary": summary,
        "sections": sections
    }

def _vietnamese_notes(text: str) -> Dict:
    """Vietnamese extractive notes via TF-IDF sentence centrality (no spaCy / pytextrank)."""
    from .vietnamese import vi_clean_sentences
    sentences = vi_clean_sentences(text)
    if len(sentences) < 2:
        return _fallback_notes(text)
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    matrix = TfidfVectorizer().fit_transform(sentences)
    centrality = cosine_similarity(matrix).sum(axis=1)
    ranked = [int(i) for i in centrality.argsort()[::-1]]
    summary = " ".join(sentences[i] for i in ranked[:2])
    key_points = [sentences[i] for i in sorted(ranked[2:8])]  # keep document order
    sections = []
    if key_points:
        sections.append({"heading": "Ý chính (độ trung tâm TextRank)", "bullet_points": key_points})
    return {
        "title": "Ghi chú trích xuất (Tiếng Việt)",
        "summary": summary,
        "sections": sections
    }


def _fallback_notes(text: str) -> Dict:
    import re
    sentences = [s.strip() for s in re.split(r'(?<=[.!?]) +', text) if s.strip()]
    
    summary = " ".join(sentences[:2]) if sentences else "No text provided."
    
    key_points = []
    for s in sentences[2:10]:
        if any(keyword in s.lower() for keyword in [" is ", " are ", " important", " must", " key ", " defined"]):
            key_points.append(s)
    
    if not key_points:
        key_points = sentences[2:7]
        
    sections = []
    if key_points:
        sections.append({"heading": "Key Information", "bullet_points": key_points})
        
    other_points = sentences[10:15]
    if other_points:
        sections.append({"heading": "Additional Details", "bullet_points": other_points})

    return {
        "title": "Mock Notes",
        "summary": summary,
        "sections": sections
    }
