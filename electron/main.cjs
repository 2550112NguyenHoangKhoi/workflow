const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

const BACKEND_PORT = 8000;
const HEALTH_URL = `http://127.0.0.1:${BACKEND_PORT}/api/usage`;
const STARTUP_TIMEOUT_MS = 90_000; // first launch unpacks spaCy/NLTK; can be slow

let backendProcess = null;
let quitting = false;

const LOADING_HTML = `data:text/html;charset=utf-8,${encodeURIComponent(`
  <html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#FAFAF9;color:#1B2A4E">
    <div style="text-align:center"><h2 style="font-family:Georgia,serif;font-style:italic;color:#8A334B">Workflow</h2>
    <p>Đang khởi động bộ máy học tập…</p></div></body></html>`)}`;

function pingBackend() {
  return new Promise((resolve) => {
    const req = http.get(HEALTH_URL, (res) => { res.resume(); resolve(res.statusCode === 200); });
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
    env: { ...process.env, WORKFLOW_DATA_DIR: app.getPath('userData'), WORKFLOW_PORT: String(BACKEND_PORT) },
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
      nodeIntegration: true,
      contextIsolation: false
    }
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

  // IPC Dialog Handler
  ipcMain.handle('dialog:openDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
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
