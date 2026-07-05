// Selected study sources (local documents / public-Drive files) shared between the
// library card checkboxes and the exam / exam-room-doc config modals via localStorage.
// Source shape: { type: 'document' | 'drive', value: '<id>', name: '<display name>' }
const KEY = 'workflow_exam_sources';

export function getSelectedSources() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}

export function toggleSource(src) {
  const list = getSelectedSources();
  const i = list.findIndex(s => s.type === src.type && s.value === src.value);
  if (i >= 0) list.splice(i, 1);
  else list.push(src);
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('exam-sources-changed'));
  return list;
}

export function isSelected(type, value) {
  return getSelectedSources().some(s => s.type === type && s.value === String(value));
}

export function clearSources() {
  localStorage.setItem(KEY, '[]');
  window.dispatchEvent(new Event('exam-sources-changed'));
}

// Extract text from an uploaded file: plain text client-side, PDFs via the backend.
export async function extractFileText(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (['txt', 'md', 'csv'].includes(ext)) {
    return { name: file.name, text: await file.text() };
  }
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('http://127.0.0.1:8000/api/extract_text', { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Không đọc được file (${res.status})`);
  const data = await res.json();
  return { name: file.name, text: data.text || '' };
}

export function getOwnerEmail() {
  try { return JSON.parse(localStorage.getItem('workflow_user'))?.email || null; } catch { return null; }
}
