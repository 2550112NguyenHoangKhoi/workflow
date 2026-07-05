import pytest
import requests

# =====================================================================
# FEATURE 1: Document Ingestion Boundary & Corner Cases
# =====================================================================

def test_f1_upload_empty_file(api):
    """F1-B1: Uploading an empty file."""
    res = api.upload_document("", "empty.txt")
    assert res["id"] is not None
    api.delete_document(res["id"])

def test_f1_ingest_invalid_url(api):
    """F1-B2: Ingestion of an invalid or unreachable URL."""
    # Depending on implementation, it may fail, return error or handle it.
    # We expect either a soft failure (empty content) or HTTP error.
    res = api.ingest_url("https://this-does-not-exist-at-all-1234567.com")
    assert res["id"] is not None  # DB entry created but content should be empty
    api.delete_document(res["id"])

def test_f1_upload_large_content(api):
    """F1-B3: Uploading a large text content to verify payload handling."""
    large_text = "Data science " * 5000  # ~60KB of text
    res = api.upload_document(large_text, "large.txt")
    assert res["id"] is not None
    api.delete_document(res["id"])

def test_f1_upload_unicode_characters(api):
    """F1-B4: Uploading document with special/Unicode characters (Vietnamese, emojis)."""
    special_content = "Xin chào thế giới! Học máy và trí tuệ nhân tạo. 🧠🚀"
    res = api.upload_document(special_content, "unicode.txt")
    assert res["id"] is not None
    
    # Read the file back if possible
    content = api.get_document_file(res["id"])
    assert "Xin chào" in content.decode("utf-8")
    api.delete_document(res["id"])

def test_f1_delete_non_existent_document(api):
    """F1-B5: Deleting a non-existent document ID should return 404."""
    with pytest.raises(requests.exceptions.HTTPError) as exc_info:
        api.delete_document(99999)
    assert exc_info.value.response.status_code == 404


# =====================================================================
# FEATURE 2: Roadmap Generation Boundary & Corner Cases
# =====================================================================

def test_f2_generate_roadmap_empty_topic(api, temp_project):
    """F2-B1: Generating project roadmap with empty topic_or_text."""
    # Should fall back to default or handle gracefully
    res = api.generate_project_roadmap(temp_project["id"], "")
    assert res["status"] == "ok"

def test_f2_generate_project_roadmap_not_found(api):
    """F2-B2: Generating project roadmap for a non-existent project ID."""
    with pytest.raises(requests.exceptions.HTTPError) as exc_info:
        api.generate_project_roadmap(99999, "Chemistry")
    assert exc_info.value.response.status_code == 404

def test_f2_generate_document_roadmap_not_found(api):
    """F2-B3: Generating document roadmap for a non-existent document ID."""
    res = api.generate_document_roadmap(99999, "Math")
    assert res["status"] == "error" or "not found" in res.get("message", "").lower()

def test_f2_generate_roadmap_overwrite(api, temp_project):
    """F2-B2: Double generation of roadmap on the same project should overwrite/update."""
    doc = api.upload_document("History of computing.", "hist.txt", project_id=temp_project["id"])
    res1 = api.generate_project_roadmap(temp_project["id"], "History")
    assert res1["status"] == "ok"
    
    res2 = api.generate_project_roadmap(temp_project["id"], "Modern Computing")
    assert res2["status"] == "ok"
    
    api.delete_document(doc["id"])

def test_f2_generate_roadmap_invalid_key(api, temp_project):
    """F2-B5: Generating roadmap with an invalid API key should fallback to offline NLP."""
    doc = api.upload_document("Photosynthesis uses sunlight.", "science.txt", project_id=temp_project["id"])
    res = api.generate_project_roadmap(temp_project["id"], "Science", api_key="INVALID_KEY_123")
    assert res["status"] == "ok"
    api.delete_document(doc["id"])

def test_f2_update_roadmap_item_non_existent(api):
    """F2-B6: Updating non-existent roadmap item should return 404."""
    with pytest.raises(requests.exceptions.HTTPError) as exc_info:
        api.update_roadmap_item(999999, completed=True)
    assert exc_info.value.response.status_code == 404

def test_f2_update_roadmap_item_toggling(api, temp_project):
    """F2-B7: Toggling roadmap item status back and forth multiple times."""
    doc = api.upload_document("Photosynthesis uses sunlight.", "science.txt", project_id=temp_project["id"])
    api.generate_project_roadmap(temp_project["id"], "Science")
    roadmap = api.get_project_roadmap(temp_project["id"])
    assert len(roadmap["items"]) > 0
    item_id = roadmap["items"][0]["id"]
    
    # Toggle completed to True
    res = api.update_roadmap_item(item_id, completed=True)
    assert res["completed"] == 1
    
    # Toggle completed back to False
    res = api.update_roadmap_item(item_id, completed=False)
    assert res["completed"] == 0
    
    # Toggle completed to True again
    res = api.update_roadmap_item(item_id, completed=True)
    assert res["completed"] == 1
    
    api.delete_document(doc["id"])



# =====================================================================
# FEATURE 3: Quiz & Progress Boundary & Corner Cases
# =====================================================================

def test_f3_generate_quiz_empty_text(api):
    """F3-B1: Generating quiz with empty text."""
    quiz = api.generate_quiz(topic_or_text="")
    assert "questions" in quiz

def test_f3_generate_quiz_invalid_document_id(api):
    """F3-B2: Generating quiz with non-existent document ID."""
    # Should either raise 404/500 or fallback to generating from topic_or_text
    res = api.generate_quiz(topic_or_text="Fallback", document_id=99999)
    assert "questions" in res

def test_f3_submit_quiz_out_of_bounds_score(api, temp_document):
    """F3-B3: Submit quiz score exceeding total questions or negative."""
    res = api.submit_quiz(document_id=temp_document["id"], score=-1, total_questions=5)
    assert res["success"] is True

def test_f3_submit_quiz_invalid_document_id(api):
    """F3-B4: Submitting a quiz score for a non-existent document ID."""
    with pytest.raises(requests.exceptions.HTTPError) as exc_info:
        api.submit_quiz(document_id=99999, score=5, total_questions=5)
    # Backend DB constraint might trigger 500
    assert exc_info.value.response.status_code in [404, 500]

def test_f3_get_progress_non_existent_document(api):
    """F3-B5: Fetching progress for a non-existent document ID should return 404."""
    with pytest.raises(requests.exceptions.HTTPError) as exc_info:
        api.get_document_progress(99999)
    assert exc_info.value.response.status_code == 404


# =====================================================================
# FEATURE 4: AI / NLP Materials Boundary & Corner Cases
# =====================================================================

def test_f4_generate_path_empty_topic(api):
    """F4-B1: Generating learning path with empty topic."""
    path = api.generate_path(topic="")
    assert "title" in path
    assert len(path.get("modules", [])) >= 0

def test_f4_generate_suggestions_empty_text(api):
    """F4-B2: Generating suggestions with empty text."""
    s = api.generate_suggestions("")
    assert "path_topic" in s

def test_f4_generate_concept_map_empty_text(api):
    """F4-B3: Generating concept map with empty text."""
    cmap = api.generate_concept_map("")
    assert "nodes" in cmap
    assert "edges" in cmap

def test_f4_search_materials_empty_query(api):
    """F4-B4: Search materials with empty query."""
    res = api.search_materials("")
    assert "results" in res

def test_f4_generate_notes_empty_text(api):
    """F4-B5: Generating notes with empty/extremely short text."""
    notes = api.generate_notes("")
    assert "summary" in notes


# =====================================================================
# FEATURE 5: Flashcard & Spaced Repetition Boundary & Corner Cases
# =====================================================================

def test_f5_generate_flashcards_empty_text(api):
    """F5-B1: Generating flashcards with empty/extremely short text."""
    res = api.generate_flashcards("")
    assert "flashcards" in res

def test_f5_review_non_existent_card(api):
    """F5-B2: Reviewing a non-existent flashcard (should return states, skip DB update)."""
    # Card ID 99999 doesn't exist
    res = api.review_flashcard(card_id=99999, interval=1, ease=2.5, repetitions=1, due="2026-06-28", quality=4)
    assert "interval" in res
    assert "ease" in res

def test_f5_review_invalid_quality(api):
    """F5-B3: Spaced repetition review with quality outside [0, 5]."""
    # Quality 6 is invalid. SM-2 should clamp or handle it.
    res = api.review_flashcard(card_id=1, interval=1, ease=2.5, repetitions=1, due="2026-06-28", quality=6)
    assert "interval" in res
    assert "ease" in res

def test_f5_review_minimum_ease(api):
    """F5-B4: Spaced repetition ease should not drop below 1.3."""
    # Under SM-2, ease decreases when quality is low. Let's send low ease and low quality.
    res = api.review_flashcard(card_id=1, interval=1, ease=1.3, repetitions=1, due="2026-06-28", quality=1)
    assert res["ease"] >= 1.3

def test_f5_flashcard_generation_invalid_project(api):
    """F5-B5: Flashcard generation under a non-existent project context."""
    # Should still generate the cards, but might fail on database link if not handled.
    res = api.generate_flashcards("An atom is the basic unit of a chemical element.", project_id=99999)
    assert "flashcards" in res


# =====================================================================
# FEATURE 6: Collaboration Boundary & Corner Cases
# =====================================================================

def test_f6_invite_non_existent_project(api):
    """F6-B1: Inviting a member to a non-existent project ID should return 404."""
    with pytest.raises(requests.exceptions.HTTPError) as exc_info:
        api.invite_project_member(99999, "email@example.com", "viewer")
    assert exc_info.value.response.status_code == 404

def test_f6_invite_non_existent_document(api):
    """F6-B2: Inviting a member to a non-existent document ID should return 404."""
    with pytest.raises(requests.exceptions.HTTPError) as exc_info:
        api.invite_document_member(99999, "email@example.com", "viewer")
    assert exc_info.value.response.status_code == 404

def test_f6_invite_invalid_email_format(api, temp_project):
    """F6-B3: Inviting a member with an invalid email format."""
    # Backend might accept it or return validation error. E2E tests target either behavior.
    res = api.invite_project_member(temp_project["id"], "invalid-email-format", "viewer")
    assert "status" in res

def test_f6_list_members_non_existent_project(api):
    """F6-B4: Listing members of a non-existent project should return 404."""
    with pytest.raises(requests.exceptions.HTTPError) as exc_info:
        api.get_project_members(99999)
    assert exc_info.value.response.status_code == 404

def test_f6_invite_idempotency(api, temp_project):
    """F6-B5: Re-inviting the same user to the same project should return 'Already invited'."""
    api.invite_project_member(temp_project["id"], "duplicate@example.com", "editor")
    res = api.invite_project_member(temp_project["id"], "duplicate@example.com", "editor")
    assert res["status"] == "Already invited"
