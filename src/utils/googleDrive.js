import { readUploadResult } from './uploads';

// Google account + Google Drive.
//
// Signing in with Google (one consent: profile + drive.readonly) shows the user's own Drive
// — My Drive, "Shared with me", shared drives — in the sidebar and the Drive browser.
//   • Desktop app: system-browser OAuth with loopback + PKCE in the Electron main process
//     (electron/googleOAuth.cjs). Needs a "Desktop app" OAuth client, entered in Settings.
//     The session survives restarts (encrypted refresh token in the user-data folder).
//   • Browser (dev): Google Identity Services popup with VITE_GOOGLE_OAUTH_CLIENT_ID (a "Web"
//     client); the access token is kept in sessionStorage until it expires (~1 h).
// The Drive API key (Settings) is optional: only needed for public folders while signed out.

export const DRIVE_KEY_STORAGE = 'workflow_drive_api_key';
export const GOOGLE_CLIENT_STORAGE = 'workflow_google_client';
const TOKEN_STORAGE = 'workflow_google_token';
export const PINNED_STORAGE = 'workflow_drive_pinned';
export const AUTH_EVENT = 'workflow-google-auth';

const desktopGoogle = () => (typeof window !== 'undefined' ? window.workflowDesktop?.google : undefined);
export const isDesktop = () => Boolean(desktopGoogle());

export function getDriveApiKey() {
  try {
    return (localStorage.getItem(DRIVE_KEY_STORAGE) || '').trim() || import.meta.env.VITE_GOOGLE_DRIVE_API_KEY || '';
  } catch {
    return import.meta.env.VITE_GOOGLE_DRIVE_API_KEY || '';
  }
}

export function setDriveApiKey(key) {
  localStorage.setItem(DRIVE_KEY_STORAGE, (key || '').trim());
}

// OAuth client from Settings; the build-time env var is the fallback.
export function getGoogleClient() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(GOOGLE_CLIENT_STORAGE) || '{}') || {}; } catch { /* ignore */ }
  const envId = isDesktop()
    ? import.meta.env.VITE_GOOGLE_DESKTOP_CLIENT_ID
    : import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
  return { clientId: (saved.clientId || envId || '').trim(), clientSecret: (saved.clientSecret || '').trim() };
}

export function setGoogleClient({ clientId, clientSecret }) {
  localStorage.setItem(GOOGLE_CLIENT_STORAGE, JSON.stringify({ clientId: (clientId || '').trim(), clientSecret: (clientSecret || '').trim() }));
}

export const MISSING_DRIVE_KEY_MSG = 'Hãy đăng nhập Google (nút “Kết nối Google Drive”) — hoặc nhập Drive API key trong Cài đặt để xem thư mục công khai.';
export const MISSING_CLIENT_MSG = isDesktop()
  ? 'Chưa nhập OAuth Client ID — vào Cài đặt → Tài khoản Google để nhập.'
  : 'Chưa cấu hình VITE_GOOGLE_OAUTH_CLIENT_ID trong .env';

// `key=` query param when we have one. Without a key, only OAuth-authorised calls work.
function keyParam(prefix) {
  const key = getDriveApiKey();
  return key ? `${prefix}key=${encodeURIComponent(key)}` : '';
}
const SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.readonly';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

let accessToken = null;
let tokenExpiry = 0;

export function isConfigured() {
  return Boolean(getGoogleClient().clientId);
}

export function isConnected() {
  return Boolean(accessToken) && Date.now() < tokenExpiry;
}

// Current access token (or null) — sent to the backend so exam/doc generation can read
// private Drive sources.
export function getAccessToken() {
  return isConnected() ? accessToken : null;
}

function setToken(tok) {
  if (tok?.access_token) {
    accessToken = tok.access_token;
    tokenExpiry = Date.now() + (Number(tok.expires_in || 3600) - 60) * 1000;
    if (!isDesktop()) {
      try { sessionStorage.setItem(TOKEN_STORAGE, JSON.stringify({ t: accessToken, e: tokenExpiry })); } catch { /* ignore */ }
    }
  } else {
    accessToken = null;
    tokenExpiry = 0;
    try { sessionStorage.removeItem(TOKEN_STORAGE); } catch { /* ignore */ }
  }
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: { connected: isConnected() } }));
}

// Silently restores the Google session (no UI). Resolves true when connected.
let restoring = null;
export function restoreSession() {
  if (isConnected()) return Promise.resolve(true);
  if (restoring) return restoring;
  restoring = (async () => {
    try {
      if (isDesktop()) {
        const cfg = getGoogleClient();
        if (!cfg.clientId) return false;
        const tok = await desktopGoogle().getToken(cfg);
        if (tok) setToken(tok);
      } else {
        const saved = JSON.parse(sessionStorage.getItem(TOKEN_STORAGE) || 'null');
        if (saved && Date.now() < saved.e) { accessToken = saved.t; tokenExpiry = saved.e; }
      }
    } catch { /* stay signed out */ }
    return isConnected();
  })().finally(() => { restoring = null; });
  return restoring;
}

// Access token for an API call: restores silently, refreshing on the desktop when expired.
async function ensureToken() {
  if (isConnected()) return accessToken;
  await restoreSession();
  return isConnected() ? accessToken : null;
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

// Signs in with Google (consent in the system browser on desktop, a popup on the web) and
// resolves with an access token that covers both the profile and Drive.
export async function connectDrive() {
  const cfg = getGoogleClient();
  if (!cfg.clientId) throw new Error(MISSING_CLIENT_MSG);
  if (isDesktop()) {
    setToken(await desktopGoogle().signIn(cfg));
    return accessToken;
  }
  await loadGis();
  const tok = await new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: cfg.clientId,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error) {
          const msg = resp.error === 'access_denied'
            ? 'Google chặn vì email chưa nằm trong danh sách "Test users". Mở Google Cloud Console → APIs & Services → OAuth consent screen → mục Test users → thêm email Gmail của bạn → Save, rồi bấm Kết nối lại.'
            : (resp.error_description || resp.error);
          return reject(new Error(msg));
        }
        resolve(resp);
      },
      error_callback: (e) => reject(new Error(e?.message || 'Đã đóng cửa sổ đăng nhập Google.')),
    });
    client.requestAccessToken();
  });
  setToken(tok);
  return accessToken;
}

export async function disconnectDrive() {
  try {
    if (isDesktop()) await desktopGoogle().signOut();
    else if (accessToken && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(accessToken);
  } catch { /* ignore */ }
  setToken(null);
}

const SHORTCUT_MIME = 'application/vnd.google-apps.shortcut';

// Virtual folder ids understood by listChildren / the Drive browser.
export const MY_DRIVE = 'root';
export const SHARED_WITH_ME = 'shared-with-me';

// Pinned folders: any Drive folder (e.g. a public study library such as a university's
// shared course folder) the user added by link. Stored locally; nothing is pinned by default.
export function getPinnedFolders() {
  try { return JSON.parse(localStorage.getItem(PINNED_STORAGE) || '[]') || []; } catch { return []; }
}
export function folderIdFromInput(input) {
  const s = (input || '').trim();
  const m = s.match(/folders\/([\w-]{10,})/) || s.match(/[?&]folder=([\w-]{10,})/) || s.match(/[?&]id=([\w-]{10,})/) || s.match(/^([\w-]{2,})$/);
  return m ? m[1] : null;
}
export async function pinFolder(input) {
  const id = folderIdFromInput(input);
  if (!id) throw new Error('Không nhận ra liên kết thư mục Google Drive.');
  const meta = await getFileMeta(id);
  if (meta.mimeType !== FOLDER_MIME) throw new Error('Liên kết này không phải là thư mục.');
  const list = getPinnedFolders().filter((f) => f.id !== meta.id);
  list.push({ id: meta.id, name: meta.name });
  localStorage.setItem(PINNED_STORAGE, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: { connected: isConnected() } }));
  return meta;
}
export function unpinFolder(id) {
  localStorage.setItem(PINNED_STORAGE, JSON.stringify(getPinnedFolders().filter((f) => f.id !== id)));
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: { connected: isConnected() } }));
}

async function driveGet(path) {
  const token = await ensureToken();
  if (!token && !getDriveApiKey()) throw new Error(MISSING_DRIVE_KEY_MSG);
  const sep = path.includes('?') ? '&' : '?';
  const url = `https://www.googleapis.com/drive/v3/${path}${sep}supportsAllDrives=true${keyParam('&')}`;
  let res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (res.status === 401 && token) {
    // Token revoked/expired early: drop it and retry once with a refreshed one.
    setToken(null);
    const again = await ensureToken();
    if (again) res = await fetch(url, { headers: { Authorization: `Bearer ${again}` } });
  }
  if (!res.ok) {
    let msg = `Drive API ${res.status}`;
    try { msg = (await res.json()).error?.message || msg; } catch { /* ignore */ }
    if (res.status === 404 || res.status === 403) msg += token ? '' : ' — thư mục có thể là riêng tư: hãy đăng nhập Google.';
    throw new Error(msg);
  }
  return res.json();
}

// Drive shortcuts point at another file/folder; resolve them to their targets so folder
// navigation and file preview/download use the real object id + mime type.
function resolveShortcut(f) {
  if (f.mimeType === SHORTCUT_MIME && f.shortcutDetails?.targetId) {
    return { ...f, id: f.shortcutDetails.targetId, mimeType: f.shortcutDetails.targetMimeType || f.mimeType };
  }
  return f;
}

const FILE_FIELDS = 'id,name,mimeType,modifiedTime,size,iconLink,thumbnailLink,shortcutDetails';

// Fetch one file/folder's metadata — used for the breadcrumb title when browsing ?folder=<id>.
export async function getFileMeta(fileId) {
  if (fileId === MY_DRIVE) return { id: MY_DRIVE, name: 'Drive của tôi', mimeType: FOLDER_MIME };
  if (fileId === SHARED_WITH_ME) return { id: SHARED_WITH_ME, name: 'Được chia sẻ với tôi', mimeType: FOLDER_MIME };
  return resolveShortcut(await driveGet(`files/${fileId}?fields=${FILE_FIELDS}`));
}

async function listAll(q, extra = '') {
  const out = [];
  let pageToken = '';
  for (let i = 0; i < 20; i++) { // ≤ 20 pages × 1000 items
    const data = await driveGet(
      `files?q=${encodeURIComponent(q)}&fields=nextPageToken,files(${FILE_FIELDS})&pageSize=1000&orderBy=folder,name_natural`
      + `&includeItemsFromAllDrives=true${extra}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`
    );
    out.push(...(data.files || []));
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return out.map(resolveShortcut);
}

const split = (files) => ({
  folders: files.filter((f) => f.mimeType === FOLDER_MIME),
  files: files.filter((f) => f.mimeType !== FOLDER_MIME),
});

// List folders + files inside a folder. MY_DRIVE = My Drive top level, SHARED_WITH_ME = items
// others shared with the user (top level only, like drive.google.com).
export async function listChildren(parentId = MY_DRIVE) {
  if (parentId === SHARED_WITH_ME) return split(await listAll('sharedWithMe and trashed=false'));
  return split(await listAll(`'${parentId}' in parents and trashed=false`));
}

// Shared drives (Google Workspace / school accounts). Empty for most personal accounts.
export async function listSharedDrives() {
  if (!(await ensureToken())) return [];
  const data = await driveGet('drives?pageSize=100&fields=drives(id,name)');
  return data.drives || [];
}

export async function getUserInfo() {
  const token = await ensureToken();
  if (!token) throw new Error('Chưa đăng nhập Google.');
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Không lấy được hồ sơ Google (${res.status})`);
  return res.json();
}

// Public-file URLs that work without OAuth (like the reference product's library):
// card preview thumbnails, the embedded viewer, and raw downloads.
export const publicThumbUrl = (fileId) => `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
export const publicPreviewUrl = (fileId) => `https://drive.google.com/file/d/${fileId}/preview`;
export const publicDownloadUrl = (fileId) => `https://drive.google.com/uc?export=download&id=${fileId}`;
export const publicShareUrl = (fileId) => `https://drive.google.com/file/d/${fileId}/view`;

// Raw bytes of a Drive file. Google Docs/Sheets/Slides are exported (`exportAs`).
async function fetchFileBlob(file, exportAs) {
  const token = await ensureToken();
  if (!token && !getDriveApiKey()) throw new Error(MISSING_DRIVE_KEY_MSG);
  const isNative = file.mimeType?.startsWith('application/vnd.google-apps');
  const url = isNative
    ? `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=${encodeURIComponent(exportAs)}${keyParam('&')}`
    : `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true${keyParam('&')}`;
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(`Tải file thất bại (${res.status})`);
  return { blob: await res.blob(), isNative };
}

// Download a Drive file for import. Google-native docs are exported to text/plain;
// everything else is fetched as a Blob (PDF/txt/etc.) for the backend to parse.
export async function downloadFile(file) {
  const { blob, isNative } = await fetchFileBlob(file, 'text/plain');
  const name = isNative ? `${file.name}.txt` : file.name;
  return new File([blob], name, { type: blob.type || 'application/octet-stream' });
}

// blob: URL for viewing a file in-app (private files can't use the public preview iframe
// unless the browser happens to be signed in to Google). Docs are exported to PDF.
export async function fileObjectUrl(file) {
  const { blob } = await fetchFileBlob(file, 'application/pdf');
  return URL.createObjectURL(blob);
}

// Download from Drive and import into the local library via the backend.
export async function importFileToLibrary(file) {
  const localFile = await downloadFile(file);
  const form = new FormData();
  form.append('file', localFile);
  const res = await fetch('http://127.0.0.1:8000/api/documents/upload', { method: 'POST', body: form });
  const result = await readUploadResult(res);
  if (!result.ok) throw new Error(result.message || `Import thất bại (${res.status})`);
  return result;
}
