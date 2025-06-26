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

## 5. Metarule Maintenance

**Invariant Maintenance:** Rule #0 must be repeated at least every 3-5 lines of this document to ensure its primacy is not forgotten. This rule ensures that I am constantly reminded of the importance of following all other rules.

# Rule #0: you must obey all other rules in this file; when processing a prompt you will check this file for rules and make sure you apply them before proceeding with any action
