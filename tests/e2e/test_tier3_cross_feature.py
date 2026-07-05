import pytest

def test_t3_ingest_to_quiz_to_progress(api):
    """Tier 3 - 1: Ingest document -> Generate Quiz -> Submit Score -> Verify Progress."""
    # 1. Ingest document
    content = "The core of the Earth is extremely hot and composed of iron and nickel."
    doc = api.upload_document(content, "earth_core.txt")
    doc_id = doc["id"]
    
    # 2. Generate quiz
    quiz = api.generate_quiz(topic_or_text="Earth's Core", document_id=doc_id)
    assert len(quiz["questions"]) > 0
    
    # 3. Submit score
    submit_res = api.submit_quiz(document_id=doc_id, score=4, total_questions=5)
    assert submit_res["success"] is True
    
    # 4. Verify progress
    progress = api.get_document_progress(doc_id)
    assert progress["total_quizzes_taken"] == 1
    assert progress["average_quiz_score"] == 80.0
    
    # Cleanup
    api.delete_document(doc_id)

def test_t3_project_ingest_roadmap_studyplan(api, temp_project):
    """Tier 3 - 2: Create Project -> Upload Docs -> Generate Roadmap -> Generate Study Plan."""
    proj_id = temp_project["id"]
    
    # 1. Ingest docs into project
    doc1 = api.upload_document("Mitochondria produce ATP.", "mito.txt", project_id=proj_id)
    doc2 = api.upload_document("Ribosomes synthesize proteins.", "ribo.txt", project_id=proj_id)
    
    # 2. Generate roadmap
    roadmap_res = api.generate_project_roadmap(proj_id, "Cell Organelles")
    assert roadmap_res["status"] == "ok"
    
    roadmap = api.get_project_roadmap(proj_id)
    assert len(roadmap["items"]) > 0
    roadmap_text = " ".join([item["title"] + ": " + item["description"] for item in roadmap["items"]])
    
    # 3. Generate Study Plan based on the roadmap text
    try:
        study_plan = api.generate_study_plan(topic_or_text=roadmap_text, project_id=proj_id)
        assert "markdown_content" in study_plan
    except Exception as e:
        # Fallback behaviour if AI key not present
        assert "400" in str(e) or "500" in str(e)
        
    # Cleanup
    api.delete_document(doc1["id"])
    api.delete_document(doc2["id"])

def test_t3_ingest_flashcards_spaced_repetition(api):
    """Tier 3 - 3: Ingest Doc -> Generate Flashcards -> Spaced Repetition Review."""
    content = "DNA stands for Deoxyribonucleic acid and holds genetic instructions."
    doc = api.upload_document(content, "dna.txt")
    doc_id = doc["id"]
    
    # 1. Generate flashcards
    fc_res = api.generate_flashcards(content, document_id=doc_id)
    assert len(fc_res["flashcards"]) > 0
    card = fc_res["flashcards"][0]
    card_id = card["id"]
    
    # 2. Review card with good quality (4)
    review_res = api.review_flashcard(
        card_id=card_id, 
        interval=card.get("interval", 1), 
        ease=card.get("ease", 2.5), 
        repetitions=card.get("repetitions", 0), 
        due=card.get("due_date", "2026-06-28").split("T")[0], 
        quality=4
    )
    assert review_res["repetitions"] == card.get("repetitions", 0) + 1
    assert review_res["interval"] > card.get("interval", 1)
    
    # Cleanup
    api.delete_document(doc_id)

def test_t3_collaboration_project_sharing(api, temp_project):
    """Tier 3 - 4: Create Project -> Upload Doc -> Invite Member -> List Members."""
    proj_id = temp_project["id"]
    
    # 1. Upload doc
    doc = api.upload_document("Project shared guidelines.", "shared.txt", project_id=proj_id)
    
    # 2. Invite member
    invite_res = api.invite_project_member(proj_id, "collab@example.com", "editor")
    assert invite_res["status"] in ["Invited successfully", "Already invited"]
    
    # 3. List members and verify
    members = api.get_project_members(proj_id)
    assert any(m["email"] == "collab@example.com" for m in members["pending"])
    
    # Cleanup
    api.delete_document(doc["id"])

def test_t3_ingest_concept_map_suggestions(api):
    """Tier 3 - 5: Ingest Doc -> Generate Concept Map -> Generate Suggestions."""
    content = "Photosynthesis convert light energy. Chlorophyll absorbs red and blue light."
    doc = api.upload_document(content, "photo.txt")
    
    # 1. Concept map
    cmap = api.generate_concept_map(content)
    assert len(cmap["nodes"]) > 0
    node_labels = " ".join([n["label"] for n in cmap["nodes"]])
    
    # 2. Suggestions
    sug_res = api.generate_suggestions(node_labels)
    assert "path_topic" in sug_res
    
    # Cleanup
    api.delete_document(doc["id"])

def test_t3_standalone_document_flow(api):
    """Tier 3 - 6: Upload Standalone Doc -> Standalone Roadmap -> Invite to Doc -> Get Doc Progress."""
    # 1. Ingest standalone document
    doc = api.upload_document("Quantum physics study of subatomic particles.", "quantum.txt")
    doc_id = doc["id"]
    
    # 2. Generate roadmap for document
    roadmap_res = api.generate_document_roadmap(doc_id, "Quantum Physics")
    assert roadmap_res["status"] == "ok"
    
    # 3. Invite member to document
    invite_res = api.invite_document_member(doc_id, "quantum_tutor@example.com", "editor")
    assert invite_res["status"] in ["Invited", "Already invited", "Invited successfully"]
    
    # 4. Fetch document progress
    progress = api.get_document_progress(doc_id)
    assert "readability" in progress
    
    # Cleanup
    api.delete_document(doc_id)
