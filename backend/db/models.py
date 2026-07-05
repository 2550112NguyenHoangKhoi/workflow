from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from .database import Base
import datetime

class Flashcard(Base):
    __tablename__ = "flashcards"

    id = Column(Integer, primary_key=True, index=True)
    front = Column(String, index=True)
    back = Column(String)
    
    # SM-2 Spaced Repetition Fields
    interval = Column(Integer, default=1)
    ease = Column(Float, default=2.5)
    repetitions = Column(Integer, default=0)
    due_date = Column(Date, default=datetime.date.today)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    
    project = relationship("Project")
    document = relationship("Document")

class Roadmap(Base):
    __tablename__ = "roadmaps"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    items = relationship("RoadmapItem", back_populates="roadmap", cascade="all, delete-orphan")

class RoadmapItem(Base):
    __tablename__ = "roadmap_items"

    id = Column(Integer, primary_key=True, index=True)
    roadmap_id = Column(Integer, ForeignKey("roadmaps.id"))
    step_number = Column(Integer)
    title = Column(String)
    description = Column(String, nullable=True)
    completed = Column(Integer, default=0) # 0 or 1 for boolean
    active = Column(Integer, default=0) # 0 or 1 for boolean

    roadmap = relationship("Roadmap", back_populates="items")

class Folder(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    projects = relationship("Project", back_populates="folder")

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    folder_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    folder = relationship("Folder", back_populates="projects")
    documents = relationship("Document", back_populates="project", cascade="all, delete-orphan")
    messages = relationship("ChatMessage", back_populates="project", cascade="all, delete-orphan")
    artifacts = relationship("Artifact", back_populates="project", cascade="all, delete-orphan")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    invites = relationship("ProjectInvite", back_populates="project", cascade="all, delete-orphan")

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    picture = Column(String, nullable=True)
    status = Column(String, default="free")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_login = Column(DateTime, default=datetime.datetime.utcnow)

class ProjectMember(Base):
    __tablename__ = "project_members"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    email = Column(String, index=True)
    role = Column(String, default="viewer") # owner, editor, viewer
    
    project = relationship("Project", back_populates="members")

class ProjectInvite(Base):
    __tablename__ = "project_invites"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    email = Column(String, index=True)
    role = Column(String, default="viewer")
    status = Column(String, default="pending")
    
    project = relationship("Project", back_populates="invites")

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    filename = Column(String, index=True)
    kind = Column(String, default="pdf") # pdf, docx, image, audio, video, link
    content = Column(String)
    page_count = Column(Integer, nullable=True)
    pages_data = Column(Text, nullable=True) # JSON array of strings
    upload_date = Column(Date, default=datetime.date.today)

    project = relationship("Project", back_populates="documents")

class QuizScore(Base):
    __tablename__ = "quiz_scores"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    score = Column(Integer)
    total_questions = Column(Integer)
    date_taken = Column(Date, default=datetime.date.today)

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    role = Column(String) # user or assistant
    content = Column(String)
    persona = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="messages")
    document = relationship("Document")

class Artifact(Base):
    __tablename__ = "artifacts"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    type = Column(String) # 'quiz', 'notes', 'concept_map', 'exam', 'examdoc'
    title = Column(String)
    content = Column(String) # JSON payload or markdown
    owner_email = Column(String, nullable=True) # creator; powers the Studio "của bạn" panel
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="artifacts")
    document = relationship("Document")

class TeamMessage(Base):
    """Realtime-ish project group chat (the floating 'Team chat' widget). Human-to-human
    messages between project members — separate from the AI ChatMessage history."""
    __tablename__ = "team_messages"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), index=True)
    author_email = Column(String, nullable=True)
    author_name = Column(String, default="Ẩn danh")
    content = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Share(Base):
    """A study item shared to another user: either a generated artifact (exam / exam-room
    doc) or a Drive library file. Powers the Studio "được chia sẻ" panels."""
    __tablename__ = "shares"

    id = Column(Integer, primary_key=True, index=True)
    artifact_id = Column(Integer, ForeignKey("artifacts.id"), nullable=True)
    drive_file_id = Column(String, nullable=True)
    drive_file_name = Column(String, nullable=True)
    owner_email = Column(String)
    shared_with_email = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    artifact = relationship("Artifact")

class WritingAttempt(Base):
    """One completed writing-practice session (a sentence/paragraph set or an IELTS essay).
    Powers persisted progress: total points, average score, per-category breakdown, streak —
    the study-value tracking modeled on datpmt's per-exercise attempt history."""
    __tablename__ = "writing_attempts"

    id = Column(Integer, primary_key=True, index=True)
    owner_email = Column(String, index=True, nullable=True)
    mode = Column(String)            # "sentence" | "paragraph" | "ielts"
    level = Column(String)
    category = Column(String, default="")   # sentence category / paragraph type / "" for ielts
    task = Column(String, default="")       # ielts: "task1" | "task2"
    score = Column(Float, default=0.0)      # sentence/paragraph: avg /10; ielts: band /9
    points = Column(Integer, default=0)     # points earned this session
    num_items = Column(Integer, default=0)  # sentences graded (0 for ielts)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class VocabWord(Base):
    __tablename__ = "vocab_words"
    id = Column(Integer, primary_key=True, index=True)
    owner_email = Column(String, index=True, nullable=True)
    word = Column(String, index=True)
    meaning_vi = Column(String, default="")
    ipa = Column(String, default="")
    part_of_speech = Column(String, default="")
    example_en = Column(String, default="")
    example_vi = Column(String, default="")
    repetitions = Column(Integer, default=0)     # consecutive correct recalls (SM-2 style)
    interval = Column(Integer, default=1)        # days until next due
    ease = Column(Float, default=2.5)
    correct_count = Column(Integer, default=0)
    wrong_count = Column(Integer, default=0)
    learned = Column(Integer, default=0)         # 0/1: becomes 1 after repetitions>=3
    due_date = Column(Date, default=datetime.date.today)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_reviewed = Column(DateTime, nullable=True)

class VocabReview(Base):
    __tablename__ = "vocab_reviews"
    id = Column(Integer, primary_key=True, index=True)
    owner_email = Column(String, index=True, nullable=True)
    vocab_id = Column(Integer, ForeignKey("vocab_words.id"), nullable=True)
    correct = Column(Integer, default=0)         # 0/1
    points = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
