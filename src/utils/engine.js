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

/** Human-readable name of the selected engine, for subtitles/loading text. */
export function engineLabel() {
  const k = getEngineKey();
  if (k === 'OFFLINE') return 'bộ máy NLP tích hợp (offline)';
  if (k.startsWith('LOCAL')) return `model cục bộ${k.includes(':') ? ` (${k.split(':')[1]})` : ' (Ollama)'}`;
  return 'Gemini (Cloud)';
}
