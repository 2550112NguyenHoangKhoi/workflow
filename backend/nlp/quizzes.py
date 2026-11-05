import random
from typing import List, Dict
import spacy
from nltk.corpus import wordnet as wn

try:
    nlp = spacy.load("en_core_web_sm")
except Exception:
    nlp = None

# Nouns too generic to be a fair blank or a convincing wrong answer.
GENERIC_NOUNS = {
    "place", "process", "product", "way", "part", "type", "kind", "form", "thing", "number",
    "amount", "level", "stage", "result", "use", "example", "factor", "rate", "side", "area",
    "time", "case", "point", "fact", "idea", "effect", "role", "group", "set", "lot", "variety",
    "range", "order", "step", "method", "aspect", "feature", "member", "piece", "item", "word",
    "people", "person", "something", "everything", "today", "year", "day", "information",
}


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
    from .vietnamese import is_vietnamese

    text = clean_text(text)

    if is_vietnamese(text):
        return _vietnamese_quiz(text, num_questions)

    if not nlp:
        return _fallback_quiz(text)

    doc = nlp(text)
    
    questions = []
    # Find sentences that contain at least one Named Entity or important noun
    # Sentences that open with a pronoun ("It produces …") lose their subject once taken out
    # of context, so they make unanswerable questions.
    candidate_sentences = [sent for sent in doc.sents if len(sent.text.split()) > 8
                           and sent[0].pos_ != 'PRON' and sent[0].lower_ not in ('this', 'these', 'that', 'those', 'such')]
    random.shuffle(candidate_sentences)
    
    used_targets = set()

    # Distractor pools drawn from THIS document, so wrong answers are plausible and on-topic
    # (they used to be a canned list: "London", "Microsoft", "Albert Einstein", ...).
    ents_by_label = {}
    for ent in doc.ents:
        ents_by_label.setdefault(ent.label_, {})[ent.text.lower()] = ent.text
    doc_terms = {}
    for chunk in doc.noun_chunks:
        root = chunk.root
        if (root.pos_ in ('NOUN', 'PROPN') and len(root.text) > 3 and not root.is_stop
                and root.lemma_.lower() not in GENERIC_NOUNS):
            # Keep proper nouns / acronyms as written; common nouns lower-case (a sentence-initial
            # "Algae" must not be pasted mid-sentence as "requires Algae").
            keep = root.pos_ == 'PROPN' or root.text.isupper() or any(c.isupper() for c in root.text[1:])
            doc_terms.setdefault(root.text.lower(), root.text if keep else root.text.lower())

    def _resemblance(cand, target):
        """Higher = a more convincing wrong answer: same plural form, similar length, same
        capitalisation. "Mitochondria" next to "Place"/"Process" gave the answer away."""
        score = 0.0
        if cand.lower().endswith('s') == target.lower().endswith('s'):
            score += 1
        if cand[:1].isupper() == target[:1].isupper():
            score += 0.5
        score -= abs(len(cand) - len(target)) / 10
        return score + random.random() * 0.6  # keep some variety between runs

    def _from_doc(target_text, label=None, num=3):
        low = target_text.lower()
        same = [v for k, v in ents_by_label.get(label, {}).items() if k != low and low not in k and k not in low] if label else []
        others = [v for k, v in doc_terms.items() if k != low and low not in k and k not in low and v not in same]
        random.shuffle(same)
        others.sort(key=lambda c: -_resemblance(c, target_text))
        return (same + others)[:num]

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
                # Other dates from the text, then nearby years — never a non-date term.
                low = target_text.lower()
                distractors = [v for k, v in ents_by_label.get('DATE', {}).items() if k != low]
                random.shuffle(distractors)
                import re as _re
                years = _re.findall(r'\b(1[5-9]\d\d|20\d\d)\b', target_text)
                if years:
                    y = int(years[0])
                    for d in (-10, 5, 20, -3):
                        alt = target_text.replace(years[0], str(y + d))
                        if alt.lower() not in {x.lower() for x in distractors}:
                            distractors.append(alt)
            else:
                distractors = _from_doc(target_text, target.label_)
            if len(distractors) < 3:
                continue  # not enough on-topic wrong answers for a fair question
            distractors = distractors[:3]
            
        # 2. Fallback to Root Nouns
        if not target:
            nouns = [token for token in sent if token.pos_ in ['NOUN', 'PROPN'] and len(token.text) > 4
                     and token.lemma_.lower() not in GENERIC_NOUNS]
            if nouns:
                target = random.choice(nouns)
                target_text = target.text
                # Other terms from the same document first, then WordNet coordinate terms.
                distractors = _from_doc(target_text)
                if len(distractors) < 3:
                    distractors += [d for d in generate_distractors(target_text, num=3)
                                    if d.lower() not in {x.lower() for x in distractors}]
                if len(distractors) < 3:
                    continue  # skip this sentence if we can't build a good question
            else:
                continue
                
        if target_text.lower() in used_targets:
            continue
            
        used_targets.add(target_text.lower())
        
        # Build the question
        question_text = " ".join(sent.text.replace(target_text, "_______", 1).split())
        
        # Ensure we have exactly 3 distractors
        if len(distractors) > 3:
            distractors = distractors[:3]
        while len(distractors) < 3:
            distractors.append("None of the above")
            
        options_text = [target_text] + distractors
        random.shuffle(options_text)
        
        # Upper-case only the first letter: str.capitalize() turned "ATP" into "Atp".
        options = [{"id": chr(97+j), "text": str(opt)[:1].upper() + str(opt)[1:]} for j, opt in enumerate(options_text)]
        correct_id = [opt["id"] for opt in options if opt["text"].lower() == target_text.lower()][0]
        
        # Terms as written in the document (option labels are capitalised for display); the
        # true/false converter puts them back into the sentence.
        blank_at_start = question_text.startswith("_______")
        terms = {o["id"]: (str(t)[:1].upper() + str(t)[1:] if blank_at_start else str(t))
                 for o, t in zip(options, options_text)}
        questions.append({
            "question": question_text,
            "options": options,
            "terms": terms,
            "correct_option_id": correct_id,
            "answer": correct_id,
            "explanation": f"The correct missing entity or term from the source text is '{target_text}'."
        })
        
    if not questions:
        return _fallback_quiz(text)
        
    return {
        "title": "Algorithmically Generated MCQ Quiz",
        "questions": questions
    }


def _vietnamese_quiz(text: str, num_questions: int = 5) -> Dict:
    """Vietnamese MCQ quiz: blank a pyvi noun, distractors from other document nouns."""
    from .vietnamese import vi_clean_sentences, vi_nouns
    sentences = [s for s in vi_clean_sentences(text) if len(s.split()) > 6]
    doc_nouns = list({n for s in sentences for n in vi_nouns(s) if len(n) > 2})

    questions = []
    used = set()
    random.shuffle(sentences)
    for s in sentences:
        if len(questions) >= num_questions:
            break
        nouns = [n for n in vi_nouns(s) if n.lower() not in used and len(n) > 2]
        if not nouns:
            continue
        target = max(nouns, key=len)
        pool = [d for d in doc_nouns if d.lower() != target.lower()]
        if len(pool) < 3:
            continue
        distractors = random.sample(pool, 3)
        options_text = [target] + distractors
        random.shuffle(options_text)
        options = [{"id": chr(97 + j), "text": opt} for j, opt in enumerate(options_text)]
        correct_id = [o["id"] for o in options if o["text"] == target][0]
        questions.append({
            "question": s.replace(target, "_______", 1),
            "options": options,
            "correct_option_id": correct_id,
            "answer": correct_id,
            "explanation": f"Cụm từ đúng bị khuyết trong câu là '{target}'.",
        })
        used.add(target.lower())

    if not questions:
        return _fallback_quiz(text)
    return {"title": "Trắc nghiệm tự động (Tiếng Việt)", "questions": questions}


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
                "answer": correct_id,
                "explanation": f"The missing word is '{target_clean}'."
            })
            
    if not questions:
        questions = [{
            "question": "What is 2+2?",
            "options": [{"id": "a", "text": "3"}, {"id": "b", "text": "4"}, {"id": "c", "text": "5"}, {"id": "d", "text": "6"}],
            "correct_option_id": "b",
            "answer": "b",
            "explanation": "2+2 equals 4."
        }]

    return {
        "title": "Algorithmic Reading Comprehension Quiz",
        "questions": questions
    }
