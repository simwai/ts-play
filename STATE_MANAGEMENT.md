# State Management in TSPlay

This document outlines the flow of state across the application, from the central store to the WebContainer and the UI.

## Overview

TSPlay uses a centralized state machine approach to manage the lifecycle of the playground environment, code compilation, and user preferences.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#cba6f7', 'secondaryColor': '#1e1e2e', 'mainBkg': '#181825', 'nodeBorder': '#cba6f7', 'clusterBkg': '#11111b', 'titleColor': '#cdd6f4', 'lineColor': '#cba6f7', 'textColor': '#cdd6f4' }}}%%
graph TD
    Store[PlaygroundStore] -->|Observable| UI[React Components]
    Store -->|Persist| LS[LocalStorage]
    UI -->|Actions| Store

    WCS[WebContainerService] -->|Status Updates| Store
    WCS -->|File Changes| WC[WebContainer VM]

    WC -->|Background TSC| Artifacts[JS/DTS Artifacts]
    Artifacts -->|Sync| Monaco[Monaco Editor]

    UI -->|User Input| Monaco
    Monaco -->|Code Change| UI
```

## Core Components

### 1. PlaygroundStore (`src/lib/state-manager.ts`)
The "Source of Truth" for application-level state.
- **Responsibility**: Tracks environment lifecycle (`idle`, `booting`, `ready`), compiler status (`TSC`, `Esbuild`), and user settings (`theme`, `lineWrap`).
- **Mechanism**: A simple observer pattern with a `subscribe` method and an `operationQueue` for sequential async tasks.

### 2. WebContainerService (`src/lib/webcontainer.ts`)
The orchestrator for the WebContainer VM.
- **Responsibility**: Booting the container, mounting files, spawning processes, and managing the filesystem.
- **Integration**: Emits logs to the UI and updates the `PlaygroundStore` with lifecycle transitions.

### 3. Hooks (`src/hooks/`)
Bridges between the services and the UI.
- **`usePlaygroundStore`**: Connects React components to the central store.
- **`useWebContainer`**: Handles the mounting of the initial environment and syncs filesystem changes.
- **`useCompilerManager`**: Manages the execution flow of the user's code.

## Theme Synchronization

TSPlay implements a unified theme system where a single `ThemeMode` drives both the Tailwind UI and the Monaco Editor.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#cba6f7', 'secondaryColor': '#1e1e2e', 'mainBkg': '#181825', 'nodeBorder': '#cba6f7', 'clusterBkg': '#11111b', 'titleColor': '#cdd6f4', 'lineColor': '#cba6f7', 'textColor': '#cdd6f4' }}}%%
sequenceDiagram
    participant U as User
    participant H as Header/Settings
    participant S as PlaygroundStore
    participant A as App.tsx
    participant M as Monaco

    U->>H: Toggle Theme
    H->>S: setState({ theme: 'latte' })
    S->>S: Persist to LocalStorage
    S-->>A: Notify Subscriber
    A->>A: Update CSS Classes (theme-latte)
    A->>M: Pass themeMode='latte'
    M->>M: monaco.editor.setTheme('latte')
```

## Build Integrity (The "Versioned" Sync)

To ensure the executed code matches the source, every filesystem write increments an internal version. The `WebContainerService` waits for the background compiler to emit artifacts that match the latest version before allowing execution.
