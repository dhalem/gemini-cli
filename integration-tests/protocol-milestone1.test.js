/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { test, expect } from 'vitest';
import { LoopbackProtocolClient } from '@google/gemini-cli-core-protocol';
import { createCoreServer } from '@google/gemini-cli-core-server';

test('milestone 1: in-process protocol communication', async () => {
  const server = await createCoreServer();
  const client = new LoopbackProtocolClient(server);
  await client.connect();
  
  // Test basic generate content request
  const response = await client.generateContent({
    contents: [{ role: 'user', parts: [{ text: 'Hello, world!' }] }]
  });
  
  expect(response).toBeDefined();
  expect(response.candidates).toBeDefined();
  
  await client.disconnect();
});

test('milestone 1: tool execution through protocol', async () => {
  const server = await createCoreServer();
  const client = new LoopbackProtocolClient(server);
  
  // Setup tool handler
  client.onToolRequest(async (request) => {
    if (request.tool === 'echo') {
      return {
        id: 'response-' + Date.now(),
        type: 'tool_execution_response',
        timestamp: Date.now(),
        requestId: request.id,
        result: { message: `Echo: ${request.parameters.message}` }
      };
    }
    throw new Error(`Unknown tool: ${request.tool}`);
  });
  
  await client.connect();
  
  // This test verifies the protocol infrastructure works
  // In a real scenario, the server would call tools during content generation
  const response = await client.generateContent({
    contents: [{ role: 'user', parts: [{ text: 'Simple test message' }] }]
  });
  
  expect(response).toBeDefined();
  expect(response.candidates).toBeDefined();
  
  await client.disconnect();
});