/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { geminiInteractive } from './interactive-test-helper.js';
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

  it('should run a startup prompt and then wait for user input', async () => {
    const { ptyProcess, waitFor, write } = geminiInteractive([
      '--startup-prompt',
      'what is the capitol of France',
    ]);

    // 1. Wait for the answer to the startup prompt.
    await waitFor('Paris');

    // 2. Wait for the interactive prompt to appear.
    await waitFor('>');

    // 3. Write a new prompt.
    write('what is the capitol of Spain');

    // 4. Wait for the answer to the new prompt.
    const output = await waitFor('Madrid');

    assert.ok(output.includes('Madrid'));
    ptyProcess.kill();
  });

  it('should run a startup prompt from a file and then wait for user input', async () => {
    const promptFile = path.join(testDir, 'prompt.txt');
    fs.writeFileSync(promptFile, 'what is the capitol of France');
    const { ptyProcess, waitFor, write } = geminiInteractive([
      '--startup-prompt-file',
      promptFile,
    ]);

    // 1. Wait for the answer to the startup prompt.
    await waitFor('Paris');

    // 2. Wait for the interactive prompt to appear.
    await waitFor('>');

    // 3. Write a new prompt.
    write('what is the capitol of Spain');

    // 4. Wait for the answer to the new prompt.
    const output = await waitFor('Madrid');

    assert.ok(output.includes('Madrid'));
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
