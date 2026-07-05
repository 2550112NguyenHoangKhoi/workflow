import requests
import json
import time
import argparse
from typing import List, Dict, Optional
from deep_translator import GoogleTranslator

# Free Dictionary API Endpoint
DICTIONARY_API_URL = "https://api.dictionaryapi.dev/api/v2/entries/en/{}"

def fetch_word_data(word: str) -> Optional[Dict]:
    """Fetches word details from Free Dictionary API."""
    try:
        response = requests.get(DICTIONARY_API_URL.format(word))
        if response.status_code == 200:
            data = response.json()[0]
            
            # Extract phonetic (prefer UK/US if available, fallback to default)
            phonetic = data.get("phonetic", "")
            if not phonetic and "phonetics" in data:
                for p in data["phonetics"]:
                    if p.get("text"):
                        phonetic = p["text"]
                        break
            
            # Extract first meaning
            if data.get("meanings"):
                meaning = data["meanings"][0]
                pos = meaning.get("partOfSpeech", "")
                
                if meaning.get("definitions"):
                    definition_data = meaning["definitions"][0]
                    definition = definition_data.get("definition", "")
                    example = definition_data.get("example", "")
                    
                    return {
                        "word": word,
                        "ipa": phonetic,
                        "part_of_speech": pos,
                        "definition_en": definition,
                        "example_en": example
                    }
        else:
            print(f"[-] Could not fetch data for '{word}' (Status: {response.status_code})")
    except Exception as e:
        print(f"[-] Error fetching '{word}': {e}")
    
    return None

def translate_to_vi(text: str) -> str:
    """Translates English text to Vietnamese using deep-translator."""
    if not text:
        return ""
    try:
        translator = GoogleTranslator(source='en', target='vi')
        return translator.translate(text)
    except Exception as e:
        print(f"[-] Translation error for '{text}': {e}")
        return ""

def process_words(words: List[str], delay: float = 1.0) -> List[Dict]:
    """Processes a list of words, fetches data, translates, and formats."""
    results = []
    
    for idx, word in enumerate(words):
        print(f"[{idx+1}/{len(words)}] Processing '{word}'...")
        
        data = fetch_word_data(word)
        if data:
            print(f"    -> Translating meanings and examples...")
            meaning_vi = translate_to_vi(data["definition_en"])
            example_vi = translate_to_vi(data["example_en"])
            
            vocab_entry = {
                "word": data["word"],
                "ipa": data["ipa"],
                "part_of_speech": data["part_of_speech"],
                "meaning_vi": meaning_vi,
                "example_en": data["example_en"],
                "example_vi": example_vi
            }
            results.append(vocab_entry)
            
            print(f"    [+] Success: {data['word']} - {meaning_vi}")
        
        # Respect API rate limits
        time.sleep(delay)
        
    return results

def main():
    parser = argparse.ArgumentParser(description="Bulk generate vocab bank entries.")
    parser.add_argument("--words", type=str, nargs="+", help="List of words to process")
    parser.add_argument("--file", type=str, help="Text file containing words (one per line)")
    parser.add_argument("--output", type=str, default="vocab_output.json", help="Output JSON file")
    
    args = parser.parse_args()
    
    words_to_process = []
    if args.words:
        words_to_process.extend(args.words)
    if args.file:
        try:
            with open(args.file, "r", encoding="utf-8") as f:
                words_to_process.extend([line.strip() for line in f if line.strip()])
        except Exception as e:
            print(f"Error reading file {args.file}: {e}")
            return

    if not words_to_process:
        print("No words provided. Use --words or --file.")
        print("Example: python build_vocab.py --words ubiquitous ephemeral pragmatic")
        return
        
    print(f"Starting processing for {len(words_to_process)} words...")
    results = process_words(words_to_process)
    
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=4)
        
    print(f"\n[+] Successfully saved {len(results)} entries to {args.output}")
    print("You can copy these JSON entries directly into backend/nlp/vocab_bank.py")

if __name__ == "__main__":
    main()
