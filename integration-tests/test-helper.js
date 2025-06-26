/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync, spawn } from 'child_process';
import { mkdirSync, writeFileSync, readFileSync, mkdtempSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { env } from 'process';
import { tmpdir } from 'os';

export function spawnCli(args) {
  const child = spawn('node', ['packages/cli/dist/index.js', ...args], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  return {
    process: child,
    send: (line) => child.stdin.write(line + '\n'),
    onOutput: (callback) => {
      child.stdout.on('data', (data) => {
        callback(data.toString());
      });
    },
    onError: (callback) => {
      child.stderr.on('data', (data) => {
        callback(data.toString());
      });
    },
    kill: () => child.kill(),
  };
}

function sanitizeTestName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-');
}

export function getTestHelpers() {
  return {
    gemini: (args) => {
      return spawn('stdbuf', ['-o0', 'node', join(__dirname, '..', 'bundle/gemini.js'), ...args]);
    },
    exec: (args) => {
      return new Promise((resolve) => {
        const child = spawn('node', [join(__dirname, '..', 'bundle/gemini.js'), ...args]);
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