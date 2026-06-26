const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let backendProcess = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    win.loadURL('http://localhost:5173');
  }
}

app.whenReady().then(() => {
  const backendPath = app.isPackaged 
    ? path.join(process.resourcesPath, 'backend', 'workflow-backend')
    : path.join(__dirname, '../../backend/dist/workflow-backend/workflow-backend');
    
  console.log("Starting backend at:", backendPath);
  
  backendProcess = spawn(backendPath, [], {
    cwd: path.dirname(backendPath),
  });
  
  backendProcess.stdout.on('data', (data) => console.log(`Backend stdout: ${data}`));
  backendProcess.stderr.on('data', (data) => console.error(`Backend stderr: ${data}`));

  // Open window immediately
  createWindow();
});

app.on('will-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
