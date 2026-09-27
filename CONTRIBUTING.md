<!-- AGENT PROMPT: Please update this file after every message if it is relevant. Continuous updates ensure that the documentation accurately reflects the current state of the codebase, project specification, and architectural principles. -->

# Contributing to ts-play

Thank you for your interest in contributing to ts-play! This document covers the setup, development workflow, and contribution process.

## Prerequisites

- **Node.js** >= 20.19.0 and < 21, or >= 22.12.0
- **pnpm** (package manager, version specified in `package.json`)

## Setup

```bash
# Clone the repository
git clone <repo-url>
cd ts-play

# Install dependencies
pnpm install

# Start the development server
pnpm run dev
```

Open [http://localhost:5173](http://localhost:5173) to use the playground.

## Development Workflow

ts-play uses a task-based development approach. Each task targets a specific set of files and is sized at approximately 400 LOC of touched code per PATCH cycle. Tasks are ordered by dependencies — highest confidence first.

### Available Scripts

| Command                  | Description                        |
| ------------------------ | ---------------------------------- |
| `pnpm run dev`           | Start development server           |
| `pnpm run build`         | Build for production               |
| `pnpm run preview`       | Preview production build           |
| `pnpm run format`        | Format with prettier               |
| `pnpm run type-check`    | Type-check with tsc --noEmit       |
| `pnpm run check-quality` | Run knip and madge (circular deps) |
| `pnpm test`              | Run Vitest tests                   |

### Code Style

This project uses `upgrade-house-style` per `STYLE_POLICY.md`. Key conventions:

- TypeScript strict mode (`"strict": true` in `tsconfig.json`)
- No `any` types — use `unknown` with narrowing
- Named exports over default exports
- Arrow functions for callbacks, `async/await` over `.then()` chains
- `pnpm` for all package management

### Pre-commit Hooks

Husky pre-commit hooks run automatically. The hook order is:

1. **Formatter** — `prettier --write`
2. **Linter** — ESLint with auto-fix
3. **Type check** — `tsc --noEmit`

## Pull Request Process

1. Create a branch for your task (e.g., `feat/share-flow`, `fix/header-status`)
2. Make your changes following the code style guidelines
3. Run all quality checks: `pnpm run format`, `pnpm run type-check`, `pnpm test`
4. Ensure all tests pass and there are no lint errors
5. Submit a PR with a clear description of the change

## Questions?

Check the [ARCHITECTURE.md](docs/ARCHITECTURE.md) for system design details or the [BUG_LOG.md](docs/BUG_LOG.md) for known issues.
