// Google Drive (private) integration via Google Identity Services (GIS) token flow.
// No client secret needed: the OAuth Client ID is public and embedded in the frontend.
// Requires (in .env, Vite-exposed):
//   VITE_GOOGLE_OAUTH_CLIENT_ID = <...>.apps.googleusercontent.com
//   VITE_GOOGLE_DRIVE_API_KEY   = AIza...   (your existing key)

const CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || '';
const API_KEY = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY || '';
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

let accessToken = null;
let tokenExpiry = 0;

export function isConfigured() {
  return Boolean(CLIENT_ID);
}

export function isConnected() {
  return Boolean(accessToken) && Date.now() < tokenExpiry;
}

export function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const existing = document.getElementById('gis-script');
    if (existing) {
      existing.addEventListener('load', resolve);
      existing.addEventListener('error', reject);
      return;
    }
    const s = document.createElement('script');
    s.id = 'gis-script';
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(s);
  });
}

// Opens Google's consent popup and resolves with an access token.
export async function connectDrive() {
  if (!CLIENT_ID) {
    throw new Error('Chưa cấu hình VITE_GOOGLE_OAUTH_CLIENT_ID trong .env');
  }
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) {
          const msg = resp.error === 'access_denied'
            ? 'Google chặn vì email chưa nằm trong danh sách "Test users". Mở Google Cloud Console → APIs & Services → OAuth consent screen → mục Test users → thêm email Gmail của bạn → Save, rồi bấm Kết nối lại.'
            : (resp.error_description || resp.error);
          return reject(new Error(msg));
        }
        accessToken = resp.access_token;
        tokenExpiry = Date.now() + (Number(resp.expires_in || 3600) - 60) * 1000;
        resolve(accessToken);
      },
    });
    client.requestAccessToken();
  });
}

export function disconnectDrive() {
  if (accessToken && window.google?.accounts?.oauth2) {
    try { window.google.accounts.oauth2.revoke(accessToken); } catch { /* ignore */ }
  }
  accessToken = null;
  tokenExpiry = 0;
}

const SHORTCUT_MIME = 'application/vnd.google-apps.shortcut';

// The public study library mirrored from omilearn.com — a shared Drive folder that is
// listable with just the API key (no OAuth). This is the default "Duyệt Drive" root.
export const LIBRARY_ROOT = '1VTmwR9iVndmKvI2O3jiHPlAu0OBnWPir';
export const LIBRARY_ROOT_NAME = 'ĐẠI HỌC BÁCH KHOA HÀ NỘI (HUST)';

// Public folders need only the API key; the OAuth token is attached when present so the
// same helpers also browse the user's private Drive after they connect.
function authHeaders() {
  return isConnected() ? { Authorization: `Bearer ${accessToken}` } : {};
}

async function driveGet(path) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`https://www.googleapis.com/drive/v3/${path}${sep}key=${API_KEY}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Drive API ${res.status}: ${await res.text()}`);
  return res.json();
}

// The library is built from Drive shortcuts; resolve them to their targets so folder
// navigation and file preview/download use the real object id + mime type.
function resolveShortcut(f) {
  if (f.mimeType === SHORTCUT_MIME && f.shortcutDetails?.targetId) {
    return { ...f, id: f.shortcutDetails.targetId, mimeType: f.shortcutDetails.targetMimeType || f.mimeType };
  }
  return f;
}

// Fetch one file/folder's metadata — used for the breadcrumb title when browsing ?folder=<id>.
export async function getFileMeta(fileId) {
  return resolveShortcut(await driveGet(`files/${fileId}?fields=id,name,mimeType,shortcutDetails`));
}

// List folders + files inside a parent folder ('root' = My Drive top level).
export async function listChildren(parentId = 'root') {
  const q = `'${parentId}' in parents and trashed=false`;
  const data = await driveGet(
    `files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,modifiedTime,shortcutDetails)&pageSize=200&orderBy=folder,name`
  );
  const files = (data.files || []).map(resolveShortcut);
  return {
    folders: files.filter((f) => f.mimeType === FOLDER_MIME),
    files: files.filter((f) => f.mimeType !== FOLDER_MIME),
  };
}

// Public-file URLs that work without OAuth (like the reference product's library):
// card preview thumbnails, the embedded viewer, and raw downloads.
export const publicThumbUrl = (fileId) => `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
export const publicPreviewUrl = (fileId) => `https://drive.google.com/file/d/${fileId}/preview`;
export const publicDownloadUrl = (fileId) => `https://drive.google.com/uc?export=download&id=${fileId}`;
export const publicShareUrl = (fileId) => `https://drive.google.com/file/d/${fileId}/view`;

// Download a Drive file's text. Google-native docs are exported to text/plain;
// everything else is fetched as a Blob (PDF/txt/etc.) for the backend to parse.
export async function downloadFile(file) {
  const isNative = file.mimeType.startsWith('application/vnd.google-apps');
  const url = isNative
    ? `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain&key=${API_KEY}`
    : `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${API_KEY}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Tải file thất bại (${res.status})`);
  const blob = await res.blob();
  const name = isNative ? `${file.name}.txt` : file.name;
  return new File([blob], name, { type: blob.type || 'application/octet-stream' });
}

// Download from Drive and import into the local library via the backend.
export async function importFileToLibrary(file) {
  const localFile = await downloadFile(file);
  const form = new FormData();
  form.append('file', localFile);
  const res = await fetch('http://127.0.0.1:8000/api/documents/upload', { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Import thất bại (${res.status})`);
  return res.json();
}
