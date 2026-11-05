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
  // Google sign-in through the system browser (loopback + PKCE, electron/googleOAuth.cjs).
  // cfg = { clientId, clientSecret } of a "Desktop app" OAuth client from Settings.
  google: {
    signIn: (cfg) => ipcRenderer.invoke('google:signIn', cfg),
    getToken: (cfg) => ipcRenderer.invoke('google:getToken', cfg), // null when signed out
    signOut: () => ipcRenderer.invoke('google:signOut'),
  },
  // Native notification (smart reminders). onClick fires when the user clicks one.
  notify: (opts) => ipcRenderer.invoke('notify:show', opts),
  onNotificationClick: (cb) => {
    const h = () => cb();
    ipcRenderer.on('notify:clicked', h);
    return () => ipcRenderer.removeListener('notify:clicked', h);
  },
});
