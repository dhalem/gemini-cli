/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { assert, getTestHelpers, makeTestDir } from './test-helper.js';
import * as fs from 'fs';
import * as path from 'path';
import { describe, beforeEach, it } from 'node:test';

const { gemini, exec } = getTestHelpers();

describe('gemini --startup-prompt', () => {
  let testDir;

  beforeEach(() => {
    testDir = makeTestDir();
  });

  it('should run a startup prompt and stay in interactive mode', async () => {
    const child = gemini(['--startup-prompt', 'what is the capitol of France']);
    child.stdout.setEncoding('utf8');
    const output = await new Promise((resolve) => {
      let allOutput = '';
      child.stdout.on('data', (data) => {
        allOutput += data;
        if (allOutput.includes('Paris')) {
          resolve(allOutput);
        }
      });
    });
    assert.include(output, 'Paris');
    child.kill();
  });

  it('should run a startup prompt from a file and stay in interactive mode', async () => {
    const promptFile = path.join(testDir, 'prompt.txt');
    fs.writeFileSync(promptFile, 'what is the capitol of France');
    const child = gemini(['--startup-prompt-file', promptFile]);
    child.stdout.setEncoding('utf8');
    const output = await new Promise((resolve) => {
      let allOutput = '';
      child.stdout.on('data', (data) => {
        allOutput += data;
        if (allOutput.includes('Paris')) {
          resolve(allOutput);
        }
      });
    });
    assert.include(output, 'Paris');
    child.kill();
  });

  it('should error if both startup-prompt and startup-prompt-file are provided', async () => {
    const result = await exec([
      '--startup-prompt',
      'foo',
      '--startup-prompt-file',
      'bar',
    ]);
    assert.equal(result.exitCode, 1);
    assert.include(
      result.stderr,
      '--startup-prompt and --startup-prompt-file are mutually exclusive.',
    );
  });
});
