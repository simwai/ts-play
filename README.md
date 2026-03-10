# ts-play

> Just another TS playground, but at least it has sleek look and easy handling on smartphones.

<img src="https://raw.githubusercontent.com/simwai/ts-play/master/screenshot.png">

# Apache Config

(I use it 1:1 on a Plesk subdomain.)

**Wichtig:** WebContainers benötigen zwingend einen sicheren Kontext (HTTPS) und Cross-Origin Isolation (für `SharedArrayBuffer`). Stelle sicher, dass das Apache-Modul `mod_headers` aktiviert ist.

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
