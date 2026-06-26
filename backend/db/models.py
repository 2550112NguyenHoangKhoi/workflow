from sqlalchemy import Column, Integer, String, Float, Date
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

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    content = Column(String)
    upload_date = Column(Date, default=datetime.date.today)

class QuizScore(Base):
    __tablename__ = "quiz_scores"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    score = Column(Integer)
    total_questions = Column(Integer)
    date_taken = Column(Date, default=datetime.date.today)
