# MCP Server Integration Test Plan (Revised)

This document outlines the step-by-step process for creating an integration test that verifies that the main Gemini CLI can correctly manage and communicate with an MCP server sub-process using the `settings.json` configuration.

## 1. Core Objective

The goal is to create a test that can:

1.  Launch the main Gemini CLI using the `--prompt` flag, which will automatically discover and launch the `gemini-mcp` server based on the `settings.json` file.
2.  Send a prompt that will be handled by the MCP server tool.
3.  Verify that the CLI correctly routes the prompt to the MCP server and displays the response.

## 2. Phased Implementation and Testing

### Phase 1: Create the Test Script

**Objective:** Create a shell script that can build the project, run the CLI with a prompt, and verify the output.

**Steps:**

1.  **Create the `test_mcp.sh` script:**
    - The script will first run `npm run build`.
    - If the build is successful, it will run `npm start -- --prompt "1 + 1"`.
    - The script will check for errors in the output and verify that the output contains the correct response.
    - **Checkpoint:** Commit the script to the repository.

2.  **Run the test:**
    - Run the `test_mcp.sh` script.
    - If the test fails, I will analyze the errors and attempt to fix them. I will not revert the changes.
    - **Checkpoint:** The test passes.

This plan will ensure that we are testing the correct architecture and that the main CLI is in control of the MCP server sub-process.
