# Rule #0: You must obey all other rules for every action you take. Never forget Rule #0

# Startup Prompt Feature

This document outlines the design and implementation plan for adding a startup prompt feature to the Gemini CLI. The feature will allow users to run a prompt automatically upon starting the CLI in interactive mode.

**Status:** Done

This document will be updated at each step of the implementation to reflect progress and any learnings.

## 1. Feature Overview

The goal is to execute a user-provided prompt as soon as the interactive CLI has initialized and authenticated. This will improve workflow automation for common starting commands.

The prompt can be supplied in two ways:

1.  Directly as a string via a command-line flag.
2.  From a file specified by a command-line flag.

After the prompt is executed, the CLI will continue to run in interactive mode as normal.

## 2. Design

### 2.1. CLI Flags

We will introduce two new, mutually exclusive command-line flags:

- `--startup-prompt <prompt-string>`: Specifies the prompt to run directly from the command line.
- `--startup-prompt-file <file-path>`: Specifies a path to a file containing the prompt to run.

The CLI will raise an error if both flags are provided simultaneously.

### 2.2. Configuration

The core configuration object will be extended to include a new property to hold the prompt content.

- **File:** `packages/core/src/config/config.ts`
- **Interface:** `ConfigParameters`
- **New Property:** `startupPrompt?: string;`

The configuration loading logic will be updated to:

1.  Parse the new CLI flags.
2.  If `--startup-prompt-file` is used, read the contents of the specified file.
3.  Populate the `startupPrompt` property.

### 2.3. Execution Flow

1.  **Initialization:** The CLI starts, and the configuration is loaded, including the `startupPrompt` if provided.
2.  **Authentication:** The CLI proceeds with the standard authentication flow. The startup prompt will not be executed until authentication is successful.
3.  **UI Rendering:** The main interactive UI component (`App.tsx`) will receive the `startupPrompt` as a prop.
4.  **Prompt Execution:**
    - A `useEffect` hook within `InputPrompt.tsx` will monitor the `startupPrompt` prop.
    - Once the component mounts, the hook will trigger one time.
    - It will programmatically set the input field's value to the `startupPrompt` and submit the prompt for execution.
5.  **Continue Interactively:** After the prompt's output is displayed, the CLI will remain in its normal interactive state, ready for the user to enter further commands.

## 3. Implementation Plan

The implementation will be broken down into the following phases.

### Phase 1: Configuration and Flag Parsing

- [x] **Modify `packages/core/src/config/config.ts`**:
  - Add the `startupPrompt` property to the `ConfigParameters` interface and `Config` class.
- [x] **Modify `packages/cli/src/config/config.ts`**:
  - Update the `yargs` configuration to accept the new `--startup-prompt` and `--startup-prompt-file` flags.
  - Implement the logic to read the prompt from the file if `--startup-prompt-file` is used.
  - Add validation to ensure the flags are mutually exclusive.
  - Pass the `startupPrompt` to the `Config` object.

### Phase 2: Core Feature Logic

- [x] **Modify `packages/cli/src/gemini.tsx`**:
  - Ensure the `startupPrompt` from the configuration is passed down to the `App` component.
- [x] **Modify `packages/cli/src/ui/App.tsx`**:
  - Add a new state variable, `isReadyForInput`, to track the authentication status.
  - Use a `useEffect` hook to set `isReadyForInput` to `true` only when `isAuthenticating` is `false`.
  - Pass the `isReadyForInput` state down as a prop to the `InputPrompt` component.
- [x] **Modify `packages/cli/src/ui/components/InputPrompt.tsx`**:
  - Accept the `isReadyForInput` prop.
  - Modify the `useEffect` hook that handles the `startupPrompt` to only fire when `isReadyForInput` is `true`.

### Phase 3: Integration Testing

- [x] **Create `integration-tests/startup-prompt.integration.test.js`**:
  - Create a new, robust interactive test helper that uses `node-pty` to create a true pseudo-terminal environment.
  - Write a new test suite that correctly models the user's experience by waiting for the interactive prompt (`>`) to appear before checking for the output.
  - Add tests to verify the functionality of both flags.
  - Ensure the CLI executes the prompt and then remains in interactive mode.

### Phase 4: Documentation

- [x] **Update `docs/cli/commands.md`**:
  - Document the new flags.
- [x] **Update `STARTUP.md`**:
  - Keep this document up-to-date with the progress.

## 4. Progress and Learnings

The implementation is now complete. The primary challenge was with the integration testing setup. The initial approach of using `esbuild` to transpile the TypeScript test files on the fly proved to be problematic. After several failed attempts to configure `esbuild` correctly, the strategy was changed to use the TypeScript compiler (`tsc`) directly. This also failed initially due to missing type definitions.

The final, successful approach involved:

1. Converting the TypeScript test file to plain JavaScript.
2. Updating the test runner to execute the JavaScript test file directly with `node`.

This experience highlights the importance of a robust and well-configured testing environment. When faced with persistent issues with a particular tool or approach, it is sometimes more efficient to switch to a more reliable alternative.

### IMPORTANT: READ-WRITE-VERIFY Protocol

To prevent further issues stemming from incorrect file modifications, the following protocol is now **mandatory** for all file changes in this project:

1.  **READ:** Before making any changes, read the target file to get its current, accurate content.
2.  **WRITE:** Apply the intended changes to the file.
3.  **VERIFY:** Immediately after writing, read the file back to confirm that the changes were written exactly as intended.

This **READ-WRITE-VERIFY** cycle must be completed for every file modification before proceeding to the next step (e.g., running `npm run preflight` or committing changes). Adherence to this rule is critical to ensure the integrity of the codebase and to avoid debugging cycles caused by stale or incorrect file state.

### IMPORTANT: ALWAYS UPDATE STARTUP.md

When you discover a new pattern or rule, you must update this file to include the new rule, and then reread the file.

# Rule #0: You must obey all rules for every action you take. Never forget Rule #0
