import os
import re
import random
from fastapi import FastAPI, HTTPException, Header, UploadFile, File, Depends
from pydantic import BaseModel
from dotenv import load_dotenv

from google.antigravity import Agent, LocalAgentConfig

# Load env vars from parent directory .env if it exists
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

import sys
from pathlib import Path
from sqlalchemy.orm import Session
from db import models, crud
from db.database import engine, get_db

# Create DB tables
models.Base.metadata.create_all(bind=engine)

# --- PyInstaller Runtime Bootstrap ---
def setup_runtime_paths():
    if getattr(sys, "frozen", False):
        base = Path(sys._MEIPASS)
        # NLTK bundle path
        nltk_dir = base / "nltk_data"
        os.environ["NLTK_DATA"] = str(nltk_dir)
        try:
            import nltk
            nltk.data.path.insert(0, str(nltk_dir))
        except ImportError:
            pass
        return base
    return Path(__file__).resolve().parent.parent

BASE_DIR = setup_runtime_paths()

app = FastAPI()

# Check for API key
api_key = os.getenv("GEMINI_API_KEY") or os.getenv("VITE_GEMINI_API_KEY")

def get_api_key(x_api_key: str | None) -> str | None:
    if x_api_key and x_api_key.startswith("AIzaSy"):
        return x_api_key
    return api_key

# --- Schemas ---
class ChatRequest(BaseModel):
    message: str
    context: str = ""
    conversation_id: str = "default-session"

class FlashcardRequest(BaseModel):
    topic_or_text: str

class Flashcard(BaseModel):
    id: int | None = None
    front: str
    back: str
    interval: int | None = 1
    ease: float | None = 2.5
    repetitions: int | None = 0
    due_date: str | None = None

class FlashcardList(BaseModel):
    flashcards: list[Flashcard]

class LearningPathRequest(BaseModel):
    topic: str

class ModuleTopic(BaseModel):
    title: str
    description: str
    estimated_time: str

class LearningModule(BaseModel):
    title: str
    topics: list[ModuleTopic]

class LearningPathSchema(BaseModel):
    title: str
    description: str
    modules: list[LearningModule]

class QuizOption(BaseModel):
    id: str
    text: str

class QuizQuestion(BaseModel):
    question: str
    options: list[QuizOption]
    correct_option_id: str
    explanation: str

class QuizSchema(BaseModel):
    title: str
    questions: list[QuizQuestion]

class NoteSection(BaseModel):
    heading: str
    bullet_points: list[str]

class NoteSchema(BaseModel):
    title: str
    summary: str
    sections: list[NoteSection]

class TopicRequest(BaseModel):
    topic_or_text: str
    
class ReviewRequest(BaseModel):
    id: int | None = None
    interval: int
    ease: float
    repetitions: int
    due: str
    quality: int


class SuggestionSchema(BaseModel):
    path_topic: str
    quiz_topic: str
    flashcard_topic: str

class QuizSubmitRequest(BaseModel):
    document_id: int
    score: int
    total_questions: int

# --- Endpoints ---


@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest, x_api_key: str | None = Header(default=None)):
    current_key = get_api_key(x_api_key)
    if not current_key or current_key.startswith("AQ"):
        return {"response": "[Algorithm] The server is missing a valid GEMINI_API_KEY. I cannot chat with you algorithmically. Please add a key in Settings!"}

    try:
        config = LocalAgentConfig(api_key=current_key)
        prompt = f"Context:\n{request.context}\n\nUser Question:\n{request.message}"
        
        async with Agent(config) as agent:
            response = await agent.chat(prompt)
            response_text = await response.text()
            return {"response": response_text}
            
    except Exception as e:
        print(f"Error in agent chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate_flashcards")
async def generate_flashcards(request: FlashcardRequest, x_api_key: str | None = Header(default=None), db: Session = Depends(get_db)):
    current_key = get_api_key(x_api_key)
    if not current_key or current_key.startswith("AQ"):
        from nlp.flashcards import extract_flashcards
        cards = extract_flashcards(request.topic_or_text, max_cards=10)
        
        # Save to SQLite
        saved_cards = []
        for c in cards:
            db_card = crud.create_flashcard(db, front=c["front"], back=c["back"])
            saved_cards.append({
                "id": db_card.id,
                "front": db_card.front,
                "back": db_card.back,
                "interval": db_card.interval,
                "ease": db_card.ease,
                "repetitions": db_card.repetitions,
                "due_date": db_card.due_date.isoformat()
            })
        return {"flashcards": saved_cards}

    try:
        config = LocalAgentConfig(
            api_key=current_key,
            response_schema=FlashcardList
        )
        prompt = f"Generate 5 to 10 highly effective study flashcards based on the following topic or text. Ensure the front contains a clear question or concept, and the back contains a concise answer or definition.\n\nText:\n{request.topic_or_text}"
        
        async with Agent(config) as agent:
            response = await agent.chat(prompt)
            data = await response.structured_output()
            if not data:
                raise Exception("Failed to generate structured flashcards")
            return data
            
    except Exception as e:
        print(f"Error generating flashcards: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/documents/upload")
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    import tempfile, os, shutil
    import pdfplumber
    
    suffix = os.path.splitext(file.filename)[1].lower()
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        path = tmp.name
    
    try:
        text = ""
        if suffix == ".pdf":
            with pdfplumber.open(path) as pdf:
                for page in pdf.pages:
                    text += page.extract_text() + "\n"
        else:
            with open(path, "r", encoding="utf-8") as f:
                text = f.read()
                
        # Save to SQLite
        doc = crud.create_document(db, filename=file.filename, content=text)
        return {"id": doc.id, "filename": doc.filename, "upload_date": doc.upload_date.isoformat()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.unlink(path)

@app.get("/api/documents")
async def list_documents(db: Session = Depends(get_db)):
    docs = crud.get_documents(db)
    return {"documents": [{"id": d.id, "filename": d.filename, "upload_date": d.upload_date.isoformat(), "content": d.content} for d in docs]}

@app.post("/api/generate_path")
async def generate_path(request: LearningPathRequest, x_api_key: str | None = Header(default=None)):
    current_key = get_api_key(x_api_key)
    if not current_key or current_key.startswith("AQ"):
        return {
            "title": f"Learning Path: {request.topic}",
            "description": f"An algorithmically generated structured path for mastering {request.topic}.",
            "modules": [
                {
                    "title": f"Module 1: Introduction to {request.topic}",
                    "topics": [
                        {"title": f"What is {request.topic}?", "description": f"Understanding the basic definition and scope of {request.topic}.", "estimated_time": "30 mins"},
                        {"title": "History and Evolution", "description": "How this field has evolved over time.", "estimated_time": "45 mins"}
                    ]
                },
                {
                    "title": "Module 2: Core Concepts",
                    "topics": [
                        {"title": "Key Principles", "description": "The fundamental building blocks and rules.", "estimated_time": "60 mins"},
                        {"title": "Important Terminology", "description": "A glossary of terms you must know.", "estimated_time": "45 mins"}
                    ]
                },
                {
                    "title": "Module 3: Advanced Applications",
                    "topics": [
                        {"title": "Real-world Use Cases", "description": f"How {request.topic} is applied in industry.", "estimated_time": "90 mins"},
                        {"title": "Next Steps", "description": "Resources and projects to continue learning.", "estimated_time": "30 mins"}
                    ]
                }
            ]
        }

    try:
        config = LocalAgentConfig(
            api_key=current_key,
            response_schema=LearningPathSchema
        )
        prompt = f"Create a comprehensive, step-by-step learning path for the topic: '{request.topic}'. Break it down into logical modules, and each module should have specific topics with descriptions and estimated study times."
        
        async with Agent(config) as agent:
            response = await agent.chat(prompt)
            data = await response.structured_output()
            if not data:
                raise Exception("Failed to generate structured learning path")
            return data
            
    except Exception as e:
        print(f"Error generating learning path: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate_quiz")
async def generate_quiz(request: TopicRequest, x_api_key: str | None = Header(default=None)):
    current_key = get_api_key(x_api_key)
    if not current_key or current_key.startswith("AQ"):
        from nlp.quizzes import extract_quiz
        return extract_quiz(request.topic_or_text, num_questions=5)

    try:
        config = LocalAgentConfig(api_key=current_key, response_schema=QuizSchema)
        prompt = f"Generate a multiple-choice quiz (5 questions) based on this topic or text: '{request.topic_or_text}'. Ensure each question has 4 options, a correct option ID, and an explanation."
        async with Agent(config) as agent:
            response = await agent.chat(prompt)
            data = await response.structured_output()
            if not data: raise Exception("Failed to generate quiz")
            return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/quizzes/submit")
async def submit_quiz(request: QuizSubmitRequest, db: Session = Depends(get_db)):
    try:
        score_record = crud.create_quiz_score(
            db, 
            document_id=request.document_id, 
            score=request.score, 
            total_questions=request.total_questions
        )
        return {"success": True, "score_id": score_record.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/documents/{document_id}/progress")
async def get_document_progress(document_id: int, db: Session = Depends(get_db)):
    try:
        from nlp.readability import score_difficulty
        
        doc = db.query(models.Document).filter(models.Document.id == document_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
            
        readability = score_difficulty(doc.content)
        scores = crud.get_quiz_scores(db, document_id)
        
        total_quizzes = len(scores)
        average_score = 0
        latest_score = None
        
        if total_quizzes > 0:
            total_points = sum([s.score for s in scores])
            total_max = sum([s.total_questions for s in scores])
            if total_max > 0:
                average_score = (total_points / total_max) * 100
            
            latest = scores[-1]
            if latest.total_questions > 0:
                latest_score = (latest.score / latest.total_questions) * 100
                
        return {
            "readability": readability,
            "average_quiz_score": round(average_score, 1),
            "latest_score": round(latest_score, 1) if latest_score is not None else None,
            "total_quizzes_taken": total_quizzes
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate_notes")
async def generate_notes(request: TopicRequest, x_api_key: str | None = Header(default=None)):
    current_key = get_api_key(x_api_key)
    if not current_key or current_key.startswith("AQ"):
        from nlp.notes import extract_notes
        return extract_notes(request.topic_or_text)

    try:
        config = LocalAgentConfig(api_key=current_key, response_schema=NoteSchema)
        agent = Agent(config)
        prompt = f"""Generate extremely high-quality, structured study notes based on the following text.
Text: {request.topic_or_text}"""
        response = agent.run(prompt)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/flashcards/due")
async def get_due_flashcards(db: Session = Depends(get_db)):
    cards = crud.get_due_flashcards(db)
    return {"flashcards": [
        {
            "id": c.id, "front": c.front, "back": c.back,
            "interval": c.interval, "ease": c.ease, 
            "repetitions": c.repetitions, "due_date": c.due_date.isoformat()
        } for c in cards
    ]}

@app.post("/api/flashcards/review")
async def review_flashcard(request: ReviewRequest, db: Session = Depends(get_db)):
    from nlp.spaced_repetition import CardState, sm2_update
    state = CardState(
        interval=request.interval,
        ease=request.ease,
        repetitions=request.repetitions,
        due=request.due
    )
    new_state = sm2_update(state, request.quality)
    
    # If request has an ID, we update the DB
    # We need to add card_id to ReviewRequest
    if hasattr(request, "id") and getattr(request, "id") is not None:
        crud.update_flashcard_sm2(
            db, request.id, new_state.interval, new_state.ease, 
            new_state.repetitions, new_state.due
        )
    return new_state.model_dump()

@app.post("/api/score_difficulty")
async def score_text_difficulty(request: TopicRequest):
    from nlp.readability import score_difficulty
    return score_difficulty(request.topic_or_text)

@app.post("/api/generate_map")
async def generate_concept_map_endpoint(request: TopicRequest):
    from nlp.concept_map import generate_concept_map
    return generate_concept_map(request.topic_or_text)

if __name__ == "__main__":
    import uvicorn
    import sys
    
    is_frozen = getattr(sys, 'frozen', False)
    if is_frozen:
        uvicorn.run(app, host="127.0.0.1", port=8000, workers=1)
    else:
        uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

@app.post("/api/suggestions")
async def generate_suggestions(request: TopicRequest, x_api_key: str | None = Header(default=None)):
    current_key = get_api_key(x_api_key)
    
    # Fallback NLP Logic
    if not current_key or current_key.startswith("AQ"):
        # Very basic extraction: find the most frequent long word
        words = [re.sub(r'[^a-zA-Z]', '', w).lower() for w in request.topic_or_text.split() if len(re.sub(r'[^a-zA-Z]', '', w)) > 5]
        from collections import Counter
        most_common = [word for word, count in Counter(words).most_common(3)]
        
        path_topic = most_common[0].capitalize() if len(most_common) > 0 else "General Study"
        quiz_topic = most_common[1].capitalize() if len(most_common) > 1 else "Reading Comprehension"
        flashcard_topic = most_common[2].capitalize() if len(most_common) > 2 else "Vocabulary"
        
        return {
            "path_topic": f"Introduction to {path_topic}",
            "quiz_topic": f"{quiz_topic} Concepts",
            "flashcard_topic": f"Key {flashcard_topic} Terms"
        }

    try:
        config = LocalAgentConfig(api_key=current_key, response_schema=SuggestionSchema)
        prompt = f"""Analyze the following text corpus from a user's document library. Suggest 3 things: a topic for a structured learning path, a specific topic for a multiple-choice quiz, and a topic for a set of flashcards. Keep the suggestions concise.

Corpus:
{request.topic_or_text[:5000]}"""
        async with Agent(config) as agent:
            response = await agent.chat(prompt)
            data = await response.structured_output()
            if not data: raise Exception("Failed to generate suggestions")
            return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

