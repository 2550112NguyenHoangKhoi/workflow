import os
import sys
import sqlite3
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

# Add backend directory to path so we can import models, crud, and main
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from db import models, crud
from main import patch_database_schema

def test_startup_schema_patching():
    print("=== Testing Startup Schema Patching ===")
    
    # Use a temporary SQLite database file
    db_file = "test_migration_temp.db"
    if os.path.exists(db_file):
        os.remove(db_file)
        
    try:
        # Step 1: Create old schema using raw sqlite
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
        
        cursor.execute("CREATE TABLE projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR)")
        cursor.execute("CREATE TABLE documents (id INTEGER PRIMARY KEY AUTOINCREMENT, filename VARCHAR)")
        
        cursor.execute("""
            CREATE TABLE chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER REFERENCES projects(id),
                role VARCHAR,
                content VARCHAR
            )
        """)
        
        cursor.execute("""
            CREATE TABLE artifacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER REFERENCES projects(id),
                type VARCHAR,
                title VARCHAR,
                content VARCHAR
            )
        """)
        
        cursor.execute("""
            CREATE TABLE flashcards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                front VARCHAR,
                back VARCHAR
            )
        """)
        
        # Step 2: Insert initial data
        cursor.execute("INSERT INTO projects (name) VALUES ('Test Project')")
        cursor.execute("INSERT INTO documents (filename) VALUES ('test_doc.pdf')")
        cursor.execute("INSERT INTO chat_messages (project_id, role, content) VALUES (1, 'user', 'Hello')")
        cursor.execute("INSERT INTO artifacts (project_id, type, title, content) VALUES (1, 'quiz', 'Quiz 1', 'Content 1')")
        cursor.execute("INSERT INTO flashcards (front, back) VALUES ('Front 1', 'Back 1')")
        conn.commit()
        conn.close()
        
        # Step 3: Run schema patching using engine
        engine = create_engine(f"sqlite:///{db_file}")
        patch_database_schema(engine)
        
        # Step 4: Verify columns and data integrity
        inspector = inspect(engine)
        
        # chat_messages verification
        chat_cols = [c["name"] for c in inspector.get_columns("chat_messages")]
        assert "document_id" in chat_cols, "document_id missing from chat_messages"
        
        # artifacts verification
        art_cols = [c["name"] for c in inspector.get_columns("artifacts")]
        assert "document_id" in art_cols, "document_id missing from artifacts"
        
        # flashcards verification
        fc_cols = [c["name"] for c in inspector.get_columns("flashcards")]
        assert "project_id" in fc_cols, "project_id missing from flashcards"
        assert "document_id" in fc_cols, "document_id missing from flashcards"
        
        # Verify data is still intact
        with engine.connect() as connection:
            res = connection.execute(text("SELECT id, project_id, role, content, document_id FROM chat_messages")).fetchone()
            assert res is not None
            assert res[0] == 1
            assert res[1] == 1
            assert res[2] == 'user'
            assert res[3] == 'Hello'
            assert res[4] is None, f"Expected document_id to be NULL, got {res[4]}"
            
            res_art = connection.execute(text("SELECT id, project_id, type, title, content, document_id FROM artifacts")).fetchone()
            assert res_art is not None
            assert res_art[0] == 1
            assert res_art[1] == 1
            assert res_art[2] == 'quiz'
            assert res_art[3] == 'Quiz 1'
            assert res_art[4] == 'Content 1'
            assert res_art[5] is None
            
            res_fc = connection.execute(text("SELECT id, front, back, project_id, document_id FROM flashcards")).fetchone()
            assert res_fc is not None
            assert res_fc[0] == 1
            assert res_fc[1] == 'Front 1'
            assert res_fc[2] == 'Back 1'
            assert res_fc[3] is None
            assert res_fc[4] is None
            
            # Test inserting new row with new columns
            connection.execute(text("INSERT INTO chat_messages (project_id, role, content, document_id) VALUES (1, 'assistant', 'Response', 1)"))
            res_new = connection.execute(text("SELECT document_id FROM chat_messages WHERE id = 2")).fetchone()
            assert res_new[0] == 1, f"Expected new document_id to be 1, got {res_new[0]}"
            
        print("Startup schema patching test: PASSED")
        
    finally:
        if os.path.exists(db_file):
            os.remove(db_file)

def test_cascade_deletes():
    print("=== Testing Cascade Deletes ===")
    
    # Use a temporary SQLite database file
    db_file = "test_cascade_temp.db"
    if os.path.exists(db_file):
        os.remove(db_file)
        
    try:
        engine = create_engine(f"sqlite:///{db_file}")
        models.Base.metadata.create_all(bind=engine)
        Session = sessionmaker(bind=engine)
        db = Session()
        
        # 1. Create a Project
        project = models.Project(name="Test Project")
        db.add(project)
        db.commit()
        db.refresh(project)
        
        # 2. Create two Documents under this project (Doc A and Doc B)
        doc_a = models.Document(filename="DocA.pdf", project_id=project.id, content="Doc A content")
        doc_b = models.Document(filename="DocB.pdf", project_id=project.id, content="Doc B content")
        db.add(doc_a)
        db.add(doc_b)
        db.commit()
        db.refresh(doc_a)
        db.refresh(doc_b)
        
        # 3. Create dependent records for Doc B (to test document deletion)
        quiz_b = models.QuizScore(document_id=doc_b.id, score=8, total_questions=10)
        roadmap_b = models.Roadmap(document_id=doc_b.id, project_id=project.id)
        db.add(quiz_b)
        db.add(roadmap_b)
        db.commit()
        db.refresh(roadmap_b)
        
        # Roadmap items for Doc B
        item_b = models.RoadmapItem(roadmap_id=roadmap_b.id, step_number=1, title="Step B")
        db.add(item_b)
        
        msg_b = models.ChatMessage(document_id=doc_b.id, project_id=project.id, role="user", content="Msg B")
        art_b = models.Artifact(document_id=doc_b.id, project_id=project.id, type="quiz", title="Art B", content="Content B")
        fc_b = models.Flashcard(document_id=doc_b.id, project_id=project.id, front="F B", back="B B")
        
        # Add ProjectMember and ProjectInvite tied to Doc B
        member_b = models.ProjectMember(document_id=doc_b.id, project_id=project.id, email="b_member@example.com")
        invite_b = models.ProjectInvite(document_id=doc_b.id, project_id=project.id, email="b_invite@example.com")
        
        db.add_all([msg_b, art_b, fc_b, member_b, invite_b])
        db.commit()
        
        # Verify everything is present before deletion
        assert db.query(models.Document).filter(models.Document.id == doc_b.id).first() is not None
        assert db.query(models.QuizScore).filter(models.QuizScore.document_id == doc_b.id).count() == 1
        assert db.query(models.Roadmap).filter(models.Roadmap.document_id == doc_b.id).count() == 1
        assert db.query(models.ChatMessage).filter(models.ChatMessage.document_id == doc_b.id).count() == 1
        assert db.query(models.Artifact).filter(models.Artifact.document_id == doc_b.id).count() == 1
        assert db.query(models.Flashcard).filter(models.Flashcard.document_id == doc_b.id).count() == 1
        assert db.query(models.ProjectMember).filter(models.ProjectMember.document_id == doc_b.id).count() == 1
        assert db.query(models.ProjectInvite).filter(models.ProjectInvite.document_id == doc_b.id).count() == 1
        
        # 4. Perform document delete on Doc B
        print("Performing delete_document on Doc B...")
        crud.delete_document(db, doc_b.id)
        
        # Verify Doc B is deleted
        assert db.query(models.Document).filter(models.Document.id == doc_b.id).first() is None
        
        # Verify all Doc B's associated data is deleted
        assert db.query(models.QuizScore).filter(models.QuizScore.document_id == doc_b.id).count() == 0
        assert db.query(models.Roadmap).filter(models.Roadmap.document_id == doc_b.id).count() == 0
        assert db.query(models.ChatMessage).filter(models.ChatMessage.document_id == doc_b.id).count() == 0
        assert db.query(models.Artifact).filter(models.Artifact.document_id == doc_b.id).count() == 0
        assert db.query(models.Flashcard).filter(models.Flashcard.document_id == doc_b.id).count() == 0
        
        # Check ProjectMember and ProjectInvite tied to Doc B (Adversarial challenge: do they leak?)
        member_leak_count = db.query(models.ProjectMember).filter(models.ProjectMember.document_id == doc_b.id).count()
        invite_leak_count = db.query(models.ProjectInvite).filter(models.ProjectInvite.document_id == doc_b.id).count()
        print(f"ProjectMember leak count after document delete: {member_leak_count}")
        print(f"ProjectInvite leak count after document delete: {invite_leak_count}")
        
        # 5. Create dependent records for Doc A (to test project deletion)
        quiz_a = models.QuizScore(document_id=doc_a.id, score=9, total_questions=10)
        roadmap_a = models.Roadmap(document_id=doc_a.id, project_id=project.id)
        db.add_all([quiz_a, roadmap_a])
        db.commit()
        db.refresh(roadmap_a)
        
        item_a = models.RoadmapItem(roadmap_id=roadmap_a.id, step_number=1, title="Step A")
        db.add(item_a)
        
        msg_a = models.ChatMessage(document_id=doc_a.id, project_id=project.id, role="user", content="Msg A")
        art_a = models.Artifact(document_id=doc_a.id, project_id=project.id, type="quiz", title="Art A", content="Content A")
        fc_a = models.Flashcard(document_id=doc_a.id, project_id=project.id, front="F A", back="B A")
        
        # Create a document-level Roadmap and Flashcard for Doc A that does NOT have project_id set
        roadmap_doc_a = models.Roadmap(document_id=doc_a.id, project_id=None)
        fc_doc_a = models.Flashcard(document_id=doc_a.id, project_id=None, front="F Doc A", back="B Doc A")
        db.add_all([msg_a, art_a, fc_a, roadmap_doc_a, fc_doc_a])
        db.commit()
        db.refresh(roadmap_doc_a)
        
        item_doc_a = models.RoadmapItem(roadmap_id=roadmap_doc_a.id, step_number=1, title="Step Doc A")
        db.add(item_doc_a)
        db.commit()
        
        # 6. Perform project delete on Project
        print("Performing delete_project on Project...")
        crud.delete_project(db, project.id)
        
        # Verify Project is deleted
        assert db.query(models.Project).filter(models.Project.id == project.id).first() is None
        
        # Verify Doc A is deleted via SQLAlchemy cascade delete
        assert db.query(models.Document).filter(models.Document.id == doc_a.id).first() is None
        
        # Verify project-level roadmap, chat_messages, artifacts, flashcards are deleted
        assert db.query(models.Roadmap).filter(models.Roadmap.project_id == project.id).count() == 0
        assert db.query(models.ChatMessage).filter(models.ChatMessage.project_id == project.id).count() == 0
        assert db.query(models.Artifact).filter(models.Artifact.project_id == project.id).count() == 0
        assert db.query(models.Flashcard).filter(models.Flashcard.project_id == project.id).count() == 0
        
        # Check for leaks/orphans:
        # A. QuizScore associated with Doc A: Does it leak?
        quiz_leak_count = db.query(models.QuizScore).filter(models.QuizScore.document_id == doc_a.id).count()
        print(f"QuizScore leak count after project delete: {quiz_leak_count}")
        
        # B. Roadmap associated with Doc A but project_id is NULL: Does it leak?
        roadmap_leak_count = db.query(models.Roadmap).filter(models.Roadmap.document_id == doc_a.id).count()
        print(f"Roadmap leak count after project delete: {roadmap_leak_count}")
        
        # C. Flashcard associated with Doc A but project_id is NULL: Does it leak?
        fc_leak_count = db.query(models.Flashcard).filter(models.Flashcard.document_id == doc_a.id).count()
        print(f"Flashcard leak count after project delete: {fc_leak_count}")
        
        print("Cascade deletes test: COMPLETED (Check output logs for leakage findings)")
        
    finally:
        db.close()
        if os.path.exists(db_file):
            os.remove(db_file)

if __name__ == "__main__":
    test_startup_schema_patching()
    test_cascade_deletes()
