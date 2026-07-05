import nltk
from nltk.corpus import wordnet as wn
import difflib

# Find close matches in WordNet lemmas
lemmas = list(set(wn.all_lemma_names()))
print("Total lemmas:", len(lemmas))
matches = difflib.get_close_matches("amelorate", lemmas, n=3, cutoff=0.8)
print("Matches for 'amelorate':", matches)
