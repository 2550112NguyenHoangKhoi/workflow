// The AI engine chosen in Settings, encoded as the value every AI request sends as `api_key`
// (or the X-API-Key header). Settings is the only writer:
//   '<Gemini key>' | ''  -> Cloud Gemini ('' = use the server's .env key)
//   'LOCAL' | 'LOCAL:m'  -> local Ollama model
//   'OFFLINE'            -> built-in NLP engine
export const ENGINE_KEY_STORAGE = 'workflow_api_key';

export function getEngineKey() {
  try {
    return localStorage.getItem(ENGINE_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}
