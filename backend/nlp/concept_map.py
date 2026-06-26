import spacy
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from typing import Dict, List
import networkx as nx

try:
    nlp = spacy.load("en_core_web_sm")
except Exception:
    nlp = None

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
    
    if len(concepts) < 2:
        return {"nodes": [{"id": c, "label": c} for c in concepts], "edges": []}
        
    # We need sentences to find co-occurrences
    sentences = [sent.text.lower() for sent in doc.sents]
    
    # Calculate TF-IDF vectors for sentences to find similarity
    # However, a simpler way to build a concept map is to link concepts that co-occur in the same sentence.
    
    G = nx.Graph()
    for c in concepts:
        G.add_node(c)
        
    # Add edges based on co-occurrence in sentences
    for sent in sentences:
        present_concepts = [c for c in concepts if c in sent]
        for i in range(len(present_concepts)):
            for j in range(i + 1, len(present_concepts)):
                c1, c2 = present_concepts[i], present_concepts[j]
                if G.has_edge(c1, c2):
                    G[c1][c2]['weight'] += 1
                else:
                    G.add_edge(c1, c2, weight=1)
                    
    # Only keep the most important edges to avoid a hairball graph
    # Filter edges with weight < threshold (e.g., must co-occur at least once, or keep top N)
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
    formatted_nodes = [{"id": n, "label": n.title()} for n in nodes]
    
    return {
        "nodes": formatted_nodes,
        "edges": edges
    }


def _vietnamese_concept_map(text: str) -> Dict:
    """Concept map for Vietnamese text using pyvi noun extraction + co-occurrence."""
    from collections import Counter
    from .vietnamese import vi_nouns, vi_split_sentences

    sentences = vi_split_sentences(text)
    sent_nouns = []
    freq = Counter()
    for s in sentences:
        ns = list(dict.fromkeys(n.lower() for n in vi_nouns(s)))
        sent_nouns.append(ns)
        freq.update(ns)

    concepts = [w for w, _ in freq.most_common(12)]
    if len(concepts) < 2:
        return {"nodes": [{"id": c, "label": c.title()} for c in concepts], "edges": []}

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

    return {
        "nodes": [{"id": n, "label": n.title()} for n in nodes],
        "edges": edges
    }
