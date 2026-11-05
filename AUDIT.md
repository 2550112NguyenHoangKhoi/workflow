# Codebase audit: bugs & unfinished features

> **Status (fix pass, same branch):** every item below is ✅ fixed unless marked otherwise.
> Regression tests for the backend fixes live in `tests/backend/` and run in CI before the build.
>
> **Not fixed, needs a decision or outside action:**
> - Release tags `v1.0.0` / `v1.0.1` still point at pre-purge commits (the session can't push tags). Move them to `16976a7` / `d17ba68` and rotate the leaked Gemini and Drive keys.
> - Collaboration (invites / members / team chat / shares): needs a shared server. That's an architecture decision, so it's left as-is.
> - Login bypass (hard-coded local user): kept on purpose (commit 9968c97). The user is now registered in the backend.
>
> **History purged (all branches):** `.env` (Gemini + Drive keys), the personal DB files, and AI-agent notes / build output / caches containing the Mac username and machine name.
>
> **Drive API key:** no longer built into the app. Users enter it in Settings → Google Drive (stored locally); `.env` is a dev-only fallback.
>
> **Removed:** pricing / Premium plans (modal, `/api/user/upgrade`, user `status`). This is a non-commercial app.
>
> **Corrections to the original audit:**
> - #15 (vocabulary review) is intended behaviour, not a bug. Due "learning" words are reviewed via "Ôn từ mới", and the bank top-up is deliberate.
> - `package.json` / `package-lock.json` are *not* gitignored; that line came from a different command's output.
>
> **Also found and fixed during the pass:**
> - The offline concept map was nondeterministic and only covered the first sentence.
> - The workspace-folder picker had no button anywhere in the UI.
> - IELTS model-essay translation was scored as a band.
> - `TakeQuizModal` was dead code.
> - The global TLS-verification bypass in the NLTK download was removed.

Snapshot of `claude/determined-noether-5k5z68` @ `d6111a7` (2026-11-05).
Scope: `backend/` (FastAPI + SQLite + NLP), `src/` (React/Vite), `electron/`, CI.

Legend: ✅ = reproduced by running the code; 📖 = found by reading the code.

---

## P0: breaks the released desktop app

| # | Issue | Where | Evidence |
|---|---|---|---|
| 1 | **About a third of the API is missing from the packaged build.** `if __name__ == "__main__": uvicorn.run(app)` sits halfway through `main.py`. In the frozen (PyInstaller) build `uvicorn.run` blocks there, so nothing defined below it gets registered: suggestions, exams, exam docs, artifacts, writing, vocabulary, teach-back, share, studio overview, extract_text and team chat. Dev mode works because uvicorn re-imports `main:app`. | `backend/main.py:1448` | ✅ Simulated frozen start: 51 of 76 routes registered, `/api/writing/grade` missing |
| 2 | **The CI-built backend can't start.** `requirements.txt` is missing packages that are imported at module top level, `google-antigravity` and `ddgs`, plus runtime ones: `python-docx`, `trafilatura`, `youtube-transcript-api`, `deep-translator`, `certifi`, `requests`, `pytesseract`/`Pillow`, `faster-whisper`. The spaCy model `en_core_web_sm` is never installed either. | `backend/requirements.txt`, `main.py:28,1089` | 📖 + `pip index` confirms both packages exist on PyPI but aren't listed |
| 3 | **CI builds with the wrong spec.** The workflow runs `pyinstaller workflow-backend.spec`, the bare auto-generated spec with no hidden imports, no `hooks/`, no NLTK data and no spaCy data. `backend.spec` has all of that but isn't used. Both specs are also matched by `.gitignore` (`backend/*.spec`) even though they're tracked. | `.github/workflows/build-release.yml`, `backend/*.spec` | 📖 |
| 4 | **User data is lost or goes to read-only places when packaged.** `UPLOAD_DIR` and `usage.json` sit next to `__file__`, which in a frozen app is the bundle or temp dir. The DB defaults to `./workflow_local.db` relative to cwd, which is the app's resources folder (read-only in a signed macOS `.app`). | `main.py:38,88`, `db/database.py:44`, `electron/main.cjs:31` | 📖 |
| 5 | **Roadmap generation crashes in the frozen build.** `nlp/roadmap.py` runs `from main import agent_run` outside its `try`. In a PyInstaller exe the entry script is `__main__`, so the import fails or re-runs the whole module. | `backend/nlp/roadmap.py:28` | 📖 |
| 6 | **Electron never waits for or watches the backend.** There's no `error` handler on `spawn` (a missing binary throws an uncaught exception), no readiness check before the window loads, and no restart if the backend dies. | `electron/main.cjs` | 📖 |

## P1: wrong behaviour or data bugs

| # | Issue | Where | Evidence |
|---|---|---|---|
| 7 | **`/api/vocabulary/generate` always returns 500.** It imports a module `core.agent` that doesn't exist. The "Generate words with AI" button in Vocabulary never works. | `main.py:2458` | ✅ `{"detail":"No module named 'core'"}` |
| 8 | **Deleted documents leak their old file into new documents.** SQLite reuses the highest ID after a delete, `delete_document` never removes `uploads/{id}.*`, and `/file` falls back to a glob on `{id}.*`. The next document that reuses the ID serves the old file. | `db/crud.py:delete_document`, `main.py:1022` | ✅ Uploaded `secret.pdf`, deleted it, ingested a URL; the URL doc served `%PDF-OLD PRIVATE` |
| 9 | **Main chat ignores the AI engine chosen in Settings.** `DocumentViewer` never sends `api_key`, so the backend always uses the `.env` Gemini key. Choosing Offline or Ollama has no effect. With only a key saved in Settings (none in `.env`), chat always falls back to offline TF-IDF. Same for project roadmap generation, team-chat "teacher" and Smart Notes (offline only). | `src/pages/DocumentViewer.jsx:144`, `ProjectStudioSidebar.jsx:94`, `TeamChatWidget.jsx:112` | 📖 |
| 10 | **The API key lives under three different localStorage keys.** `workflow_api_key` (engine signal), `workflow_gemini_key` (raw key) and `gemini_api_key` (dead `utils/api.js`). `CreateLessonPlanModal` reads `workflow_gemini_key` first, so it uses Gemini even when the user picked Offline or Local. | `CreateLessonPlanModal.jsx:67` | 📖 |
| 11 | **The document library silently stops at 100.** `crud.get_documents`, `get_projects` and `get_folders` default to `limit=100` with no ordering. After 100 uploads, new documents don't appear, and every modal that "finds the active doc" in the list falls back to the wrong one. | `db/crud.py` | 📖 |
| 12 | **Regenerating destroys progress.** Generating flashcards, quiz, exam, exam prep or study plan for a document deletes all previous ones, including SM-2 review history on flashcards and exams that were already shared (shares then point at a deleted artifact). | `main.py:491-499,1206,1929` | 📖 |
| 13 | **New flashcards skip the 1-day step.** `create_flashcard` sets `repetitions=1`, so the first good review jumps straight to a 6-day interval. | `db/crud.py:create_flashcard` | 📖 |
| 14 | **The due-flashcards modal filters by stale context.** It ANDs `project_id` with a leftover `sessionStorage.active_document_id` from another page, which can return 0 cards. Flashcards saved from Writing Practice have no project or document, so they only show where no context applies. | `DueFlashcardModal.jsx:29-50`, `WritingPractice.jsx:297` | 📖 |
| 15 | **Vocabulary review logic is inconsistent.** Review mode only returns `learned==1` words, so due "learning" words never come up for review. Fetching new words also inserts random bank words into the user's list as a side effect. | `main.py:2795-2860` | 📖 |
| 16 | **Writing streak resets every morning.** It requires an attempt *today* (the vocab streak accepts yesterday) and compares UTC timestamps with the local date. `/api/writing/progress` with no email returns *everyone's* attempts, while vocab uses `owner_email IS NULL`. | `main.py:3025-3032,3001` | 📖 |
| 17 | **Deleting a project leaves orphans.** Child documents' flashcards, artifacts, quiz scores, roadmaps and uploaded files remain, along with team messages and shares. Deleting a document leaves its shares and invites. | `db/crud.py:delete_project` | 📖 |
| 18 | **Uploads fail silently.** A corrupt PDF, `.pptx`, `.doc`, or OCR/Whisper with the dependency missing returns 200 with empty content, and AI features then run on an empty doc. The YouTube ingest uses `YouTubeTranscriptApi.get_transcript`, which was removed in youtube-transcript-api 1.x. Failed URL ingests create empty documents. | `main.py:527-638` | ✅ (corrupt PDF accepted) / 📖 |
| 19 | **Document roadmap errors look like success.** An error returns HTTP 200 with `{"status":"error"}` and the UI checks only `res.ok`. A doc with no text gives a silent no-op. | `main.py:531`, `ProjectStudioSidebar.jsx:99` | 📖 |
| 20 | **Project chat context is truncated to one document.** The frontend always sends `context` (the active doc, first 6,000 chars), which overrides the backend's whole-project context. | `DocumentViewer.jsx:146`, `main.py:402` | 📖 |
| 21 | **Some endpoints skip the timeout and engine routing.** `generate_path`, `search` and `suggestions` use `Agent` directly instead of `agent_run`, with no timeout and no LOCAL routing (a `LOCAL:` key is sent to Gemini). | `main.py:735,1127,1469` | 📖 |
| 22 | **Dictionary lookup returns `null`.** `/api/vocabulary/lookup` returns `null` with status 200 on failure. `/api/user/stats` returns 404 for the bypass "Local User", who is never synced via `/api/auth/login`. | `main.py:2736,377`, `LandingPage.jsx:20` | ✅ / 📖 |

## P2: security & privacy

- **A personal database is committed to the repo.** `backend/omilearn_local.db.bak` (610 KB) contains real user emails, 35 documents, 265 flashcards and 47 invites. It's in `.gitignore` but still tracked, so it's in git history. `database.sqlite` and `local.db.bak` (empty) and `usage.json` are tracked too.
- **Electron runs with `nodeIntegration: true` and `contextIsolation: false`.** The renderer shows AI and Markdown output and web-search results, so any XSS becomes code execution on the user's machine.
- **The backend has no authentication and allows CORS from `*`.** Any website the user visits can call `http://127.0.0.1:8000` (read and delete documents, invite people). Identity is just an `email` string from the client.
- **The NLTK startup download disables TLS verification globally:** `ssl._create_default_https_context = ssl._create_unverified_context`.
- **The Drive API key is shipped in the frontend bundle** (`VITE_GOOGLE_DRIVE_API_KEY`).

## Unfinished or fake features

| Feature | State |
|---|---|
| **IELTS essay grading** | The backend (`/api/writing/ielts/grade` + `nlp.writing.grade_ielts`) is complete, but no UI calls it. |
| **IELTS Task 1** | The lesson comes back with `sentences: []`. The UI shows "Câu 1/0" with no essay box, and "Kiểm tra" throws on `lesson.sentences[0]`. Dead end. |
| **Pricing / Premium** | "Upgrade" just flips `status='premium'` for any email with no payment. On a network error it still shows success. Premium gates nothing. |
| **Google Calendar export** (Study Plan) | The button only shows `alert('Đã tạo file .ics và kết nối Google Calendar thành công!')`. Nothing is created. |
| **Public share link** (project sidebar) | It alerts a made-up URL, `https://workflow.com/share/{id}`. |
| **Community exams / exam-room docs** | Buttons show "sắp ra mắt" (coming soon). |
| **Collaboration (invite, members, team chat)** | It's a single-user local SQLite app, so invites can't be delivered or accepted, there's a fake `owner@local.app` member, and "team" chat only talks to yourself. Shares only show up if someone logs in *on the same machine*. |
| **Login** | Google login is bypassed with a hard-coded `local@workflow.ai` user. |
| **Offline roadmap** | Without a working AI key the "Giáo án" is always the same three canned steps. |
| **Smart Notes** | Offline only, cached forever (no regenerate), and the AI `/api/generate_notes` path is unused. |
| **Chat action pills** | "Tạo quiz nhanh" and "Tạo flashcard" just send that text as a chat message; they don't create anything. |
| **Change workspace folder** | It writes `~/.workflow_config.json` and says the DB "will move". It doesn't: the next start opens an empty DB, and `uploads/` stays behind. |
| **Folders** | Create only: no rename, delete or move. |
| **Shares** | Can't be listed by the owner, revoked or notified. |
| **No-op buttons** | The `⋮` menus at `ProjectStudioSidebar.jsx:174,243,417`. |
| **Unused backend endpoints** | `/api/generate_exam_prep`, `/api/vocabulary/bank/words`, `/api/writing/word`, `/api/generate_notes`, `/api/suggestions` |
| **Dead frontend code** | `src/utils/api.js` and `src/utils/storage.js` are never imported (lint flags the unused imports in `DocumentExplorer`). |

## Tooling & hygiene

- `npm run lint` runs `eslint .`, but eslint isn't installed (only `oxlint`). `oxlint src` passes with about 30 unused-variable and hook-dependency warnings. `vite build` passes, with one chunk over 500 kB.
- `package.json` and `package-lock.json` are in `.gitignore` but tracked. The package name is still `hopeful-galileo`.
- The backend has no automated tests. The `backend/test_*.py` files are ad-hoc scripts that hit a live server, and `tests/e2e` needs a running backend. CI runs no tests.
- The backend URL `http://127.0.0.1:8000` is hard-coded in more than 40 places instead of using `API_BASE`.
- `main.py` is 3,268 lines with repeated imports (`json`, `BaseModel`, `Form`) partway through the file, and the same "delete old artifact then create" block copied six times.
- The README points at `nguyenhoangkhoi2312/workflow/releases`, but this repo is `2550112nguyenhoangkhoi/workflow`.

## Suggested fix order

1. Move the `__main__` block to the end of `main.py`; complete `requirements.txt`; switch CI to `backend.spec` and install `en_core_web_sm`. Together these make the release actually work.
2. Put the DB, uploads and usage under a user-data dir (`app.getPath('userData')`, passed to the backend as an env var).
3. Remove `omilearn_local.db.bak` from the repo **and from history**.
4. Remove `core.agent` from `/api/vocabulary/generate`; delete uploaded files on document delete (and use `AUTOINCREMENT` or UUID filenames).
5. Send `api_key` from every AI caller and collapse to one storage key.
6. Then the P1 data bugs, then decide which fake features to finish or hide.
