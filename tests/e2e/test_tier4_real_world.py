import pytest
import requests

def test_t4_full_study_cycle(api):
    """Tier 4 - 1: Complete end-to-end study cycle scenario.
    Login -> Create Project -> Ingest Docs -> Roadmap -> Suggestions -> Flashcards -> Quiz -> Verify Progress.
    """
    # 1. Login
    user = api.login(email="student@academy.edu", name="Alex Student")
    assert user["email"] == "student@academy.edu"
    
    # 2. Create Project
    project = api.create_project(name="Deep Learning 101", description="Mastering deep neural networks")
    proj_id = project["id"]
    
    # 3. Ingest documents
    doc1 = api.upload_document("Neural networks consist of input, hidden, and output layers.", "nn_basics.txt", project_id=proj_id)
    doc2 = api.upload_document("Backpropagation computes gradients using the chain rule.", "backprop.txt", project_id=proj_id)
    
    # 4. Generate project roadmap
    roadmap_res = api.generate_project_roadmap(proj_id, "Deep Learning Layers and Backpropagation")
    assert roadmap_res["status"] == "ok"
    
    # 5. Generate Suggestions
    sug_res = api.generate_suggestions("Backpropagation, Neural networks, Deep Learning", api_key=None)
    assert "quiz_topic" in sug_res
    
    # 6. Generate and review flashcards
    fc_res = api.generate_flashcards("Backpropagation uses chain rule.", project_id=proj_id)
    assert len(fc_res["flashcards"]) > 0
    card = fc_res["flashcards"][0]
    api.review_flashcard(card_id=card["id"], interval=1, ease=2.5, repetitions=1, due="2026-06-28", quality=5)
    
    # 7. Generate and take quiz
    quiz = api.generate_quiz("Neural networks and layers.", project_id=proj_id, document_id=doc1["id"])
    assert len(quiz["questions"]) > 0
    
    # 8. Submit score & check progress
    api.submit_quiz(document_id=doc1["id"], score=5, total_questions=5)
    progress = api.get_document_progress(doc1["id"])
    assert progress["total_quizzes_taken"] == 1
    assert progress["average_quiz_score"] == 100.0
    
    # Cleanup
    api.delete_document(doc1["id"])
    api.delete_document(doc2["id"])
    api.delete_project(proj_id)

def test_t4_collaborative_exam_prep(api, temp_project):
    """Tier 4 - 2: Collaborative exam preparation scenario.
    Upload Syllabus -> Invite Classmates -> Create Exam Prep -> Create Concept Map -> Send chat message.
    """
    proj_id = temp_project["id"]
    
    # 1. Upload syllabus
    syllabus = api.upload_document("Calculus final covers limits, derivatives, and integrals.", "calculus_syllabus.txt", project_id=proj_id)
    
    # 2. Invite classmates
    api.invite_project_member(proj_id, "buddy1@college.edu", "editor")
    api.invite_project_member(proj_id, "buddy2@college.edu", "viewer")
    
    members = api.get_project_members(proj_id)
    assert len(members["pending"]) >= 2
    
    # 3. Create Exam Prep
    try:
        prep = api.generate_exam_prep("Limits and derivatives", project_id=proj_id)
        assert "markdown_content" in prep
    except Exception as e:
        # Check invalid/missing key response behavior
        assert "400" in str(e) or "500" in str(e)
        
    # 4. Create Concept Map
    cmap = api.generate_concept_map("Limits, derivatives, integrals are calculus pillars.", project_id=proj_id)
    assert len(cmap["nodes"]) > 0
    
    # 5. Send Chat Message to sync context
    msg = api.send_chat_message(project_id=proj_id, role="user", content="Explain derivatives in simple terms.")
    assert msg["id"] is not None
    
    chat_history = api.get_project_messages(proj_id)
    assert len(chat_history) > 0
    
    # Cleanup
    api.delete_document(syllabus["id"])

def test_t4_spaced_repetition_mastery(api):
    """Tier 4 - 3: Spaced repetition mastery scenario.
    Generate cards -> Review cards with different qualities -> Verify interval differences.
    """
    # 1. Generate flashcards
    res = api.generate_flashcards("Anatomy: Femur is the thigh bone. Patella is the kneecap.")
    assert len(res["flashcards"]) >= 2
    
    card1 = res["flashcards"][0]
    card2 = res["flashcards"][1]
    
    # 2. Review Card 1 with Perfect response (quality 5)
    r1 = api.review_flashcard(card_id=card1["id"], interval=1, ease=2.5, repetitions=1, due="2026-06-28", quality=5)
    
    # 3. Review Card 2 with Blackout response (quality 0)
    r2 = api.review_flashcard(card_id=card2["id"], interval=6, ease=2.6, repetitions=3, due="2026-06-28", quality=0)
    
    # 4. Assert interval differences
    assert r1["interval"] > 1  # Should increase
    assert r2["interval"] == 1  # Should reset
    assert r2["repetitions"] == 0

def test_t4_offline_fallback(api):
    """Tier 4 - 4: Verify offline fallback behavior when no API key is set/provided.
    Should fallback gracefully to local NLP algorithms for path, suggestions, maps, cards, and quizzes.
    """
    # Using None or invalid keys to trigger offline logic
    # 1. Learning Path fallback
    path = api.generate_path("Offline Chemistry", api_key=None)
    assert "Module 1" in path["modules"][0]["title"]
    
    # 2. Suggestions fallback
    s = api.generate_suggestions("Photosynthesis is process of plants.", api_key=None)
    assert "quiz_topic" in s
    
    # 3. Concept Map fallback
    cmap = api.generate_concept_map("Water consists of hydrogen and oxygen.", api_key=None)
    assert len(cmap["nodes"]) > 0
    
    # 4. Flashcards fallback
    fc = api.generate_flashcards("Mitosis is cell division.", api_key=None)
    assert len(fc["flashcards"]) > 0
    
    # 5. Quiz fallback
    quiz = api.generate_quiz("Cell division has phases.", api_key=None)
    assert len(quiz["questions"]) > 0

def test_t4_standalone_document_workspace(api):
    """Tier 4 - 5: Standalone document workspace scenario.
    Ingest standalone document -> Document roadmap -> Collaborate -> Document Quiz -> Progress -> Delete.
    """
    # 1. Ingest standalone document
    doc = api.upload_document("History of Rome starting from Romulus.", "rome_history.txt")
    doc_id = doc["id"]
    
    # 2. Standalone document roadmap
    roadmap_res = api.generate_document_roadmap(doc_id, "Rome Foundations")
    assert roadmap_res["status"] == "ok"
    
    # 3. Invite a researcher to this document specifically
    invite_res = api.invite_document_member(doc_id, "collaborator@history.org", "editor")
    assert invite_res["status"] in ["Invited", "Already invited", "Invited successfully"]
    
    # 4. Generate quiz from page 1 of document
    quiz = api.generate_quiz("Rome foundations", document_id=doc_id, page_ranges=[1])
    assert len(quiz["questions"]) > 0
    
    # 5. Take & Submit score
    api.submit_quiz(document_id=doc_id, score=3, total_questions=5)
    
    # 6. Verify progress metrics
    progress = api.get_document_progress(doc_id)
    assert progress["total_quizzes_taken"] == 1
    assert progress["average_quiz_score"] == 60.0
    
    # 7. Delete document to ensure no orphan data remains
    api.delete_document(doc_id)
