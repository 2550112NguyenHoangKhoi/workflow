from sqlalchemy.orm import Session
from . import models
from .database import UPLOAD_DIR
import datetime
import glob
import os


def remove_document_files(doc_id: int) -> None:
    """Delete every stored source file for a document id (uploads/{id}.*).

    SQLite reuses the highest rowid after a delete, so leftover files would otherwise be
    served as the source file of the NEXT document that gets this id."""
    for path in glob.glob(os.path.join(UPLOAD_DIR, f"{int(doc_id)}.*")):
        try:
            os.remove(path)
        except OSError:
            pass

def get_flashcards(db: Session, project_id: int = None, document_id: int = None, skip: int = 0, limit: int = 1000):
    query = db.query(models.Flashcard)
    if project_id is not None:
        query = query.filter(models.Flashcard.project_id == project_id)
    if document_id is not None:
        query = query.filter(models.Flashcard.document_id == document_id)
    return query.offset(skip).limit(limit).all()

def create_roadmap(db: Session, project_id: int, items: list):
    old_roadmaps = db.query(models.Roadmap).filter(models.Roadmap.project_id == project_id).all()
    for rm in old_roadmaps:
        db.query(models.RoadmapItem).filter(models.RoadmapItem.roadmap_id == rm.id).delete()
        db.delete(rm)
    db.commit()

    db_roadmap = models.Roadmap(project_id=project_id)
    db.add(db_roadmap)
    db.commit()
    db.refresh(db_roadmap)
    
    for i, item in enumerate(items):
        db_item = models.RoadmapItem(
            roadmap_id=db_roadmap.id,
            step_number=i+1,
            title=item.get("title", ""),
            description=item.get("description", "")
        )
        db.add(db_item)
    db.commit()
    return db_roadmap

def get_roadmap(db: Session, project_id: int):
    return db.query(models.Roadmap).filter(models.Roadmap.project_id == project_id).order_by(models.Roadmap.created_at.desc()).first()

def get_due_flashcards(db: Session, project_id: int = None, document_id: int = None):
    today = datetime.date.today()
    query = db.query(models.Flashcard).filter(models.Flashcard.due_date <= today)
    if project_id is not None:
        query = query.filter(models.Flashcard.project_id == project_id)
    if document_id is not None:
        query = query.filter(models.Flashcard.document_id == document_id)
    return query.all()

def create_flashcard(db: Session, front: str, back: str, project_id: int = None, document_id: int = None):
    # repetitions starts at 0: SM-2's first successful review must give the 1-day step
    # (starting at 1 jumped new cards straight to a 6-day interval).
    db_flashcard = models.Flashcard(front=front, back=back, project_id=project_id, document_id=document_id, repetitions=0)
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
        db_card.last_reviewed = datetime.datetime.utcnow()
        db.commit()
        db.refresh(db_card)
    return db_card

def get_folders(db: Session, skip: int = 0, limit: int | None = None):
    query = db.query(models.Folder).order_by(models.Folder.id).offset(skip)
    return (query.limit(limit) if limit else query).all()

def create_folder(db: Session, name: str):
    db_folder = models.Folder(name=name)
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)
    return db_folder

def get_documents(db: Session, project_id: int = None, skip: int = 0, limit: int | None = None):
    # No implicit cap: a default limit of 100 silently hid every document after the 100th
    # (and the UI's "latest document" lookups then picked the wrong one).
    query = db.query(models.Document)
    if project_id is not None:
        query = query.filter(models.Document.project_id == project_id)
    query = query.order_by(models.Document.id).offset(skip)
    return (query.limit(limit) if limit else query).all()

def create_document(db: Session, filename: str, content: str, kind: str = "pdf", project_id: int = None, page_count: int = None, pages_data: str = None):
    db_doc = models.Document(filename=filename, content=content, kind=kind, project_id=project_id, page_count=page_count, pages_data=pages_data)
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)
    # A reused id may still have files from a deleted document (e.g. one removed by an
    # older version that didn't clean up) — never let them leak into this one.
    remove_document_files(db_doc.id)
    return db_doc

def delete_document(db: Session, doc_id: int) -> bool:
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        return False
    # Clean up quiz scores tied to this document so we don't leave orphans.
    db.query(models.QuizScore).filter(models.QuizScore.document_id == doc_id).delete()
    # Clean up roadmap items to prevent orphans before deleting roadmaps.
    roadmaps = db.query(models.Roadmap).filter(models.Roadmap.document_id == doc_id).all()
    for rm in roadmaps:
        db.query(models.RoadmapItem).filter(models.RoadmapItem.roadmap_id == rm.id).delete()
    db.query(models.Roadmap).filter(models.Roadmap.document_id == doc_id).delete()
    db.query(models.ChatMessage).filter(models.ChatMessage.document_id == doc_id).delete()
    db.query(models.Artifact).filter(models.Artifact.document_id == doc_id).delete()
    db.query(models.Flashcard).filter(models.Flashcard.document_id == doc_id).delete()
    db.delete(doc)
    db.commit()
    remove_document_files(doc_id)
    return True


def create_quiz_score(db: Session, document_id: int, score: int, total_questions: int):
    db_score = models.QuizScore(document_id=document_id, score=score, total_questions=total_questions)
    db.add(db_score)
    db.commit()
    db.refresh(db_score)
    return db_score

def get_quiz_scores(db: Session, document_id: int):
    return db.query(models.QuizScore).filter(models.QuizScore.document_id == document_id).all()

def create_project(db: Session, name: str, description: str = "", folder_id: int = None):
    db_project = models.Project(name=name, description=description, folder_id=folder_id)
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

def get_projects(db: Session, skip: int = 0, limit: int | None = None, folder_id: int = None):
    query = db.query(models.Project)
    if folder_id is not None:
        query = query.filter(models.Project.folder_id == folder_id)
    query = query.order_by(models.Project.id).offset(skip)
    return (query.limit(limit) if limit else query).all()

def get_project(db: Session, project_id: int):
    return db.query(models.Project).filter(models.Project.id == project_id).first()

def delete_project(db: Session, project_id: int) -> bool:
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        return False
    # Clean up roadmap items to prevent orphans before deleting roadmaps.
    roadmaps = db.query(models.Roadmap).filter(models.Roadmap.project_id == project_id).all()
    for rm in roadmaps:
        db.query(models.RoadmapItem).filter(models.RoadmapItem.roadmap_id == rm.id).delete()
    db.query(models.Roadmap).filter(models.Roadmap.project_id == project_id).delete()
    db.query(models.ChatMessage).filter(models.ChatMessage.project_id == project_id).delete()
    db.query(models.Artifact).filter(models.Artifact.project_id == project_id).delete()
    db.query(models.Flashcard).filter(models.Flashcard.project_id == project_id).delete()
    db.delete(project)
    db.commit()
    return True

def save_chat_message(db: Session, project_id: int = None, role: str = "", content: str = "", persona: str = None, document_id: int = None):
    msg = models.ChatMessage(project_id=project_id, role=role, content=content, persona=persona, document_id=document_id)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg

def create_artifact(db: Session, project_id: int = None, type: str = "", title: str = "", content: str = "", document_id: int = None, owner_email: str = None):
    db_artifact = models.Artifact(project_id=project_id, type=type, title=title, content=content, document_id=document_id, owner_email=owner_email)
    db.add(db_artifact)
    db.commit()
    db.refresh(db_artifact)
    return db_artifact

def get_artifacts(db: Session, project_id: int = None, document_id: int = None):
    query = db.query(models.Artifact)
    if project_id is not None:
        query = query.filter(models.Artifact.project_id == project_id)
    if document_id is not None:
        query = query.filter(models.Artifact.document_id == document_id)
    return query.order_by(models.Artifact.created_at.desc()).all()

def get_chat_history(db: Session, project_id: int = None, document_id: int = None):
    query = db.query(models.ChatMessage)
    if project_id is not None:
        query = query.filter(models.ChatMessage.project_id == project_id)
    if document_id is not None:
        query = query.filter(models.ChatMessage.document_id == document_id)
    return query.order_by(models.ChatMessage.created_at).all()

def update_roadmap_item(db: Session, item_id: int, completed: bool = None, active: bool = None):
    db_item = db.query(models.RoadmapItem).filter(models.RoadmapItem.id == item_id).first()
    if not db_item:
        return None
    
    if completed is not None:
        db_item.completed = 1 if completed else 0
        
    if active is not None:
        if active:
            # Deactivate all other items in the same roadmap
            db.query(models.RoadmapItem).filter(
                models.RoadmapItem.roadmap_id == db_item.roadmap_id,
                models.RoadmapItem.id != item_id
            ).update({models.RoadmapItem.active: 0})
            db_item.active = 1
        else:
            db_item.active = 0
            
    db.commit()
    db.refresh(db_item)
    return db_item


def flashcard_has_progress(card) -> bool:
    """True if the learner has reviewed this card (so regenerating must not delete it).
    Cards from before `last_reviewed` existed: any SM-2 movement beyond a fresh card."""
    if card.last_reviewed is not None:
        return True
    return (card.interval or 1) > 1 or (card.repetitions or 0) >= 2 or \
        (card.due_date is not None and card.due_date > datetime.date.today())
