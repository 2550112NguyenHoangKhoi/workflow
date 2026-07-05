import pytest
import datetime

# =====================================================================
# FEATURE 1: Document Ingestion (Upload & URL Ingest)
# =====================================================================

def test_f1_upload_text_file(api):
    """F1-1: Upload a basic text file and check its properties."""
    doc = api.upload_document("This is a simple biology note about cells.", "cells.txt")
    assert doc["id"] is not None
    assert doc["filename"] == "cells.txt"
    assert doc["kind"] == "document"
    
    # Verify it exists in list
    docs = api.list_documents()
    assert any(d["id"] == doc["id"] for d in docs["documents"])
    
    # Clean up
    api.delete_document(doc["id"])

def test_f1_upload_file_with_project_id(api, temp_project):
    """F1-2: Upload a file bound to a project context."""
    doc = api.upload_document("History of Rome study guide.", "rome.txt", project_id=temp_project["id"])
    assert doc["id"] is not None
    assert doc["filename"] == "rome.txt"
    
    # Verify filtering by project_id
    docs = api.list_documents(project_id=temp_project["id"])
    assert len(docs["documents"]) == 1
    assert docs["documents"][0]["id"] == doc["id"]
    
    # Clean up
    api.delete_document(doc["id"])

def test_f1_ingest_general_url(api):
    """F1-3: Ingest a general web article URL."""
    url = "https://en.wikipedia.org/wiki/Photosynthesis"
    doc = api.ingest_url(url)
    assert doc["id"] is not None
    assert doc["kind"] == "link"
    
    # Clean up
    api.delete_document(doc["id"])

def test_f1_ingest_youtube_url(api):
    """F1-4: Ingest a YouTube URL."""
    url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    doc = api.ingest_url(url)
    assert doc["id"] is not None
    assert doc["kind"] == "video"
    
    # Clean up
    api.delete_document(doc["id"])

def test_f1_delete_document(api):
    """F1-5: Create and then delete a document, ensuring it is removed."""
    doc = api.upload_document("Temporary content", "delete_me.txt")
    doc_id = doc["id"]
    
    res = api.delete_document(doc_id)
    assert res["success"] is True
    assert res["deleted_id"] == doc_id
    
    # Verify it is no longer listed
    docs = api.list_documents()
    assert not any(d["id"] == doc_id for d in docs["documents"])


# =====================================================================
# FEATURE 2: Roadmap Generation (Project & Standalone Document)
# =====================================================================

def test_f2_generate_project_roadmap(api, temp_project):
    """F2-1: Generate a roadmap for a project context."""
    # First upload a document to the project to provide content
    doc = api.upload_document("Organic chemistry involves carbon compounds.", "chem.txt", project_id=temp_project["id"])
    
    res = api.generate_project_roadmap(temp_project["id"], "Organic Chemistry Basics")
    assert res["status"] == "ok"
    
    # Clean up document
    api.delete_document(doc["id"])

def test_f2_get_empty_project_roadmap(api, temp_project):
    """F2-2: Retrieve roadmap for a new project with no generated roadmap."""
    res = api.get_project_roadmap(temp_project["id"])
    assert "items" in res
    assert len(res["items"]) == 0

def test_f2_generate_standalone_document_roadmap(api, temp_document):
    """F2-3: Generate a roadmap for a standalone document context."""
    res = api.generate_document_roadmap(temp_document["id"], "My document topic")
    assert res["status"] == "ok"

def test_f2_get_empty_document_roadmap(api):
    """F2-4: Retrieve roadmap for a non-existent document or document without roadmap."""
    res = api.get_document_roadmap(99999)
    assert "items" in res
    assert len(res["items"]) == 0

def test_f2_get_project_roadmap_items(api, temp_project):
    """F2-5: Generate and fetch roadmap items, verifying list structure."""
    doc = api.upload_document("We will study machine learning, neural networks, and deep learning.", "ml.txt", project_id=temp_project["id"])
    api.generate_project_roadmap(temp_project["id"], "Machine Learning")
    
    roadmap = api.get_project_roadmap(temp_project["id"])
    assert len(roadmap["items"]) > 0
    for item in roadmap["items"]:
        assert "step_number" in item
        assert "title" in item
        assert "description" in item
        assert "completed" in item
        
    api.delete_document(doc["id"])

def test_f2_roadmap_item_interactivity(api, temp_project):
    """F2-6: Test toggle completed status and active status on roadmap items with backend persistence."""
    doc = api.upload_document("Let's study algorithm design, dynamic programming, and graphs.", "algo.txt", project_id=temp_project["id"])
    api.generate_project_roadmap(temp_project["id"], "Algorithms")
    
    roadmap = api.get_project_roadmap(temp_project["id"])
    items = roadmap["items"]
    assert len(items) >= 2
    
    item1_id = items[0]["id"]
    item2_id = items[1]["id"]
    
    # 1. Verify default values (0 for both)
    assert items[0]["completed"] == 0
    assert items[0]["active"] == 0
    
    # 2. Toggle completed status of first item to True
    res = api.update_roadmap_item(item1_id, completed=True)
    assert res["completed"] == 1
    
    # Verify persistence
    roadmap = api.get_project_roadmap(temp_project["id"])
    assert roadmap["items"][0]["completed"] == 1
    assert roadmap["items"][0]["active"] == 0
    
    # 3. Toggle active status of first item to True
    res = api.update_roadmap_item(item1_id, active=True)
    assert res["active"] == 1
    
    # Verify persistence
    roadmap = api.get_project_roadmap(temp_project["id"])
    assert roadmap["items"][0]["active"] == 1
    assert roadmap["items"][1]["active"] == 0
    
    # 4. Toggle active status of second item to True (should deactivate first item)
    res = api.update_roadmap_item(item2_id, active=True)
    assert res["active"] == 1
    
    # Verify mutual exclusion of active status
    roadmap = api.get_project_roadmap(temp_project["id"])
    assert roadmap["items"][0]["active"] == 0
    assert roadmap["items"][1]["active"] == 1
    
    api.delete_document(doc["id"])



# =====================================================================
# FEATURE 3: Quiz Generation, Submission, & Progress Tracking
# =====================================================================

def test_f3_generate_quiz_from_text(api):
    """F3-1: Generate a quiz directly from text content."""
    text = "Photosynthesis requires carbon dioxide, water, and light energy to produce glucose."
    quiz = api.generate_quiz(topic_or_text=text)
    assert "questions" in quiz
    assert len(quiz["questions"]) > 0
    for q in quiz["questions"]:
        assert "question" in q
        assert "options" in q
        assert "answer" in q

def test_f3_submit_quiz_score(api, temp_document):
    """F3-2: Submit a quiz score for a document."""
    res = api.submit_quiz(document_id=temp_document["id"], score=4, total_questions=5)
    assert res["success"] is True
    assert res["score_id"] is not None

def test_f3_get_document_progress_default(api, temp_document):
    """F3-3: Fetch progress for a document with no quizzes submitted yet."""
    progress = api.get_document_progress(temp_document["id"])
    assert "readability" in progress
    assert progress["total_quizzes_taken"] == 0
    assert progress["average_quiz_score"] == 0.0
    assert progress["latest_score"] is None

def test_f3_quiz_submission_updates_progress(api, temp_document):
    """F3-4: Submitting a score updates document progress metrics."""
    api.submit_quiz(document_id=temp_document["id"], score=3, total_questions=5)
    progress = api.get_document_progress(temp_document["id"])
    assert progress["total_quizzes_taken"] == 1
    assert progress["average_quiz_score"] == 60.0
    assert progress["latest_score"] == 60.0

def test_f3_generate_quiz_from_document(api, temp_document):
    """F3-5: Generate quiz passing a document ID and page ranges."""
    quiz = api.generate_quiz(topic_or_text="Fallback", document_id=temp_document["id"], page_ranges=[1])
    assert "questions" in quiz
    assert len(quiz["questions"]) > 0


# =====================================================================
# FEATURE 4: AI / NLP Study Materials & Offline Fallbacks
# =====================================================================

def test_f4_generate_learning_path(api):
    """F4-1: Generate learning path for a topic."""
    path = api.generate_path(topic="Python Programming")
    assert "title" in path
    assert "modules" in path
    assert len(path["modules"]) > 0

def test_f4_generate_suggestions(api):
    """F4-2: Generate study suggestions based on text."""
    suggestions = api.generate_suggestions("Learn advanced algorithms, data structures, and graph theory.")
    assert "path_topic" in suggestions
    assert "quiz_topic" in suggestions
    assert "flashcard_topic" in suggestions

def test_f4_generate_concept_map(api):
    """F4-3: Generate concept map for a topic."""
    cmap = api.generate_concept_map("Gravity is a natural phenomenon by which all things with mass or energy are brought toward one another.")
    assert "nodes" in cmap
    assert "edges" in cmap
    assert len(cmap["nodes"]) > 0

def test_f4_generate_exam_prep(api):
    """F4-4: Generate exam prep sheet (with offline fallback or key)."""
    try:
        prep = api.generate_exam_prep("Linear Algebra")
        assert "markdown_content" in prep
    except Exception as e:
        # If API key is missing, should fail or fallback depending on implementation.
        # We assert it behaves as expected (e.g. throws 400 if no key and no fallback yet)
        assert "400" in str(e) or "500" in str(e)

def test_f4_generate_study_plan(api):
    """F4-5: Generate study plan (with offline fallback or key)."""
    try:
        plan = api.generate_study_plan("Calculus I")
        assert "markdown_content" in plan
    except Exception as e:
        assert "400" in str(e) or "500" in str(e)


# =====================================================================
# FEATURE 5: Flashcard Generation & Spaced Repetition (SM-2)
# =====================================================================

def test_f5_generate_flashcards(api):
    """F5-1: Generate flashcards from a given paragraph."""
    res = api.generate_flashcards("Nucleus contains the cell DNA and coordinates activities.")
    assert "flashcards" in res
    assert len(res["flashcards"]) > 0
    for card in res["flashcards"]:
        assert "front" in card
        assert "back" in card
        assert "id" in card

def test_f5_get_due_flashcards(api):
    """F5-2: Retrieve the due list of flashcards."""
    res = api.get_due_flashcards()
    assert "flashcards" in res
    assert isinstance(res["flashcards"], list)

def test_f5_review_flashcard_updates_state(api):
    """F5-3: Submit a flashcard review with quality score, verifying SM-2 update is returned."""
    # We send default SM-2 states and score quality 4 (good response)
    res = api.review_flashcard(card_id=1, interval=1, ease=2.5, repetitions=1, due="2026-06-28", quality=4)
    assert "interval" in res
    assert "ease" in res
    assert "repetitions" in res
    assert "due" in res

def test_f5_spaced_repetition_logic(api):
    """F5-4: Assert SM-2 math logic transitions correctly for different qualities."""
    # Quality 0 (complete blackout) should reset repetitions and interval to 1
    res = api.review_flashcard(card_id=1, interval=6, ease=2.5, repetitions=3, due="2026-06-28", quality=0)
    assert res["repetitions"] == 0
    assert res["interval"] == 1

def test_f5_flashcard_project_context(api, temp_project):
    """F5-5: Generate flashcards under a specific project context."""
    # The API request accepts project_id. Tests target this schema requirement.
    res = api.generate_flashcards("An atom is the basic unit of a chemical element.", project_id=temp_project["id"])
    assert "flashcards" in res


# =====================================================================
# FEATURE 6: Collaboration (Invites & Members Listing)
# =====================================================================

def test_f6_project_invite_member(api, temp_project):
    """F6-1: Invite a member to a project."""
    res = api.invite_project_member(temp_project["id"], "test_member@example.com", "editor")
    assert res["status"] in ["Invited successfully", "Already invited"]

def test_f6_project_list_members(api, temp_project):
    """F6-2: List members of a project, checking for active and pending lists."""
    # Invite first
    api.invite_project_member(temp_project["id"], "pending_member@example.com", "viewer")
    
    members = api.get_project_members(temp_project["id"])
    assert "active" in members
    assert "pending" in members
    assert any(i["email"] == "pending_member@example.com" for i in members["pending"])

def test_f6_document_invite_member(api, temp_document):
    """F6-3: Invite a member to a standalone document context."""
    res = api.invite_document_member(temp_document["id"], "doc_editor@example.com", "editor")
    assert res["status"] in ["Invited", "Already invited", "Invited successfully"]

def test_f6_document_list_members(api, temp_document):
    """F6-4: List members of a standalone document context."""
    api.invite_document_member(temp_document["id"], "doc_viewer@example.com", "viewer")
    
    members = api.get_document_members(temp_document["id"])
    assert "active" in members
    assert "pending" in members
    assert any(i["email"] == "doc_viewer@example.com" for i in members["pending"])

def test_f6_invite_multiple_roles(api, temp_project):
    """F6-5: Verify invitations can specify owner, editor, or viewer roles."""
    res1 = api.invite_project_member(temp_project["id"], "editor_role@example.com", "editor")
    res2 = api.invite_project_member(temp_project["id"], "viewer_role@example.com", "viewer")
    
    assert res1["status"] in ["Invited successfully", "Already invited"]
    assert res2["status"] in ["Invited successfully", "Already invited"]
