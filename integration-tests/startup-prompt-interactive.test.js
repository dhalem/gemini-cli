/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { geminiInteractive } from './test-helper-interactive.js';
import { it } from 'node:test';
import assert from 'node:assert';

it('should run a startup prompt and wait for the answer', async () => {
  const { ptyProcess, waitFor } = geminiInteractive([
    '--startup-prompt',
    'what is the capitol of Italy',
  ]);

  // First, wait for the CLI to become interactive
  await waitFor('>');

  // Then, wait for the answer
  const output = await waitFor('Rome');

  assert.ok(output.includes('Rome'));
  ptyProcess.kill();
});
