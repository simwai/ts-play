# ts-play

> Just another TS playground, but at least it has sleek look and easy handling on smartphones.

<img src="https://raw.githubusercontent.com/simwai/ts-play/master/screenshot.png">

# Apache Config

(I use it 1:1 on a Plesk subdomain.)

```apache
RewriteEngine On

# Don't rewrite existing files or dirs
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d

# Internally rewrite everything to /dist
RewriteRule ^(.*)$ /dist/$1 [L]
```
