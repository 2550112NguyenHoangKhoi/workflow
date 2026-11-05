// The only bridge between the (sandboxed, isolated) renderer and Electron/Node.
const { contextBridge, ipcRenderer } = require('electron');

const tokenArg = process.argv.find((a) => a.startsWith('--workflow-token='));

contextBridge.exposeInMainWorld('workflowDesktop', {
  isDesktop: true,
  // Per-launch secret the local backend requires on API calls (see backend/main.py).
  apiToken: tokenArg ? tokenArg.split('=')[1] : '',
  // Opens a folder picker and stores the choice in ~/.workflow_config.json (main process).
  // Resolves to { path, moved, existing, from } or null if cancelled; data is copied over.
  selectWorkspace: () => ipcRenderer.invoke('workspace:select'),
  relaunch: () => ipcRenderer.invoke('app:relaunch'),
});
