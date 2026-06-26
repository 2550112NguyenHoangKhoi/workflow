import re

def clean_text(text: str) -> str:
    """
    Normalizes whitespace and removes excessive boilerplate from text.
    """
    # Remove multiple newlines
    text = re.sub(r'\n+', '\n', text)
    # Remove multiple spaces
    text = re.sub(r' +', ' ', text)
    return text.strip()

def split_into_sentences_spacy(nlp, text: str) -> list[str]:
    """
    Uses spaCy to split text into robust sentences.
    """
    doc = nlp(text)
    return [sent.text.strip() for sent in doc.sents if len(sent.text.strip()) > 5]
