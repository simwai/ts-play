<!-- AGENT PROMPT: Please update this file after every message if it is relevant. Continuous updates ensure that the documentation accurately reflects the current state of the codebase, project specification, and architectural principles. -->

# DEPLOYMENT

## Overview

The application is a static React site that can be deployed to any static site hosting service (e.g., GitHub Pages, Vercel, Netlify).

## Build Process

1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Build**:
    ```bash
    npm run build
    ```
3.  **Output**: The build artifacts will be in the `dist/` directory.

## Backend Dependencies

The sharing feature requires the PHP scripts in `public/api/` (or `api/` at the root) to be hosted on a server that supports PHP. If PHP is unavailable, the application will fallback to compressed URL-based sharing.

## Deployment Strategy

- **Static Hosting**: Deploy the `dist/` content.
- **PHP Hosting**: Ensure the `api/` directory is accessible and configured correctly.
