# AGENTS.md — Workflow: architecture, fix log & handoff

> **Audience:** AI coding agents and developers taking over this repo.
> **Status:** branch `claude/determined-noether-5k5z68`, 2026-11-05. All fixes below are merged on this branch.
> **Companion files:** `AUDIT.md` (original bug audit + status), `tests/backend/` (regression suite).
> **Line numbers** are accurate at the time of writing; search for the quoted symbol if they have shifted.

---

## 0. TL;DR for agents

| Need | Go to |
|---|---|
| What the app is | §1 |
| How to run / test | §2 |
| How the pieces talk | §3 |
| Where a feature lives | §4 (repo map), §6 (API index), §8 (frontend map) |
| Rules that prevent regressions | §9 |
| What was fixed, where and why | §10 |
| What is still broken / unfinished | §11 |

**The rules most often broken (read before editing):**
1. Never add code below the `if __name__ == "__main__":` block at the **end** of `backend/main.py`. In the packaged app, `uvicorn.run()` blocks there, so routes defined after it are never registered.
2. Every AI call goes through `core.agent.agent_run(...)`. The key comes from `core.agent.get_api_key(raw_key_from_ui)`.
3. Every frontend AI request sends `api_key: getEngineKey()` (`src/utils/engine.js`).
4. Inline styles use **theme variables** (`var(--bg-tertiary)`, `var(--text-navy)`, …), never hard-coded light colours. Dark mode depends on it.
5. Never put secrets or personal data in git. History was purged on 2026-11-05 (§10, H-1).
6. Run `pytest tests/backend` and `npx vite build` before committing.

---

## 1. Product summary

**Workflow** is an offline-capable, desktop (Electron) study app for Vietnamese and English learners. It is non-commercial: there are no plans or payments.

**Features:**
- **Document library and chat:** upload PDF, DOCX, TXT/MD, images, audio or URLs, then chat with them.
- **Study generators:** flashcards (SM-2 spaced repetition), quizzes, exams with mixed question types and page citations, exam cram docs, study plans, roadmaps ("Giáo án"), concept maps and smart notes.
- **Writing practice:** Vietnamese→English translation drills, IELTS essay band scoring, and a dictionary.
- **Vocabulary trainer:** spaced repetition, a built-in word bank, streaks and points.
- **Active learning:** Feynman "teach-back" evaluation.

Every AI feature has **three interchangeable engines**, selected in Settings:

| Engine | UI signal (`localStorage.workflow_api_key`) | Backend behaviour |
|---|---|---|
| Gemini (cloud) | the user's key `AIza…` / `AQ…`, or `''` (empty) | Google Antigravity SDK; `''` falls back to the `.env` key |
| Local (Ollama) | `LOCAL` or `LOCAL:<model>` | `nlp/local_llm.py` → `http://127.0.0.1:11434` |
| Offline NLP | `OFFLINE` | deterministic spaCy / pyvi / TextRank / WordNet engine in `backend/nlp/` |

**Every AI path falls back to the offline engine** on error or timeout, so endpoints never fail just because the AI did.

UI language: Vietnamese, with some English labels.

---

## 2. Run, build, test

Install backend dependencies (Python ≥ 3.10):

```bash
pip install -r backend/requirements.txt
```

```bash
python -m spacy download en_core_web_sm
```

Optional extras (OCR and audio transcription; the app works without them):

```bash
pip install -r backend/requirements-optional.txt
```

Backend in dev mode (port 8000, auto-reload; no API token is enforced when `WORKFLOW_API_TOKEN` is unset). It must be run from inside `backend/`:

```bash
cd backend && uvicorn main:app --reload --port 8000
```

Frontend in dev mode (Vite on :5173):

```bash
npm install && npm run dev
```

Desktop shell in dev mode (expects the backend already running, or a bundled build in `backend/dist/`):

```bash
npm run electron:dev
```

Backend regression tests (in-process TestClient against a throwaway data dir; no server or AI needed):

```bash
python -m pytest tests/backend -q -p no:warnings
```

Build check and lint (lint uses oxlint; about 15 hook-dependency warnings are expected):

```bash
npx vite build
```

```bash
npm run lint
```

Release: `.github/workflows/build-release.yml` (manual dispatch) installs the requirements and the spaCy model, runs `tests/backend`, builds the backend with **PyInstaller `backend/backend.spec`**, then runs `electron-builder` (Windows `.exe`, macOS `.dmg`).

Legacy end-to-end tests in `tests/e2e/` need a **running** backend on :8000.

---

## 3. Architecture

```
┌──────────────────────────── Electron main (electron/main.cjs) ────────────────────────────┐
│ 1. generates API_TOKEN (random, per launch)                                                │
│ 2. spawns backend exe  env: WORKFLOW_DATA_DIR=userData, WORKFLOW_PORT=8000,                │
│                             WORKFLOW_API_TOKEN=API_TOKEN                                   │
│ 3. shows a loading page, polls GET /api/usage (with token) up to 90 s                      │
│ 4. loads dist/index.html (packaged) or http://localhost:5173 (dev)                         │
│ IPC: 'workspace:select' (pick folder, copy data, write ~/.workflow_config.json)            │
│      'app:relaunch'                                                                        │
└───────────────┬───────────────────────────────────────────────────────────┬───────────────┘
                │ preload.cjs (contextBridge)                                │ child process
                ▼                                                            ▼
┌──── Renderer: React 19 + Vite (src/) ────┐   HTTP + X-Workflow-Token   ┌──── Backend: FastAPI (backend/main.py) ────┐
│ sandboxed, contextIsolation, no Node     │ ─────────────────────────▶ │ middleware: CORS allow-list + token check  │
│ window.workflowDesktop = {apiToken,      │   http://127.0.0.1:8000    │ routes → crud (db/) → SQLite               │
│   selectWorkspace, relaunch, isDesktop}  │                            │ AI: core/agent.agent_run ─┬─ Gemini (SDK)  │
│ main.jsx wraps fetch() to add the token  │                            │                           ├─ Ollama        │
│ HashRouter routes (§8)                   │                            │                           └─ offline nlp/  │
└──────────────────────────────────────────┘                            │ files: <DATA_DIR>/uploads/{doc_id}.{ext}   │
                                                                        │ db:    <DATA_DIR>/workflow_local.db        │
                                                                        └────────────────────────────────────────────┘
External (optional): Google Drive API (user-entered key), DuckDuckGo search (ddgs), dictionaryapi.dev,
Google Translate (deep-translator), YouTube transcripts, trafilatura (web pages), Google Identity (login, Drive OAuth).
```

**Data directory** (`backend/db/database.py:get_data_dir`), first match wins:
1. `workspace_path` in `~/.workflow_config.json` (set from Settings → storage folder)
2. env `WORKFLOW_DATA_DIR` (Electron passes `app.getPath('userData')`)
3. `~/.workflow` when frozen (PyInstaller)
4. `backend/` when running from source

`DATA_DIR`, `UPLOAD_DIR` and `USAGE_FILE` are module constants in `db/database.py`. On the first frozen run, old data next to the executable or in the cwd is copied in (`_migrate_legacy_frozen_data`).

**Schema migrations:** there is no Alembic. `backend/main.py:patch_database_schema` (≈ line 51) adds missing columns with `ALTER TABLE` at startup, then `Base.metadata.create_all` creates missing tables. **To add a column:** edit `db/models.py` **and** add an `ALTER TABLE` guard there.

**Auth model:** single-user, local. "Login" is a localStorage profile (`workflow_user`: Google sign-in or a hard-coded local user), synced to the `users` table via `POST /api/auth/login`. Per-user data is keyed by `owner_email` (vocabulary, writing, exams). The real access control is the per-launch API token plus the CORS allow-list.

---

## 4. Repository map

| Path | Role |
|---|---|
| `backend/main.py` (≈3.4k lines) | FastAPI app: schema patch, CORS + token middleware, all routes, Pydantic schemas, helper functions. Ends with the `__main__` block. |
| `backend/core/agent.py` | **AI plumbing:** `get_api_key`, `agent_run` (Gemini / Ollama, hard timeout), `FAST_CAPS`, `DEFAULT_MODEL`, token accounting (`read_usage`, `record_usage`). Imported by `main.py` and `nlp/roadmap.py`. |
| `backend/db/database.py` | Data-dir resolution, legacy migration, SQLAlchemy engine and session, `UPLOAD_DIR`, `USAGE_FILE`. |
| `backend/db/models.py` | ORM models (§7). |
| `backend/db/crud.py` | DB helpers incl. `remove_document_files`, `_purge_document_rows`, `delete_document`, `delete_project`, `flashcard_has_progress`. |
| `backend/nlp/` | Offline engine; see the sub-table below. |
| `backend/nltk_data/corpora/wordnet.zip` | Bundled WordNet (added to `nltk.data.path` at startup). |
| `backend/backend.spec` | **The** PyInstaller spec: hidden imports, spaCy/NLTK data, `collect_all` for the antigravity binary, etc. |
| `backend/hooks/` | PyInstaller hooks (spaCy, nltk, en_core_web_sm). |
| `backend/requirements*.txt` | Runtime dependencies / optional OCR and Whisper. |
| `backend/test_*.py`, `stress_test_nlp.py` | Old ad-hoc scripts (need a live server); not part of CI. |
| `electron/main.cjs` | Desktop shell (§3). |
| `electron/preload.cjs` | `contextBridge` → `window.workflowDesktop`. |
| `src/main.jsx` | Bootstraps React; dark-mode class; legacy key migration; **fetch wrapper adding `X-Workflow-Token`**. |
| `src/App.jsx` | HashRouter routes + `AuthGuard`. |
| `src/index.css` | Theme tokens (`:root` / `:root.dark-mode`), incl. `--surface-*`, `--text-ink`, `--text-slate*`. |
| `src/utils/engine.js` | `getEngineKey()`, `engineLabel()`; the single source of the AI-engine signal. |
| `src/utils/uploads.js` | `readUploadResult(res)`: interprets 422 `detail` / 200 `warning` from upload and URL endpoints. |
| `src/utils/googleDrive.js` | Drive browse/import, GIS OAuth, `getDriveApiKey()`/`setDriveApiKey()` (user-entered key), `LIBRARY_ROOT` (public HUST folder). |
| `src/utils/googleAuth.js` | Google sign-in (GIS token flow). |
| `src/utils/examSources.js` | Selected-sources store for exam generation, `extractFileText`, `getOwnerEmail`. |
| `src/utils/ics.js` | Study plan → iCalendar file (`buildStudyPlanIcs`, `downloadIcs`). |
| `src/pages/*` | Route pages (§8). |
| `src/components/layout/*` | App shell: `AppLayout`, `Sidebar`, `Topbar`, `StudioSidebar` (library pages), `ProjectStudioSidebar` (document/project pages), `TeamChatWidget`, `NotificationsBell`. |
| `src/components/modals/*` | Generators and viewers (§8). |
| `tests/backend/` | **Regression suite** (`conftest.py` sets a temp data dir and disables the AI key). |
| `tests/e2e/` | Older HTTP tests against a live server. |
| `.github/workflows/build-release.yml` | Release pipeline. |
| `AUDIT.md` | Original audit (2026-11-05) + status header. |

### `backend/nlp/` (offline engine)

| File | Key functions | Notes |
|---|---|---|
| `quizzes.py` | `extract_quiz` :36, `_vietnamese_quiz` :165, `_fallback_quiz` :203, `generate_distractors` :11 | Cloze MCQ; distractors drawn from the **same document** (pools built inside `extract_quiz`). |
| `exam.py` | `extract_exam` :92, `_page_index` :65, `_find_page` :77, `_as_*` converters | Mixed types `mcq / true_false / short_answer / essay`; per-question `source_ref` "Trang N". |
| `flashcards.py` | `extract_flashcards` :12 | Definition-style cards (EN/VI). |
| `concept_map.py` | `generate_concept_map` :77, offline exam prep / study plan / learning path / suggestions | Deterministic (order-preserving); edge selection covers every concept. |
| `notes.py` | `extract_notes` :12 | TextRank summary + sections. |
| `roadmap.py` | `generate_roadmap` :83 (async), `offline_roadmap` :39, `_parse_items` :21 | Uses `core.agent`; offline = overview → one step per concept (document order) → review. |
| `writing.py` | `generate_lesson` :946, `grade_sentence` :1041, `grade_ielts` :1119, `lookup_word` :1338, `vocab_bank` :1373 | IELTS offline grader is calibrated (§10 Q-4). `lookup_word` = word bank → WordNet → hint. |
| `readability.py` | `score_difficulty` :19, `_syllables` :9 | Flesch–Kincaid → 1–10 scale (EN); a separate Vietnamese heuristic. |
| `vietnamese.py` | `is_vietnamese`, `vi_pos` :87, `_merge_split_compounds` :103, `vi_nouns` :114 | pyvi wrapper; repairs split compounds via `_COMPOUND_TAILS`. |
| `vi_desegment.py` | `desegment` | Re-spaces glued Vietnamese syllables from bad PDF extraction. |
| `teachback.py` | `make_prompt`, `evaluate` | Feynman check (keyword coverage offline). |
| `spaced_repetition.py` | `sm2_update` | SM-2 (quality 0–5). |
| `local_llm.py` | `local_generate`, `status` | Ollama client. |
| `vocab_bank.py` | `VOCAB_BANK` | `{topic: {"b"/"i"/"a": [word dicts]}}` |
| `pdf_toc.py` | `parse_pdf_toc` | Heading detection (largely unused). |

---

## 5. Key flows

**Upload** (`POST /api/documents/upload`, main.py ≈947):
1. Validate the project exists.
2. Check the suffix whitelist; anything else → **422**.
3. Extract text: pdfplumber per page (`pages_data` JSON), python-docx, OCR (optional), Whisper (optional), or text decode (BOM / UTF-8 / cp1258; binary → 422).
4. Save the document row with `crud.create_document`, which also **removes stale `uploads/{id}.*` files** (SQLite reuses ids).
5. Copy the source to `UPLOAD_DIR/{id}{suffix}`.
6. Return; the response includes `warning` when the file was kept but no text could be extracted.

**Chat** (`POST /api/chat` ≈771):
1. Save the user message.
2. Build context **from the DB**: the focused document first, then the project's other documents, capped at 30k characters.
3. Add the persona prompt and the active roadmap step.
4. Try `agent_run`; on failure fall back to `offline_doc_answer` (TF-IDF sentence retrieval).
5. Save the assistant message.

**Generators** (quiz / flashcards / exam prep / study plan / map / notes): `get_api_key(req.api_key)` → AI (schema-constrained) → otherwise the offline function. Results persist as `Artifact` rows (`type` = quiz, examprep, studyplan, exam, examdoc, writing_lesson, smart_notes). Regenerating replaces previous **unshared** artifacts of the same type for that document or project (`_clear_unshared_artifacts`, ≈1281). Exams are never auto-deleted.

**Flashcards:**
- `generate_flashcards` (≈870) keeps reviewed cards (`crud.flashcard_has_progress`) and replaces unreviewed ones.
- Review: `POST /api/flashcards/review` → `sm2_update` → `crud.update_flashcard_sm2`, which sets `last_reviewed`.
- New cards start at `repetitions=0`.

**Exam:**
- `POST /api/exams/generate` (≈1984) assembles source text with `[Trang N]` page markers (`_assemble_source_text_paged`).
- Then AI or `nlp.exam.extract_exam`, then `_normalize_exam_questions` (≈1924), which normalises type labels and `correct_option_id`.
- The front end, `ExamTaker.jsx`, grades locally and has a timer (`doSubmitRef`).

**Writing / IELTS:** `WritingPractice.jsx` screens are `setup → practice | essay → summary`. Essay mode posts to `/api/writing/ielts/grade`. Attempts are logged to `/api/writing/attempts`; IELTS model-essay translation is logged as mode `ielts_translate`.

**Vocabulary:** `/api/vocabulary/*`. Review `type=new_words` returns unlearned words and tops up from `VOCAB_BANK`; `learned_words` returns due learned words. A word becomes learned after 3 correct answers in a row.

---

## 6. API index (`backend/main.py`)

Line ≈ = line of the decorator.

| Method + path | Line ≈ | Purpose |
|---|---|---|
| POST `/api/auth/login` | 302 | upsert user (email, name, picture) |
| GET `/api/user/stats` | 320 | doc/project counts (global, not per user) |
| GET/POST `/api/folders` | 335/340 | list / create (blank name → 422) |
| PATCH/DELETE `/api/folders/{id}` | 348/361 | rename / delete (projects become unfiled) |
| PATCH `/api/projects/{id}` | 380 | rename, describe, move (`folder_id`) or `unfile` |
| POST/GET `/api/projects` | 402/411 | create (validates name and folder) / list |
| GET/DELETE `/api/projects/{id}` | 426/479 | detail / full cascade delete |
| POST `/api/projects/{id}/invite`, GET `…/members` | 440/459 | local-only collaboration (see §11) |
| GET/POST `/api/projects/{id}/roadmap[/generate]` | 486/493 | roadmap ("Giáo án") |
| GET/POST `/api/documents/{id}/roadmap[/generate]` | 515/536 | per-document roadmap (404 / 422 on missing or empty) |
| PATCH `/api/roadmap/items/{id}` | 522 | completed / active step |
| GET/POST `/api/documents/{id}/members`, `…/invite` | 567/580 | local-only |
| GET `/api/projects/{id}/artifacts`, `/api/documents/{id}/artifacts` | 593/598 | artifact lists |
| GET `/api/documents/{id}/notes?api_key&regenerate` | 603 | smart notes (cached artifact) |
| GET `/api/engine/local_status`, `/api/engine/recommend_local` | 655/661 | Ollama status / RAM-based recommendation |
| GET `/api/system/info` | 695 | `{data_dir}` for Settings |
| GET `/api/usage` | 702 | estimated AI tokens vs a made-up 500k quota (§11) |
| POST `/api/chat` | 771 | chat (§5) |
| GET `/api/projects/{id}/messages`, `/api/documents/{id}/messages` | 846/858 | AI chat history |
| POST `/api/generate_flashcards` | 870 | §5 |
| POST `/api/documents/upload` | 947 | §5 |
| POST `/api/documents/url` (alias `/ingest_url`) | 1070 | web page via trafilatura or YouTube transcript; 422 when no text |
| GET `/api/documents` | 1108 | full library (no cap) with `has_file` |
| GET `/api/documents/{id}`, `…/file` | 1124/1148 | pages / raw file (`file` exempt from the token for iframes) |
| DELETE `/api/documents/{id}` | 1185 | cascade + delete files |
| POST `/api/generate_path` | 1192 | learning path (header `x-api-key`) |
| POST `/api/search` | 1212 | DuckDuckGo + optional AI curation |
| POST `/api/generate_quiz` | 1326 | quiz |
| POST `/api/generate_exam_prep`, `/api/generate_study_plan` | 1358/1393 | markdown artifacts |
| POST `/api/quizzes/submit`, GET `/api/documents/{id}/progress` | 1423/1443 | scores + readability |
| POST `/api/generate_notes` | 1480 | unused by the UI |
| GET `/api/flashcards/due`, POST `/api/flashcards/review` | 1499/1511 | SM-2 (quality must be 0–5) |
| POST `/api/score_difficulty`, `/api/generate_map`, `/api/suggestions` | 1531/1536/1552 | difficulty / concept map / suggestions |
| POST `/api/exams/generate`, `/api/exams/{id}/questions` | 1984/2057 | exams (+ add questions) |
| POST `/api/examdocs/generate` | 2115 | exam cram doc |
| GET `/api/artifacts/{id}` | 2168 | any artifact (exam payload normalised) |
| POST `/api/writing/lessons/generate`, `/grade`, `/ielts/grade`, `/word`, `/vocab_bank` | 2198–2396 | writing practice |
| `/api/vocabulary/*` (add, bank, bank/words, generate, bank/import, list, lookup, delete, review, grade, stats) | 2447–3047 | vocabulary trainer |
| POST `/api/writing/attempts`, GET `/api/writing/progress` | 3093/3107 | writing stats + streak |
| POST `/api/teachback/start`, `/evaluate` | 3150/3192 | Feynman |
| POST `/api/share`, GET `/api/studio/overview` | 3229/3250 | local shares + studio panel |
| POST `/api/extract_text` | 3299 | text from a file (exam sources) |
| GET/POST `/api/projects/{id}/team_messages` | 3347/3358 | team chat (polling; 404 for a missing project) |

Main helpers in `main.py`:
- `_require_api_token` ≈143
- `offline_doc_answer` ≈712
- `_decode_text_file` ≈932
- `_youtube_video_id` / `_youtube_transcript` ≈1045
- `_clear_unshared_artifacts` ≈1281
- `_fetch_drive_text` ≈1822
- `_assemble_source_text[_paged]` ≈1857
- `_normalize_exam_questions` ≈1924
- `_dictionary_lookup` ≈2732
- `_enrich_words` ≈2880
- `_local_date` / `_day_streak` ≈3028
- `_writing_points` ≈3085

---

## 7. Data model (`backend/db/models.py`, SQLite)

| Table | Key columns | Notes |
|---|---|---|
| `users` | email (unique), name, picture, last_login | (`status` column may exist in old DBs; unused) |
| `folders` | name | 1-n projects |
| `projects` | name, description, folder_id | cascades: documents, messages, artifacts, members, invites (ORM) |
| `documents` | project_id?, filename, kind, content, page_count, pages_data (JSON list) | file at `UPLOAD_DIR/{id}{ext}` |
| `chat_messages` | project_id?, document_id?, role, content, persona | AI chat |
| `artifacts` | project_id?, document_id?, type, title, content (JSON / markdown), owner_email | quiz / exam / examdoc / examprep / studyplan / writing_lesson / smart_notes |
| `flashcards` | front, back, interval, ease, repetitions, due_date, **last_reviewed**, project_id?, document_id? | SM-2 |
| `quiz_scores` | document_id, score, total_questions | |
| `roadmaps` / `roadmap_items` | project_id? or document_id?; step_number, title, description, completed, active | |
| `project_members` / `project_invites` | project_id? or document_id?, email, role | local only |
| `shares` | artifact_id? or drive_file_id, owner_email, shared_with_email | |
| `team_messages` | project_id, author_email, author_name, content | |
| `writing_attempts` | owner_email, mode, level, category, task, score, points, num_items | mode: sentence / paragraph / ielts / ielts_translate |
| `vocab_words` / `vocab_reviews` | owner_email, word, …, repetitions, interval, ease, learned, due_date | |

SQLite foreign keys are **not enforced**, so endpoints validate parent ids themselves.

---

## 8. Frontend map

| Route (`src/App.jsx`) | Page | Notable components |
|---|---|---|
| `/` | `LandingPage` | Google login or "bypass" local user (registers via `/api/auth/login`) |
| `/documents[?folder=&q=]` | `DocumentExplorer` | library, Drive browser (`utils/googleDrive`), `StudioSidebar` (upload, exams, notes, concept map, flashcards, import) |
| `/chat`, `/document/:id`, `/project/:id` | `DocumentViewer` | chat, `PdfViewer` (pdf.js), `ProjectStudioSidebar` (uploads, personas, roadmap, artifacts), `TeamChatWidget` |
| `/settings` | `Settings` | engine picker, Gemini key, Ollama check, **Drive API key**, **storage folder** |
| `/writing` | `WritingPractice` | sentence / paragraph / IELTS (`renderEssay` ≈759, `handleGradeEssay` ≈360) |
| `/active-learning` | `ActiveLearning` | Feynman |
| `/vocabulary` | `Vocabulary` | trainer, bank import, AI generate |
| `/drive/:fileId` | `DriveViewer` | Drive preview |
| `/exam-take/:artifactId` | `ExamTaker` | timer, grading (`normalizeAnswer` ≈179, `doSubmitRef` ≈218), PDF/JSON export |

**localStorage keys:**

| Key | Holds |
|---|---|
| `workflow_user` | profile |
| `workflow_api_key` | engine signal; read **only** via `getEngineKey()` |
| `workflow_gemini_key` | raw key remembered by Settings |
| `workflow_engine_mode` | `ai` / `local` / `algorithm` |
| `workflow_drive_api_key` | Drive key |
| `workflow_dark_mode` | theme |
| `vocab_limit`, `vocab_wrong_limit` | vocabulary review settings |
| `workflow_notif_seen` | notifications read state |

`sessionStorage.active_document_id` is set by `DocumentViewer`.

**Cross-component events:** `window` events `artifacts-updated` and `open-artifact`.

---

## 9. Conventions and gotchas (do / don't)

1. **Backend route placement:** keep `if __name__ == "__main__":` the **last statement** of `main.py` (test: `test_all_routes_registered_when_frozen`).
2. **AI calls:** `config = LocalAgentConfig(api_key=get_api_key(raw), model=DEFAULT_MODEL, response_schema=..., capabilities=FAST_CAPS)` then `await agent_run(config, prompt, structured=..., timeout=...)` inside `try/except`, with an offline fallback. Never call `Agent(...)` directly (no timeout, no Ollama routing).
3. **Don't import `main` from other modules** (it breaks in PyInstaller). Shared code goes in `core/` or `db/`.
4. **New DB column:** update `models.py` **and** `patch_database_schema`.
5. **Deleting documents/projects:** use `crud.delete_document` / `crud.delete_project`. They purge child rows, shares **and** stored files.
6. **Validation:** SQLite won't stop orphans; check parent ids exist (404) and reject blanks (422). Error `detail` text is shown to users in Vietnamese.
7. **Frontend AI requests:** always `api_key: getEngineKey()` (or header `x-api-key` for `/api/generate_path`, `/api/search`, `/api/suggestions`).
8. **Uploads:** interpret responses with `readUploadResult()`; show `message` on error **and** on warning.
9. **Backend URL** is hard-coded as `http://127.0.0.1:8000` in about 40 places. The token fetch wrapper in `main.jsx` matches that prefix and `/api/`. If you centralise it, keep the wrapper working.
10. **Styling:** inline styles only use theme variables. Light values of `--surface-*`, `--text-ink` and `--text-slate*` equal the old hard-coded colours. SVG icon `color=` props can't use `var()`, so leave those as hex.
11. **Adding imports by script:** some files have multi-line `import {…}` blocks; inserting a line "after the last `import`" can land inside one and break the build. Check with `npx vite build`, plus `npm run lint | grep no-undef` (Vite does **not** catch undefined JSX identifiers).
12. **Electron:** the renderer has no Node. New native features need an `ipcMain.handle` in `main.cjs` + an entry in `preload.cjs`.
13. **Secrets:** `.env` is gitignored (dev only). Keys users enter live in localStorage. Never commit DBs, `usage.json`, agent notes (`.agents/`, `.claude/`) or build output.
14. **Offline NLP must be deterministic:** avoid iterating over `set()` for ordering (use `dict.fromkeys`).
15. **Commit style:** conventional commits (`fix(scope): …`) whose body explains root cause and fix.

---

## 10. Fix log (2026-11-05)

Columns: **ID**, **Where** (file and symbol), **Symptom**, **Root cause**, **Fix**, **Test** (✅ = covered in `tests/backend/test_regressions.py`).

### P0: release blockers

| ID | Where | Symptom | Root cause | Fix | Test |
|---|---|---|---|---|---|
| R-1 | `backend/main.py` end of file | Packaged app missing about 30 endpoints | `__main__` + `uvicorn.run()` mid-file; frozen build blocked before later routes registered | Moved to end; port from `WORKFLOW_PORT` | ✅ `test_all_routes_registered_when_frozen` |
| R-2 | `backend/requirements.txt` | CI-built backend crashed on import | `google-antigravity`, `ddgs`, docx, trafilatura… missing | Complete list; OCR/Whisper → `requirements-optional.txt` | CI install |
| R-3 | `.github/workflows/build-release.yml`, `backend/backend.spec` | Bundle lacked spaCy/NLTK data and the SDK binary | CI used the bare auto-generated spec | CI uses `backend.spec`; spec `collect_all`s the antigravity `localharness` binary, uvicorn, ddgs…; bundles `nltk_data`; installs `en_core_web_sm`; runs tests first | CI |
| R-4 | `backend/db/database.py:get_data_dir`, `electron/main.cjs` | DB in a read-only app bundle; uploads lost | Paths relative to cwd / `__file__` | Per-user `DATA_DIR` (§3) + one-time legacy copy | ✅ (all tests use a temp data dir) |
| R-5 | `backend/nlp/roadmap.py` | Roadmap crashed in the frozen build; offline roadmap was 3 canned steps | `from main import agent_run` | New `backend/core/agent.py`; real offline roadmap from document concepts | ✅ `test_offline_roadmap_is_built_from_the_document` |
| R-6 | `electron/main.cjs` | Crash if the backend binary was missing; first requests failed | No `spawn` error handler; no readiness wait | Error dialogs, loading page, poll `/api/usage`, `.exe` on Windows | manual |

### Data and logic bugs

| ID | Where | Symptom | Root cause | Fix | Test |
|---|---|---|---|---|---|
| D-1 | `main.py:/api/vocabulary/generate` | Always 500 | Imported a non-existent `core.agent` | Module now exists; same model as other calls; 502 with a message on AI failure | ✅ |
| D-2 | `db/crud.py:remove_document_files`, `create_document` | A new document served a **deleted** document's file | SQLite reuses rowids; files never deleted | Delete files on delete; clear stale `{id}.*` on create | ✅ |
| D-3 | `src/utils/engine.js` + all AI callers | Settings engine ignored by chat/roadmap; three different key names | Missing `api_key`; inconsistent localStorage keys | `getEngineKey()` everywhere; removed dead `utils/api.js`, `utils/storage.js` | build |
| D-4 | `db/crud.py:get_documents/get_projects/get_folders` | Library stopped at 100 items | Default `limit=100`, no ORDER BY | No cap, ordered by id | ✅ |
| D-5 | `main.py:generate_flashcards._save`, `_clear_unshared_artifacts`, `crud.flashcard_has_progress` | Regenerating wiped SM-2 history and shared items; new exams deleted old ones | Blanket delete per document/project | Keep reviewed cards; keep shared artifacts; never auto-delete exams; `flashcards.last_reviewed` column | ✅ |
| D-6 | `db/crud.py:create_flashcard` | First review jumped to 6 days | New cards started at `repetitions=1` | Start at 0 | ✅ |
| D-7 | `src/components/modals/DueFlashcardModal.jsx:loadCards` | Due cards hidden on project pages | ANDed project with a stale active document id | Scope strictly by route | manual |
| D-8 | `main.py:_day_streak`, `_local_date`, `/api/writing/progress` | Streak reset every morning; no-email stats showed all users | Required "today"; UTC vs local; missing IS NULL filter | Allow a streak ending yesterday; local dates; IS NULL bucket | ✅ |
| D-9 | `db/crud.py:_purge_document_rows`, `delete_project` | Orphan rows and files after deletes | Partial cascades | Shared purge, incl. shares, invites, team messages, files | ✅ |
| D-10 | `main.py:upload_document`, `ingest_url`, `_decode_text_file`, `_youtube_*` | Empty documents from bad uploads / URLs; YouTube broken | No validation; youtube-transcript-api 1.x removed `get_transcript` | 422 with Vietnamese messages; `warning` for kept-but-textless files; encoding detection; v1 API + shorts/embed URLs | ✅ |
| D-11 | `main.py:generate_document_roadmap`, `ProjectStudioSidebar.generateRoadmap` | Errors looked like success | HTTP 200 + `{"status": "error"}` | 404/422; UI alerts `detail` | ✅ |
| D-12 | `main.py:chat_endpoint`, `DocumentViewer.sendMessage` | Project chat saw 6k chars of one document | UI-sent context overrode the DB context | Backend builds context from ids; UI sends none | ✅ |
| D-13 | `main.py:generate_path`, `search_materials`, `generate_suggestions` | Hangs; LOCAL key sent to Gemini; search 500 on AI failure | Called `Agent` directly | `agent_run` with timeouts; search falls back to raw results | manual |
| D-14 | `main.py:lookup_dictionary`, `nlp/writing.py:lookup_word` | `null` lookups; offline "turn on AI" stub | No fallback | Word bank → WordNet → 404 | manual |
| D-15 | `src/pages/LandingPage.jsx`, `UserProfileModal.jsx` | Profile 404 for the local user | Bypass never registered the user | POST `/api/auth/login`; modal ignores non-OK | manual |
| D-16 | `src/pages/ExamTaker.jsx` timer (`doSubmitRef`) | **Timed-out exams scored 0** | Interval closure held the initial empty answers | Call the latest `doSubmit` via ref | manual (Playwright clock: 0/3 → 3/3) |
| D-17 | `ExamTaker.jsx:normalizeAnswer` | "Mitochondria." marked wrong | Only trim/lowercase | Ignore punctuation, spacing and a leading article; diacritics still count | manual |
| D-18 | `main.py` request models / endpoints | Bad data stored (blank words / project names, orphan messages / uploads, quality=99, score>total) | No validation | 422/404; `ReviewRequest.quality` 0–5; dictionary URL encoded | manual (fuzz) |
| D-19 | `src/pages/DocumentViewer.jsx:attachedCount` | "N sources attached" counted the whole library | Used `documents.length` | Count what chat actually uses | manual |

### Offline-engine quality (Q)

| ID | Where | Symptom | Root cause | Fix | Test |
|---|---|---|---|---|---|
| Q-1 | `nlp/concept_map.py:generate_concept_map` | Different maps each run; only the first sentence covered | `set()` ordering; top-15 cut on tied weights | Order-preserving dedupe; every concept keeps its strongest edge | covered via roadmap test |
| Q-2 | `nlp/quizzes.py:extract_quiz` | Wrong answers "Microsoft", "Albert Einstein"…; "ATP"→"Atp" | Canned distractor list; `str.capitalize()` | Distractors from the document (same entity type first); first-letter uppercase only | ✅ |
| Q-3 | `nlp/exam.py:extract_exam`, `main.py:_normalize_exam_questions` | All questions cited "Trang 1"; short exams; unknown AI type labels | First marker reused; one question per fact; free-text types | Per-question page lookup; reuse facts in another type; type aliases | ✅ |
| Q-4 | `nlp/writing.py:grade_ielts` | Nonsense essay = band 5.5; "improved intro" echoed the input | Score floors, no prompt relevance, no length cap | Relevance, paragraphing, punctuation, length cap, repetition / off-topic caps; task-specific intro pattern | ✅ |
| Q-5 | `nlp/vietnamese.py:_merge_split_compounds` | Blanks cut "hóa học" in half | pyvi segmentation errors | Re-attach `_COMPOUND_TAILS` syllables to the preceding noun | ✅ |
| Q-6 | `nlp/readability.py:score_difficulty` | Simple texts "Advanced 10/10" | Entity density ×40 | Flesch–Kincaid based | ✅ |

### Security and privacy (S, H)

| ID | Where | Issue | Fix |
|---|---|---|---|
| S-1 | `electron/main.cjs`, `electron/preload.cjs`, `StudioSidebar` / `Settings` | `nodeIntegration:true` + `contextIsolation:false`, so any XSS was code execution | Sandboxed, isolated renderer; preload bridge `window.workflowDesktop` |
| S-2 | `main.py` CORS + `_require_api_token`; `src/main.jsx` fetch wrapper | Any website could read or delete local data (CORS `*`) | CORS allow-list (`WORKFLOW_ALLOWED_ORIGINS`, default dev server + `null`); per-launch `X-Workflow-Token` when `WORKFLOW_API_TOKEN` is set (✅ test) |
| S-3 | `main.py` startup | NLTK download disabled TLS verification globally | Removed; bundled WordNet first |
| S-4 | `src/utils/googleDrive.js`, Settings, CI | Drive API key baked into installers | Users enter it in Settings (localStorage); CI no longer injects it; `drive_api_key` passed to exam endpoints |
| H-1 | git history (all branches) | `.env` with Gemini + Drive keys, personal DB, agent notes with local paths were committed | History rewritten with git-filter-repo and force-pushed on all 9 branches. **Tags `v1.0.0` / `v1.0.1` still need moving** (§11) |

### Unfinished or fake features (F)

| ID | Where | Before | After |
|---|---|---|---|
| F-1 | `WritingPractice.jsx:renderEssay`, `handleGradeEssay` | IELTS Task 1 dead end; band grader unused | Essay screen with band scoring; Task 2 offers write vs translate |
| F-2 | `StudyPlanModal.jsx`, `utils/ics.js` | Fake "Google Calendar connected" alert | Real `.ics` download |
| F-3 | `ProjectStudioSidebar.jsx` | Fake public share link, "coming soon" buttons, no-op ⋮ menus | Removed |
| F-4 | Pricing (`PricingModal`, `/api/user/upgrade`, `User.status`) | Fake premium | **Removed entirely** (non-commercial app) |
| F-5 | `main.py:get_document_notes_api`, `SmartNotesModal` | Offline-only, cached forever | Engine-aware, `regenerate=true`, "Tạo lại" button |
| F-6 | `DocumentViewer.actionPills` | Quiz / flashcard pills sent text to chat | Open the generators |
| F-7 | `electron/main.cjs:workspace:select`, `Settings` storage card, `/api/system/info` | Workspace change didn't move data; no button | Copies DB + uploads, offers relaunch; card in Settings |
| F-8 | `main.py` folder/project PATCH/DELETE, `Sidebar.jsx` | Folders create-only; projects couldn't be renamed / moved / deleted | Endpoints + UI (folder icons, right-click project menu) |

### UI (U)

| ID | Where | Fix |
|---|---|---|
| U-1 | `src/index.css` tokens + about 200 inline colours | Dark mode had invisible text; now themed (light mode pixel-identical; dark `--text-muted` #9A9A9A) |
| U-2 | `ConceptMapModal.jsx:getLayoutedElements`, `layoutToFit` | Global dagre graph leaked across maps; fitView once; size mismatch → fresh graph, remount per map, TB/LR auto-pick |
| U-3 | `ConceptMapModal`, `SmartNotesModal` (`engineLabel`) | Labels claimed "TF-IDF / TextRank" even with Gemini |
| U-4 | `TeamChatWidget.fetchAiMessages` | Auto-scrolled every 3 s |
| U-5 | `package.json`, lint | `npm run lint` used a missing eslint → oxlint; package renamed `workflow` |

---

## 11. Open issues / backlog (prioritised)

| # | Item | Location | Suggested approach |
|---|---|---|---|
| 1 | **Move release tags** `v1.0.0` → `16976a7`, `v1.0.1` → `d17ba68` (they still reference pre-purge history); **rotate the leaked Gemini and Drive keys**; ask GitHub Support to purge cached commits (PR refs #1–#5) | GitHub | `git push --force origin 16976a7f815bfadbee31daf53ecd448426f0261e:refs/tags/v1.0.0 d17ba683cd99bfd9a1e7a00d50aba8e7156ef5ae:refs/tags/v1.0.1` from a fresh clone (the agent session's proxy blocks tag pushes) |
| 2 | Electron changes untested in a real Electron run (readiness wait, sandbox / preload, workspace move, token) | `electron/` | Run `npm run electron:dev`, plus a packaged build from CI |
| 3 | "AI TOKENS 500k" quota is made up and not enforced | `core/agent.py:USAGE_QUOTA`, `Sidebar.jsx`, `Topbar.jsx` | Owner was asked whether to drop the quota and show usage only (unanswered) |
| 4 | Collaboration (invites / members / team chat / shares) can't work in a single-user local app | `/api/projects/*/invite`, `members`, `TeamChatWidget`, `/api/share` | Owner chose to leave as is; needs a server to be real |
| 5 | Offline IELTS `model_answer` is a generic Task 2 template, even for Task 1 | `nlp/writing.py:_model_answer_skeleton` | Separate Task 1 report template |
| 6 | Dead components | `src/components/modals/GenerateQuizModal.jsx`, `StudyDocProgressModal.jsx` (not imported) | Delete or wire up |
| 7 | Backend URL hard-coded about 40× | `src/**` | Central `API_BASE` (keep the `main.jsx` token wrapper matching it) |
| 8 | Unused endpoints | `/api/generate_exam_prep`, `/api/generate_notes`, `/api/suggestions`, `/api/vocabulary/bank/words`, `/api/writing/word` | Remove or use |
| 9 | Team chat "teacher" tab shows the project's whole AI chat history | `TeamChatWidget.fetchAiMessages` → `/api/projects/{id}/messages` | Filter by persona or add a separate channel |
| 10 | `/api/user/stats` counts are global, not per user | `main.py:get_user_stats` | Filter by owner once documents have owners |
| 11 | Source column in `DocumentViewer` is narrow (buttons wrap) | `DocumentViewer.jsx` layout | Responsive widths |
| 12 | `LIBRARY_ROOT` is someone else's public Drive folder | `src/utils/googleDrive.js` | Make it a setting or copy the folder |
| 13 | Old ad-hoc test scripts need a live server | `backend/test_*.py`, `tests/e2e/` | Port to `tests/backend` style |
| 14 | `datetime.utcnow()` deprecation warnings | `db/models.py`, `main.py` | `datetime.now(datetime.UTC)` (mind naive / aware comparisons) |

---

## 11b. Reference products and feature gaps (surveyed 2026-11-05)

The owner names two products as inspiration. Copy **features and mechanics, not branding, text or assets**. A search found no copied marketing text in `src/`.

**english.datpmt.com** (public pages; the exercises themselves need sign-in):

| Their feature | Workflow today | Gap |
|---|---|---|
| Sentence writing: 3 levels × 20 categories | `WritingPractice` sentence mode, same 20 categories | none |
| Paragraph writing: Emails / Diaries / Essays / Articles / Stories / Reports | same 6 content types | none |
| IELTS Writing: level → task → **exercise library** (Task 1: 360, filter by Bar / Pie / Mixed / Line / Table; Task 2: 539), each with an attempt count, a "New" badge and "last practiced" | one random prompt per click; Task 1 prompts are text-only; no history per exercise | **Exercise library with per-exercise attempt history; chart-type filter; rendered Task 1 charts** |
| Pronunciation (AI feedback on spoken sentences, 3 levels) + conversations | none | speech recording + scoring (e.g. Web Speech API or Whisper, then compare with the target sentence) |
| IELTS Speaking Parts 1–3 (full simulation and history "coming soon" on their side) | none | cue cards + recording + offline/AI rubric |
| Leaderboard (points) | points/streaks exist locally (vocabulary, writing) | single-user app: a personal progress/history page instead |

**omilearn.com** (public landing page; the app needs an account):

| Their feature | Workflow today | Gap |
|---|---|---|
| AI roadmap **scheduled on a calendar from a deadline / exam date** ("Lịch học tuần này") | roadmap steps without dates; Study Plan → `.ics` export | deadline input → dated schedule, a "today" view and reminders |
| AI material search with "trusted" source labels | `/api/search` (DuckDuckGo + AI curation) | source-trust labelling |
| **Smart reminders: a quiz inside the notification**, streak nudges | `NotificationsBell` only lists shared items | Electron native notifications with a due flashcard/quiz question; daily streak reminder |
| **Branching (non-linear) chat**: each follow-up opens a branch | linear chat per document/project | `parent_id` on `chat_messages` + a thread/branch UI |
| Active learning (teach-back) with XP and a "memory %" | `ActiveLearning` (understanding score) | XP/memory tracking over time |
| Auto summary / flashcards / quizzes / spaced repetition | present | — |
| Public HUST study library | `LIBRARY_ROOT` in `src/utils/googleDrive.js` **is omilearn's public Drive folder** | depends on a third party keeping it public; make it configurable or self-hosted (backlog #12) |

---

## 12. Verification recipes

- **Endpoint fuzz** (offline): post every generator endpoint with EN, VI, empty, symbol and very long inputs. Assert no 5xx and valid shapes (MCQ `correct_option_id` ∈ option ids; concept-map edges reference existing nodes).
- **Browser flows:** run backend + Vite, then use Playwright (pre-installed; `require('playwright')`). Set `localStorage.workflow_user` and `workflow_api_key='OFFLINE'`. Collect `pageerror`, console errors and API responses ≥ 400. Useful pages: `/#/exam-take/{id}` (use `page.clock` for timer tests), `/#/project/{id}`, `/#/vocabulary`, `/#/writing`, `/#/settings`.
- **Dark mode:** set `localStorage.workflow_dark_mode='1'`, reload, then scan text elements for contrast below 3:1.
- **Frozen-route simulation:** see `test_all_routes_registered_when_frozen`.
