/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as pty from 'node-pty';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const bundlePath = join(__dirname, '..', 'bundle/gemini.js');

export function geminiInteractive(args) {
  const ptyProcess = pty.spawn('node', [bundlePath, ...args], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.cwd(),
    env: process.env,
  });

  return {
    ptyProcess,
    waitFor: async (searchText, timeout = 10000) => {
      return new Promise((resolve, reject) => {
        let allOutput = '';
        const timeoutId = setTimeout(() => {
          reject(new Error(`Test timed out waiting for "${searchText}"`));
        }, timeout);

        ptyProcess.onData((data) => {
          console.log('stdout:', data);
          allOutput += data;
          if (allOutput.includes(searchText)) {
            clearTimeout(timeoutId);
            resolve(allOutput);
          }
        });
      });
    },
  };
}
