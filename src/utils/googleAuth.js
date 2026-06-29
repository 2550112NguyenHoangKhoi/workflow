// Google account sign-in via Google Identity Services (GIS) token flow.
// Reuses the OAuth Client ID already configured for Drive (VITE_GOOGLE_OAUTH_CLIENT_ID),
// requests the basic-profile scopes, fetches the user's profile and remembers it locally
// so the session survives reloads. No client secret is needed (the Client ID is public).
import { loadGis } from './googleDrive';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || '';
const STORAGE_KEY = 'workflow_user';
const PROFILE_SCOPE = 'openid email profile';

export function isAuthConfigured() {
  return Boolean(CLIENT_ID);
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Opens Google's consent popup, then fetches and stores the basic profile.
export async function signInWithGoogle() {
  if (!CLIENT_ID) {
    throw new Error('Chưa cấu hình VITE_GOOGLE_OAUTH_CLIENT_ID trong .env');
  }
  await loadGis();
  const accessToken = await new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: PROFILE_SCOPE,
      callback: (resp) => {
        if (resp.error) {
          const msg = resp.error === 'access_denied'
            ? 'Google chặn vì email chưa nằm trong danh sách "Test users" của OAuth consent screen. Thêm email Gmail vào Test users rồi thử lại.'
            : (resp.error_description || resp.error);
          return reject(new Error(msg));
        }
        resolve(resp.access_token);
      },
    });
    client.requestAccessToken();
  });

  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Không lấy được hồ sơ Google (${res.status})`);
  const info = await res.json();
  const user = {
    name: info.name || '',
    email: info.email || '',
    picture: info.picture || '',
    sub: info.sub || '',
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  return user;
}

export function signOutGoogle() {
  localStorage.removeItem(STORAGE_KEY);
}
