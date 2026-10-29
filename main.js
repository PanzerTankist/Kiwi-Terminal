const { app, BrowserWindow, ipcMain, screen, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const pty = require('node-pty');

// true = приглашение как в macOS zsh: archi@PC ~ %  (только для PowerShell)
const ZSH_STYLE_PROMPT = true;

const MIN_W = 500;
const MIN_H = 300;

let win;
const sessions = new Map(); // id вкладки -> pty
let resizeTimer = null;
let dragTimer = null;
let maximized = false;
let prevBounds = null;

// ---------- настройки (сохраняются между запусками) ----------
let settings = { shell: 'powershell', buttons: 'mac' };

function settingsFile() {
  return path.join(app.getPath('userData'), 'settings.json');
}
function loadSettings() {
  try {
    const s = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
    if (['powershell', 'cmd'].includes(s.shell)) settings.shell = s.shell;
    if (['mac', 'windows'].includes(s.buttons)) settings.buttons = s.buttons;
  } catch (e) { /* файла ещё нет */ }
}
function saveSettings() {
  try {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
  } catch (e) { /* не страшно */ }
}

// ---------- оболочка ----------
function powershellArgs() {
  if (!ZSH_STYLE_PROMPT) return ['-NoLogo'];
  const script = `
function prompt {
  $p = $executionContext.SessionState.Path.CurrentLocation.Path
  if ($p -eq $HOME) { $leaf = '~' }
  else { $leaf = Split-Path $p -Leaf; if (-not $leaf) { $leaf = $p } }
  "$($env:USERNAME.ToLower())@$($env:COMPUTERNAME) $leaf % "
}
$cmdBuiltins = @('ver','vol','assoc','ftype','mklink','color','title','pause','verify','path')
$ExecutionContext.InvokeCommand.CommandNotFoundAction = {
  param($name, $eventArgs)
  if ($cmdBuiltins -contains $name.ToLower()) {
    $n = $name
    $eventArgs.CommandScriptBlock = { cmd.exe /c "$n $args" }.GetNewClosure()
    $eventArgs.StopSearch = $true
  }
}
$d = (Get-Date).ToString('ddd MMM d HH:mm:ss', [cultureinfo]'en-US')
Write-Host "Last login: $d on console"
`;
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return ['-NoLogo', '-NoExit', '-EncodedCommand', encoded];
}

function createSession(id, shellType, cols, rows) {
  const file = shellType === 'cmd' ? 'cmd.exe' : 'powershell.exe';
  const args = shellType === 'cmd' ? [] : powershellArgs();

  const sh = pty.spawn(file, args, {
    name: 'xterm-256color',
    cols: cols > 0 ? cols : 105,
    rows: rows > 0 ? rows : 25,
    cwd: process.env.USERPROFILE,
    env: process.env,
  });
  sessions.set(id, sh);

  sh.onData((data) => {
    if (win && !win.isDestroyed()) win.webContents.send('pty-data', id, data);
  });
  sh.onExit(() => {
    // выход по команде exit: сообщаем вкладке, чтобы она закрылась
    if (sessions.get(id) === sh) {
      sessions.delete(id);
      if (win && !win.isDestroyed()) win.webContents.send('pty-exit', id);
    }
  });
}

// ---------- окно ----------
function createWindow() {
  win = new BrowserWindow({
    width: 960,   // примерный размер, точный 105x25 подгоняется в renderer.js
    height: 560,
    show: false,
    minWidth: MIN_W,
    minHeight: MIN_H,
    frame: false,
    transparent: true,       // нужно для больших скруглений как в Tahoe
    resizable: false,        // размер меняем своими ручками (см. resize-start)
    backgroundColor: '#00000000',
    title: 'Kiwi Terminal',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('index.html');
  setTimeout(() => { if (win && !win.isDestroyed() && !win.isVisible()) win.show(); }, 2500);
  win.on('focus', () => win.webContents.send('focus', true));
  win.on('blur', () => win.webContents.send('focus', false));

}

function toggleMaximize() {
  if (!maximized) {
    prevBounds = win.getBounds();
    win.setBounds(screen.getDisplayMatching(prevBounds).workArea);
    maximized = true;
  } else {
    if (prevBounds) win.setBounds(prevBounds);
    maximized = false;
  }
  win.webContents.send('maximized', maximized);
}

// ---------- IPC ----------
ipcMain.on('pty-create', (_, id, shellType, cols, rows) => {
  if (!sessions.has(id)) createSession(id, shellType, cols, rows);
});
ipcMain.on('pty-input', (_, id, data) => {
  const sh = sessions.get(id);
  if (sh) sh.write(data);
});
ipcMain.on('pty-resize', (_, id, cols, rows) => {
  const sh = sessions.get(id);
  if (sh && cols > 0 && rows > 0) {
    try { sh.resize(cols, rows); } catch (e) {}
  }
});
ipcMain.on('pty-kill', (_, id) => {
  const sh = sessions.get(id);
  if (sh) {
    sessions.delete(id); // убираем до kill, чтобы не слать pty-exit
    try { sh.kill(); } catch (e) {}
  }
});
ipcMain.on('win-close', () => win.close());
ipcMain.on('win-min', () => win.minimize());
ipcMain.on('win-max', toggleMaximize);

ipcMain.handle('get-settings', () => settings);
ipcMain.handle('set-settings', (_, patch) => {
  if (patch && ['powershell', 'cmd'].includes(patch.shell)) settings.shell = patch.shell;
  if (patch && ['mac', 'windows'].includes(patch.buttons)) settings.buttons = patch.buttons;
  saveSettings();
  return settings;
});

// Ручное изменение размера окна за края
ipcMain.on('resize-start', (_, dir) => {
  if (maximized) return;
  const start = win.getBounds();
  const c0 = screen.getCursorScreenPoint();
  clearInterval(resizeTimer);
  resizeTimer = setInterval(() => {
    const c = screen.getCursorScreenPoint();
    const dx = c.x - c0.x;
    const dy = c.y - c0.y;
    let { x, y, width, height } = start;
    if (dir.includes('e')) width = Math.max(MIN_W, start.width + dx);
    if (dir.includes('s')) height = Math.max(MIN_H, start.height + dy);
    if (dir.includes('w')) {
      width = Math.max(MIN_W, start.width - dx);
      x = start.x + start.width - width;
    }
    if (dir.includes('n')) {
      height = Math.max(MIN_H, start.height - dy);
      y = start.y + start.height - height;
    }
    win.setBounds({ x, y, width, height });
  }, 16);
});
ipcMain.on('resize-end', () => clearInterval(resizeTimer));

// Перетаскивание окна за заголовок
ipcMain.on('drag-start', () => {
  if (maximized) return;
  const start = win.getBounds();
  const c0 = screen.getCursorScreenPoint();
  clearInterval(dragTimer);
  dragTimer = setInterval(() => {
    const c = screen.getCursorScreenPoint();
    win.setBounds({
      x: start.x + c.x - c0.x,
      y: start.y + c.y - c0.y,
      width: start.width,
      height: start.height,
    });
  }, 8);
});
ipcMain.on('drag-end', () => clearInterval(dragTimer));

// Подгонка размера окна под нужное число колонок и строк
ipcMain.on('set-size', (_, w, h) => {
  const b = win.getBounds();
  const wa = screen.getDisplayMatching(b).workArea;
  win.setBounds({
    x: Math.round(wa.x + (wa.width - w) / 2),
    y: Math.round(wa.y + (wa.height - h) / 2),
    width: Math.round(w),
    height: Math.round(h),
  });
});
ipcMain.on('win-ready', () => { if (!win.isVisible()) win.show(); });

app.whenReady().then(() => {
  if (app.isPackaged) Menu.setApplicationMenu(null);
  loadSettings();
  createWindow();
});
app.on('window-all-closed', () => {
  for (const sh of sessions.values()) { try { sh.kill(); } catch (e) {} }
  sessions.clear();
  app.quit();
});
