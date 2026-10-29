
(async () => {
  // Ждём загрузки JetBrains Mono, чтобы xterm правильно измерил ячейки
  try {
    await Promise.all([
      document.fonts.load('13px "KiwiMono"'),
      document.fonts.load('bold 13px "KiwiMono"'),
    ]);
  } catch (e) {
    // Если шрифты не загрузились, используем запасные
  }

  // Настройки: оболочка по умолчанию и стиль кнопок окна
  let settings = { shell: 'powershell', buttons: 'mac' };
  try { settings = await window.api.getSettings(); } catch (e) {}

  const FONT_FAMILY = '"KiwiMono", "JetBrains Mono", Consolas, monospace';

  const THEME = {
    background: '#00000000',
    foreground: '#e2e5ea',
    cursor: '#c4c8ce',
    cursorAccent: '#292e37',
    selectionBackground: 'rgba(255, 255, 255, 0.22)',
    black: '#1d1f24',
    brightBlack: '#6b7078',
    red: '#ff5f57',
    brightRed: '#ff7b73',
    green: '#28c840',
    brightGreen: '#5be06f',
    yellow: '#febc2e',
    brightYellow: '#ffd05e',
    blue: '#5aa9ff',
    brightBlue: '#85c0ff',
    magenta: '#d68cff',
    brightMagenta: '#e3adff',
    cyan: '#5fd7d7',
    brightCyan: '#8ae8e8',
    white: '#d8dadf',
    brightWhite: '#ffffff',
  };

  const termHost = document.getElementById('term');
  const tabsEl = document.getElementById('tabs');
  const titleText = document.getElementById('title-text');

  const tabs = new Map(); // id -> { id, shell, term, fit, el, btn, started }
  let activeId = null;
  let nextId = 1;

  const shellLabel = (s) => (s === 'cmd' ? 'cmd' : 'PowerShell');
  const active = () => tabs.get(activeId);

  function updateTitle() {
    const t = active();
    if (!t) return;

    const name = t.shell === 'cmd' ? 'cmd' : 'powershell';
    titleText.textContent =
      `${window.api.user} — ${name} — ${t.term.cols}×${t.term.rows}`;
  }

  function doFit(tab = active()) {
    if (!tab || tab.el.style.display === 'none') return;

    try {
      tab.fit.fit();
    } catch (e) {
      return;
    }

    window.api.resize(tab.id, tab.term.cols, tab.term.rows);

    if (tab.id === activeId) updateTitle();
  }

  function startSession(tab) {
    if (tab.started) return;

    tab.started = true;
    window.api.createSession(
      tab.id,
      tab.shell,
      tab.term.cols,
      tab.term.rows
    );
  }

  function activate(id) {
    const tab = tabs.get(id);
    if (!tab) return;

    activeId = id;

    tabs.forEach((t) => {
      const on = t.id === id;
      t.el.style.display = on ? 'block' : 'none';
      t.btn.classList.toggle('active', on);
    });

    doFit(tab);
    updateTitle();
    tab.term.focus();
  }

  function cycle(dir) {
    const ids = [...tabs.keys()];
    if (ids.length < 2) return;

    const i = ids.indexOf(activeId);
    activate(ids[(i + dir + ids.length) % ids.length]);
  }

  function closeTab(id, kill = true) {
    const tab = tabs.get(id);
    if (!tab) return;

    const idx = [...tabs.keys()].indexOf(id);

    if (kill) window.api.killSession(id);

    tab.term.dispose();
    tab.el.remove();
    tab.btn.remove();
    tabs.delete(id);

    if (tabs.size === 0) {
      window.api.close();
      return;
    }

    if (activeId === id) {
      const rest = [...tabs.keys()];
      activate(rest[Math.min(idx, rest.length - 1)]);
    }
  }

  function handleKey(e, tab) {
    if (e.type !== 'keydown') return true;

    if (e.ctrlKey && e.shiftKey && e.code === 'KeyT') {
      createTab(settings.shell);
      return false;
    }

    if (e.ctrlKey && e.shiftKey && e.code === 'KeyW') {
      closeTab(tab.id);
      return false;
    }

    if (e.ctrlKey && e.code === 'Tab') {
      cycle(e.shiftKey ? -1 : 1);
      return false;
    }

    // Ctrl+C копирует выделение, иначе работает как прерывание
    if (e.ctrlKey && e.code === 'KeyC' && tab.term.hasSelection()) {
      navigator.clipboard
        .writeText(tab.term.getSelection())
        .catch(() => {});

      tab.term.clearSelection();
      return false;
    }

    return true;
  }

  function createTab(shell, opts = {}) {
    const id = nextId++;

    const el = document.createElement('div');
    el.className = 'tab-term';
    termHost.appendChild(el);

    const term = new Terminal({
      fontFamily: FONT_FAMILY,
      fontSize: 13,
      fontWeight: '400',
      fontWeightBold: '700',
      lineHeight: 1.15,
      cursorStyle: 'block',
      cursorBlink: false,
      allowTransparency: true,
      scrollback: 5000,
      theme: THEME,
    });

    const fit = new FitAddon.FitAddon();
    term.loadAddon(fit);

    const btn = document.createElement('div');
    btn.className = 'tab';

    btn.innerHTML =
      '<span class="tab-name"></span>' +
      '<button class="tab-close" tabindex="-1">' +
      '<svg viewBox="0 0 10 10">' +
      '<path d="M1.5 1.5l7 7M8.5 1.5l-7 7"/>' +
      '</svg></button>';

    btn.querySelector('.tab-name').textContent = shellLabel(shell);
    tabsEl.appendChild(btn);

    const tab = {
      id,
      shell,
      term,
      fit,
      el,
      btn,
      started: false,
    };

    tabs.set(id, tab);

    btn.addEventListener('mousedown', (e) => {
      if (e.button === 0 && !e.target.closest('.tab-close')) {
        activate(id);
      }
    });

    btn.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        closeTab(id);
      }
    });

    btn.querySelector('.tab-close').addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(id);
    });

    // Контейнер должен быть виден до open(), чтобы xterm измерил ячейки
    tabs.forEach((t) => {
      t.el.style.display = t.id === id ? 'block' : 'none';
    });

    term.open(el);
    term.attachCustomKeyEventHandler((e) => handleKey(e, tab));
    term.onData((d) => window.api.write(id, d));

    activate(id);

    if (!opts.defer) startSession(tab);

    return tab;
  }

  window.api.onData((id, data) => {
    const t = tabs.get(id);
    if (t) t.term.write(data);
  });

  window.api.onExit((id) => closeTab(id, false));

  new ResizeObserver(() => doFit()).observe(termHost);

  // ---------- Кнопки окна ----------
  document.getElementById('btn-close').onclick = () =>
    window.api.close();

  document.getElementById('btn-min').onclick = () =>
    window.api.minimize();

  document.getElementById('btn-max').onclick = () =>
    window.api.maximize();

  document.getElementById('wbtn-min').onclick = () =>
    window.api.minimize();

  document.getElementById('wbtn-max').onclick = () =>
    window.api.maximize();

  document.getElementById('wbtn-close').onclick = () =>
    window.api.close();

  window.api.onFocus((f) => {
    document.body.classList.toggle('inactive', !f);
  });

  window.api.onMaximized((m) => {
    document.body.classList.toggle('maximized', m);
    setTimeout(() => doFit(), 50);
  });

  // Изменение размера за края окна
  document.querySelectorAll('.rz').forEach((h) => {
    h.addEventListener('mousedown', (e) => {
      e.preventDefault();
      window.api.resizeStart(h.dataset.dir);
    });
  });

  function stopAll() {
    window.api.resizeEnd();
    window.api.dragEnd();
  }

  window.addEventListener('mouseup', stopAll);
  window.addEventListener('blur', stopAll);

  // Перетаскивание за заголовок, двойной клик = развернуть
  const titlebar = document.getElementById('titlebar');

  titlebar.addEventListener('mousedown', (e) => {
    if (
      e.button !== 0 ||
      e.target.closest('#buttons, #settings-btn, #win-controls')
    ) {
      return;
    }

    window.api.dragStart();
  });

  titlebar.addEventListener('dblclick', (e) => {
    if (e.target.closest('#buttons, #settings-btn, #win-controls')) {
      return;
    }

    window.api.maximize();
  });

  // ---------- Панель настроек ----------
  const panel = document.getElementById('settings-panel');
  const gear = document.getElementById('settings-btn');
  const tabMenu = document.getElementById('tab-menu');
  const menuBtn = document.getElementById('tab-menu-btn');

  function closePopups() {
    panel.classList.remove('open');
    gear.classList.remove('open');
    tabMenu.classList.remove('open');
  }

  function applySettings() {
    document.body.classList.toggle(
      'btn-windows',
      settings.buttons === 'windows'
    );

    panel.querySelectorAll('.seg').forEach((seg) => {
      seg.querySelectorAll('button').forEach((b) => {
        b.classList.toggle(
          'active',
          settings[seg.dataset.setting] === b.dataset.value
        );
      });
    });

    updateTitle();
  }

  gear.addEventListener('click', (e) => {
    e.stopPropagation();

    const open = !panel.classList.contains('open');

    closePopups();
    panel.classList.toggle('open', open);
    gear.classList.toggle('open', open);
  });

  panel.querySelectorAll('.seg').forEach((seg) => {
    seg.addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b) return;

      const key = seg.dataset.setting;
      const value = b.dataset.value;

      if (settings[key] === value) return;

      settings = await window.api.setSettings({ [key]: value });

      applySettings();

      const t = active();
      if (t) t.term.focus();
    });
  });

  // ---------- Кнопки вкладок ----------
  document.getElementById('new-tab').addEventListener('click', () => {
    closePopups();
    createTab(settings.shell);
  });

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();

    const open = !tabMenu.classList.contains('open');

    closePopups();

    if (open) {
      const w = document.getElementById('window').getBoundingClientRect();
      const r = menuBtn.getBoundingClientRect();

      tabMenu.classList.add('open');

      // Выравниваем по правому краю кнопки и удерживаем внутри окна
      const mw = tabMenu.offsetWidth;

      let left = r.right - w.left - mw;
      left = Math.max(8, Math.min(left, w.width - mw - 8));

      tabMenu.style.left = left + 'px';
      tabMenu.style.top = (r.bottom - w.top + 4) + 'px';
    }
  });

  tabMenu.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      closePopups();
      createTab(b.dataset.shell);
    });
  });

  document.addEventListener('mousedown', (e) => {
    if (
      !panel.contains(e.target) &&
      !gear.contains(e.target) &&
      !tabMenu.contains(e.target) &&
      !menuBtn.contains(e.target)
    ) {
      closePopups();
    }
  });

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') closePopups();
    },
    true
  );


  // ---------- Старт: точный размер терминала 105 x 25 ----------
  const TARGET_COLS = 105;
  const TARGET_ROWS = 22;

  const sleep = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  async function sizeToTarget() {
    try {
      await document.fonts.ready;
    } catch (e) {}

    const tab = active();
    if (!tab) return;

    // Даем xterm.js измерить загруженный шрифт
    for (let i = 0; i < 5; i++) {
      doFit();
      await sleep(80);
    }

    for (let i = 0; i < 12; i++) {
      const cols = tab.term.cols;
      const rows = tab.term.rows;

      if (cols === TARGET_COLS && rows === TARGET_ROWS) {
        break;
      }

      const cell =
        tab.term._core?._renderService?.dimensions?.css?.cell;

      if (!cell || !cell.width || !cell.height) {
        await sleep(100);
        continue;
      }

      const deltaW = (TARGET_COLS - cols) * cell.width;
      const deltaH = (TARGET_ROWS - rows) * cell.height;

      window.api.setSize(
        Math.ceil(window.innerWidth + deltaW),
        Math.ceil(window.innerHeight + deltaH)
      );

      await sleep(180);
      doFit();
    }

    doFit();
    startSession(tab);
    updateTitle();
    window.api.ready();
  }

  createTab(settings.shell, { defer: true });
  applySettings();
  sizeToTarget();
})();
