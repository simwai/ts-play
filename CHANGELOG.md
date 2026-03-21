# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2025-05-22

### Added

- **WebContainer-based Compilation**: Migrated the TypeScript compilation process from a Web Worker (`esbuild-wasm`) to the WebContainer environment using `npx esbuild`.
- **Automatic Configuration Sync**: `package.json` and `tsconfig.json` are now automatically synced to the WebContainer virtual file system.
- **Robust Console Logic**: Improved the console monkey-patching to prevent infinite recursion and added safety checks for non-serializable arguments.
- **Improved UI Feedback**: Added clearer status messages for syncing, compilation, and execution phases.

### Fixed

- Fixed an issue where the application could crash if a render error occurred during console logging.
- Fixed a bug where `npm` processes were not correctly awaited in the package manager.
- Resolved a "jsh: no such file or directory" error when executing `esbuild` by using `npx` directly.
- Improved the cleanup of the virtual file system before each execution to prevent running stale code.

### Changed

- The JavaScript output tab is now updated by reading the actual compiled file back from the WebContainer.
- Enforced a 5-minute timeout for user script execution to prevent long-running processes from blocking the UI.
- Refined the `Console` component to be more resilient to malformed message states.
