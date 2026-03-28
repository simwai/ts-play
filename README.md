# 🚀 TSPlay

> **A blazing fast, mobile-first TypeScript playground with full npm support.**

<img src="https://raw.githubusercontent.com/simwai/ts-play/master/screenshot.png" alt="TSPlay Screenshot" width="800">

## 🤔 The Motivation

Ever tried writing code on your smartphone using Monaco or CodeMirror?
Yeah, it's painful. The virtual keyboard jumps around, native text selection is broken, scrolling feels unnatural, and the whole experience is just sluggish.

**We wanted something better.**

TSPlay is built on a radically simple idea: **Use a native `<textarea>`**.
By layering a transparent textarea over a blazing-fast, custom syntax-highlighted `<pre>` tag, we get:

- 📱 **100% Native Mobile Editing:** Your phone's native text selection, copy/paste, and keyboard just _work_. No weird workarounds.
- ⚡ **Zero Bloat:** No massive editor bundles. Just pure, fast React.
- 🎨 **Beautiful Design:** Fully integrated [Catppuccin](https://github.com/catppuccin/catppuccin) themes with custom selection colors that look gorgeous on any screen.

But we didn't stop at a simple editor. We packed a full Node.js environment right into your browser!

## ✨ Features

- **WebContainers Inside:** Run real Node.js directly in your browser. No backend execution required.
- **Auto npm Installs:** Just type `import React from 'react'` and watch TSPlay automatically detect, install, and fetch typings in the background.
- **TypeScript Language Service:** Runs in a dedicated Web Worker, providing real-time diagnostics, smart autocomplete, and type information on hover (or tap on mobile).
- **True Mobile UX:** Features swipe-to-change tabs, dynamic virtual keyboard avoidance, and responsive font scaling for the ultimate smartphone coding experience.
- **Customizable Compiler:** Edit your `tsconfig.json` on the fly with native TS validation, auto-formatting, and instant compiler updates.
- **Prettier Formatting:** Built-in code formatting for TS, JS, and JSON to keep your snippets clean.
- **Shareable Snippets:** Share your code instantly via compressed URLs (client-side only) or our lightweight PHP backend.
- **Offline Capable:** Once loaded, the core editor and compiler work entirely in your browser.

## 🛠️ Tech Stack

- **Frontend:** React 19, Vite, TailwindCSS v4
- **Editor:** Custom `<textarea>` + `<pre>` implementation (No Monaco/CodeMirror!)
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

_Note: For local development, the Vite dev server is already configured to send the correct `COOP/COEP` headers required by WebContainers._

## ⚙️ Production Deployment (Apache / Plesk)

The headers set by the Vite dev server have **0 impact** in production. WebContainers strictly require a secure context (HTTPS) and Cross-Origin Isolation (for `SharedArrayBuffer`). You **must** configure your production server to send these headers.

(I use this exact setup on a Plesk subdomain.)

**Plesk Note:** In Plesk, setting headers via `.htaccess` often doesn't work depending on your nginx/Apache proxy settings. Instead, you must add them in the Hosting Settings under **Additional headers -> Custom headers**:

- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Opener-Policy: same-origin`

**Apache `.htaccess`:**
Ensure that the Apache module `mod_headers` is enabled on your server.

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

## 🤝 Contributing

We love contributions! Whether it's fixing a bug, adding a new feature, or just improving the documentation, your help is welcome.
Since we are avoiding heavy editor libraries, any PRs improving the custom editor experience (like better auto-indentation, bracket matching, or mobile-specific tweaks) are highly appreciated!

1. Fork the project
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

## 📝 License

MIT License. Do whatever you want with it, but we'd love a shoutout!
