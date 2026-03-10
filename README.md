# 🚀 TSPlay

> **A blazing fast, mobile-first TypeScript playground with full npm support.**

<img src="https://raw.githubusercontent.com/simwai/ts-play/master/screenshot.png" alt="TSPlay Screenshot" width="800">

## 🤔 The Motivation

Ever tried writing code on your smartphone using Monaco or CodeMirror? 
Yeah, it's painful. The virtual keyboard jumps around, native text selection is broken, scrolling feels unnatural, and the whole experience is just sluggish.

**We wanted something better.** 

TSPlay is built on a radically simple idea: **Use a native `<textarea>`**. 
By layering a transparent textarea over a blazing-fast, custom syntax-highlighted `<pre>` tag, we get:
- 📱 **100% Native Mobile Editing:** Your phone's native text selection, copy/paste, and keyboard just *work*.
- ⚡ **Zero Bloat:** No massive editor bundles. Just pure, fast React.
- 🎨 **Beautiful Design:** Fully integrated [Catppuccin](https://github.com/catppuccin/catppuccin) themes with custom selection colors.

But we didn't stop at a simple editor. We packed a full Node.js environment into your browser!

## ✨ Features

- **WebContainers Inside:** Run real Node.js directly in your browser. No backend required.
- **Auto npm Installs:** Just `import React from 'react'` and watch TSPlay automatically detect and install the package in the background.
- **TypeScript Language Service:** Running in a Web Worker, providing real-time diagnostics, type information on hover/tap, and autocomplete.
- **Prettier Formatting:** Built-in code formatting.
- **Shareable Snippets:** Share your code via compressed URLs or our lightweight PHP backend.

## 🛠️ Tech Stack

- **Frontend:** React 19, Vite, TailwindCSS v4
- **Editor:** Custom `<textarea>` + `<pre>` implementation
- **Execution:** WebContainers API
- **Compilation:** esbuild-wasm + TypeScript Compiler API
- **Theme:** Catppuccin (Mocha & Latte)

## 🚀 Getting Started

Want to contribute or run it locally? It's super easy.

```bash
# Clone the repository
git clone https://github.com/yourusername/ts-play.git
cd ts-play

# Install dependencies
npm install

# Start the development server
npm run dev
```

*Note: WebContainers require cross-origin isolation. The Vite dev server is already configured to send the correct `COOP/COEP` headers.*

## 🤝 Contributing

We love contributions! Whether it's fixing a bug, adding a new feature, or just improving the documentation, your help is welcome. 
Since we are avoiding heavy editor libraries, any PRs improving the custom editor experience (like better auto-indentation or bracket matching) are highly appreciated!

1. Fork the project
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

---

## ⚙️ Apache Config (Production)

(I use it 1:1 on a Plesk subdomain.)

**Wichtig:** WebContainers benötigen zwingend einen sicheren Kontext (HTTPS) und Cross-Origin Isolation (für `SharedArrayBuffer`). Stelle sicher, dass das Apache-Modul `mod_headers` aktiviert ist.

**Plesk Hinweis:** In Plesk funktioniert das Setzen der Header über die `.htaccess` oft nicht. Du musst diese stattdessen in den Hosting-Einstellungen unter **Zusätzliche Header** -> **Benutzerdefinierte Header** (Additional headers -> Custom headers) eintragen:
- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Opener-Policy: same-origin`

```apache
<IfModule mod_headers.c>
  # Required for WebContainers (SharedArrayBuffer)
  Header set Cross-Origin-Embedder-Policy "require-corp"
  Header set Cross-Origin-Opener-Policy "same-origin"
</IfModule>

RewriteEngine On

# Don't rewrite existing files or dirs
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d

# Internally rewrite everything to /dist
RewriteRule ^(.*)$ /dist/$1 [L]
```
