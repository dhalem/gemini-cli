# Gemini CLI Import Guidelines

This document outlines the correct way to handle imports within the Gemini CLI monorepo to ensure a clean, maintainable, and scalable architecture.

## 1. Key Packages and Their Roles

The project is a monorepo structured into three primary packages, each with a distinct responsibility:

- **`@google/gemini-cli-core` (`packages/core`)**: This is the foundational package. It contains the core, reusable logic for interacting with the Gemini API, managing configuration, and defining the interfaces for tools. It is designed to be application-agnostic and should **never** depend on any other package in this monorepo.

- **`@google/gemini-cli` (`packages/cli`)**: This is the main command-line application package. It is responsible for the user interface (UI), parsing command-line arguments, and orchestrating the overall application flow. It **depends on** both `@google/gemini-cli-core` and `@google/gemini-cli-mcp`.

- **`@google/gemini-cli-mcp` (`packages/mcp`)**: This package contains the specific implementation for the Model Context Protocol (MCP) server. It **depends on** `@google/gemini-cli-core` to access core functionalities like the `Config` object.

## 2. Dependency Flow

The dependency flow is strictly hierarchical and one-directional:

```
`@google/gemini-cli` (frontend) --> depends on --> `@google/gemini-cli-core` (backend)
```

**Crucially, the `@google/gemini-cli-core` package MUST NEVER import from the `@google/gemini-cli` package.** This prevents circular dependencies and keeps the backend logic independent of the UI implementation.

```
+------------------------+
|                        |
|   packages/cli         |
|                        |
+-----------+------------+
            |
            v
+-----------+------------+
|                        |
|   packages/mcp         |
|                        |
+-----------+------------+
            |
            v
+-----------+------------+
|                        |
|   packages/core        |
|                        |
+------------------------+
```

- `cli` -> `mcp` (Allowed)
- `cli` -> `core` (Allowed)
- `mcp` -> `core` (Allowed)
- `core` -> `cli` (**FORBIDDEN**)
- `core` -> `mcp` (**FORBIDDEN**)
- `mcp` -> `cli` (**FORBIDDEN**)

## 3. How Imports Work

### 3.1. Inter-Package Imports

When you need to import code from one package into another (e.g., using a core utility inside the CLI), **you MUST use the package's name**.

- **Correct:**
  ```typescript
  // In a file within packages/cli
  import { someFunction } from '@google/gemini-cli-core';
  ```

- **Incorrect:**
  ```typescript
  // Do NOT use relative paths for cross-package imports.
  // This is enforced by the `no-relative-cross-package-imports` ESLint rule.
  import { someFunction } from '../core/src/some-module';
  ```

This is made possible by the workspace configuration (e.g., npm/yarn/pnpm workspaces), which links the packages together.

### 3.2. Intra-Package Imports (Within the Same Package)

When importing modules within the same package (e.g., `packages/core` importing from another file in `packages/core`), use relative paths.

- **Correct:**
  ```typescript
  // In packages/core/src/services/serviceA.ts
  import { utilityB } from '../utils/utilityB';
  ```

- **Incorrect:**
  ```typescript
  // Do not use the package name for internal imports.
  import { utilityB } from '@google/gemini-cli-core/src/utils/utilityB';
  ```

### 3.3. The Role of `index.ts`

Each package has an `index.ts` file in its root directory (`packages/<name>/index.ts`) that serves as the public API for that package. Any code that needs to be accessible to other packages **must** be exported from this file.

For example, if you create a new function `newFunction` in `packages/core/src/new-feature.ts`, you must add the following line to `packages/core/index.ts` to make it available to the `cli` package:

```typescript
export { newFunction } from './src/new-feature.js';
```

By following these patterns, we can avoid the circular dependencies and build errors that have been causing issues.

## Tool Imports

All tools are located within the `@google/gemini-cli-core` package, specifically in the `packages/core/src/tools/` directory.

- Tools should only be imported and used by the `ToolRegistry` and other core services within the `@google/gemini-cli-core` package.
- The `@google/gemini-cli` package should not import tools directly. It interacts with tools via the abstractions provided by the core package.

## Practical Example

Imagine you are adding a new command to the CLI in `packages/cli/src/commands/new-command.ts`. This command needs a utility function, `processData`, from the core package.

**File: `packages/core/src/utils/data-processor.ts`**

```typescript
export function processData(data: any): string {
  // ... processing logic
  return 'processed data';
}
```

**File: `packages/core/index.ts` (or a relevant entry point)**

```typescript
export * from './src/utils/data-processor';
```

**File: `packages/cli/src/commands/new-command.ts`**

```typescript
// Correct: Use the package name for the import
import { processData } from '@google/gemini-cli-core';

export function runNewCommand() {
  const result = processData({ foo: 'bar' });
  console.log(result);
}
```

By adhering to these guidelines, we maintain a clear separation of concerns, prevent dependency issues, and make the codebase easier to navigate and scale.
