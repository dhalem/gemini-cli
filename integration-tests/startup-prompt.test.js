/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { geminiInteractive } from './interactive-test-helper.js';
import { it } from 'node:test';
import assert from 'node:assert';

it('should FAIL with current code, then PASS with fixed code', async () => {
  const { ptyProcess, waitFor } = geminiInteractive([
    '--startup-prompt',
    'what is the capitol of France',
  ]);

  // 1. Wait for the CLI to be fully interactive and ready for user input.
  // This is the key step that was missing.
  await waitFor('>', 15000);

  // 2. NOW, look for the answer. With the bug, this will time out.
  // With the fix, this will pass.
  const output = await waitFor('Paris', 15000);

  // 3. Assert the output is correct.
  assert.ok(output.includes('Paris'));

  // 4. Clean up the process.
  ptyProcess.kill();
});
