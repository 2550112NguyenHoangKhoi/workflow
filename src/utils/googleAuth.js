// Google account sign-in. One consent covers the profile and Google Drive (read-only), so
// signing in is also what makes the user's own Drive folders appear in the app.
// The OAuth mechanics (desktop loopback flow vs web popup) live in ./googleDrive.
import { connectDrive, disconnectDrive, getUserInfo, isConfigured } from './googleDrive';

const STORAGE_KEY = 'workflow_user';

export function isAuthConfigured() {
  return isConfigured();
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Opens Google's consent page, then fetches and stores the basic profile.
export async function signInWithGoogle() {
  await connectDrive();
  const info = await getUserInfo();
  const user = {
    name: info.name || '',
    email: info.email || '',
    picture: info.picture || '',
    sub: info.sub || '',
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  return user;
}

export async function signOutGoogle() {
  localStorage.removeItem(STORAGE_KEY);
  await disconnectDrive();
}
