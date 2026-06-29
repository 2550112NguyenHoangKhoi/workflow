import spacy
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from typing import Dict, List, Tuple
import networkx as nx
import re

try:
    nlp = spacy.load("en_core_web_sm")
except Exception:
    nlp = None

def _extract_definition_and_formula(concept: str, sentences: List[str], is_vn: bool = False) -> Tuple[str, str | None]:
    """
    Extracts a definition and a formula from a list of sentences where the concept occurs.
    """
    concept_lower = concept.lower()
    matching_sents = [s for s in sentences if concept_lower in s.lower()]
    
    # Definition heuristics
    en_def_indicators = [" is ", " are ", " refers to ", " is defined as ", " means ", " represents ", " is a ", " is an "]
    vi_def_indicators = [" là ", " định nghĩa là ", " nghĩa là ", " bao gồm ", " đề cập đến "]
    
    indicators = vi_def_indicators if is_vn else en_def_indicators
    definition = None
    
    # Priority 1: Sentence containing both the concept and a definition indicator immediately after it
    for sent in matching_sents:
        sent_lower = sent.lower()
        idx = sent_lower.find(concept_lower)
        if idx != -1:
            after_concept = sent_lower[idx + len(concept_lower):]
            if any(ind in after_concept[:50] for ind in indicators):
                definition = sent.strip()
                break
                
    # Priority 2: Sentence containing the concept and any definition indicator anywhere
    if not definition:
        for sent in matching_sents:
            if any(ind in sent.lower() for ind in indicators):
                definition = sent.strip()
                break
                
    # Priority 3: First sentence containing the concept
    if not definition and matching_sents:
        definition = matching_sents[0].strip()
        
    # Priority 4: Default generic sentence
    if not definition:
        if is_vn:
            definition = f"{concept.title()} là một khái niệm quan trọng liên quan đến chủ đề."
        else:
            definition = f"{concept.title()} is a key concept related to the topic."

    # Formula heuristics
    formula = None
    math_symbols = ["+", "-", "*", "/", "^", "√", "∑", "π", "θ", "λ"]
    math_keywords = ["formula", "equation", "calculate", "defined by", "given by", "where", "công thức", "phương trình", "tính bằng"]
    
    for sent in matching_sents:
        sent_lower = sent.lower()
        if "=" in sent_lower:
            parts = sent_lower.split("=")
            if len(parts) >= 2 and any(c.isalnum() for c in parts[0]) and any(c.isalnum() for c in parts[1]):
                if any(sym in sent_lower for sym in math_symbols) or any(kw in sent_lower for kw in math_keywords):
                    match = re.search(r'[a-zA-Z0-9_\(\)\s\+\-\*\/\.\^≈≠≤≥]+=[a-zA-Z0-9_\(\)\s\+\-\*\/\.\^≈≠≤≥]+', sent)
                    if match:
                        extracted = match.group(0).strip()
                        if len(extracted) > 3 and any(ch.isalpha() for ch in extracted):
                            formula = extracted
                            break
                    formula = sent.strip()
                    break

    return definition, formula

def generate_concept_map(text: str) -> Dict:
    """
    Extracts key concepts from text and clusters them using TF-IDF and NetworkX 
    to build a semantic relationship graph.
    """
    from .preprocessor import clean_text
    from .vietnamese import is_vietnamese

    text = clean_text(text)

    if is_vietnamese(text):
        return _vietnamese_concept_map(text)

    if not nlp:
        return {"nodes": [], "edges": []}

    doc = nlp(text)
    
    # Extract noun phrases as concepts
    concepts = [chunk.text.lower().strip() for chunk in doc.noun_chunks if len(chunk.text.split()) <= 3]
    
    # Filter common stop words and very short words
    concepts = list(set([c for c in concepts if len(c) > 3 and c not in nlp.Defaults.stop_words]))
    
    sentences = [sent.text.strip() for sent in doc.sents]
    
    if len(concepts) < 2:
        formatted_nodes = []
        for c in concepts:
            defn, form = _extract_definition_and_formula(c, sentences, is_vn=False)
            formatted_nodes.append({
                "id": c,
                "label": c.title(),
                "definition": defn,
                "formula": form
            })
        return {"nodes": formatted_nodes, "edges": []}
        
    G = nx.Graph()
    for c in concepts:
        G.add_node(c)
        
    # Add edges based on co-occurrence in sentences
    for sent in sentences:
        sent_lower = sent.lower()
        present_concepts = [c for c in concepts if c in sent_lower]
        for i in range(len(present_concepts)):
            for j in range(i + 1, len(present_concepts)):
                c1, c2 = present_concepts[i], present_concepts[j]
                if G.has_edge(c1, c2):
                    G[c1][c2]['weight'] += 1
                else:
                    G.add_edge(c1, c2, weight=1)
                    
    # Only keep the most important edges to avoid a hairball graph
    edges_list = sorted(G.edges(data=True), key=lambda x: x[2]['weight'], reverse=True)
    
    # Keep top 15 edges
    top_edges = edges_list[:15]
    
    # Build final graph dictionary
    nodes = set()
    edges = []
    
    for u, v, data in top_edges:
        nodes.add(u)
        nodes.add(v)
        edges.append({"source": u, "target": v, "weight": data['weight']})
        
    # Format for frontend (e.g., React Flow)
    formatted_nodes = []
    for n in nodes:
        defn, form = _extract_definition_and_formula(n, sentences, is_vn=False)
        formatted_nodes.append({
            "id": n,
            "label": n.title(),
            "definition": defn,
            "formula": form
        })
    
    return {
        "nodes": formatted_nodes,
        "edges": edges
    }

def _vietnamese_concept_map(text: str) -> Dict:
    """Concept map for Vietnamese text using pyvi noun extraction + co-occurrence."""
    from collections import Counter
    from .vietnamese import vi_nouns, vi_clean_sentences

    sentences = vi_clean_sentences(text)
    sent_nouns = []
    freq = Counter()
    for s in sentences:
        ns = list(dict.fromkeys(n.lower() for n in vi_nouns(s)))
        sent_nouns.append(ns)
        freq.update(ns)

    concepts = [w for w, _ in freq.most_common(12)]
    
    if len(concepts) < 2:
        formatted_nodes = []
        for c in concepts:
            defn, form = _extract_definition_and_formula(c, sentences, is_vn=True)
            formatted_nodes.append({
                "id": c,
                "label": c.title(),
                "definition": defn,
                "formula": form
            })
        return {"nodes": formatted_nodes, "edges": []}

    G = nx.Graph()
    for c in concepts:
        G.add_node(c)
    for ns in sent_nouns:
        present = [c for c in concepts if c in ns]
        for i in range(len(present)):
            for j in range(i + 1, len(present)):
                c1, c2 = present[i], present[j]
                if G.has_edge(c1, c2):
                    G[c1][c2]['weight'] += 1
                else:
                    G.add_edge(c1, c2, weight=1)

    top_edges = sorted(G.edges(data=True), key=lambda x: x[2]['weight'], reverse=True)[:15]
    nodes, edges = set(), []
    for u, v, data in top_edges:
        nodes.add(u)
        nodes.add(v)
        edges.append({"source": u, "target": v, "weight": data['weight']})

    # Ensure the strongest standalone concepts still render even without edges.
    if not nodes:
        nodes = set(concepts[:8])

    formatted_nodes = []
    for n in nodes:
        defn, form = _extract_definition_and_formula(n, sentences, is_vn=True)
        formatted_nodes.append({
            "id": n,
            "label": n.title(),
            "definition": defn,
            "formula": form
        })

    return {
        "nodes": formatted_nodes,
        "edges": edges
    }

def generate_offline_exam_prep(text: str) -> dict:
    from .preprocessor import clean_text
    from .vietnamese import is_vietnamese, vi_clean_sentences, vi_keywords
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    
    text = clean_text(text)
    is_vn = is_vietnamese(text)
    
    if is_vn:
        keywords = vi_keywords(text, top_n=3)
        title = f"Tài liệu ôn thi: {', '.join(keywords).title()}" if keywords else "Tài liệu ôn thi"
        sentences = vi_clean_sentences(text)
    else:
        if nlp:
            doc = nlp(text)
            sentences = [s.text.strip() for s in doc.sents]
            chunks = [chunk.text.lower().strip() for chunk in doc.noun_chunks if len(chunk.text.split()) <= 3]
            from collections import Counter
            common_chunks = [c for c, _ in Counter(chunks).most_common(3) if len(c) > 3 and c not in nlp.Defaults.stop_words]
            title = f"Exam Prep: {', '.join(common_chunks).title()}" if common_chunks else "Exam Prep Guide"
        else:
            sentences = [s.strip() for s in text.split(".") if s.strip()]
            title = "Exam Prep Guide"
            
    summary = ""
    key_points = []
    if len(sentences) >= 2:
        try:
            matrix = TfidfVectorizer().fit_transform(sentences)
            centrality = cosine_similarity(matrix).sum(axis=1)
            ranked_indices = centrality.argsort()[::-1]
            summary = "\n\n".join(sentences[i] for i in sorted(ranked_indices[:2]))
            key_points = [sentences[i] for i in sorted(ranked_indices[2:8])]
        except Exception:
            summary = "\n\n".join(sentences[:2])
            key_points = sentences[2:7]
    else:
        summary = text
        key_points = sentences
        
    md = f"# {title}\n\n"
    if is_vn:
        md += f"## Tổng quan học tập\n{summary}\n\n"
        md += "## Trọng tâm ôn tập (Kiến thức cốt lõi)\n"
        for i, pt in enumerate(key_points, 1):
            md += f"- **Kiến thức {i}**: {pt}\n"
    else:
        md += f"## Executive Summary / Overview\n{summary}\n\n"
        md += "## Key Learning Points (High Centrality Takeaways)\n"
        for i, pt in enumerate(key_points, 1):
            md += f"- **Key Point {i}**: {pt}\n"
            
    return {"title": title, "markdown_content": md}

def generate_offline_study_plan(text: str) -> dict:
    from .preprocessor import clean_text
    from .vietnamese import is_vietnamese, vi_clean_sentences, vi_keywords
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    
    text = clean_text(text)
    is_vn = is_vietnamese(text)
    
    if is_vn:
        keywords = vi_keywords(text, top_n=2)
        title = f"Giáo án học tập: {', '.join(keywords).title()}" if keywords else "Giáo án học tập"
        sentences = vi_clean_sentences(text)
    else:
        if nlp:
            doc = nlp(text)
            sentences = [s.text.strip() for s in doc.sents]
            chunks = [chunk.text.lower().strip() for chunk in doc.noun_chunks if len(chunk.text.split()) <= 3]
            from collections import Counter
            common_chunks = [c for c, _ in Counter(chunks).most_common(2) if len(c) > 3 and c not in nlp.Defaults.stop_words]
            title = f"Study Plan: {', '.join(common_chunks).title()}" if common_chunks else "Study Plan Guide"
        else:
            sentences = [s.strip() for s in text.split(".") if s.strip()]
            title = "Study Plan Guide"
            
    stage1_sents, stage2_sents, stage3_sents = [], [], []
    if len(sentences) >= 3:
        try:
            n = len(sentences)
            s1, s2, s3 = sentences[:n//3], sentences[n//3 : 2*n//3], sentences[2*n//3:]
            
            def get_top_sents(stage_sents, count=2):
                if not stage_sents: return []
                mat = TfidfVectorizer().fit_transform(stage_sents)
                cent = cosine_similarity(mat).sum(axis=1)
                ranked = cent.argsort()[::-1]
                return [stage_sents[i] for i in sorted(ranked[:count])]
                
            stage1_sents = get_top_sents(s1, 2)
            stage2_sents = get_top_sents(s2, 2)
            stage3_sents = get_top_sents(s3, 2)
        except Exception:
            n = len(sentences)
            stage1_sents = sentences[:min(2, n)]
            stage2_sents = sentences[n//3 : min(n//3 + 2, n)]
            stage3_sents = sentences[2*n//3 : min(2*n//3 + 2, n)]
    else:
        stage1_sents = sentences

    md = f"# {title}\n\n"
    if is_vn:
        md += "## Giai đoạn 1: Tiếp cận & Nền tảng (Thời gian: 1 - 2 ngày)\n"
        for s in stage1_sents: md += f"- *Khái niệm trọng tâm*: {s}\n"
        md += "\n## Giai đoạn 2: Chi tiết & Nghiên cứu sâu (Thời gian: 3 - 5 ngày)\n"
        for s in stage2_sents: md += f"- *Nội dung cần làm rõ*: {s}\n"
        md += "\n## Giai đoạn 3: Thực hành & Tự đánh giá (Thời gian: 1 - 2 ngày)\n"
        for s in stage3_sents: md += f"- *Ứng dụng & Kết luận*: {s}\n"
    else:
        md += "## Phase 1: Foundations & Core Terminology (Duration: 1-2 Days)\n"
        for s in stage1_sents: md += f"- *Foundational Point*: {s}\n"
        md += "\n## Phase 2: Deep Dive & Core Mechanism (Duration: 3-5 Days)\n"
        for s in stage2_sents: md += f"- *Core Detail*: {s}\n"
        md += "\n## Phase 3: Review & Self-Assessment (Duration: 1-2 Days)\n"
        for s in stage3_sents: md += f"- *Conclusion / Application*: {s}\n"
        
    return {"title": title, "markdown_content": md}

def generate_offline_learning_path(topic: str, db = None) -> dict:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    from .vietnamese import is_vietnamese, vi_nouns, vi_clean_sentences
    
    source_doc = None
    if db is not None:
        try:
            from db import models
            docs = db.query(models.Document).all()
            if docs:
                corpus = [topic] + [doc.content for doc in docs if doc.content]
                if len(corpus) > 1:
                    vectorizer = TfidfVectorizer()
                    tfidf = vectorizer.fit_transform(corpus)
                    similarities = cosine_similarity(tfidf[0:1], tfidf[1:]).flatten()
                    best_idx = similarities.argsort()[::-1][0]
                    if similarities[best_idx] > 0.05:
                        source_doc = docs[best_idx]
        except Exception as e:
            print(f"Error querying DB for path relevance: {e}")
            
    if source_doc:
        text = source_doc.content
        is_vn = is_vietnamese(text)
        if is_vn:
            sentences = vi_clean_sentences(text)
            concepts = vi_nouns(text)
            from collections import Counter
            unique_concepts = [c for c, _ in Counter(concepts).most_common(6)]
        else:
            if nlp:
                doc = nlp(text)
                sentences = [s.text.strip() for s in doc.sents]
                chunks = [chunk.text.lower().strip() for chunk in doc.noun_chunks if len(chunk.text.split()) <= 3]
                from collections import Counter
                unique_concepts = [c for c, _ in Counter(chunks).most_common(6) if len(c) > 3 and c not in nlp.Defaults.stop_words]
            else:
                sentences = [s.strip() for s in text.split(".") if s.strip()]
                unique_concepts = []
                
        if len(unique_concepts) >= 3:
            modules = []
            num_modules = 3
            concepts_per_module = len(unique_concepts) // num_modules
            for m_idx in range(num_modules):
                m_concepts = unique_concepts[m_idx * concepts_per_module : (m_idx + 1) * concepts_per_module]
                topics = []
                for c in m_concepts:
                    defn, form = _extract_definition_and_formula(c, sentences, is_vn)
                    desc = defn
                    if form: desc += f" (Formula: {form})"
                    topics.append({
                        "title": c.title(),
                        "description": desc[:150] + "..." if len(desc) > 150 else desc,
                        "estimated_time": "45 mins"
                    })
                
                module_title = f"Giai đoạn {m_idx+1}: " if is_vn else f"Module {m_idx+1}: "
                if m_idx == 0: module_title += "Khái niệm nền tảng" if is_vn else "Foundations"
                elif m_idx == 1: module_title += "Kiến thức chuyên sâu" if is_vn else "Core Mechanisms"
                else: module_title += "Ứng dụng & Tổng hợp" if is_vn else "Advanced Applications"
                
                modules.append({"title": module_title, "topics": topics})
                
            return {
                "title": f"Learning Path: {topic.title() if hasattr(topic, 'title') else topic}",
                "description": f"Offline generated path based on your document '{source_doc.filename}' regarding {topic}.",
                "modules": modules
            }
            
    # Default template fallback
    return {
        "title": f"Learning Path: {topic}",
        "description": f"An algorithmically generated structured path for mastering {topic}.",
        "modules": [
            {
                "title": f"Module 1: Introduction to {topic}",
                "topics": [
                    {"title": f"What is {topic}?", "description": f"Understanding the basic definition and scope of {topic}.", "estimated_time": "30 mins"},
                    {"title": "History and Evolution", "description": f"How the study of {topic} has evolved over time.", "estimated_time": "45 mins"}
                ]
            },
            {
                "title": "Module 2: Core Concepts",
                "topics": [
                    {"title": "Key Principles", "description": f"The fundamental building blocks and rules governing {topic}.", "estimated_time": "60 mins"},
                    {"title": "Important Terminology", "description": "A glossary of terms you must know.", "estimated_time": "45 mins"}
                ]
            },
            {
                "title": "Module 3: Advanced Applications",
                "topics": [
                    {"title": "Real-world Use Cases", "description": f"How {topic} is applied in practical scenarios and industry.", "estimated_time": "90 mins"},
                    {"title": "Next Steps", "description": "Resources and exercises to continue learning.", "estimated_time": "30 mins"}
                ]
            }
        ]
    }

def generate_offline_suggestions(text: str) -> dict:
    from .preprocessor import clean_text
    from .vietnamese import is_vietnamese, vi_nouns
    from collections import Counter
    import re
    
    text = clean_text(text)
    is_vn = is_vietnamese(text)
    
    if is_vn:
        concepts = vi_nouns(text)
        freq = Counter(concepts)
        most_common = [w for w, _ in freq.most_common(3)]
    else:
        if nlp:
            doc = nlp(text)
            chunks = [chunk.text.lower().strip() for chunk in doc.noun_chunks if len(chunk.text.split()) <= 3]
            freq = Counter(chunks)
            most_common = [c for c, _ in freq.most_common(3) if len(c) > 3 and c not in nlp.Defaults.stop_words]
        else:
            words = [re.sub(r'[^a-zA-Z]', '', w).lower() for w in text.split() if len(re.sub(r'[^a-zA-Z]', '', w)) > 5]
            freq = Counter(words)
            most_common = [word for word, count in freq.most_common(3)]
            
    path_topic = most_common[0].capitalize() if len(most_common) > 0 else "General Study"
    quiz_topic = most_common[1].capitalize() if len(most_common) > 1 else "Reading Comprehension"
    flashcard_topic = most_common[2].capitalize() if len(most_common) > 2 else "Vocabulary"
    
    if is_vn:
        return {
            "path_topic": f"Giới thiệu về {path_topic}",
            "quiz_topic": f"Các khái niệm {quiz_topic}",
            "flashcard_topic": f"Các thuật ngữ {flashcard_topic} trọng tâm"
        }
    else:
        return {
            "path_topic": f"Introduction to {path_topic}",
            "quiz_topic": f"{quiz_topic} Concepts",
            "flashcard_topic": f"Key {flashcard_topic} Terms"
        }

