/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

async function main() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const rootDir = join(__dirname, '..');
  const testFile = join(
    rootDir,
    'integration-tests/startup-prompt.integration.test.js',
  );

  console.log('Building project...');
  const buildResult = spawnSync('npm', ['run', 'build'], {
    stdio: 'inherit',
  });

  if (buildResult.status !== 0) {
    console.error('Build failed.');
    process.exit(1);
  }

  console.log('Running tests...');
  const child = spawn('node', ['--test', testFile], {
    stdio: 'inherit',
  });

  const exitCode = await new Promise((resolve) => {
    child.on('close', resolve);
  });

  if (exitCode !== 0) {
    console.error('Test failed');
    process.exit(1);
  }
}

main();
