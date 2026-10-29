const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  user: (process.env.USERNAME || 'user').toLowerCase(),

  // сессии терминала (вкладки)
  createSession: (id, shell, cols, rows) => ipcRenderer.send('pty-create', id, shell, cols, rows),
  killSession: (id) => ipcRenderer.send('pty-kill', id),
  write: (id, d) => ipcRenderer.send('pty-input', id, d),
  resize: (id, c, r) => ipcRenderer.send('pty-resize', id, c, r),
  onData: (cb) => ipcRenderer.on('pty-data', (_, id, d) => cb(id, d)),
  onExit: (cb) => ipcRenderer.on('pty-exit', (_, id) => cb(id)),

  // окно
  onFocus: (cb) => ipcRenderer.on('focus', (_, f) => cb(f)),
  onMaximized: (cb) => ipcRenderer.on('maximized', (_, m) => cb(m)),
  close: () => ipcRenderer.send('win-close'),
  minimize: () => ipcRenderer.send('win-min'),
  maximize: () => ipcRenderer.send('win-max'),
  resizeStart: (dir) => ipcRenderer.send('resize-start', dir),
  resizeEnd: () => ipcRenderer.send('resize-end'),
  dragStart: () => ipcRenderer.send('drag-start'),
  dragEnd: () => ipcRenderer.send('drag-end'),
  setSize: (w, h) => ipcRenderer.send('set-size', w, h),
  ready: () => ipcRenderer.send('win-ready'),

  // настройки
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (patch) => ipcRenderer.invoke('set-settings', patch),
});
