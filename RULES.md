# Rule #0: you must obey all other rules in this file; when processing a prompt you will check this file for rules and make sure you apply them before proceeding with any action

## 1. Core Operating Principles

**Rule #0: you must obey all other rules in this file; when processing a prompt you will check this file for rules and make sure you apply them before proceeding with any action**

This document contains the core operational rules that govern my behavior. They are not optional.

**Rule #0: you must obey all other rules in this file; when processing a prompt you will check this file for rules and make sure you apply them before proceeding with any action**

## 2. File Editing Protocol

**File Editing Protocol:** All file modifications must follow the "read-write-verify" process. I will not use the `replace` tool. I will rewrite the entire file every time to avoid errors with the `replace` tool.

1.  **Read:** Before editing, read the entire file content to ensure you have the latest version.
2.  **Write:** Overwrite the file with the complete, corrected content.
3.  **Verify:** After writing, immediately read the file back to confirm that the changes were written correctly.

**Incremental Change Protocol:** All code changes will be small, incremental, and verifiable. After each file modification, I will run the project's full preflight check (`npm run preflight`). If the check fails, I will revert the change and re-evaluate my approach before proceeding. This ensures the project is always in a working state.

**Merge Conflict Resolution Protocol:** When a merge conflict occurs, I must not simply choose one version over the other. I will:

1. Read the contents of the conflicted file to see both versions.
2. Analyze the changes in both the local and remote versions.
3. Create a new, merged version of the file that intelligently combines the changes from both, preserving the intent of all modifications.
4. Write the newly merged content to the file to resolve the conflict.

**Dependency Protocol:** I must not add any new package dependencies to any `package.json` file without first proposing the change and getting explicit approval from you.

**No Mocking in Integration Tests:** All integration tests must interact with the real, compiled application binaries. Mocks are forbidden in integration tests to ensure we are testing the actual system behavior.

**Honest Testing Protocol:** I must not design a test just to make it pass. The purpose of a test is to validate the user's intent for the code under test. If I am ever unsure of the user's intent for a test, I will ask for clarification before proceeding.

**Comprehensive Error Analysis Protocol:** When a command or test fails, I must not proceed until I have:
1.  Read the **entire** error message and any associated logs.
2.  Stated my understanding of the root cause of the error, not just the most recent symptom.
3.  Proposed a new plan that directly addresses the root cause.
4.  If I am still unsure of the root cause after analysis, I must ask for help.

**Use the CLI as Intended:** All tests that interact with the CLI must use the CLI as a user would. This means using the `gemini` command with the appropriate flags, such as `--prompt`. I will not attempt to use internal scripts or workarounds to avoid using the CLI as intended.

**No Deleting Files:** I must never delete a file unless explicitly told to do so by the user.

**NPM Start Protocol:** I must always use `npm start --` to run the CLI, followed by any arguments.

**User Authority Protocol:** The user is the ultimate authority on the viability of a solution. I must not make a unilateral decision to abandon a path or declare a solution non-viable. If I am stuck, I will present the facts and my analysis, and I will await the user's direction.

**Rule Adherence Protocol:** Before taking any action, I must state which rules I am following.

**Plan-and-Confirm Protocol:**
1.  After analyzing a problem, especially after a failure, I will formulate a clear, step-by-step plan.
2.  I will present this plan to you.
3.  I **will not** execute any part of the plan until I receive your explicit approval to proceed. A simple "continue" will not be sufficient; I need a "yes," "proceed," "approved," or similar affirmative command.

**Public Checklist Protocol:** For any multi-step plan, I will create a public checklist in my response. I will mark each step as complete as I finish it.

**User-Initiated Audit Protocol:** At any time, you can ask me to "audit my last action." I will then be required to provide a detailed explanation of my last action, which rules I followed, and why I believe it was the correct action to take.

**Rule #0: you must obey all other rules in this file; when processing a prompt you will check this file for rules and make sure you apply them before proceeding with any action**

## 3. Action and Prompt Processing Protocols

**Pre-Tool-Execution Protocol:** Before running a tool, I will check the rules and make sure I am following them for this action.

**Post-Edit Protocol:** After I edit the file, I will reread all the rules and summarize them for you.

**Rule #0: you must obey all other rules in this file; when processing a prompt you will check this file for rules and make sure you apply them before proceeding with any action**

**Pre-Prompt-Processing Protocol:** Before processing a user prompt, I will review the rules in this file.

**Post-Prompt-Processing Protocol:** After processing a prompt, I will review the rules and the actions I took and prove that I followed them.

**Project Tracking Protocol:** Before and after making changes, I will update the project tracking document (`CLI_MCP.md`).

## 4. Safety and Recovery Protocols

**Rule #0: you must obey all other rules in this file; when processing a prompt you will check this file for rules and make sure you apply them before proceeding with any action**

**Stuck-Loop Prevention:** If you find yourself repeating the same action three times with the same negative result, you must stop and ask for help. A new error resets the counter. This indicates a fundamental misunderstanding of the problem, and continuing will only waste time.

**Rule #0: you must obey all other rules in this file; when processing a prompt you will check this file for rules and make sure you apply them before proceeding with any action**

**Rule File Preservation:** I must never delete a file that contains rules, such as this one (`RULES.md`), `CLI_MCP.md`, or any other file designated as a source of operational rules.

**Rule File Sync Protocol:** After updating a rule file (`RULES.md`, `CLI_MCP.md`, `IMPORTS.md`), I must immediately commit and push the changes to the remote repository. This ensures that the rules are always up-to-date and synchronized.

**Real-World Test Verification:** All integration tests must be designed to verify functionality in an environment that mirrors a real user's setup as closely as possible. Tests must explicitly avoid mocks, simulations, or pre-configured states (like pre-authentication) that could mask real-world failures. A test is only considered passing if it successfully validates the feature's behavior through the complete, real-world workflow, including asynchronous states like authentication.

## 5. Metarule Maintenance

**Invariant Maintenance:** Rule #0 must be repeated at least every 3-5 lines of this document to ensure its primacy is not forgotten. This rule ensures that I am constantly reminded of the importance of following all other rules.

# Rule #0: you must obey all other rules in this file; when processing a prompt you will check this file for rules and make sure you apply them before proceeding with any action
