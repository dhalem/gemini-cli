# Rule #0: You must obey all rules for every action you take. Never forget Rule #0

# Startup Prompt Feature

This document outlines the design and implementation plan for adding a startup prompt feature to the Gemini CLI. The feature will allow users to run a prompt automatically upon starting the CLI in interactive mode.

**Status:** Implementation In Progress

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

- **File:** `packages/cli/src/config/config.ts`
- **Interface:** `GeminiConfig`
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
    - A `useEffect` hook within `App.tsx` will monitor the authentication status.
    - Once authentication is confirmed as complete, the hook will trigger one time.
    - It will programmatically set the input field's value to the `startupPrompt` and submit the prompt for execution.
5.  **Continue Interactively:** After the prompt's output is displayed, the CLI will remain in its normal interactive state, ready for the user to enter further commands.

## 3. Implementation Plan

The implementation will be broken down into the following phases.

### Phase 1: Configuration and Flag Parsing

- [x] **Modify `packages/cli/src/config/config.ts`**:
  - Add the `startupPrompt` property to the `GeminiConfig` interface.
  - Update the argument parsing logic to handle `--startup-prompt` and `--startup-prompt-file`.
  - Implement file reading for `--startup-prompt-file`.
  - Add validation to ensure the flags are mutually exclusive.

### Phase 2: Core Feature Logic

- [x] **Modify `packages/cli/src/gemini.tsx`**:
  - Pass the `startupPrompt` from the configuration down to the `App` component.
- [x] **Modify `packages/cli/src/ui/App.tsx`**:
  - Accept the `startupPrompt` prop.
  - Create a `useEffect` hook to observe an existing state variable that indicates authentication completion.
  - Inside the effect, call the function responsible for submitting a prompt.

### Phase 3: Integration Testing

- [x] **Create `integration-tests/startup-prompt.test.js`**:
  - Follow the existing structure from `test-helper.js`.
  - **Test Case 1: No Flag:** Launch the CLI without any startup flags and ensure it starts normally without executing a prompt.
  - **Test Case 2: `--startup-prompt`:** Launch the CLI with the prompt "what is the capitol of France" provided directly. Verify that the prompt and its expected output appear in `stdout`.
  - **Test Case 3: `--startup-prompt-file`:**
    - Create a temporary file with the prompt string "what is the capitol of France".
    - Launch the CLI with the flag pointing to the temp file.
    - Verify the prompt and its output appear in `stdout`.
  - All test cases will need to successfully kill the interactive CLI process after verification.

### Phase 4: Documentation

- [x] **Update `STARTUP.md`**: Keep this document current with progress, decisions, and learnings.
- [x] **Update `docs/cli/commands.md`**: Add documentation for the new `--startup-prompt` and `--startup-prompt-file` flags.

## 4. Progress and Learnings

The implementation is currently blocked by a recurring build issue. The primary challenge has been resolving module import paths within the TypeScript/React codebase, which has led to repeated failures in the `npm run preflight` command.

### IMPORTANT: READ-WRITE-VERIFY Protocol

To prevent further issues stemming from incorrect file modifications, the following protocol is now **mandatory** for all file changes in this project:

1.  **READ:** Before making any changes, read the target file to get its current, accurate content.
2.  **WRITE:** Apply the intended changes to the file.
3.  **VERIFY:** Immediately after writing, read the file back to confirm that the changes were written exactly as intended.

This **READ-WRITE-VERIFY** cycle must be completed for every file modification before proceeding to the next step (e.g., running `npm run preflight` or committing changes). Adherence to this rule is critical to ensure the integrity of the codebase and to avoid debugging cycles caused by stale or incorrect file state.

### IMPORTANT: ALWAYS UPDATE STARTUP.md

When you discover a new pattern or rule, you must update this file to include the new rule, and then reread the file.

# Rule #0: You must obey all rules for every action you take. Never forget Rule #0
