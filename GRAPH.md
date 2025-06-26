# Gemini CLI Dependency Graph

This document outlines the dependency graph of the Gemini CLI project.

## High-Level Architecture

The Gemini CLI is a monorepo with a clear, unidirectional dependency flow.

```
+------------------------+       +--------------------------+
|                        |       |                          |
|   @google/gemini-cli   |------>|  @google/gemini-cli-core |
|      (packages/cli)    |       |      (packages/core)     |
|                        |       |                          |
+------------------------+       +--------------------------+
```

### `@google/gemini-cli` (Frontend)

- **Description:** The user-facing command-line interface. It handles user input, rendering, and the overall user experience.
- **Dependencies:**
  - **`@google/gemini-cli-core`:** It imports the core logic, including the Gemini API client, tool scheduler, and configuration.
  - **`ink`:** For building the React-based command-line UI.
  - **`yargs`:** For parsing command-line arguments.
  - Other UI and utility libraries.

### `@google/gemini-cli-core` (Backend)

- **Description:** The backend logic for the CLI. It communicates with the Gemini API, manages tools, and handles the core functionality.
- **Dependencies:**
  - **`@google/genai`:** The official Google AI SDK for Node.js.
  - **`simple-git`:** For interacting with Git repositories.
  - **`glob`:** For finding files.
  - Other utility libraries.

## Key Principles

- **Unidirectional Dependency Flow:** The `cli` package depends on the `core` package, but the `core` package has no knowledge of the `cli` package. This is enforced by the `no-relative-cross-package-imports` ESLint rule.
- **Separation of Concerns:** The `cli` package is responsible for the UI, and the `core` package is responsible for the logic. This separation makes the codebase easier to maintain and test.
- **Tool Abstraction:** The `cli` package does not interact with tools directly. It uses the `ToolRegistry` and other abstractions provided by the `core` package.

This dependency graph should be followed for all new work. If you need to do something outside of the current design, you must stop and ask for help.
