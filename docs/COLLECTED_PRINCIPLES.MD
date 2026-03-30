<!-- AGENT PROMPT: Please update this file after every message if it is relevant. Continuous updates ensure that the documentation accurately reflects the current state of the codebase, project specification, and architectural principles. -->

# COLLECTED PRINCIPLES

## General Principles
-   **Documentation First**: Always maintain up-to-date documentation in the `docs/` folder.
-   **Bug Logging**: Document complex bugs and their solutions in `BUG_LOG.MD`.
-   **Language Service Consistency**: Use standardized absolute paths (e.g., `'/main.ts'`) when interacting with the TypeScript Language Service.
-   **Symbol Info Robustness**: Prefer `displayParts` over regex for symbol name extraction in the editor and worker.
-   **Path Normalization**: Consistently normalize paths across the frontend, worker, and WebContainer filesystem to ensure seamless inter-process communication.

## Documentation Maintenance
-   All documentation files should have an agent prompt at the top to encourage continuous updates.
-   Documentation filenames must be in UPPER_CASE_SNAKE_CASE with the `.MD` extension.
