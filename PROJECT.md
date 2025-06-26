# Project Overview: Gemini CLI

This document summarizes the architecture, features, and development practices of the Gemini CLI project, based on the existing documentation and codebase structure.

## 1. Core Architecture

The Gemini CLI is a monorepo built with TypeScript, composed of two primary packages that create a separation between the user-facing interface and the backend logic.

- **`@google/gemini-cli` (`packages/cli`):** This is the **frontend** package. It is responsible for everything the user sees and interacts with, including:

  - Rendering the REPL interface.
  - Handling user input and slash commands (e.g., `/help`, `/theme`).
  - Managing display, themes, and the overall user experience.

- **`@google/gemini-cli-core` (`packages/core`):** This is the **backend** package. It acts as the engine for the CLI and handles:
  - Communicating with the Google Gemini API.
  - Constructing prompts and managing conversation history.
  - Discovering, registering, and executing tools.
  - Managing session state and core configuration.

The dependency flow is strictly **unidirectional**: `cli` depends on `core`, but `core` **never** depends on `cli`.

## 2. Key Features

- **Interactive REPL:** Provides a rich, interactive command-line experience.
- **Extensible Tool System:** The model can use a variety of built-in tools to interact with the local system.
  - **File System:** `read_file`, `write_file`, `list_directory`, `glob`, `search_file_content`, `replace`.
  - **Shell Execution:** `run_shell_command` for executing arbitrary shell commands.
  - **Web Access:** `web_fetch` and `google_web_search`.
  - **Memory:** `save_memory` to persist facts across sessions.
- **Sandboxing:** Potentially unsafe operations (shell commands, file writes) can be executed in an isolated environment (macOS Seatbelt, Docker, or Podman) for security.
- **Configuration System:** Behavior can be customized through a hierarchical system:
  - `settings.json` files (global `~/.gemini/` and project-specific `.gemini/`).
  - Environment variables (e.g., `GEMINI_API_KEY`, `GEMINI_SANDBOX`).
  - Command-line arguments.
- **Hierarchical Context (`GEMINI.md`):** The model's instructional context can be defined in `GEMINI.md` files at global, project, and sub-directory levels, allowing for highly tailored and project-aware responses.
- **Model Context Protocol (MCP):** The CLI can connect to external MCP servers to discover and use custom, third-party tools.
- **Checkpointing:** Automatically saves a snapshot of the project state before file modifications, allowing users to `/restore` to a previous state.
- **Telemetry:** Supports OpenTelemetry for monitoring and debugging, with options to send data to local collectors or Google Cloud.

## 3. Extensibility

The CLI is designed to be extended:

- **MCP Servers:** The primary way to add complex, custom tools is by creating an MCP server and configuring it in `settings.json`. The CLI handles discovery, connection, and execution.
- **Extensions:** The `.gemini/extensions` directory allows for loading pre-packaged configurations, including MCP servers and context files.
- **Custom Tool Commands:** For simpler cases, `toolDiscoveryCommand` and `toolCallCommand` in `settings.json` allow for integrating tools via custom shell commands.

## 4. Development and Testing

- **Monorepo Management:** The project uses npm workspaces to manage the `cli` and `core` packages.
- **Running from Source:** `npm run start` is used for development with hot-reloading.
- **Building:** `npm run build` transpiles the TypeScript code. `npm run preflight` runs all checks (build, test, lint, typecheck).
- **Testing:**
  - Unit tests are co-located with source files (`*.test.ts`/`*.test.tsx`) and run with Vitest.
  - Integration tests are in the `integration-tests/` directory and are run explicitly with `npm run test:e2e`. These tests validate the built binary against a real file system and in different sandbox environments.
- **Import Strategy:**
  - **Cross-package imports** (e.g., `cli` using `core`) **must** use the package name (`@google/gemini-cli-core`). Relative path imports across packages are forbidden by an ESLint rule.
  - **Intra-package imports** (within the same package) should use relative paths.
