from sqlalchemy.orm import Session
from . import models
import datetime

def get_flashcards(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Flashcard).offset(skip).limit(limit).all()

def get_due_flashcards(db: Session):
    today = datetime.date.today()
    return db.query(models.Flashcard).filter(models.Flashcard.due_date <= today).all()

def create_flashcard(db: Session, front: str, back: str):
    db_flashcard = models.Flashcard(front=front, back=back)
    db.add(db_flashcard)
    db.commit()
    db.refresh(db_flashcard)
    return db_flashcard

def update_flashcard_sm2(db: Session, card_id: int, interval: int, ease: float, repetitions: int, due_date_str: str):
    db_card = db.query(models.Flashcard).filter(models.Flashcard.id == card_id).first()
    if db_card:
        db_card.interval = interval
        db_card.ease = ease
        db_card.repetitions = repetitions
        # Parse YYYY-MM-DD
        db_card.due_date = datetime.datetime.strptime(due_date_str, "%Y-%m-%d").date()
        db.commit()
        db.refresh(db_card)
    return db_card
