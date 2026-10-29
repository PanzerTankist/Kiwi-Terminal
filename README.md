# 🥝 Kiwi Terminal

**A modern terminal inspired by macOS Tahoe.**

Kiwi Terminal is a modern desktop terminal application built with Electron, featuring a clean macOS Tahoe-inspired interface, rounded corners, elegant typography, and a minimal design.

Designed for a comfortable command-line experience with the look and feel of Apple's latest macOS design language.

---

## ✨ Features

- 🍏 **macOS Tahoe-inspired UI** — a modern, minimal interface.
- 💎 **Liquid Glass aesthetic** — translucent surfaces and refined visual details.
- 🔤 **JetBrains Mono typography** — optimized for reading and writing code.
- 🖥️ **Native terminal experience** — execute commands in a real terminal environment.
- 🪟 **Custom window controls** — a sleek title bar inspired by macOS.
- 🌙 **Dark interface** — comfortable for everyday terminal use.

## 🔤 Typography

Kiwi Terminal uses the **JetBrains Mono** typeface for a consistent and readable terminal experience.

| Font file | Usage |
|---|---|
| `JetBrainsMono-Regular` | Regular terminal text |
| `JetBrainsMono-Bold` | Bold text and emphasis |

Place the font files inside the project's `fonts/` directory.

```text
Kiwi Terminal/
├── fonts/
│   ├── JetBrainsMono-Regular.ttf
│   └── JetBrainsMono-Bold.ttf
├── main.js
├── index.html
├── package.json
└── README.md
```

*Adjust the file structure above if your project uses different filenames.*

## 🛠️ Built With

- [Electron](https://www.electronjs.org/) — desktop application framework.
- [xterm.js](https://xtermjs.org/) — terminal emulator interface.
- [node-pty](https://github.com/microsoft/node-pty) — pseudo-terminal integration.
- [JetBrains Mono](https://www.jetbrains.com/lp/mono/) — monospaced typeface.

## 🚀 Getting Started

### Requirements

- Node.js and npm
- Windows, with a compatible shell such as PowerShell
- The project's dependencies installed

### Installation

Clone or download the project, then open a terminal in the project directory.

Install dependencies:

```bash
npm install
```

Start Kiwi Terminal:

```bash
npm start
```

If the project does not have a `start` script in `package.json`, configure it to launch Electron before running the command.

## 🎨 Design Philosophy

Kiwi Terminal follows three principles:

- **Simplicity** — keep the interface clean and focused.
- **Clarity** — use readable typography and carefully spaced elements.
- **Consistency** — bring the visual language of macOS Tahoe to the terminal.

The goal is to make command-line work feel natural in a modern desktop environment without unnecessary visual clutter.

## 📄 License

Choose a license before distributing Kiwi Terminal publicly. If this project is private, you can keep it private and omit this section until needed.

---

<p align="center">
  <strong>🥝 Kiwi Terminal</strong><br>
  <em>A little closer to macOS.</em>
</p>
