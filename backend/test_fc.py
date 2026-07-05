from nlp.flashcards import extract_flashcards

text = "The mitochondria is the powerhouse of the cell. Photosynthesis is how plants make food using sunlight, water, and carbon dioxide. We need to ameliorate the situation quickly."
cards = extract_flashcards(text)
for c in cards:
    print("F:", c['front'])
    print("B:", c['back'])
    print("-")
