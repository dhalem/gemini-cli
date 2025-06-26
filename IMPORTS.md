# Gemini CLI Import Guidelines

This document outlines the correct way to handle imports within the Gemini CLI monorepo to ensure a clean, maintainable, and scalable architecture.

## Core Principles

The project is structured as a monorepo with two primary packages:

1.  **`@google/gemini-cli` (`packages/cli`):** The user-facing frontend.
2.  **`@google/gemini-cli-core` (`packages/core`):** The backend, handling logic, API communication, and tool execution.

The fundamental rule of our architecture is **unidirectional dependency flow**:

```
`@google/gemini-cli` (frontend) --> depends on --> `@google/gemini-cli-core` (backend)
```

**Crucially, the `@google/gemini-cli-core` package MUST NEVER import from the `@google/gemini-cli` package.** This prevents circular dependencies and keeps the backend logic independent of the UI implementation.

## How to Import

### 1. Cross-Package Imports

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

### 2. Intra-Package Imports (Within the Same Package)

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
