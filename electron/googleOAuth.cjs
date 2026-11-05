// Google sign-in for the desktop app: OAuth 2.0 for installed apps (loopback redirect + PKCE).
//
// Why not Google Identity Services (the web popup used in the browser build)? The packaged app
// loads index.html from file:// (origin "null"), which GIS rejects, and Google blocks sign-in
// pages shown inside embedded Electron windows. So the consent page opens in the user's normal
// browser and Google redirects back to a one-shot server on 127.0.0.1.
//
// Needs an OAuth client of type "Desktop app" (Google Cloud Console → Credentials). Google
// treats a desktop client secret as non-confidential, but we still never bundle it: the user
// enters client id/secret in Settings and the renderer passes them in.
//
// The refresh token is stored encrypted (Electron safeStorage, injected as encrypt/decrypt)
// so the user stays signed in across launches. Access tokens live only in memory.
//
// This module has no Electron imports so it can be tested with plain Node
// (tests/electron/googleOAuth.test.cjs).
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000;

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function postForm(url, params) {
  const body = new URLSearchParams(params).toString();
  const u = new URL(url);
  const mod = u.protocol === 'http:' ? http : https;
  return new Promise((resolve, reject) => {
    const req = mod.request(u, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let json = {};
        try { json = JSON.parse(data || '{}'); } catch { /* non-JSON error page */ }
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(json);
        else reject(Object.assign(new Error(json.error_description || json.error || `HTTP ${res.statusCode}`), { code: json.error, status: res.statusCode }));
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('Google không phản hồi (timeout)')));
    req.end(body);
  });
}

const PAGE = (title, msg) => `<!doctype html><meta charset="utf-8"><title>Workflow</title>
<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#FAFAF9;color:#1B2A4E">
<div style="text-align:center"><h2 style="color:#8A334B">${title}</h2><p>${msg}</p></div></body>`;

/**
 * @param {object} deps
 * @param {(url: string) => Promise<void>|void} deps.openExternal  opens the system browser
 * @param {string} deps.storePath     file that holds the encrypted refresh token
 * @param {(s: string) => Buffer} deps.encrypt
 * @param {(b: Buffer) => string} deps.decrypt
 * @param {object} [deps.endpoints]   override Google URLs (tests)
 */
function createGoogleOAuth({ openExternal, storePath, encrypt, decrypt, endpoints = {} }) {
  const authUrl = endpoints.auth || AUTH_URL;
  const tokenUrl = endpoints.token || TOKEN_URL;
  const revokeUrl = endpoints.revoke || REVOKE_URL;
  let cached = null;      // { access_token, expires_at, scope }
  let pending = null;     // in-flight sign-in (only one browser round-trip at a time)

  const readStore = () => {
    try { return JSON.parse(decrypt(fs.readFileSync(storePath))); } catch { return null; }
  };
  const writeStore = (obj) => fs.writeFileSync(storePath, encrypt(JSON.stringify(obj)));
  const clearStore = () => { try { fs.unlinkSync(storePath); } catch { /* none */ } };

  const remember = (tok) => {
    cached = {
      access_token: tok.access_token,
      expires_at: Date.now() + (Number(tok.expires_in || 3600) - 60) * 1000,
      scope: tok.scope || '',
    };
    return { access_token: cached.access_token, expires_in: Math.round((cached.expires_at - Date.now()) / 1000), scope: cached.scope };
  };

  // Starts the one-shot loopback server. Resolves (once listening) to its redirect URI and
  // a promise for the authorization code Google sends back.
  function startRedirectServer(state) {
    let settle;
    const codeP = new Promise((resolve, reject) => { settle = { resolve, reject }; });
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (u.pathname !== '/') { res.writeHead(404); res.end(); return; }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (u.searchParams.get('state') !== state) {
        res.writeHead(400);
        res.end(PAGE('Yêu cầu không hợp lệ', 'Hãy đóng tab này và thử đăng nhập lại từ Workflow.'));
        return; // keep waiting for the real redirect
      }
      const err = u.searchParams.get('error');
      res.writeHead(200);
      res.end(err
        ? PAGE('Chưa đăng nhập', 'Bạn đã huỷ hoặc Google từ chối. Có thể đóng tab này.')
        : PAGE('Đã kết nối Google', 'Bạn có thể đóng tab này và quay lại Workflow.'));
      finish();
      if (err) settle.reject(Object.assign(new Error(err === 'access_denied'
        ? 'Google từ chối truy cập. Nếu ứng dụng OAuth đang ở chế độ "Testing", hãy thêm email của bạn vào Test users.'
        : err), { code: err }));
      else settle.resolve(u.searchParams.get('code'));
    });
    const timer = setTimeout(() => { finish(); settle.reject(new Error('Hết thời gian chờ đăng nhập Google (5 phút).')); }, SIGN_IN_TIMEOUT_MS);
    const finish = () => { clearTimeout(timer); server.close(); };
    return new Promise((resolve, reject) => {
      server.on('error', (e) => { clearTimeout(timer); reject(e); });
      server.listen(0, '127.0.0.1', () => resolve({ redirectUri: `http://127.0.0.1:${server.address().port}`, codeP, cancel: finish }));
    });
  }

  async function signIn({ clientId, clientSecret, scopes }) {
    if (!clientId) throw new Error('Chưa nhập OAuth Client ID (Cài đặt → Tài khoản Google).');
    if (pending) return pending;
    pending = (async () => {
      const verifier = b64url(crypto.randomBytes(32));
      const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
      const state = b64url(crypto.randomBytes(16));

      const { redirectUri, codeP, cancel } = await startRedirectServer(state);

      const url = new URL(authUrl);
      url.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scopes.join(' '),
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state,
        access_type: 'offline',      // ask for a refresh token…
        prompt: 'consent select_account', // …every time (Google only returns it on consent)
        include_granted_scopes: 'true',
      }).toString();
      try { await openExternal(url.toString()); } catch (e) { cancel(); throw e; }

      const code = await codeP;
      const tok = await postForm(tokenUrl, {
        code,
        client_id: clientId,
        ...(clientSecret ? { client_secret: clientSecret } : {}),
        code_verifier: verifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      });
      if (tok.refresh_token) writeStore({ refresh_token: tok.refresh_token, client_id: clientId });
      return remember(tok);
    })();
    try { return await pending; } finally { pending = null; }
  }

  // A valid access token without any UI: the cached one, else a refresh. null = must sign in.
  async function getToken({ clientId, clientSecret }) {
    if (cached && Date.now() < cached.expires_at) {
      return { access_token: cached.access_token, expires_in: Math.round((cached.expires_at - Date.now()) / 1000), scope: cached.scope };
    }
    const stored = readStore();
    if (!stored?.refresh_token) return null;
    if (clientId && stored.client_id && stored.client_id !== clientId) return null; // client changed
    try {
      const tok = await postForm(tokenUrl, {
        refresh_token: stored.refresh_token,
        client_id: stored.client_id || clientId,
        ...(clientSecret ? { client_secret: clientSecret } : {}),
        grant_type: 'refresh_token',
      });
      return remember(tok);
    } catch (e) {
      if (e.code === 'invalid_grant') clearStore(); // revoked or expired: sign in again
      throw e;
    }
  }

  async function signOut() {
    const stored = readStore();
    const toRevoke = stored?.refresh_token || cached?.access_token;
    cached = null;
    clearStore();
    if (toRevoke) { try { await postForm(revokeUrl, { token: toRevoke }); } catch { /* best effort */ } }
    return true;
  }

  return { signIn, getToken, signOut, hasStoredSession: () => Boolean(readStore()?.refresh_token) };
}

module.exports = { createGoogleOAuth };
