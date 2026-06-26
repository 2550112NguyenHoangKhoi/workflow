import random
from typing import List, Dict
import spacy
from nltk.corpus import wordnet as wn

try:
    nlp = spacy.load("en_core_web_sm")
except Exception:
    nlp = None

def generate_distractors(word: str, num: int = 3) -> List[str]:
    """
    Generates plausible distractors using WordNet coordinate terms.
    """
    distractors = set()
    synsets = wn.synsets(word)
    if synsets:
        # Get the first synset (most common sense)
        synset = synsets[0]
        # Get coordinate terms (terms sharing the same hypernym)
        hypernyms = synset.hypernyms()
        if hypernyms:
            for hyponym in hypernyms[0].hyponyms():
                name = hyponym.lemma_names()[0].replace('_', ' ')
                if name.lower() != word.lower():
                    distractors.add(name)
                    if len(distractors) >= num * 3:
                        break
                        
    # Convert to list and randomly sample if we have enough
    dist_list = list(distractors)
    if len(dist_list) >= num:
        return random.sample(dist_list, num)
    return dist_list

def extract_quiz(text: str, num_questions: int = 5) -> Dict:
    """
    Algorithmically generates a multiple-choice quiz using NER and WordNet.
    """
    from .preprocessor import clean_text
    
    if not nlp:
        return _fallback_quiz(text)
        
    text = clean_text(text)
    doc = nlp(text)
    
    questions = []
    # Find sentences that contain at least one Named Entity or important noun
    candidate_sentences = [sent for sent in doc.sents if len(sent.text.split()) > 8]
    random.shuffle(candidate_sentences)
    
    used_targets = set()
    
    for sent in candidate_sentences:
        if len(questions) >= num_questions:
            break
            
        target = None
        target_text = ""
        
        # 1. Prefer Named Entities (ORG, PERSON, GPE, DATE)
        valid_ents = [ent for ent in sent.ents if ent.label_ in ['ORG', 'PERSON', 'GPE', 'DATE', 'LOC']]
        if valid_ents:
            target = random.choice(valid_ents)
            target_text = target.text
            # Try to get distractors based on entity type if possible, otherwise skip WordNet
            # Simple fallback for Entities:
            if target.label_ == 'DATE':
                distractors = ["1998", "2005", "1800s", "the 19th century"]
            else:
                distractors = ["London", "Microsoft", "Albert Einstein", "The United Nations"]
                
            distractors = random.sample([d for d in distractors if d.lower() != target_text.lower()], 3)
            
        # 2. Fallback to Root Nouns
        if not target:
            nouns = [token for token in sent if token.pos_ in ['NOUN', 'PROPN'] and len(token.text) > 4]
            if nouns:
                target = random.choice(nouns)
                target_text = target.text
                distractors = generate_distractors(target_text, num=3)
                # If wordnet fails to find enough distractors, we use generic ones from the document
                if len(distractors) < 3:
                    doc_nouns = list(set([t.text for t in doc if t.pos_ == 'NOUN' and len(t.text) > 4 and t.text.lower() != target_text.lower()]))
                    if len(doc_nouns) >= 3:
                        distractors = random.sample(doc_nouns, 3)
                    else:
                        continue # Skip this sentence if we can't build a good question
            else:
                continue
                
        if target_text.lower() in used_targets:
            continue
            
        used_targets.add(target_text.lower())
        
        # Build the question
        question_text = sent.text.replace(target_text, "_______", 1)
        
        # Ensure we have exactly 3 distractors
        if len(distractors) > 3:
            distractors = distractors[:3]
        while len(distractors) < 3:
            distractors.append("None of the above")
            
        options_text = [target_text] + distractors
        random.shuffle(options_text)
        
        options = [{"id": chr(97+j), "text": str(opt).capitalize()} for j, opt in enumerate(options_text)]
        correct_id = [opt["id"] for opt in options if opt["text"].lower() == target_text.lower()][0]
        
        questions.append({
            "question": question_text,
            "options": options,
            "correct_option_id": correct_id,
            "explanation": f"The correct missing entity or term from the source text is '{target_text}'."
        })
        
    if not questions:
        return _fallback_quiz(text)
        
    return {
        "title": "Algorithmically Generated MCQ Quiz",
        "questions": questions
    }


def _fallback_quiz(text: str) -> Dict:
    import re
    sentences = [s.strip() for s in re.split(r'(?<=[.!?]) +', text) if len(s.split()) > 5]
    all_long_words = list(set([re.sub(r'[^a-zA-Z]', '', w) for w in text.split() if len(re.sub(r'[^a-zA-Z]', '', w)) >= 5]))
    
    questions = []
    for i, s in enumerate(sentences[:5]):
        words = [w for w in s.split() if len(re.sub(r'[^a-zA-Z]', '', w)) >= 5]
        if words and len(all_long_words) >= 4:
            target = random.choice(words)
            target_clean = re.sub(r'[^a-zA-Z]', '', target)
            
            distractors = random.sample([w for w in all_long_words if w.lower() != target_clean.lower()], min(3, len(all_long_words)-1))
            options_text = [target_clean] + distractors
            random.shuffle(options_text)
            
            options = [{"id": chr(97+j), "text": opt} for j, opt in enumerate(options_text)]
            correct_id = [opt["id"] for opt in options if opt["text"] == target_clean][0]
            
            questions.append({
                "question": s.replace(target, "_______"),
                "options": options,
                "correct_option_id": correct_id,
                "explanation": f"The missing word is '{target_clean}'."
            })
            
    if not questions:
        questions = [{
            "question": "What is 2+2?",
            "options": [{"id": "a", "text": "3"}, {"id": "b", "text": "4"}, {"id": "c", "text": "5"}, {"id": "d", "text": "6"}],
            "correct_option_id": "b",
            "explanation": "2+2 equals 4."
        }]

    return {
        "title": "Algorithmic Reading Comprehension Quiz",
        "questions": questions
    }
