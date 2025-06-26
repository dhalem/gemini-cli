/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as readline from 'readline';
import {
  createToolRegistry,
  Config,
  AuthType,
  sessionId,
  GeminiClient,
} from '@google/gemini-cli-core';
import { loadCliConfig } from './config/config.js';
import { loadSettings } from './config/settings.js';
import { loadExtensions } from './config/extension.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

async function main() {
  const workspaceRoot = process.cwd();
  const settings = loadSettings(workspaceRoot);
  const extensions = loadExtensions(workspaceRoot);
  const config = await loadCliConfig(settings.merged, extensions, sessionId);
  await config.refreshAuth(AuthType.USE_GEMINI);
  const client = new GeminiClient(config);
  await client.initialize(config.getContentGeneratorConfig());

  rl.on('line', async (line) => {
    const chat = client.getChat();
    const response = await chat.sendMessage({ message: line });
    if (response.text) {
      process.stdout.write(response.text);
    }
  });
}

main();
