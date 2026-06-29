import os
import re
import random
import asyncio
import datetime
from fastapi import FastAPI, HTTPException, Header, UploadFile, File, Depends
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from google.antigravity import Agent, LocalAgentConfig, CapabilitiesConfig

# Single-shot generation config: disable the agent's builtin tools/subagents so we get a
# fast single model response (~8s) instead of a full coding-agent loop (~40s).
FAST_CAPS = CapabilitiesConfig(enable_subagents=False, enabled_tools=[])


# Run a one-shot Gemini generation with a HARD timeout. On timeout/error the caller falls
# back to the offline NLP engine, so the app never hangs on a slow/rate-limited AI call.
async def agent_run(config, prompt, structured=True, timeout=30):
    # Local-LLM engine: the UI sets the key to "LOCAL", so every generator that builds a
    # LocalAgentConfig(api_key="LOCAL", ...) is transparently routed to the local model here.
    # On any failure the caller's except-branch falls back to the offline NLP engine.
    if getattr(config, "api_key", None) == "LOCAL":
        from nlp.local_llm import local_generate
        schema = getattr(config, "response_schema", None)
        return await local_generate(prompt, structured=structured, schema=schema,
                                    timeout=max(timeout, 120))

    async def _call():
        async with Agent(config) as agent:
            response = await agent.chat(prompt)
            return await (response.structured_output() if structured else response.text())
    return await asyncio.wait_for(_call(), timeout=timeout)

# Load env vars from parent directory .env if it exists
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# Raw uploaded PDFs are kept here so the UI can render the real document (a true PDF
# viewer) instead of only its extracted text. Served by GET /api/documents/{id}/file.
from fastapi.responses import FileResponse
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")

import sys
from pathlib import Path
from sqlalchemy.orm import Session
from db import models, crud
from db.database import engine, get_db

# Startup schema-patching routine
def patch_database_schema(engine):
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    
    with engine.begin() as conn:
        if "users" in inspector.get_table_names():
            cols = [c["name"] for c in inspector.get_columns("users")]
            if "status" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN status VARCHAR DEFAULT 'free'"))

        if "chat_messages" in inspector.get_table_names():
            cols = [c["name"] for c in inspector.get_columns("chat_messages")]
            if "document_id" not in cols:
                conn.execute(text("ALTER TABLE chat_messages ADD COLUMN document_id INTEGER REFERENCES documents(id)"))
                
        if "artifacts" in inspector.get_table_names():
            cols = [c["name"] for c in inspector.get_columns("artifacts")]
            if "document_id" not in cols:
                conn.execute(text("ALTER TABLE artifacts ADD COLUMN document_id INTEGER REFERENCES documents(id)"))
                
        if "flashcards" in inspector.get_table_names():
            cols = [c["name"] for c in inspector.get_columns("flashcards")]
            if "project_id" not in cols:
                conn.execute(text("ALTER TABLE flashcards ADD COLUMN project_id INTEGER REFERENCES projects(id)"))
            if "document_id" not in cols:
                conn.execute(text("ALTER TABLE flashcards ADD COLUMN document_id INTEGER REFERENCES documents(id)"))

        if "project_members" in inspector.get_table_names():
            cols = [c["name"] for c in inspector.get_columns("project_members")]
            if "document_id" not in cols:
                conn.execute(text("ALTER TABLE project_members ADD COLUMN document_id INTEGER REFERENCES documents(id)"))

        if "project_invites" in inspector.get_table_names():
            cols = [c["name"] for c in inspector.get_columns("project_invites")]
            if "document_id" not in cols:
                conn.execute(text("ALTER TABLE project_invites ADD COLUMN document_id INTEGER REFERENCES documents(id)"))

        if "roadmap_items" in inspector.get_table_names():
            cols = [c["name"] for c in inspector.get_columns("roadmap_items")]
            if "active" not in cols:
                conn.execute(text("ALTER TABLE roadmap_items ADD COLUMN active INTEGER DEFAULT 0"))

patch_database_schema(engine)
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

# Allow the local frontend (Vite dev server on :5173 / Electron) to call the
# backend cross-origin at http://127.0.0.1:8000. Wildcard origin with
# allow_credentials=False (browsers reject "*" + credentials).
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Check for API key
api_key = os.getenv("GEMINI_API_KEY") or os.getenv("VITE_GEMINI_API_KEY")

def get_api_key(x_api_key: str | None) -> str | None:
    # Engine toggle from the UI (Settings → AI Engine):
    #   "OFFLINE" -> force the deterministic local NLP/algorithm engine (returns None).
    #   "LOCAL"   -> force the local downloaded LLM (Ollama); routed inside agent_run.
    if x_api_key == "OFFLINE":
        return None
    if x_api_key == "LOCAL":
        return "LOCAL"
    # Accept both Google AI Studio keys (AIzaSy...) and Antigravity keys (AQ...).
    if x_api_key and x_api_key.startswith(("AIzaSy", "AQ")):
        return x_api_key
    return api_key

# --- Schemas ---
class ChatRequest(BaseModel):
    message: str | None = None
    content: str | None = None
    role: str | None = None
    context: str | None = None
    api_key: str | None = None
    conversation_id: str = "default-session"
    project_id: int | None = None
    document_id: int | None = None
    persona: str | None = "friendly"

class UserLogin(BaseModel):
    email: str
    name: str
    picture: str | None = None

class FolderCreate(BaseModel):
    name: str

class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    folder_id: int | None = None

class ProjectInviteReq(BaseModel):
    email: str
    role: str

class UrlIngestRequest(BaseModel):
    url: str
    project_id: int | None = None

class FlashcardRequest(BaseModel):
    topic_or_text: str
    project_id: int | None = None
    document_id: int | None = None
    api_key: str | None = None

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

class LearningPathModule(BaseModel):
    title: str
    topics: list[ModuleTopic]

class LearningPathSchema(BaseModel):
    title: str
    description: str
    modules: list[LearningPathModule]

class SearchMaterialItem(BaseModel):
    title: str
    url: str
    snippet: str
    type: str
    relevancy_score: int

class SearchMaterialSchema(BaseModel):
    results: list[SearchMaterialItem]

class SearchRequest(BaseModel):
    query: str

class QuizOption(BaseModel):
    id: str
    text: str

class QuizQuestion(BaseModel):
    question: str
    options: list[QuizOption]
    correct_option_id: str
    answer: str | None = None
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
    api_key: str | None = None
    project_id: int | None = None
    document_id: int | None = None
    page_ranges: list[int] | None = None
    
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

class ConceptNodeSchema(BaseModel):
    id: str
    label: str
    definition: str = Field(description="A clear and concise definition or explanation of the concept")
    formula: str | None = Field(default=None, description="The mathematical or chemical formula associated with the concept, if applicable")

class ConceptEdgeSchema(BaseModel):
    source: str
    target: str
    weight: int

class ConceptMapSchema(BaseModel):
    nodes: list[ConceptNodeSchema]
    edges: list[ConceptEdgeSchema]

class QuizSubmitRequest(BaseModel):
    document_id: int
    score: int
    total_questions: int

class UpgradeRequest(BaseModel):
    email: str

class RoadmapItemUpdate(BaseModel):
    completed: bool | None = None
    active: bool | None = None

# --- Folder Endpoints ---
@app.post("/api/user/upgrade")
def upgrade_user(req: UpgradeRequest, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == req.email).first()
    if not db_user:
        db_user = models.User(email=req.email, name=req.email.split('@')[0], status="premium")
        db.add(db_user)
    else:
        db_user.status = "premium"
    db.commit()
    db.refresh(db_user)
    return {"status": "premium", "email": req.email}

@app.post("/api/auth/login")
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user_data.email).first()
    if db_user:
        db_user.last_login = datetime.datetime.utcnow()
        db_user.name = user_data.name
        if user_data.picture:
            db_user.picture = user_data.picture
        db.commit()
        db.refresh(db_user)
        return db_user
    else:
        new_user = models.User(email=user_data.email, name=user_data.name, picture=user_data.picture)
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user

@app.get("/api/user/stats")
def get_user_stats(email: str, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == email).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    doc_count = db.query(models.Document).count() # In a real app this would filter by user_id
    project_count = db.query(models.Project).count() # Same here
    
    return {
        "document_count": doc_count,
        "project_count": project_count,
        "last_login": db_user.last_login.isoformat() if db_user.last_login else None
    }

@app.get("/api/folders")
async def get_folders_api(db: Session = Depends(get_db)):
    folders = crud.get_folders(db)
    return [{"id": f.id, "name": f.name} for f in folders]

@app.post("/api/folders")
async def create_folder_api(folder: FolderCreate, db: Session = Depends(get_db)):
    return crud.create_folder(db, name=folder.name)

# --- Project Endpoints ---

@app.post("/api/projects")
async def create_project_api(project: ProjectCreate, db: Session = Depends(get_db)):
    return crud.create_project(db, name=project.name, description=project.description, folder_id=project.folder_id)

@app.get("/api/projects")
async def get_projects_api(folder_id: int | None = None, db: Session = Depends(get_db)):
    projects = crud.get_projects(db, folder_id=folder_id)
    result = []
    for p in projects:
        result.append({
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "folder_id": p.folder_id,
            "created_at": p.created_at,
            "source_count": len(p.documents)
        })
    return result

@app.get("/api/projects/{project_id}")
async def get_project_api(project_id: int, db: Session = Depends(get_db)):
    project = crud.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "created_at": project.created_at,
        "documents": [{"id": d.id, "filename": d.filename, "kind": d.kind, "upload_date": d.upload_date} for d in project.documents],
        "messages": [{"id": m.id, "role": m.role, "content": m.content, "persona": m.persona, "created_at": m.created_at} for m in project.messages]
    }

@app.post("/api/projects/{project_id}/invite")
def invite_member(project_id: int, req: ProjectInviteReq, db: Session = Depends(get_db)):
    proj = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    
    existing_invite = db.query(models.ProjectInvite).filter(
        models.ProjectInvite.project_id == project_id,
        models.ProjectInvite.email == req.email
    ).first()
    
    if existing_invite:
        return {"status": "Already invited"}
        
    new_invite = models.ProjectInvite(project_id=project_id, email=req.email, role=req.role)
    db.add(new_invite)
    db.commit()
    return {"status": "Invited successfully"}

@app.get("/api/projects/{project_id}/members")
def get_project_members(project_id: int, db: Session = Depends(get_db)):
    project = crud.get_project(db, project_id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    # In a local app, the owner is the current user. Since we don't have sessions, we mock the owner
    members = db.query(models.ProjectMember).filter(models.ProjectMember.project_id == project_id).all()
    invites = db.query(models.ProjectInvite).filter(models.ProjectInvite.project_id == project_id).all()
    
    # Return mock owner if members is empty (legacy projects)
    if not members:
        members_data = [{"email": "owner@local.app", "role": "owner"}]
    else:
        members_data = [{"email": m.email, "role": m.role} for m in members]
        
    return {
        "active": members_data,
        "pending": [{"email": i.email, "role": i.role, "status": i.status} for i in invites]
    }

@app.delete("/api/projects/{project_id}")
async def delete_project_api(project_id: int, db: Session = Depends(get_db)):
    success = crud.delete_project(db, project_id=project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"status": "ok"}

@app.get("/api/projects/{project_id}/roadmap")
async def get_project_roadmap(project_id: int, db: Session = Depends(get_db)):
    roadmap = crud.get_roadmap(db, project_id=project_id)
    if not roadmap:
        return {"items": []}
    return {"items": [{"id": i.id, "step_number": i.step_number, "title": i.title, "description": i.description, "completed": i.completed, "active": i.active} for i in sorted(roadmap.items, key=lambda x: x.step_number)]}

@app.post("/api/projects/{project_id}/roadmap/generate")
async def generate_project_roadmap(project_id: int, req: TopicRequest, db: Session = Depends(get_db)):
    project = crud.get_project(db, project_id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    # 1. Gather all document texts
    docs = crud.get_documents(db, project_id=project_id)
    text_content = ""
    for doc in docs:
        if doc.content:
            text_content += doc.content + "\n\n"
    if not text_content.strip():
        text_content = "Vui lòng cung cấp nội dung chung."

    # 2. Call roadmap generator
    from nlp.roadmap import generate_roadmap
    items = await generate_roadmap(text_content, api_key=req.api_key)
    
    # 3. Save to DB
    crud.create_roadmap(db, project_id=project_id, items=items)
    return {"status": "ok", "message": "Đã tạo giáo án"}

@app.get("/api/documents/{document_id}/roadmap")
async def get_document_roadmap(document_id: int, db: Session = Depends(get_db)):
    roadmap = db.query(models.Roadmap).filter(models.Roadmap.document_id == document_id).first()
    if not roadmap:
        return {"items": []}
    return {"items": [{"id": i.id, "step_number": i.step_number, "title": i.title, "description": i.description, "completed": i.completed, "active": i.active} for i in sorted(roadmap.items, key=lambda x: x.step_number)]}

@app.patch("/api/roadmap/items/{item_id}")
async def update_roadmap_item_endpoint(item_id: int, req: RoadmapItemUpdate, db: Session = Depends(get_db)):
    item = crud.update_roadmap_item(db, item_id=item_id, completed=req.completed, active=req.active)
    if not item:
        raise HTTPException(status_code=404, detail="Roadmap item not found")
    return {
        "id": item.id,
        "step_number": item.step_number,
        "title": item.title,
        "description": item.description,
        "completed": item.completed,
        "active": item.active
    }

@app.post("/api/documents/{document_id}/roadmap/generate")
async def generate_document_roadmap(document_id: int, req: TopicRequest, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not doc or not doc.content:
        return {"status": "error", "message": "Không tìm thấy nội dung tài liệu."}
    from nlp.roadmap import generate_roadmap
    items = await generate_roadmap(doc.content, api_key=req.api_key)
    
    old_roadmaps = db.query(models.Roadmap).filter(models.Roadmap.document_id == document_id).all()
    for rm in old_roadmaps:
        db.query(models.RoadmapItem).filter(models.RoadmapItem.roadmap_id == rm.id).delete()
        db.delete(rm)
    db.commit()
    
    db_roadmap = models.Roadmap(document_id=document_id)
    db.add(db_roadmap)
    db.commit()
    db.refresh(db_roadmap)
    for i, item in enumerate(items):
        db_item = models.RoadmapItem(
            roadmap_id=db_roadmap.id,
            step_number=i + 1,
            title=item.get("title", ""),
            description=item.get("description", "")
        )
        db.add(db_item)
    db.commit()
    return {"status": "ok", "message": "Đã tạo giáo án cho tài liệu"}

@app.get("/api/documents/{document_id}/members")
def get_document_members(document_id: int, db: Session = Depends(get_db)):
    members = db.query(models.ProjectMember).filter(models.ProjectMember.document_id == document_id).all()
    invites = db.query(models.ProjectInvite).filter(models.ProjectInvite.document_id == document_id).all()
    if not members:
        members_data = [{"email": "owner@local.app", "role": "owner"}]
    else:
        members_data = [{"email": m.email, "role": m.role} for m in members]
    return {
        "active": members_data,
        "pending": [{"email": i.email, "role": i.role, "status": i.status} for i in invites]
    }

@app.post("/api/documents/{document_id}/invite")
def invite_document_member(document_id: int, req: ProjectInviteReq, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    exist = db.query(models.ProjectInvite).filter(models.ProjectInvite.document_id == document_id, models.ProjectInvite.email == req.email).first()
    if exist:
        return {"status": "Already invited"}
    invite = models.ProjectInvite(document_id=document_id, email=req.email, role=req.role)
    db.add(invite)
    db.commit()
    return {"status": "Invited"}

@app.get("/api/projects/{project_id}/artifacts")
async def get_project_artifacts(project_id: int, db: Session = Depends(get_db)):
    artifacts = crud.get_artifacts(db, project_id=project_id)
    return [{"id": a.id, "type": a.type, "title": a.title, "content": a.content, "created_at": a.created_at} for a in artifacts]

@app.get("/api/documents/{document_id}/artifacts")
async def get_document_artifacts(document_id: int, db: Session = Depends(get_db)):
    artifacts = crud.get_artifacts(db, document_id=document_id)
    return [{"id": a.id, "type": a.type, "title": a.title, "content": a.content, "created_at": a.created_at} for a in artifacts]

@app.get("/api/documents/{document_id}/notes")
async def get_document_notes_api(document_id: int, db: Session = Depends(get_db)):
    # Check if artifact exists
    artifact = db.query(models.Artifact).filter(models.Artifact.document_id == document_id, models.Artifact.type == 'smart_notes').first()
    if artifact:
        import json
        return json.loads(artifact.content)
    
    # Generate notes if not exists
    text = get_document_text(db, document_id)
    from nlp.notes import extract_notes
    notes_dict = extract_notes(text)
    
    # Save it
    import json
    new_artifact = models.Artifact(
        document_id=document_id,
        type='smart_notes',
        title=notes_dict.get('title', 'Smart Notes'),
        content=json.dumps(notes_dict, ensure_ascii=False)
    )
    db.add(new_artifact)
    db.commit()
    
    return notes_dict

# --- AI Engine ---

@app.get("/api/engine/local_status")
async def engine_local_status():
    """Whether a local downloaded model (Ollama) is reachable, for the Settings checker."""
    from nlp.local_llm import status
    return status()

# --- Endpoints ---

def offline_doc_answer(message: str, db: Session, context: str = "") -> str:
    """Offline chat: answer from the active (context) or latest document via TF-IDF sentence retrieval."""
    try:
        source_text = context.strip() if context and len(context.strip()) > 30 else ""
        label = "tài liệu đang chọn"
        if not source_text:
            doc = db.query(models.Document).order_by(models.Document.id.desc()).first()
            if not doc or not doc.content or not doc.content.strip():
                return "📂 [Offline] Chưa có tài liệu nào trong thư viện. Hãy Upload một tài liệu để mình trả lời dựa trên nội dung của nó."
            source_text = doc.content
            label = doc.filename
            
        import re
        from nlp.vietnamese import VIETNAMESE_STOPWORDS, is_vietnamese
        
        # Split by punctuation OR by newlines to handle bullet points and math cheatsheets better
        sentences = [s.strip() for s in re.split(r'(?<=[.!?…])\s+|\n+', source_text) if len(s.strip()) > 3]
        if not sentences:
            return "📄 [Offline] Tài liệu hiện chưa có nội dung văn bản để trích xuất."
            
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
        
        stop_words = list(VIETNAMESE_STOPWORDS) if is_vietnamese(source_text) else "english"
        
        # For answering questions
        if message and message.strip() and not any(kw in message.lower() for kw in ["tóm tắt", "summary", "summarize"]):
            try:
                matrix = TfidfVectorizer(stop_words=stop_words).fit_transform(sentences + [message])
                sims = cosine_similarity(matrix[-1], matrix[:-1]).flatten()
                ranked = [int(i) for i in sims.argsort()[::-1] if sims[int(i)] > 0.01][:4]
                if ranked:
                    answer = "\n".join("- " + sentences[i] for i in ranked)
                    return f"📚 [Offline · trích từ {label}]\n\n{answer}"
            except Exception:
                pass
                
        # Fall back to an extractive summary using TF-IDF sentence centrality.
        try:
            doc_matrix = TfidfVectorizer(stop_words=stop_words).fit_transform(sentences)
            centrality = (doc_matrix * doc_matrix.T).toarray().sum(axis=1)
            top = sorted(sorted(range(len(sentences)), key=lambda i: centrality[i], reverse=True)[:5])
            summary = "\n".join("- " + sentences[i] for i in top)
            return f"📝 [Offline · tóm tắt {label}]\n\n{summary}"
        except Exception:
            # If TF-IDF fails (e.g. not enough words), just return the first few sentences
            return f"📝 [Offline · tóm tắt {label}]\n\n" + "\n".join("- " + s for s in sentences[:5])
            
    except Exception as e:
        return f"⚠️ [Offline] Lỗi khi truy xuất tài liệu: {e}"


PERSONA_PROMPTS = {
    "Gia sư thân thiện": "You are Workflow Assistant, a friendly tutor. Giảng bài cặn kẽ, rõ ràng, luôn khích lệ, tóm tắt các điểm chính. Trả lời bằng tiếng Việt hoặc tiếng Anh tuỳ ngôn ngữ của học sinh.",
    "Coach nghiêm túc": "You are Workflow Coach, a strict and direct mentor. Dùng từ ngữ ngắn gọn, đi thẳng vào vấn đề, yêu cầu học sinh làm bài tập. Không giải thích dông dài. Trả lời bằng tiếng Việt hoặc tiếng Anh tuỳ ngôn ngữ của học sinh.",
    "Socratic hỏi gợi mở": "You are Socratic Workflow, a mentor. Dẫn dắt bằng câu hỏi gợi mở, không bật đáp án ngay. Luôn hỏi 1-2 câu cho học sinh tự suy luận trước. Trả lời bằng tiếng Việt hoặc tiếng Anh tuỳ ngôn ngữ của học sinh.",
    "Bạn học Gen Z": "You are Workflow Buddy, a Gen-Z peer. Trẻ trung, năng lượng, dùng bullet ngắn gọn, ví dụ vui vẻ dễ nhớ, luôn có bước tiếp theo. Trả lời bằng tiếng Việt hoặc tiếng Anh tuỳ ngôn ngữ của học sinh."
}

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest, db: Session = Depends(get_db)):
    message_text = request.message or request.content
    if not message_text:
        raise HTTPException(status_code=400, detail="Message/content required")
        
    role = request.role or "user"
    
    if request.project_id or request.document_id:
        crud.save_chat_message(db, project_id=request.project_id, role=role, content=message_text, persona=request.persona, document_id=request.document_id)

    context = request.context or ""
    if request.project_id and not context:
        project = crud.get_project(db, request.project_id)
        if project:
            sources = [doc.content for doc in project.documents if doc.content]
            context = "\n\n---\n\n".join(sources)[:30000]
    elif request.document_id and not context:
        doc = db.query(models.Document).filter(models.Document.id == request.document_id).first()
        if doc and doc.content:
            context = doc.content[:30000]
            
    persona_prompt = PERSONA_PROMPTS.get(request.persona, PERSONA_PROMPTS["Gia sư thân thiện"])
    
    active_step_context = ""
    if request.project_id:
        rm = db.query(models.Roadmap).filter(models.Roadmap.project_id == request.project_id).first()
        if rm:
            active_item = db.query(models.RoadmapItem).filter(models.RoadmapItem.roadmap_id == rm.id, models.RoadmapItem.active == 1).first()
            if active_item:
                active_step_context = f"Chủ đề người học đang tập trung trong lộ trình: '{active_item.title}' - Mô tả: '{active_item.description}'."
    elif request.document_id:
        rm = db.query(models.Roadmap).filter(models.Roadmap.document_id == request.document_id).first()
        if rm:
            active_item = db.query(models.RoadmapItem).filter(models.RoadmapItem.roadmap_id == rm.id, models.RoadmapItem.active == 1).first()
            if active_item:
                active_step_context = f"Chủ đề người học đang tập trung trong lộ trình: '{active_item.title}' - Mô tả: '{active_item.description}'."

    if active_step_context:
        persona_prompt = f"{active_step_context}\n{persona_prompt}"
    
    current_key = get_api_key(request.api_key)
    response_text = ""
    if current_key:
        try:
            config = LocalAgentConfig(api_key=current_key, model="gemini-3.1-flash-lite", capabilities=FAST_CAPS)
            prompt = (
                f"{persona_prompt}\n\nUsing the document context below, answer the question.\n"
                f"Context:\n{context}\n\nQuestion: {message_text}"
            )
            response_text = await agent_run(config, prompt, structured=False)
        except Exception as e:
            print(f"[chat] AI failed, falling back to offline: {e}")
            
    if not response_text:
        response_text = offline_doc_answer(message_text, db, context)

    msg_id = None
    if request.project_id or request.document_id:
        msg = crud.save_chat_message(db, project_id=request.project_id, role="assistant", content=response_text, persona=request.persona, document_id=request.document_id)
        msg_id = msg.id

    return {"id": msg_id, "response": response_text}

@app.get("/api/projects/{project_id}/messages")
async def get_project_messages_api(project_id: int, db: Session = Depends(get_db)):
    messages = crud.get_chat_history(db, project_id=project_id)
    return {
        "messages": [
            {
                "id": m.id, "role": m.role, "content": m.content, 
                "persona": m.persona, "created_at": m.created_at.isoformat() if m.created_at else None
            } for m in messages
        ]
    }

@app.get("/api/documents/{document_id}/messages")
async def get_document_messages_api(document_id: int, db: Session = Depends(get_db)):
    messages = crud.get_chat_history(db, document_id=document_id)
    return {
        "messages": [
            {
                "id": m.id, "role": m.role, "content": m.content, 
                "persona": m.persona, "created_at": m.created_at.isoformat() if m.created_at else None
            } for m in messages
        ]
    }

@app.post("/api/generate_flashcards")
async def generate_flashcards(request: FlashcardRequest, db: Session = Depends(get_db)):
    text_to_process = request.topic_or_text
    if request.document_id:
        doc_text = get_document_text(db, request.document_id)
        if doc_text.strip():
            text_to_process = doc_text

    def _save(cards):
        out = []
        for c in cards:
            db_card = crud.create_flashcard(db, front=c.get("front", ""), back=c.get("back", ""), project_id=request.project_id, document_id=request.document_id)
            out.append({
                "id": db_card.id, "front": db_card.front, "back": db_card.back,
                "interval": db_card.interval, "ease": db_card.ease,
                "repetitions": db_card.repetitions, "due_date": db_card.due_date.isoformat()
            })
        return out

    current_key = get_api_key(request.api_key)
    if current_key and not current_key.startswith("AQ"):
        try:
            config = LocalAgentConfig(api_key=current_key, model="gemini-3.1-flash-lite", response_schema=FlashcardList, capabilities=FAST_CAPS)
            prompt = f"Generate 5 to 10 highly effective study flashcards based on the following topic or text. Front = a clear question or concept, back = a concise answer or definition. Use the SAME language as the text.\n\nText:\n{text_to_process}"
            data = await agent_run(config, prompt)
            if data and data.get("flashcards"):
                return {"flashcards": _save(data["flashcards"])}
        except Exception as e:
            print(f"[flashcards] AI failed, falling back to offline: {e}")
    # Offline NLP engine (default + fallback)
    from nlp.flashcards import extract_flashcards
    return {"flashcards": _save(extract_flashcards(text_to_process, max_cards=10))}

from fastapi import Form

@app.post("/api/documents/upload")
def upload_document(
    file: UploadFile = File(...),
    project_id: int | None = Form(None),
    db: Session = Depends(get_db)
):
    import tempfile, os, shutil
    
    suffix = os.path.splitext(file.filename)[1].lower()
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        path = tmp.name
    
    try:
        text = ""
        kind = "document"
        page_count = None
        pages_data = None
        
        if suffix == ".pdf":
            kind = "pdf"
            import pdfplumber
            try:
                with pdfplumber.open(path) as pdf:
                    pages = []
                    for page in pdf.pages:
                        page_text = (page.extract_text() or "") + "\n"
                        pages.append(page_text)
                        text += page_text
                    page_count = len(pages)
                    pages_data = json.dumps(pages)
            except Exception:
                pass
        elif suffix in [".docx"]:
            kind = "docx"
            try:
                import docx
                d = docx.Document(path)
                text = "\n".join([p.text for p in d.paragraphs])
            except ImportError:
                pass
        elif suffix in [".png", ".jpg", ".jpeg", ".webp"]:
            kind = "image"
            try:
                import pytesseract
                from PIL import Image
                text = pytesseract.image_to_string(Image.open(path), lang="vie+eng")
            except Exception:
                pass
        elif suffix in [".mp4", ".mp3", ".m4a", ".wav"]:
            kind = "audio" if suffix in [".mp3", ".m4a", ".wav"] else "video"
            try:
                from faster_whisper import WhisperModel
                model = WhisperModel("tiny", device="cpu", compute_type="int8")
                segments, info = model.transcribe(path)
                text = "\n".join([segment.text for segment in segments])
            except Exception:
                pass
        else:
            try:
                with open(path, "r", encoding="utf-8") as f:
                    text = f.read()
            except Exception:
                pass
                
        doc = crud.create_document(db, filename=file.filename, content=text, kind=kind, project_id=project_id, page_count=page_count, pages_data=pages_data)
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        shutil.copyfile(path, os.path.join(UPLOAD_DIR, f"{doc.id}{suffix}"))
        return {"id": doc.id, "filename": doc.filename, "kind": doc.kind, "upload_date": doc.upload_date.isoformat()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.unlink(path)

@app.post("/api/documents/ingest_url")
@app.post("/api/documents/url")
def ingest_url(request: UrlIngestRequest, db: Session = Depends(get_db)):
    url = request.url
    text = ""
    filename = url
    kind = "link"
    
    if "youtube.com" in url or "youtu.be" in url:
        kind = "video"
        try:
            from youtube_transcript_api import YouTubeTranscriptApi
            import urllib.parse
            if "youtu.be" in url:
                video_id = url.split("/")[-1].split("?")[0]
            else:
                parsed = urllib.parse.urlparse(url)
                video_id = urllib.parse.parse_qs(parsed.query).get('v', [None])[0]
            if video_id:
                try:
                    transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=['vi', 'en'])
                    text = "\n".join([t['text'] for t in transcript])
                    filename = f"YouTube: {video_id}"
                except Exception:
                    pass
        except ImportError:
            pass
    else:
        try:
            import trafilatura
            downloaded = trafilatura.fetch_url(url)
            if downloaded:
                text = trafilatura.extract(downloaded) or ""
        except ImportError:
            pass
            
    doc = crud.create_document(db, filename=filename, content=text, kind=kind, project_id=request.project_id)
    return {"id": doc.id, "filename": doc.filename, "kind": doc.kind, "upload_date": doc.upload_date.isoformat()}

@app.get("/api/documents")
async def list_documents(project_id: int = None, db: Session = Depends(get_db)):
    docs = crud.get_documents(db, project_id=project_id)
    import glob
    def has_file(doc):
        suffix = os.path.splitext(doc.filename)[1].lower()
        file_path = os.path.join(UPLOAD_DIR, f"{doc.id}{suffix}")
        if os.path.exists(file_path):
            return True
        files = [f for f in glob.glob(os.path.join(UPLOAD_DIR, f"{doc.id}.*"))]
        if suffix != '.txt':
            files = [f for f in files if not f.endswith('.txt')]
        return len(files) > 0
    return {"documents": [{"id": d.id, "filename": d.filename, "kind": d.kind, "upload_date": d.upload_date.isoformat(), "content": d.content,
                           "project_id": d.project_id, "has_file": has_file(d)} for d in docs]}

@app.get("/api/documents/{document_id}/file")
async def get_document_file(document_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    suffix = os.path.splitext(doc.filename)[1].lower()
    file_path = os.path.join(UPLOAD_DIR, f"{doc.id}{suffix}")
    if not os.path.exists(file_path):
        import glob
        files = [f for f in glob.glob(os.path.join(UPLOAD_DIR, f"{document_id}.*"))]
        if suffix != '.txt':
            files = [f for f in files if not f.endswith('.txt')]
        if not files:
            raise HTTPException(status_code=404, detail="No source file stored for this document")
        file_path = files[0]
        
    ext = os.path.splitext(file_path)[1].lower()
    media_types = {
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".mp4": "video/mp4",
        ".mp3": "audio/mpeg",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".txt": "text/plain"
    }
    media_type = media_types.get(ext, "application/octet-stream")
    return FileResponse(
        file_path, 
        media_type=media_type, 
        filename=os.path.basename(file_path),
        content_disposition_type="inline"
    )

@app.delete("/api/documents/{document_id}")
async def remove_document(document_id: int, db: Session = Depends(get_db)):
    ok = crud.delete_document(db, document_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"success": True, "deleted_id": document_id}

@app.post("/api/generate_path")
async def generate_path(request: LearningPathRequest, x_api_key: str | None = Header(default=None), db: Session = Depends(get_db)):
    current_key = get_api_key(x_api_key)
    if current_key and not current_key.startswith("AQ"):
        try:
            config = LocalAgentConfig(
                api_key=current_key,
                response_schema=LearningPathSchema
            )
            prompt = f"Create a comprehensive, step-by-step learning path for the topic: '{request.topic}'. Break it down into logical modules, and each module should have specific topics with descriptions and estimated study times."
            
            async with Agent(config) as agent:
                response = await agent.chat(prompt)
                data = await response.structured_output()
                if data:
                    return data
        except Exception as e:
            print(f"Error generating learning path, falling back to offline: {e}")

    from nlp.concept_map import generate_offline_learning_path
    return generate_offline_learning_path(request.topic, db=db)

import json
from ddgs import DDGS

@app.post("/api/search")
async def search_materials(request: SearchRequest, x_api_key: str | None = Header(default=None)):
    if not request.query or not request.query.strip():
        return {"results": []}
    current_key = get_api_key(x_api_key)
    try:
        raw_results = []
        with DDGS() as ddgs:
            ddgs_results = list(ddgs.text(f"{request.query} guide OR tutorial OR pdf OR course", max_results=15))
            for res in ddgs_results:
                raw_results.append({
                    "title": res.get('title', ''),
                    "url": res.get('href', ''),
                    "snippet": res.get('body', '')
                })
        
        # If we have a valid key, use AI to filter and score for quality
        if current_key and not current_key.startswith("AQ"):
            config = LocalAgentConfig(
                api_key=current_key,
                response_schema=SearchMaterialSchema
            )
            prompt = f"""
            You are a helpful and intelligent curator. A user is searching for materials on the topic: '{request.query}'.
            I have queried a search engine and retrieved the following raw results:
            {json.dumps(raw_results, indent=2, ensure_ascii=False)}
            
            Your task is to review these raw results, evaluate their relevance and quality, and select the TOP 5 best resources.
            For each selected resource:
            - Keep the EXACT original 'url'. Do not change it.
            - Clean up the 'title' if necessary.
            - Write a brief 'snippet' explaining WHY this is a good resource. Respond in the language of the query.
            - Categorize its 'type' strictly as one of: Video, Article, PDF, Book, Code, or Documentation.
            - Assign a 'relevancy_score' from 0 to 100 indicating how relevant and academically/professionally useful the result is.
            """
            
            async with Agent(config) as agent:
                response = await agent.chat(prompt)
                data = await response.structured_output()
                if data and data.get("results"):
                    return data

        # Fallback to top 5 if AI fails or no key
        fallback_results = []
        for res in raw_results[:5]:
            url = res["url"]
            type_label = "Article"
            if "youtube.com" in url or "youtu.be" in url:
                type_label = "Video"
            elif url.endswith(".pdf"):
                type_label = "PDF"
            elif "amazon.com" in url or "goodreads.com" in url:
                type_label = "Book"
            elif "github.com" in url:
                type_label = "Code"
            
            fallback_results.append({
                "title": res["title"],
                "url": url,
                "snippet": res["snippet"],
                "type": type_label,
                "relevancy_score": 80
            })
            
        return {"results": fallback_results}
            
    except Exception as e:
        print(f"Error searching materials: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def get_document_text(db: Session, document_id: int | None, page_ranges: list[int] | None = None) -> str:
    if not document_id:
        return ""
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not doc:
        return ""
    if page_ranges:
        try:
            pages = json.loads(doc.pages_data) if doc.pages_data else []
            selected_text = ""
            for p in page_ranges:
                idx = p - 1
                if 0 <= idx < len(pages):
                    selected_text += pages[idx] + "\n"
            if selected_text.strip():
                return selected_text
        except Exception:
            pass
    if doc.content:
        return doc.content
    if doc.pages_data:
        try:
            pages = json.loads(doc.pages_data)
            return "\n".join(pages)
        except Exception:
            pass
    return ""

@app.post("/api/generate_quiz")
async def generate_quiz_endpoint(request: TopicRequest, db: Session = Depends(get_db)):
    text_to_process = request.topic_or_text
    
    if request.document_id:
        doc_text = get_document_text(db, request.document_id, request.page_ranges)
        if doc_text.strip():
            text_to_process = doc_text

    current_key = get_api_key(request.api_key)
    if current_key and not current_key.startswith("AQ"):
        try:
            config = LocalAgentConfig(api_key=current_key, model="gemini-3.1-flash-lite", response_schema=QuizSchema, capabilities=FAST_CAPS)
            prompt = f"Generate a multiple-choice quiz (5 questions), in the SAME language as the text: '{text_to_process}'. Each question must have 4 options, a correct option ID, and an explanation."
            data = await agent_run(config, prompt)
            if data and data.get("questions"):
                if request.project_id or request.document_id:
                    crud.create_artifact(db, project_id=request.project_id, type="quiz", title=data.get("title", "Bài Trắc Nghiệm"), content=json.dumps(data), document_id=request.document_id)
                return data
        except Exception as e:
            print(f"[quiz] AI failed, falling back to offline: {e}")
    from nlp.quizzes import extract_quiz
    quiz_data = extract_quiz(text_to_process, num_questions=5)
    if request.project_id or request.document_id:
        crud.create_artifact(db, project_id=request.project_id, type="quiz", title=quiz_data.get("title", "Bài Trắc Nghiệm"), content=json.dumps(quiz_data), document_id=request.document_id)
    return quiz_data
class ExamPrepSchema(BaseModel):
    title: str
    markdown_content: str

@app.post("/api/generate_exam_prep")
async def generate_exam_prep_endpoint(request: TopicRequest, db: Session = Depends(get_db)):
    text_to_process = request.topic_or_text
    
    if request.document_id:
        doc_text = get_document_text(db, request.document_id, request.page_ranges)
        if doc_text.strip():
            text_to_process = doc_text

    current_key = get_api_key(request.api_key)
    if current_key and not current_key.startswith("AQ"):
        try:
            config = LocalAgentConfig(api_key=current_key, model="gemini-3.1-flash-lite", response_schema=ExamPrepSchema, capabilities=FAST_CAPS)
            prompt = f"Generate a comprehensive Exam Preparation cheat sheet or study guide based on the following text: '{text_to_process}'. Use markdown formatting."
            data = await agent_run(config, prompt)
            if data and data.get("markdown_content"):
                if request.project_id or request.document_id:
                    crud.create_artifact(db, project_id=request.project_id, type="examprep", title=data.get("title", "Tài liệu phòng thi"), content=json.dumps(data), document_id=request.document_id)
                return data
        except Exception as e:
            print(f"[exam_prep] AI failed, falling back to offline: {e}")
            
    # Fallback Offline Engine
    from nlp.concept_map import generate_offline_exam_prep
    data = generate_offline_exam_prep(text_to_process)
    if request.project_id or request.document_id:
        crud.create_artifact(db, project_id=request.project_id, type="examprep", title=data.get("title", "Tài liệu phòng thi"), content=json.dumps(data), document_id=request.document_id)
    return data

class StudyPlanSchema(BaseModel):
    title: str
    markdown_content: str

@app.post("/api/generate_study_plan")
async def generate_study_plan_endpoint(request: TopicRequest, db: Session = Depends(get_db)):
    text_to_process = request.topic_or_text
    if request.document_id:
        doc_text = get_document_text(db, request.document_id, request.page_ranges)
        if doc_text.strip():
            text_to_process = doc_text

    current_key = get_api_key(request.api_key)
    if current_key and not current_key.startswith("AQ"):
        try:
            config = LocalAgentConfig(api_key=current_key, model="gemini-3.1-flash-lite", response_schema=StudyPlanSchema, capabilities=FAST_CAPS)
            prompt = f"Generate a detailed step-by-step study plan (Giáo án) based on the following roadmap/text: '{text_to_process}'. Include specific learning activities and estimated time. Format as markdown."
            data = await agent_run(config, prompt)
            if data and data.get("markdown_content"):
                if request.project_id or request.document_id:
                    crud.create_artifact(db, project_id=request.project_id, type="studyplan", title=data.get("title", "Giáo Án"), content=json.dumps(data), document_id=request.document_id)
                return data
        except Exception as e:
            print(f"[study_plan] AI failed, falling back to offline: {e}")
            
    # Fallback Offline Engine
    from nlp.concept_map import generate_offline_study_plan
    data = generate_offline_study_plan(text_to_process)
    if request.project_id or request.document_id:
        crud.create_artifact(db, project_id=request.project_id, type="studyplan", title=data.get("title", "Giáo Án"), content=json.dumps(data), document_id=request.document_id)
    return data

@app.post("/api/quizzes/submit")
async def submit_quiz(request: QuizSubmitRequest, db: Session = Depends(get_db)):
    try:
        doc = db.query(models.Document).filter(models.Document.id == request.document_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        score_record = crud.create_quiz_score(
            db, 
            document_id=request.document_id, 
            score=request.score, 
            total_questions=request.total_questions
        )
        return {"success": True, "score_id": score_record.id}
    except HTTPException:
        raise
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate_notes")
async def generate_notes(request: TopicRequest):
    current_key = get_api_key(request.api_key)
    if current_key:
        try:
            config = LocalAgentConfig(api_key=current_key, model="gemini-3.1-flash-lite", response_schema=NoteSchema, capabilities=FAST_CAPS)
            prompt = (
                "Generate high-quality, structured study notes (title, summary, and sections with "
                "bullet_points) based on the following text, in the SAME language as the text.\n"
                f"Text: {request.topic_or_text}"
            )
            data = await agent_run(config, prompt)
            if data and data.get("summary"):
                return data
        except Exception as e:
            print(f"[notes] AI failed, falling back to offline: {e}")
    from nlp.notes import extract_notes
    return extract_notes(request.topic_or_text)

@app.get("/api/flashcards/due")
async def get_due_flashcards(project_id: int | None = None, document_id: int | None = None, db: Session = Depends(get_db)):
    cards = crud.get_due_flashcards(db, project_id=project_id, document_id=document_id)
    return {"flashcards": [
        {
            "id": c.id, "front": c.front, "back": c.back,
            "interval": c.interval, "ease": c.ease, 
            "repetitions": c.repetitions, "due_date": c.due_date.isoformat(),
            "project_id": c.project_id, "document_id": c.document_id
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
    current_key = get_api_key(request.api_key)
    if current_key:
        try:
            config = LocalAgentConfig(api_key=current_key, model="gemini-3.1-flash-lite", response_schema=ConceptMapSchema, capabilities=FAST_CAPS)
            prompt = f"Analyze this educational text and extract the key concepts. Generate a concept map with up to 10 nodes and their relationships. Return structured JSON with 'nodes' (id, label, definition, formula) and 'edges' (source, target, weight). Nodes must be meaningful concepts in the SAME language as the text, NOT random fragments. Include a concise definition for each concept, and a formula if applicable (especially for chemistry/math/physics). Text: '{request.topic_or_text[:5000]}'"
            data = await agent_run(config, prompt)
            if data and data.get("nodes"):
                return data
        except Exception as e:
            print(f"[map] AI failed, falling back to offline: {e}")
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
    
    if current_key and not current_key.startswith("AQ"):
        try:
            config = LocalAgentConfig(api_key=current_key, response_schema=SuggestionSchema)
            prompt = f"""Analyze the following text corpus from a user's document library. Suggest 3 things: a topic for a structured learning path, a specific topic for a multiple-choice quiz, and a topic for a set of flashcards. Keep the suggestions concise.

Corpus:
{request.topic_or_text[:5000]}"""
            async with Agent(config) as agent:
                response = await agent.chat(prompt)
                data = await response.structured_output()
                if data:
                    return data
        except Exception as e:
            print(f"[suggestions] AI failed, falling back to offline: {e}")

    # Fallback Offline Engine
    from nlp.concept_map import generate_offline_suggestions
    return generate_offline_suggestions(request.topic_or_text)

