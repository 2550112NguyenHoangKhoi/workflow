const API_BASE = window.location.protocol === 'file:' ? 'http://127.0.0.1:8000' : '';

const DRIVE_API_KEY = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const getHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  const apiKey = localStorage.getItem('gemini_api_key');
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }
  return headers;
};

/**
 * Fetches files from a public Google Drive folder.
 * Requires VITE_GOOGLE_DRIVE_API_KEY to be set in .env
 */
export const fetchDriveFolder = async (folderId) => {
  if (!DRIVE_API_KEY) {
    console.warn('Google Drive API Key not found. Falling back to mock data.');
    return null; // Return null to indicate fallback
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&fields=files(id,name,mimeType,modifiedTime,size)&key=${DRIVE_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch from Google Drive');
    }

    const data = await response.json();
    
    return data.files.map(file => {
      let type = 'unknown';
      if (file.mimeType.includes('pdf')) type = 'pdf';
      else if (file.mimeType.includes('document')) type = 'doc';
      else if (file.mimeType.includes('spreadsheet')) type = 'sheet';
      else if (file.mimeType.includes('image')) type = 'image';
      else if (file.mimeType === 'application/vnd.google-apps.folder') type = 'folder';

      // Format size
      let sizeStr = '';
      if (file.size) {
        const sizeBytes = parseInt(file.size);
        if (sizeBytes > 1024 * 1024) sizeStr = (sizeBytes / (1024 * 1024)).toFixed(1) + ' MB';
        else sizeStr = (sizeBytes / 1024).toFixed(1) + ' KB';
      }

      return {
        id: file.id,
        name: file.name,
        type: type,
        date: new Date(file.modifiedTime).toLocaleDateString(),
        size: sizeStr || '-',
        raw: file
      };
    });
  } catch (error) {
    console.error('Error fetching Drive folder:', error);
    return null;
  }
};

/**
 * Sends a message to the AI Study Assistant.
 * Routes the request through the local Python backend which runs the Antigravity Agent.
 */
export const askAssistant = async (message, context = '') => {
  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        message,
        context
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from backend API: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Error calling backend API:', error);
    return 'Sorry, I encountered an error while processing your request. Ensure the backend server is running.';
  }
};

/**
 * Generates flashcards based on a topic or text.
 */
export const generateFlashcards = async (topic_or_text) => {
  try {
    const response = await fetch(`${API_BASE}/api/generate_flashcards`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ topic_or_text })
    });

    if (!response.ok) throw new Error('Failed to generate flashcards');
    
    const data = await response.json();
    return data.flashcards;
  } catch (error) {
    console.error('Error generating flashcards:', error);
    return [];
  }
};

/**
 * Generates a structured learning path based on a topic.
 */
export const generatePath = async (topic) => {
  try {
    const response = await fetch(`${API_BASE}/api/generate_path`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ topic })
    });

    if (!response.ok) throw new Error('Failed to generate learning path');
    
    return await response.json();
  } catch (error) {
    console.error('Error generating learning path:', error);
    return null;
  }
};

/**
 * Generates a quiz based on a topic or text.
 */
export const generateQuiz = async (topic_or_text) => {
  try {
    const response = await fetch(`${API_BASE}/api/generate_quiz`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ topic_or_text })
    });

    if (!response.ok) throw new Error('Failed to generate quiz');
    return await response.json();
  } catch (error) {
    console.error('Error generating quiz:', error);
    return null;
  }
};

/**
 * Generates structured notes based on a topic or text.
 */
export const generateNotes = async (topic_or_text) => {
  try {
    const response = await fetch(`${API_BASE}/api/generate_notes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ topic_or_text })
    });

    if (!response.ok) throw new Error('Failed to generate notes');
    return await response.json();
  } catch (error) {
    console.error('Error generating notes:', error);
    return null;
  }
};


/**
 * Generates personalized study suggestions based on the user's document corpus.
 */
export const getSuggestions = async (corpus) => {
  try {
    const response = await fetch(`${API_BASE}/api/suggestions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ topic_or_text: corpus })
    });
    if (!response.ok) throw new Error('Failed to generate suggestions');
    return await response.json();
  } catch (error) {
    console.error('Error generating suggestions:', error);
    return null;
  }
};
