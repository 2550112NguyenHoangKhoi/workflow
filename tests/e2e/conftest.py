import pytest
import requests
import os
import io

@pytest.fixture(scope="session")
def base_url():
    return "http://127.0.0.1:8000"

class ApiClient:
    def __init__(self, base_url):
        self.base_url = base_url

    def login(self, email, name, picture=None):
        payload = {"email": email, "name": name, "picture": picture}
        r = requests.post(f"{self.base_url}/api/auth/login", json=payload)
        r.raise_for_status()
        return r.json()

    def get_user_stats(self, email):
        r = requests.get(f"{self.base_url}/api/user/stats", params={"email": email})
        r.raise_for_status()
        return r.json()

    def create_folder(self, name):
        r = requests.post(f"{self.base_url}/api/folders", json={"name": name})
        r.raise_for_status()
        return r.json()

    def get_folders(self):
        r = requests.get(f"{self.base_url}/api/folders")
        r.raise_for_status()
        return r.json()

    def create_project(self, name, description="", folder_id=None):
        payload = {"name": name, "description": description, "folder_id": folder_id}
        r = requests.post(f"{self.base_url}/api/projects", json=payload)
        r.raise_for_status()
        return r.json()

    def get_projects(self, folder_id=None):
        params = {}
        if folder_id is not None:
            params["folder_id"] = folder_id
        r = requests.get(f"{self.base_url}/api/projects", params=params)
        r.raise_for_status()
        return r.json()

    def get_project(self, project_id):
        r = requests.get(f"{self.base_url}/api/projects/{project_id}")
        r.raise_for_status()
        return r.json()

    def delete_project(self, project_id):
        r = requests.delete(f"{self.base_url}/api/projects/{project_id}")
        r.raise_for_status()
        return r.json()

    def invite_project_member(self, project_id, email, role="viewer"):
        payload = {"email": email, "role": role}
        r = requests.post(f"{self.base_url}/api/projects/{project_id}/invite", json=payload)
        r.raise_for_status()
        return r.json()

    def get_project_members(self, project_id):
        r = requests.get(f"{self.base_url}/api/projects/{project_id}/members")
        r.raise_for_status()
        return r.json()

    def invite_document_member(self, document_id, email, role="viewer"):
        payload = {"email": email, "role": role}
        r = requests.post(f"{self.base_url}/api/documents/{document_id}/invite", json=payload)
        r.raise_for_status()
        return r.json()

    def get_document_members(self, document_id):
        r = requests.get(f"{self.base_url}/api/documents/{document_id}/members")
        r.raise_for_status()
        return r.json()

    def generate_project_roadmap(self, project_id, topic_or_text, api_key=None):
        payload = {"topic_or_text": topic_or_text, "api_key": api_key}
        r = requests.post(f"{self.base_url}/api/projects/{project_id}/roadmap/generate", json=payload)
        r.raise_for_status()
        return r.json()

    def get_project_roadmap(self, project_id):
        r = requests.get(f"{self.base_url}/api/projects/{project_id}/roadmap")
        r.raise_for_status()
        return r.json()

    def generate_document_roadmap(self, document_id, topic_or_text, api_key=None):
        payload = {"topic_or_text": topic_or_text, "api_key": api_key}
        r = requests.post(f"{self.base_url}/api/documents/{document_id}/roadmap/generate", json=payload)
        r.raise_for_status()
        return r.json()

    def get_document_roadmap(self, document_id):
        r = requests.get(f"{self.base_url}/api/documents/{document_id}/roadmap")
        r.raise_for_status()
        return r.json()

    def update_roadmap_item(self, item_id, completed=None, active=None):
        payload = {}
        if completed is not None:
            payload["completed"] = completed
        if active is not None:
            payload["active"] = active
        r = requests.patch(f"{self.base_url}/api/roadmap/items/{item_id}", json=payload)
        r.raise_for_status()
        return r.json()

    def upload_document(self, file_content, filename, project_id=None):
        files = {"file": (filename, io.BytesIO(file_content.encode('utf-8') if isinstance(file_content, str) else file_content))}
        data = {}
        if project_id is not None:
            data["project_id"] = project_id
        r = requests.post(f"{self.base_url}/api/documents/upload", files=files, data=data)
        r.raise_for_status()
        return r.json()

    def ingest_url(self, url, project_id=None):
        payload = {"url": url, "project_id": project_id}
        r = requests.post(f"{self.base_url}/api/documents/ingest_url", json=payload)
        r.raise_for_status()
        return r.json()

    def list_documents(self, project_id=None):
        params = {}
        if project_id is not None:
            params["project_id"] = project_id
        r = requests.get(f"{self.base_url}/api/documents", params=params)
        r.raise_for_status()
        return r.json()

    def get_document_file(self, document_id):
        r = requests.get(f"{self.base_url}/api/documents/{document_id}/file")
        r.raise_for_status()
        return r.content

    def delete_document(self, document_id):
        r = requests.delete(f"{self.base_url}/api/documents/{document_id}")
        r.raise_for_status()
        return r.json()

    def generate_path(self, topic, api_key=None):
        headers = {}
        if api_key:
            headers["x-api-key"] = api_key
        r = requests.post(f"{self.base_url}/api/generate_path", json={"topic": topic}, headers=headers)
        r.raise_for_status()
        return r.json()

    def search_materials(self, query, api_key=None):
        headers = {}
        if api_key:
            headers["x-api-key"] = api_key
        r = requests.post(f"{self.base_url}/api/search", json={"query": query}, headers=headers)
        r.raise_for_status()
        return r.json()

    def generate_quiz(self, topic_or_text, api_key=None, project_id=None, document_id=None, page_ranges=None):
        payload = {
            "topic_or_text": topic_or_text,
            "api_key": api_key,
            "project_id": project_id,
            "document_id": document_id,
            "page_ranges": page_ranges
        }
        r = requests.post(f"{self.base_url}/api/generate_quiz", json=payload)
        r.raise_for_status()
        return r.json()

    def submit_quiz(self, document_id, score, total_questions):
        payload = {
            "document_id": document_id,
            "score": score,
            "total_questions": total_questions
        }
        r = requests.post(f"{self.base_url}/api/quizzes/submit", json=payload)
        r.raise_for_status()
        return r.json()

    def get_document_progress(self, document_id):
        r = requests.get(f"{self.base_url}/api/documents/{document_id}/progress")
        r.raise_for_status()
        return r.json()

    def generate_exam_prep(self, topic_or_text, api_key=None, project_id=None, document_id=None, page_ranges=None):
        payload = {
            "topic_or_text": topic_or_text,
            "api_key": api_key,
            "project_id": project_id,
            "document_id": document_id,
            "page_ranges": page_ranges
        }
        r = requests.post(f"{self.base_url}/api/generate_exam_prep", json=payload)
        r.raise_for_status()
        return r.json()

    def generate_study_plan(self, topic_or_text, api_key=None, project_id=None, document_id=None):
        payload = {
            "topic_or_text": topic_or_text,
            "api_key": api_key,
            "project_id": project_id,
            "document_id": document_id
        }
        r = requests.post(f"{self.base_url}/api/generate_study_plan", json=payload)
        r.raise_for_status()
        return r.json()

    def generate_concept_map(self, topic_or_text, api_key=None, project_id=None, document_id=None):
        payload = {
            "topic_or_text": topic_or_text,
            "api_key": api_key,
            "project_id": project_id,
            "document_id": document_id
        }
        r = requests.post(f"{self.base_url}/api/generate_map", json=payload)
        r.raise_for_status()
        return r.json()

    def generate_flashcards(self, topic_or_text, api_key=None, project_id=None, document_id=None):
        payload = {
            "topic_or_text": topic_or_text,
            "api_key": api_key,
            "project_id": project_id,
            "document_id": document_id
        }
        r = requests.post(f"{self.base_url}/api/generate_flashcards", json=payload)
        r.raise_for_status()
        return r.json()

    def get_due_flashcards(self):
        r = requests.get(f"{self.base_url}/api/flashcards/due")
        r.raise_for_status()
        return r.json()

    def review_flashcard(self, card_id, interval, ease, repetitions, due, quality):
        payload = {
            "id": card_id,
            "interval": interval,
            "ease": ease,
            "repetitions": repetitions,
            "due": due,
            "quality": quality
        }
        r = requests.post(f"{self.base_url}/api/flashcards/review", json=payload)
        r.raise_for_status()
        return r.json()

    def score_difficulty(self, topic_or_text):
        r = requests.post(f"{self.base_url}/api/score_difficulty", json={"topic_or_text": topic_or_text})
        r.raise_for_status()
        return r.json()

    def generate_suggestions(self, topic_or_text, api_key=None):
        payload = {"topic_or_text": topic_or_text, "api_key": api_key}
        r = requests.post(f"{self.base_url}/api/suggestions", json=payload)
        r.raise_for_status()
        return r.json()

    def generate_notes(self, topic_or_text, api_key=None):
        payload = {"topic_or_text": topic_or_text, "api_key": api_key}
        r = requests.post(f"{self.base_url}/api/generate_notes", json=payload)
        r.raise_for_status()
        return r.json()

    def get_project_messages(self, project_id):
        r = requests.get(f"{self.base_url}/api/projects/{project_id}/messages")
        r.raise_for_status()
        return r.json()

    def send_chat_message(self, project_id, role, content, persona=None):
        payload = {
            "project_id": project_id,
            "role": role,
            "content": content,
            "persona": persona
        }
        r = requests.post(f"{self.base_url}/api/chat", json=payload)
        r.raise_for_status()
        return r.json()

@pytest.fixture(scope="function")
def api(base_url):
    return ApiClient(base_url)

@pytest.fixture(scope="function")
def temp_project(api):
    proj = api.create_project(name="Temp Project for Testing", description="Auto-deleted project")
    yield proj
    try:
        api.delete_project(proj["id"])
    except Exception:
        pass

@pytest.fixture(scope="function")
def temp_document(api):
    doc = api.upload_document(file_content="Sample document content for unit testing.", filename="temp_document.txt")
    yield doc
    try:
        api.delete_document(doc["id"])
    except Exception:
        pass

@pytest.fixture(scope="function")
def temp_folder(api):
    folder = api.create_folder(name="Temp Folder")
    yield folder
