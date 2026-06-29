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
    type = Column(String) # 'quiz', 'notes', 'concept_map'
    title = Column(String)
    content = Column(String) # JSON payload or markdown
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="artifacts")
    document = relationship("Document")
