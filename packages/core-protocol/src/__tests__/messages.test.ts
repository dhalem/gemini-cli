/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, test, expect } from 'vitest';
import { 
  validateProtocolMessage, 
  createGenerateContentRequest,
  createToolExecutionRequest,
  createToolExecutionResponse
} from '../messages.js';

describe('Protocol Messages', () => {
  test('validates generate content request', () => {
    const message = createGenerateContentRequest([
      { role: 'user', parts: [{ text: 'Hello, world!' }] }
    ]);
    
    expect(validateProtocolMessage(message)).toBe(true);
    expect(message.type).toBe('generate_content_request');
    expect(message.id).toBeDefined();
    expect(message.timestamp).toBeGreaterThan(0);
    expect(message.contents).toHaveLength(1);
  });
  
  test('validates tool execution request', () => {
    const message = createToolExecutionRequest('read_file', { path: 'test.txt' });
    
    expect(validateProtocolMessage(message)).toBe(true);
    expect(message.type).toBe('tool_execution_request');
    expect(message.tool).toBe('read_file');
    expect(message.parameters.path).toBe('test.txt');
  });
  
  test('validates tool execution response', () => {
    const message = createToolExecutionResponse('req-123', { content: 'file content' });
    
    expect(validateProtocolMessage(message)).toBe(true);
    expect(message.type).toBe('tool_execution_response');
    expect(message.requestId).toBe('req-123');
    expect(message.result.content).toBe('file content');
  });
  
  test('rejects invalid message format', () => {
    const invalidMessage = { type: 'invalid' };
    expect(validateProtocolMessage(invalidMessage)).toBe(false);
  });
});