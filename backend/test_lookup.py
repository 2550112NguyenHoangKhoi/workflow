import requests
def fetch_dict(word):
    try:
        r = requests.get(f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}", timeout=3)
        if r.status_code == 200:
            data = r.json()[0]
            ipa = data.get("phonetic") or (data.get("phonetics") and data["phonetics"][0].get("text")) or ""
            meanings = data.get("meanings", [])
            pos = meanings[0].get("partOfSpeech", "") if meanings else ""
            definition = meanings[0]["definitions"][0]["definition"] if meanings else ""
            example = meanings[0]["definitions"][0].get("example", "") if meanings else ""
            synonyms = []
            for m in meanings:
                synonyms.extend(m.get("synonyms", []))
            return {"word": word, "ipa": ipa, "part_of_speech": pos, "definition": definition, "example": example, "synonyms": list(set(synonyms))[:5]}
    except Exception as e:
        print(e)
    return None

print(fetch_dict("cat"))
