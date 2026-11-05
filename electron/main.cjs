const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const crypto = require('crypto');
const os = require('os');
const { createGoogleOAuth } = require('./googleOAuth.cjs');

const BACKEND_PORT = 8000;
const HEALTH_URL = `http://127.0.0.1:${BACKEND_PORT}/api/usage`;
const STARTUP_TIMEOUT_MS = 90_000; // first launch unpacks spaCy/NLTK; can be slow

let backendProcess = null;
// Per-launch secret: the backend rejects API calls without it, so other local web pages
// can't drive or read the user's data through http://127.0.0.1:8000.
const API_TOKEN = crypto.randomBytes(24).toString('hex');
let quitting = false;

const LOADING_HTML = `data:text/html;charset=utf-8,${encodeURIComponent(`
  <html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#FAFAF9;color:#1B2A4E">
    <div style="text-align:center"><h2 style="font-family:Georgia,serif;font-style:italic;color:#8A334B">Workflow</h2>
    <p>Đang khởi động bộ máy học tập…</p></div></body></html>`)}`;

function pingBackend() {
  return new Promise((resolve) => {
    const req = http.get(HEALTH_URL, { headers: { 'X-Workflow-Token': API_TOKEN } }, (res) => { res.resume(); resolve(res.statusCode === 200); });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

async function waitForBackend(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await pingBackend()) return true;
    if (backendProcess && backendProcess.exitCode !== null) return false; // it died
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function startBackend() {
  const exe = process.platform === 'win32' ? 'workflow-backend.exe' : 'workflow-backend';
  const backendPath = app.isPackaged
    ? path.join(process.resourcesPath, 'backend', exe)
    : path.join(__dirname, '../backend/dist/workflow-backend', exe);

  if (!fs.existsSync(backendPath)) {
    // In development the backend is usually started by hand (uvicorn); just use it.
    if (!app.isPackaged) {
      console.log(`No bundled backend at ${backendPath}; expecting one on port ${BACKEND_PORT}.`);
      return;
    }
    dialog.showErrorBox('Workflow', `Không tìm thấy backend:\n${backendPath}`);
    return;
  }

  console.log('Starting backend at:', backendPath);
  backendProcess = spawn(backendPath, [], {
    cwd: path.dirname(backendPath),
    // Keep the DB, uploads and usage counter in the per-user data folder, never inside
    // the (possibly read-only) app bundle.
    env: { ...process.env, WORKFLOW_DATA_DIR: app.getPath('userData'), WORKFLOW_PORT: String(BACKEND_PORT), WORKFLOW_API_TOKEN: API_TOKEN },
    windowsHide: true,
  });

  backendProcess.stdout.on('data', (data) => console.log(`Backend stdout: ${data}`));
  backendProcess.stderr.on('data', (data) => console.error(`Backend stderr: ${data}`));
  backendProcess.on('error', (err) => {
    console.error('Backend failed to start:', err);
    dialog.showErrorBox('Workflow', `Không khởi động được backend:\n${err.message}`);
  });
  backendProcess.on('exit', (code, signal) => {
    console.error(`Backend exited (code=${code}, signal=${signal})`);
    if (!quitting) {
      dialog.showErrorBox('Workflow', `Backend đã dừng bất ngờ (mã ${code ?? signal}). Hãy khởi động lại ứng dụng.`);
    }
  });
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // The renderer shows AI output, web-search results and Markdown: never give it Node.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
      plugins: true, // built-in PDF viewer for private Drive files shown from a blob: URL
      additionalArguments: [`--workflow-token=${API_TOKEN}`],
    }
  });

  // Links with target=_blank (Drive downloads, help pages) open in the user's browser,
  // never as new windows that would inherit the preload bridge.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadURL(LOADING_HTML);
  const ready = await waitForBackend(STARTUP_TIMEOUT_MS);
  if (!ready) {
    dialog.showErrorBox('Workflow', 'Backend chưa sẵn sàng sau 90 giây. Một số tính năng có thể không hoạt động.');
  }

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    win.loadURL('http://localhost:5173');
  }
}

app.whenReady().then(() => {
  startBackend();

  ipcMain.handle('workspace:select', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || !result.filePaths[0]) return null;
    const target = result.filePaths[0];
    const configPath = path.join(os.homedir(), '.workflow_config.json');

    // Where the data lives today: the previously chosen workspace, else Electron's userData.
    let current = app.getPath('userData');
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (cfg.workspace_path) current = cfg.workspace_path;
    } catch { /* no workspace chosen yet */ }

    if (path.resolve(target) === path.resolve(current)) {
      return { path: target, moved: false, existing: true };
    }

    // Copy the data into the new folder unless it already holds a Workflow database (then we
    // simply switch to it). Copy (not move) so nothing is lost if the copy is interrupted.
    const DB = 'workflow_local.db';
    const targetHasDb = fs.existsSync(path.join(target, DB)) || fs.existsSync(path.join(target, 'omilearn_local.db'));
    let moved = false;
    if (!targetHasDb) {
      try {
        fs.mkdirSync(target, { recursive: true });
        for (const name of [DB, 'usage.json']) {
          const src = path.join(current, name);
          if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(target, name)); moved = true; }
        }
        const uploads = path.join(current, 'uploads');
        if (fs.existsSync(uploads)) {
          fs.cpSync(uploads, path.join(target, 'uploads'), { recursive: true, errorOnExist: false });
          moved = true;
        }
      } catch (err) {
        throw new Error(`Không sao chép được dữ liệu sang thư mục mới: ${err.message}`);
      }
    }
    fs.writeFileSync(configPath, JSON.stringify({ workspace_path: target }, null, 2));
    return { path: target, moved, existing: targetHasDb, from: current };
  });

  // Google account (sign-in + Drive). See electron/googleOAuth.cjs for why this runs here.
  const google = createGoogleOAuth({
    openExternal: (url) => shell.openExternal(url),
    storePath: path.join(app.getPath('userData'), 'google-session.bin'),
    encrypt: (text) => (safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(text) : Buffer.from(text, 'utf8')),
    decrypt: (buf) => (safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : buf.toString('utf8')),
  });
  const SCOPES = ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/drive.readonly'];
  ipcMain.handle('google:signIn', (_e, cfg = {}) => google.signIn({ clientId: cfg.clientId, clientSecret: cfg.clientSecret, scopes: SCOPES }));
  ipcMain.handle('google:getToken', (_e, cfg = {}) => google.getToken({ clientId: cfg.clientId, clientSecret: cfg.clientSecret }));
  ipcMain.handle('google:signOut', () => google.signOut());

  // Smart reminders: a native notification carrying the quiz question; clicking it brings the
  // app forward and tells the renderer to open the in-app quiz card.
  ipcMain.handle('notify:show', (e, { title, body } = {}) => {
    if (!Notification.isSupported()) return false;
    const n = new Notification({ title: String(title || 'Workflow').slice(0, 120), body: String(body || '').slice(0, 400), silent: false });
    const sender = e.sender;
    n.on('click', () => {
      const w = BrowserWindow.fromWebContents(sender);
      if (w) { if (w.isMinimized()) w.restore(); w.show(); w.focus(); }
      if (!sender.isDestroyed()) sender.send('notify:clicked');
    });
    n.show();
    return true;
  });

  ipcMain.handle('app:relaunch', () => {
    quitting = true;
    app.relaunch();
    app.exit(0);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  quitting = true;
  if (backendProcess) {
    backendProcess.kill();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
