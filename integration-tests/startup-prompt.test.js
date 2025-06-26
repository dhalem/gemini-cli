/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { geminiInteractive } from './test-helper-interactive.js';
import { it, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { makeTestDir, getTestHelpers } from './test-helper.js';

const { exec } = getTestHelpers();

describe('gemini --startup-prompt interactive', () => {
  let testDir;

  beforeEach(() => {
    testDir = makeTestDir();
  });

  it('should run a startup prompt and wait for the answer "Paris"', async () => {
    const { ptyProcess, waitFor } = geminiInteractive([
      '--startup-prompt',
      'what is the capitol of France',
    ]);

    await waitFor('>');
    const output = await waitFor('Paris');

    assert.ok(output.includes('Paris'));
    ptyProcess.kill();
  });

  it('should run a startup prompt from a file and wait for the answer "Paris"', async () => {
    const promptFile = path.join(testDir, 'prompt.txt');
    fs.writeFileSync(promptFile, 'what is the capitol of France');
    const { ptyProcess, waitFor } = geminiInteractive([
      '--startup-prompt-file',
      promptFile,
    ]);

    await waitFor('>');
    const output = await waitFor('Paris');

    assert.ok(output.includes('Paris'));
    ptyProcess.kill();
  });

  it('should run a startup prompt and wait for the answer "Rome"', async () => {
    const { ptyProcess, waitFor } = geminiInteractive([
      '--startup-prompt',
      'what is the capitol of Italy',
    ]);

    await waitFor('>');
    const output = await waitFor('Rome');

    assert.ok(output.includes('Rome'));
    ptyProcess.kill();
  });

  it('should error if both startup-prompt and startup-prompt-file are provided', async () => {
    const result = await exec([
      '--startup-prompt',
      'foo',
      '--startup-prompt-file',
      'bar',
    ]);
    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stderr.includes(
        '--startup-prompt and --startup-prompt-file are mutually exclusive.',
      ),
    );
  });
});
