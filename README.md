# Workflow AI

Workflow is a powerful, offline-capable desktop learning and study application powered by AI. It helps you manage documents, take smart notes, and automatically generates interactive study materials like Flashcards, Quizzes, Concept Maps, and Study Plans directly from your personal files.

## Features

- **Document Studio**: Upload and read your PDFs, DOCX, and text files in a split-pane viewer.
- **AI Assistant**: Chat with your documents using advanced AI models.
- **Smart Learning Tools**: Automatically generate Flashcards, Quizzes, Study Guides, and Mindmaps from your documents.
- **Spaced Repetition**: Review vocabulary and flashcards using scientifically proven spaced repetition algorithms.
- **Flexible AI Engines**: Choose the intelligence engine that fits your needs:
  - **Cloud API (Google Gemini)**: Highest quality reasoning and speed, completely free to use with your own API key.
  - **Local Model (Ollama)**: 100% private, offline AI running directly on your computer's CPU/GPU (supports Gemma 2, Qwen 2.5, Llama 3.1, etc).
  - **Offline NLP Algorithm**: Lightweight, built-in algorithms (TextRank, pyvi) that run instantly without needing heavy AI models.

## Tech Stack

- **Frontend**: React, Vite, Electron (Desktop wrapper)
- **Backend**: Python, FastAPI, SQLite
- **AI Integrations**: Google Gemini API, Ollama (Local LLMs)

## Installation & Setup

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- (Optional) [Ollama](https://ollama.com) if you want to run local models.

### 1. Backend Setup
Navigate to the `backend` folder and set up a Python virtual environment:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Run the backend server:
```bash
python main.py
```
*The FastAPI backend will start at `http://localhost:8000`.*

### 2. Frontend Setup
Open a new terminal and install Node dependencies:
```bash
npm install
```

Run the Vite development server:
```bash
npm run dev
```

### 3. Desktop App Build (Electron)
To run the app as a desktop application during development:
```bash
npm run electron:dev
```

To build production executables (.dmg, .exe):
```bash
npm run electron:build
```
*Compiled binaries will be available in the `release/` directory.*

## Setting up AI Engines

Open the app and go to **Cài đặt hệ thống (Settings)** to configure your AI engine:

1. **Cloud API (Gemini)**: Create a free API key at [Google AI Studio](https://aistudio.google.com/app/apikey) and paste it into the app.
2. **Local AI (Ollama)**: Install Ollama, download a model (e.g., `ollama pull gemma2:9b`), and select it in the app's Settings. The app will intelligently recommend the best local model based on your computer's RAM.

## License

MIT License
