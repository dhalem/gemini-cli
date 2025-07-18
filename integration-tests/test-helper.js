/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn } from 'child_process';
import { mkdtempSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getTestHelpers() {
  return {
    gemini: (args) => {
      return spawn('stdbuf', [
        '-o0',
        'node',
        join(__dirname, '..', 'bundle/gemini.js'),
        ...args,
      ]);
    },
    exec: (args) => {
      return new Promise((resolve) => {
        const child = spawn('node', [
          join(__dirname, '..', 'bundle/gemini.js'),
          ...args,
        ]);
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (data) => {
          stdout += data;
        });
        child.stderr.on('data', (data) => {
          stderr += data;
        });
        child.on('close', (exitCode) => {
          resolve({ stdout, stderr, exitCode });
        });
      });
    },
  };
}

export function makeTestDir() {
  return mkdtempSync(join(tmpdir(), 'gemini-test-'));
}

export { assert } from 'chai';
