import re

with open("backend/main.py", "r") as f:
    content = f.read()

patch = """
class VocabListSchema(BaseModel):
    words: list[WritingWordSchema]

@app.post("/api/vocabulary/generate")
async def generate_vocab(req: VocabGenerateRequest, db: Session = Depends(get_db)):
    current_key = get_api_key(req.api_key)
    if not current_key:
        raise HTTPException(status_code=400, detail="Vui lòng cung cấp Gemini API Key để tạo từ vựng bằng AI.")
        
    try:
        from core.agent import LocalAgentConfig, agent_run, FAST_CAPS
        config = LocalAgentConfig(
            api_key=current_key, 
            model="gemini-3.1-flash", 
            response_schema=VocabListSchema, 
            capabilities=FAST_CAPS
        )
        prompt = f"Generate a list of exactly 5 useful vocabulary words related to the topic: '{req.prompt}'. For each word, provide its phonetic transcription (ipa), part of speech (part_of_speech), Vietnamese meaning (meaning_vi), one English example sentence (example_en), and its Vietnamese translation (example_vi)."
        
        data = await agent_run(config, prompt)
        
        if not data or "words" not in data:
            return {"words": [], "added": 0}
            
        words = data["words"]
        added_count = 0
        
        # Query existing words
        query = db.query(models.VocabWord)
        if req.owner_email:
            query = query.filter(models.VocabWord.owner_email == req.owner_email)
        else:
            query = query.filter(models.VocabWord.owner_email.is_(None))
        existing_words = {w.word.lower(): w for w in query.all()}
        
        for w in words:
            w_lower = w["word"].strip().lower()
            if not w_lower: continue
            
            if w_lower not in existing_words:
                new_word = models.VocabWord(
                    word=w_lower,
                    meaning_vi=w.get("meaning_vi", ""),
                    ipa=w.get("ipa", ""),
                    part_of_speech=w.get("part_of_speech", ""),
                    example_en=w.get("example_en", ""),
                    example_vi=w.get("example_vi", ""),
                    owner_email=req.owner_email,
                    learned=0,
                    correct_count=0,
                    wrong_count=0,
                    interval=0,
                    ease=2.5,
                    repetitions=0,
                    due_date=datetime.date.today()
                )
                db.add(new_word)
                added_count += 1
                
        db.commit()
        return {"added": added_count, "words": words}
        
    except Exception as e:
        print(f"Generate vocab error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
"""

content = content.replace('class VocabGenerateRequest(BaseModel):', patch + '\nclass VocabGenerateRequest(BaseModel):')

with open("backend/main.py", "w") as f:
    f.write(content)
