import os
import re
import random
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from dotenv import load_dotenv

from google.antigravity import Agent, LocalAgentConfig

# Load env vars from parent directory .env if it exists
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

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
    front: str
    back: str

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


class SuggestionSchema(BaseModel):
    path_topic: str
    quiz_topic: str
    flashcard_topic: str

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
async def generate_flashcards(request: FlashcardRequest, x_api_key: str | None = Header(default=None)):
    current_key = get_api_key(x_api_key)
    if not current_key or current_key.startswith("AQ"):
        from nlp.flashcards import extract_flashcards
        cards = extract_flashcards(request.topic_or_text, max_cards=10)
        return {"flashcards": cards}

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

@app.post("/api/generate_notes")
async def generate_notes(request: TopicRequest, x_api_key: str | None = Header(default=None)):
    current_key = get_api_key(x_api_key)
    if not current_key or current_key.startswith("AQ"):
        from nlp.notes import extract_notes
        return extract_notes(request.topic_or_text)

    try:
        config = LocalAgentConfig(api_key=current_key, response_schema=NoteSchema)
        prompt = f"Generate structured study notes summarizing this topic or text: '{request.topic_or_text}'. Include a main title, a brief summary, and multiple sections with bullet points."
        async with Agent(config) as agent:
            response = await agent.chat(prompt)
            data = await response.structured_output()
            if not data: raise Exception("Failed to generate notes")
            return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

