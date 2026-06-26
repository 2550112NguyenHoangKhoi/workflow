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
