// E2E: the user's own Google Drive in the sidebar/browser, with Google mocked.
// mode=web (GIS popup) or mode=desktop (window.workflowDesktop.google bridge).
const { chromium } = require('playwright');
const OUT = process.argv[2];
const MODE = process.argv[3] || 'web';
const APP = 'http://localhost:5173/#';
const FOLDER = 'application/vnd.google-apps.folder';
const tree = {
  root: [{ id: 'f1', name: 'Học kỳ 1', mimeType: FOLDER }, { id: 'doc1', name: 'Ghi chú tuần 1', mimeType: 'application/vnd.google-apps.document' }],
  f1: [{ id: 'f2', name: 'Chương 1', mimeType: FOLDER }, { id: 't1', name: 'bai1.txt', mimeType: 'text/plain', modifiedTime: '2026-10-01T00:00:00Z' }],
  f2: [],
  sd1: [{ id: 'f9', name: 'Tài liệu nhóm', mimeType: FOLDER }],
  shared: [{ id: 'sf', name: 'Đề thi bạn gửi', mimeType: FOLDER }],
};
const all = Object.values(tree).flat().concat([{ id: 'sd1', name: 'Nhóm học tập', mimeType: FOLDER }]);
const fails = [];
const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m); };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  let unauth = 0;
  await ctx.route('https://accounts.google.com/gsi/client', (r) => r.fulfill({ contentType: 'text/javascript', body: `
    window.google = { accounts: { oauth2: {
      initTokenClient: ({ callback }) => ({ requestAccessToken: () => setTimeout(() => callback({ access_token: 'tok-web', expires_in: 3600 }), 50) }),
      revoke: () => {} } } };` }));
  await ctx.route('https://www.googleapis.com/**', (r) => {
    const req = r.request();
    const u = new URL(req.url());
    if (!/^Bearer tok-/.test(req.headers()['authorization'] || '')) { unauth++; return r.fulfill({ status: 401, body: '{"error":{"message":"no auth"}}' }); }
    const json = (o) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(o) });
    if (u.pathname === '/oauth2/v3/userinfo') return json({ name: 'Học Viên', email: 'student@example.com', sub: '1' });
    if (u.pathname === '/drive/v3/drives') return json({ drives: [{ id: 'sd1', name: 'Nhóm học tập' }] });
    if (u.pathname === '/drive/v3/files') {
      const q = u.searchParams.get('q');
      if (q.startsWith('sharedWithMe')) return json({ files: tree.shared });
      const parent = q.match(/'([^']+)' in parents/)[1];
      return json({ files: tree[parent] || [] });
    }
    const m = u.pathname.match(/^\/drive\/v3\/files\/([^/]+)(\/export)?$/);
    if (m && m[2]) return r.fulfill({ contentType: 'application/pdf', body: '%PDF-1.4 fake' });
    if (m && u.searchParams.get('alt') === 'media') return r.fulfill({ contentType: 'text/plain', body: 'Bài 1: Đạo hàm. Đạo hàm của hàm số tại một điểm là giới hạn của tỉ số gia số. Quy tắc tính đạo hàm gồm quy tắc tổng, tích và thương.' });
    if (m) return json(all.find((f) => f.id === m[1]) || { id: m[1], name: '?', mimeType: FOLDER });
    return r.fulfill({ status: 404, body: '{}' });
  });
  await ctx.addInitScript((mode) => {
    localStorage.setItem('workflow_user', JSON.stringify({ name: 'Local', email: 'local@workflow' }));
    localStorage.setItem('workflow_engine_mode', 'algorithm');
    localStorage.setItem('workflow_api_key', 'OFFLINE');
    if (mode === 'desktop') {
      // Stands in for electron/preload.cjs; the refresh-token store is a localStorage flag.
      window.workflowDesktop = { isDesktop: true, apiToken: '', google: {
        signIn: async (cfg) => { if (!cfg.clientId) throw new Error('no client'); localStorage.setItem('__rt', '1'); return { access_token: 'tok-desk', expires_in: 3600 }; },
        getToken: async () => (localStorage.getItem('__rt') ? { access_token: 'tok-desk', expires_in: 3600 } : null),
        signOut: async () => { localStorage.removeItem('__rt'); return true; },
      } };
    }
  }, MODE);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('dialog', (d) => { errors.push('dialog: ' + d.message()); d.dismiss(); });

  // 0. No client id yet → the sidebar button leads to Settings.
  await p.goto(`${APP}/documents`); await p.waitForTimeout(1500);
  await p.getByRole('button', { name: /Kết nối Google Drive/ }).first().click();
  await p.waitForTimeout(800);
  check(p.url().includes('/settings'), 'without a client id, connect opens Settings');
  await p.getByLabel('OAuth Client ID').fill('test-client.apps.googleusercontent.com');
  if (MODE === 'desktop') await p.getByLabel('OAuth Client secret').fill('GOCSPX-test');
  await p.getByRole('button', { name: 'Lưu', exact: true }).click();
  await p.screenshot({ path: `${OUT}/${MODE}-0-settings.png`, fullPage: true });

  // 1. Connect from the sidebar → My Drive opens.
  await p.goto(`${APP}/documents`); await p.waitForTimeout(1000);
  await p.getByRole('button', { name: /Kết nối Google Drive/ }).first().click();
  await p.waitForTimeout(2000);
  check(p.url().includes('folder=root'), 'connect navigates to My Drive');
  const main = p.locator('main, [class*=animate-fade-in]').last();
  check(await p.getByText('Học kỳ 1').count() > 0, 'My Drive folder listed');
  check(await p.getByText('Ghi chú tuần 1').count() > 0, 'Google Doc listed');
  const side = p.locator('aside');
  check(await side.getByText('Drive của tôi').count() === 1, 'sidebar: Drive của tôi');
  check(await side.getByText('Được chia sẻ với tôi').count() === 1, 'sidebar: Được chia sẻ với tôi');
  check(await side.getByText('Nhóm học tập').count() === 1, 'sidebar: shared drive');
  await p.screenshot({ path: `${OUT}/${MODE}-1-mydrive.png` });

  // 2. Expand the tree in the sidebar.
  // connect auto-expands My Drive
  await p.waitForTimeout(800);
  check(await side.getByText('Học kỳ 1').count() === 1, 'sidebar tree expands to subfolders');

  // 3. Open a subfolder, pin it.
  await side.getByText('Học kỳ 1').click(); await p.waitForTimeout(1500);
  check(p.url().includes('folder=f1'), 'sidebar subfolder opens in browser');
  check(await p.getByText('bai1.txt').count() > 0, 'file in subfolder listed');
  await p.getByRole('button', { name: /Ghim/ }).click(); await p.waitForTimeout(800);
  check((await side.locator('[title="Học kỳ 1"]').count()) >= 1 && await side.getByTitle('Bỏ ghim').count() === 1, 'pinned folder in sidebar');

  // 4. Import a private file into the library.
  await p.getByTitle('Nhập vào thư viện để dùng AI').first().click(); await p.waitForTimeout(3000);
  const docs = await (await fetch('http://127.0.0.1:8000/api/documents')).json();
  check(docs.documents.some((d) => d.filename === 'bai1.txt'), 'import from Drive lands in the library');

  // 5. View a private file in-app (blob URL, not the public preview).
  await p.getByRole('button', { name: /Xem ngay/ }).first().click(); await p.waitForTimeout(2000);
  const src = await p.locator('iframe').getAttribute('src');
  check(src && src.startsWith('blob:'), `viewer uses the signed-in blob (src=${(src || '').slice(0, 30)})`);
  await p.screenshot({ path: `${OUT}/${MODE}-5-viewer.png` });

  // 6. Shared with me.
  await p.goto(`${APP}/documents?folder=shared-with-me`); await p.waitForTimeout(1500);
  check(await p.getByText('Đề thi bạn gửi').count() > 0, 'Shared with me listed');

  // 7. Reload: session restored without clicking.
  await p.reload(); await p.waitForTimeout(2000);
  check(await p.getByText('Đề thi bạn gửi').count() > 0 && await side.getByText('Drive của tôi').count() === 1, 'session survives reload');

  // 8. Settings shows connected; disconnect returns the sidebar to the connect button.
  await p.goto(`${APP}/settings`); await p.waitForTimeout(1000);
  check(/Đã kết nối/.test(await p.getByTestId('google-status').innerText()), 'Settings shows connected');
  await p.getByRole('button', { name: /Ngắt kết nối/ }).click(); await p.waitForTimeout(800);
  await p.goto(`${APP}/documents`); await p.waitForTimeout(1500);
  check(await p.getByRole('button', { name: /Kết nối Google Drive/ }).count() >= 1, 'after disconnect the sidebar offers connect again');
  check(await side.getByTitle('Bỏ ghim').count() === 1, 'pinned folder stays after disconnect');

  check(unauth === 0, `no unauthenticated Drive calls while signed in (saw ${unauth})`);
  check(errors.length === 0, 'no page errors/dialogs: ' + errors.join(' | '));
  await b.close();
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED');
  process.exit(fails.length ? 1 : 0);
})();
