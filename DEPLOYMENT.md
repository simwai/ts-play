# Deployment Guide

This guide explains how to build and deploy the TypeScript Playground.

## Prerequisites

- Node.js (>= 20.19.0)
- pnpm (recommended, `pnpm@11.8.0`) or npm
- A web server with PHP support (for the backend API)

## Build Process

The project uses Vite for bundling. To generate the production-ready files, run:

```bash
pnpm run build
# or
npm run build
```

The build process is configured to use increased memory (`NODE_OPTIONS=--max-old-space-size=4096`) to handle the heavy compilation requirements of the Monaco editor and other dependencies.

## Deployment

After the build completes, a `dist` directory will be created.

1. **Static Assets**: Deploy the contents of the `dist` directory (excluding the `api` folder) to any static web host.
2. **Backend API**: The `dist/api` directory contains PHP scripts for the "Share" functionality. These must be hosted on a server that supports PHP.
   - Ensure the server is configured to serve `api/get.php` and `api/share.php`.
   - The PHP scripts require a `data` directory with write permissions to store shared snippets.

## Environment Configuration

The application is designed to be served from the root of a domain. If you deploy it to a subpath, you may need to adjust the `base` configuration in `vite.config.ts`.
