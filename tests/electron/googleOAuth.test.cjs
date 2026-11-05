// node --test tests/electron  — exercises the desktop Google sign-in against a fake Google.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { createGoogleOAuth } = require('../../electron/googleOAuth.cjs');

function fakeGoogle() {
  const calls = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const p = Object.fromEntries(new URLSearchParams(body));
      calls.push({ path: req.url, params: p });
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/token' && p.grant_type === 'authorization_code') {
        const ok = p.code === 'good-code'
          && crypto.createHash('sha256').update(p.code_verifier).digest('base64url') === server.lastChallenge;
        res.writeHead(ok ? 200 : 400);
        return res.end(JSON.stringify(ok
          ? { access_token: 'at-1', expires_in: 3600, refresh_token: 'rt-1', scope: 'drive.readonly' }
          : { error: 'invalid_grant' }));
      }
      if (req.url === '/token' && p.grant_type === 'refresh_token') {
        const ok = p.refresh_token === 'rt-1';
        res.writeHead(ok ? 200 : 400);
        return res.end(JSON.stringify(ok ? { access_token: 'at-2', expires_in: 3600 } : { error: 'invalid_grant' }));
      }
      if (req.url === '/revoke') { res.writeHead(200); return res.end('{}'); }
      res.writeHead(404); res.end('{}');
    });
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, calls, base: `http://127.0.0.1:${server.address().port}` })));
}

function makeClient(g, store, browser) {
  return createGoogleOAuth({
    storePath: store,
    encrypt: (s) => Buffer.from(s).reverse(),    // stand-in for safeStorage
    decrypt: (b) => Buffer.from(b).reverse().toString(),
    endpoints: { auth: `${g.base}/auth`, token: `${g.base}/token`, revoke: `${g.base}/revoke` },
    openExternal: browser,
  });
}

// Plays the user's browser: reads the consent URL and follows Google's redirect.
const browserThatConsents = (g, code = 'good-code') => async (url) => {
  const u = new URL(url);
  g.server.lastChallenge = u.searchParams.get('code_challenge');
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(u.searchParams.get('access_type'), 'offline');
  const back = new URL(u.searchParams.get('redirect_uri'));
  assert.equal(back.hostname, '127.0.0.1');
  // A forged redirect with the wrong state must be ignored.
  await fetch(`${back}?code=evil&state=wrong`);
  setTimeout(() => fetch(`${back}?code=${code}&state=${u.searchParams.get('state')}`), 10);
};

test('sign-in, silent refresh, sign-out', async () => {
  const g = await fakeGoogle();
  const store = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'goauth-')), 'g.bin');
  let oauth = makeClient(g, store, browserThatConsents(g));
  const tok = await oauth.signIn({ clientId: 'cid', clientSecret: 'sec', scopes: ['openid', 'drive.readonly'] });
  assert.equal(tok.access_token, 'at-1');
  assert.ok(fs.existsSync(store));
  assert.ok(!fs.readFileSync(store, 'utf8').includes('rt-1'), 'refresh token stored encrypted');

  // Same session: cached token, no network.
  const before = g.calls.length;
  assert.equal((await oauth.getToken({ clientId: 'cid' })).access_token, 'at-1');
  assert.equal(g.calls.length, before);

  // "Next launch": new instance refreshes from the stored refresh token.
  oauth = makeClient(g, store, () => assert.fail('no browser on refresh'));
  assert.equal((await oauth.getToken({ clientId: 'cid', clientSecret: 'sec' })).access_token, 'at-2');
  assert.equal(g.calls.at(-1).params.client_secret, 'sec');

  // Different client id → must sign in again.
  oauth = makeClient(g, store, () => {});
  assert.equal(await oauth.getToken({ clientId: 'other' }), null);

  await oauth.signOut();
  assert.ok(!fs.existsSync(store));
  assert.equal(g.calls.at(-1).path, '/revoke');
  assert.equal(await makeClient(g, store, () => {}).getToken({ clientId: 'cid' }), null);
  g.server.close();
});

test('user denies consent', async () => {
  const g = await fakeGoogle();
  const store = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'goauth-')), 'g.bin');
  const oauth = makeClient(g, store, async (url) => {
    const u = new URL(url);
    setTimeout(() => fetch(`${u.searchParams.get('redirect_uri')}?error=access_denied&state=${u.searchParams.get('state')}`), 10);
  });
  await assert.rejects(oauth.signIn({ clientId: 'cid', scopes: ['x'] }), /Test users/);
  assert.ok(!fs.existsSync(store));
  g.server.close();
});

test('revoked refresh token clears the stored session', async () => {
  const g = await fakeGoogle();
  const store = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'goauth-')), 'g.bin');
  fs.writeFileSync(store, Buffer.from(JSON.stringify({ refresh_token: 'revoked', client_id: 'cid' })).reverse());
  const oauth = makeClient(g, store, () => {});
  await assert.rejects(oauth.getToken({ clientId: 'cid' }));
  assert.ok(!fs.existsSync(store));
  g.server.close();
});

test('missing client id is a clear error', async () => {
  const oauth = createGoogleOAuth({ storePath: '/nonexistent', encrypt: (s) => Buffer.from(s), decrypt: String, openExternal: () => {} });
  await assert.rejects(oauth.signIn({ clientId: '', scopes: [] }), /Client ID/);
});
