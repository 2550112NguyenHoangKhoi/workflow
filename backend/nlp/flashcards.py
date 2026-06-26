import re
import spacy
from typing import List, Dict

# Load the spaCy model globally to avoid reloading on every request
try:
    nlp = spacy.load("en_core_web_sm")
except Exception as e:
    print("Warning: en_core_web_sm not found. Flashcard algorithm might fail if spaCy is not installed.")
    nlp = None

def extract_flashcards(text: str, max_cards: int = 10) -> List[Dict[str, str]]:
    """
    Extracts candidate terms and their definitions to generate flashcards.
    Uses dependency parsing and regex patterns.
    """
    if not nlp:
        return _fallback_random_flashcards(text)

    from .preprocessor import clean_text, split_into_sentences_spacy
    text = clean_text(text)
    doc = nlp(text)
    
    flashcards = []
    seen_terms = set()
    
    # 1. Definitional Pattern Matching (Regex + spaCy)
    # Patterns like "X is a...", "X refers to...", "X is defined as..."
    patterns = [
        r'(?i)^([^,]{2,30})\s+(?:is|are)\s+(?:a|an|the|defined\s+as|known\s+as|referred\s+to\s+as)\s+(.+)',
        r'(?i)^([^,]{2,30})\s+(?:refers?\s+to)\s+(.+)'
    ]
    
    sentences = [sent.text.strip() for sent in doc.sents if len(sent.text.strip()) > 10]
    
    for sent in sentences:
        for pattern in patterns:
            match = re.search(pattern, sent)
            if match:
                term = match.group(1).strip()
                definition = match.group(2).strip()
                
                # Clean up terms
                if len(term.split()) <= 4 and term.lower() not in seen_terms:
                    flashcards.append({
                        "front": f"What is the definition of **{term}**?",
                        "back": definition.capitalize()
                    })
                    seen_terms.add(term.lower())
                break
                
    # 2. Dependency Parsing Fallback (Noun Chunks + ROOT 'be')
    # If we haven't found enough, look for sentences where the subject is a noun chunk
    # and the root verb is 'be'.
    if len(flashcards) < max_cards:
        for sent in doc.sents:
            if len(flashcards) >= max_cards:
                break
                
            # Find the root of the sentence
            root = [token for token in sent if token.head == token][0]
            if root.lemma_ == "be":
                # Find the subject
                nsubj = [token for token in sent if token.dep_ in ("nsubj", "nsubjpass") and token.head == root]
                attr = [token for token in sent if token.dep_ in ("attr", "acomp") and token.head == root]
                
                if nsubj and attr:
                    subject = nsubj[0]
                    # Get the full noun chunk for the subject
                    subject_chunk = ""
                    for chunk in sent.noun_chunks:
                        if subject in chunk:
                            subject_chunk = chunk.text
                            break
                    if not subject_chunk:
                        subject_chunk = subject.text
                        
                    if subject_chunk.lower() not in seen_terms and len(subject_chunk.split()) <= 4:
                        # Blank out the subject from the sentence to create the front
                        front_text = sent.text.replace(subject_chunk, "_______", 1)
                        flashcards.append({
                            "front": front_text,
                            "back": subject_chunk
                        })
                        seen_terms.add(subject_chunk.lower())

    # 3. Last Resort Fallback (TF-IDF / Noun extraction)
    if len(flashcards) < 3:
        for chunk in doc.noun_chunks:
            if len(flashcards) >= max_cards:
                break
            if len(chunk.text.split()) >= 2 and chunk.text.lower() not in seen_terms:
                sent = chunk.sent.text
                front_text = sent.replace(chunk.text, "_______", 1)
                flashcards.append({
                    "front": front_text,
                    "back": chunk.text
                })
                seen_terms.add(chunk.text.lower())

    # Format fallback if completely empty
    if not flashcards:
        return _fallback_random_flashcards(text)
        
    return flashcards[:max_cards]

def _fallback_random_flashcards(text: str) -> List[Dict[str, str]]:
    import random
    sentences = [s.strip() for s in re.split(r'(?<=[.!?]) +', text) if len(s.split()) > 5]
    if not sentences:
        return [{"front": "What is AI?", "back": "Artificial Intelligence is the simulation of human intelligence."}]
    
    flashcards = []
    for s in sentences[:10]:
        words = [w for w in s.split() if len(re.sub(r'[^a-zA-Z]', '', w)) >= 5]
        if words:
            target = random.choice(words)
            front = s.replace(target, "_______")
            target_clean = re.sub(r'[^a-zA-Z]', '', target)
            flashcards.append({"front": front, "back": target_clean})
    return flashcards
