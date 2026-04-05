<!-- AGENT PROMPT: Please update this file after every message if it is relevant. Continuous updates ensure that the documentation accurately reflects the current state of the codebase, project specification, and architectural principles. -->

<div style="background-color: #1e1e2e; color: #cdd6f4; padding: 3rem; border-radius: 2rem; border: 2px solid #cba6f7; font-family: 'JetBrains Mono', 'Fira Code', monospace; line-height: 1.7; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">

<h1 style="color: #cba6f7; font-size: 3rem; margin-top: 0; text-shadow: 0 0 20px rgba(203, 166, 247, 0.4);">✨ TSPlay Architecture</h1>

<p style="color: #94e2d5; font-style: italic; font-size: 1.1rem; margin-bottom: 2.5rem; border-left: 4px solid #cba6f7; padding-left: 1.5rem;">A high-fidelity, browser-native TypeScript development environment powered by WebContainers.</p>

<div style="background: rgba(49, 50, 68, 0.5); padding: 1.5rem; border-radius: 1rem; border: 1px solid rgba(203, 166, 247, 0.2); margin-bottom: 3rem;">
<h3 style="color: #cba6f7; margin-top: 0; text-align: center;">🗺️ System Relationships</h3>

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': { 'primaryColor': '#cba6f7', 'primaryTextColor': '#cdd6f4', 'primaryBorderColor': '#cba6f7', 'lineColor': '#89b4fa', 'secondaryColor': '#313244', 'tertiaryColor': '#1e1e2e'}}}%%
graph TD
    subgraph "Main UI Thread (React 19)"
        UI[User Interface]
        STORE[PlaygroundStore]
        WC_SVC[WebContainerService]
        ED[Monaco Editor]
        PM[Package Manager Hook]
    end

    subgraph "Web Worker"
        TS[TS Language Service]
        EB[esbuild-wasm]
        WFS[Virtual FS / Module Resolution]
    end

    subgraph "WebContainer (Sandbox)"
        NODE[Node.js Runtime]
        NM[node_modules]
        FS[Virtual Filesystem]
    end

    UI --> ED
    UI --> STORE
    PM --> WC_SVC
    PM -- "detectImports" --> TS
    WC_SVC --> NODE
    WC_SVC --> FS
    EB -- "compile" --> FS
    NM -- "Sync Types" --> WFS
    WFS --> ED
    TS -- "Diagnostics/Info" --> UI
    NM -- "Types" --> TS

    style UI fill:#cba6f7,stroke:#1e1e2e,color:#1e1e2e
    style TS fill:#cba6f7,stroke:#1e1e2e,color:#1e1e2e
    style NODE fill:#cba6f7,stroke:#1e1e2e,color:#1e1e2e
    style STORE fill:#89b4fa,stroke:#1e1e2e,color:#1e1e2e
    style EB fill:#89b4fa,stroke:#1e1e2e,color:#1e1e2e
    style NM fill:#89b4fa,stroke:#1e1e2e,color:#1e1e2e
```

</div>

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 3rem;">
  <div style="background: rgba(49, 50, 68, 0.5); padding: 1.5rem; border-radius: 1rem; border: 1px solid rgba(203, 166, 247, 0.2);">
    <h3 style="color: #89b4fa; margin-top: 0;">🌐 UI & Orchestration</h3>
    <ul style="margin-bottom: 0; padding-left: 1.2rem;">
      <li>React 19 Functional Core</li>
      <li>Monaco Editor Integration</li>
      <li>PlaygroundStore (Observable)</li>
      <li>WebContainer Lifecycle Mgmt</li>
    </ul>
  </div>
  <div style="background: rgba(49, 50, 68, 0.5); padding: 1.5rem; border-radius: 1rem; border: 1px solid rgba(203, 166, 247, 0.2);">
    <h3 style="color: #89b4fa; margin-top: 0;">⚙️ Processing Engine</h3>
    <ul style="margin-bottom: 0; padding-left: 1.2rem;">
      <li>Dedicated TS Worker</li>
      <li>esbuild-wasm (JS Emission)</li>
      <li>TS Language Service (Types)</li>
      <li>Virtual FS Module Resolution</li>
    </ul>
  </div>
</div>

---

<h2 style="color: #fab387; margin-top: 2.5rem;">📦 Dependency Reconciliation</h2>

<p>To ensure a smooth typing experience, TSPlay implements a state-based reconciliation loop for <code>npm</code> packages:</p>

<div style="background: rgba(30, 30, 46, 0.8); padding: 1.5rem; border-radius: 1rem; border: 1px solid #fab387; margin: 1.5rem 0;">
  <code style="color: #a6e3a1;">Debounce (2.5s) ➜ Analyze Imports ➜ Calculate Delta ➜ Execute Batch ➜ Sync FS</code>
</div>

- **Delta Calculation**: Identifies exactly which packages need to be added or removed.
- **Auto-Types Discovery**: Automatically queries the npm registry for <code>@types/</code> equivalents.
- **ESM Readiness**: Automatically manages <code>package.json</code> with <code>"type": "module"</code> to ensure seamless ES module execution in Node.js.

---

<h2 style="color: #fab387; margin-top: 2.5rem;">📂 Dual-Layer Type Parity</h2>

<p>TSPlay achieves 100% execution-to-editor parity by synchronizing type definitions from two distinct layers:</p>

1. <b style="color: #cba6f7;">ATA Layer</b>: High-speed, CDN-based type acquisition for immediate feedback during typing.
2. <b style="color: #cba6f7;">Container Sync Layer</b>: A deep recursive crawl (up to 30 levels) of the WebContainer's <code>node_modules</code>. It synchronizes both <code>.d.ts</code> and <code>package.json</code> files, ensuring Monaco resolves types exactly like the Node.js runtime.

---

<h2 style="color: #fab387; margin-top: 2.5rem;">⚡ The Execution Sandbox</h2>

<p>When you click <span style="background: #a6e3a1; color: #11111b; padding: 2px 8px; border-radius: 4px; font-weight: bold;">Run</span>, the following occurs:</p>

- Code is compiled to ESM via <code>esbuild</code>.
- Assets are mounted to the <b>WebContainer virtual filesystem</b>.
- A <code>node</code> process is spawned within the browser's sandbox.
- Output is streamed to the UI with full <b>ANSI color support</b> and yielding mechanisms to prevent UI starvation.

</div>
