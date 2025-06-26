/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as pty from 'node-pty';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { EOL } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * A more robust interactive test helper using node-pty.
 * @param {string[]} args - Arguments to pass to the gemini CLI.
 * @returns {{ptyProcess: pty.IPty, waitFor: Function, write: Function}}
 */
export function geminiInteractive(args) {
  const ptyProcess = pty.spawn('npm', ['start', '--', ...args], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.cwd(),
    env: {
      ...process.env,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    },
  });

  const waitFor = async (searchText, timeout = 30000) => {
    return new Promise((resolve, reject) => {
      let allOutput = '';
      const timeoutId = setTimeout(() => {
        console.error(`Timeout waiting for: "${searchText}"`);
        console.error('Full output so far:\n', allOutput);
        reject(new Error(`Test timed out waiting for "${searchText}"`));
      }, timeout);

      const disposable = ptyProcess.onData((data) => {
        const output = data.toString();
        process.stdout.write(output); // Log output in real-time
        allOutput += output;
        if (allOutput.includes(searchText)) {
          clearTimeout(timeoutId);
          disposable.dispose(); // Stop listening to prevent future resolves
          resolve(allOutput);
        }
      });
    });
  };

  const write = (text) => {
    ptyProcess.write(text + EOL);
  };

  return {
    ptyProcess,
    waitFor,
    write,
  };
}
