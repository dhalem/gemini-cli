/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ToolProxy } from './toolProxy.js';
import { 
  ProtocolServer,
  ToolExecutionRequest,
  ToolExecutionResponse,
  ToolDiscoveryMessage,
  ToolDefinition
} from '@google/gemini-cli-core-protocol';

// Mock ProtocolServer
class MockProtocolServer extends ProtocolServer {
  public sentMessages: Array<{ clientId: string; message: any }> = [];

  async start(): Promise<void> {}
  async stop(): Promise<void> {}

  async sendMessage(clientId: string, message: any): Promise<void> {
    this.sentMessages.push({ clientId, message });
  }

  onMessage(): void {}
  onToolRequest(): void {}
  async handleMessage(): Promise<void> {}
}

describe('ToolProxy', () => {
  let toolProxy: ToolProxy;
  let mockServer: MockProtocolServer;
  const clientId = 'test-client';

  beforeEach(() => {
    mockServer = new MockProtocolServer();
    toolProxy = new ToolProxy(mockServer, 5000); // 5 second timeout for tests
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('handleToolDiscovery', () => {
    it('should store client tools from discovery message', () => {
      const tools: ToolDefinition[] = [
        {
          name: 'read_file',
          description: 'Read a file',
          parameters: { type: 'object', properties: { path: { type: 'string' } } }
        },
        {
          name: 'write_file', 
          description: 'Write a file',
          parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } }
        }
      ];

      const discovery: ToolDiscoveryMessage = {
        id: 'discovery-1',
        type: 'tool_discovery',
        timestamp: Date.now(),
        tools
      };

      toolProxy.handleToolDiscovery(clientId, discovery);

      expect(toolProxy.getClientTools(clientId)).toEqual(tools);
    });

    it('should update tools when client announces new tools', () => {
      const initialTools: ToolDefinition[] = [
        { name: 'tool1', description: 'Tool 1', parameters: { type: 'object', properties: {} } }
      ];
      
      const updatedTools: ToolDefinition[] = [
        { name: 'tool1', description: 'Tool 1', parameters: { type: 'object', properties: {} } },
        { name: 'tool2', description: 'Tool 2', parameters: { type: 'object', properties: {} } }
      ];

      // Initial discovery
      toolProxy.handleToolDiscovery(clientId, {
        id: 'discovery-1',
        type: 'tool_discovery',
        timestamp: Date.now(),
        tools: initialTools
      });

      // Updated discovery
      toolProxy.handleToolDiscovery(clientId, {
        id: 'discovery-2',
        type: 'tool_discovery',
        timestamp: Date.now(),
        tools: updatedTools
      });

      expect(toolProxy.getClientTools(clientId)).toEqual(updatedTools);
    });
  });

  describe('getClientTools', () => {
    it('should return empty array for unknown client', () => {
      expect(toolProxy.getClientTools('unknown-client')).toEqual([]);
    });

    it('should return client tools after discovery', () => {
      const tools: ToolDefinition[] = [
        { name: 'test_tool', description: 'Test tool', parameters: { type: 'object', properties: {} } }
      ];

      toolProxy.handleToolDiscovery(clientId, {
        id: 'discovery-1',
        type: 'tool_discovery',
        timestamp: Date.now(),
        tools
      });

      expect(toolProxy.getClientTools(clientId)).toEqual(tools);
    });
  });

  describe('hasClientTool', () => {
    beforeEach(() => {
      const tools: ToolDefinition[] = [
        { name: 'read_file', description: 'Read file', parameters: { type: 'object', properties: {} } },
        { name: 'write_file', description: 'Write file', parameters: { type: 'object', properties: {} } }
      ];

      toolProxy.handleToolDiscovery(clientId, {
        id: 'discovery-1',
        type: 'tool_discovery',
        timestamp: Date.now(),
        tools
      });
    });

    it('should return true for existing tool', () => {
      expect(toolProxy.hasClientTool(clientId, 'read_file')).toBe(true);
      expect(toolProxy.hasClientTool(clientId, 'write_file')).toBe(true);
    });

    it('should return false for non-existing tool', () => {
      expect(toolProxy.hasClientTool(clientId, 'unknown_tool')).toBe(false);
    });

    it('should return false for unknown client', () => {
      expect(toolProxy.hasClientTool('unknown-client', 'read_file')).toBe(false);
    });
  });

  describe('getClientToolDefinition', () => {
    const readFileTool: ToolDefinition = {
      name: 'read_file',
      description: 'Read file',
      parameters: { type: 'object', properties: { path: { type: 'string' } } }
    };

    beforeEach(() => {
      const tools: ToolDefinition[] = [
        { name: 'read_file', description: 'Read file', parameters: { type: 'object', properties: {} } },
        { name: 'write_file', description: 'Write file', parameters: { type: 'object', properties: {} } }
      ];

      toolProxy.handleToolDiscovery(clientId, {
        id: 'discovery-1',
        type: 'tool_discovery',
        timestamp: Date.now(),
        tools
      });
    });

    it('should return tool definition for existing tool', () => {
      const result = toolProxy.getClientToolDefinition(clientId, 'read_file');
      expect(result).toBeDefined();
      expect(result?.name).toBe('read_file');
    });

    it('should return undefined for non-existing tool', () => {
      expect(toolProxy.getClientToolDefinition(clientId, 'unknown_tool')).toBeUndefined();
    });
  });

  describe('getFunctionDeclarations', () => {
    it('should convert tool definitions to function declarations', () => {
      const tools: ToolDefinition[] = [
        {
          name: 'read_file',
          description: 'Read a file',
          parameters: { type: 'object', properties: { path: { type: 'string' } } }
        }
      ];

      toolProxy.handleToolDiscovery(clientId, {
        id: 'discovery-1',
        type: 'tool_discovery',
        timestamp: Date.now(),
        tools
      });

      const declarations = toolProxy.getFunctionDeclarations(clientId);
      
      expect(declarations).toHaveLength(1);
      expect(declarations[0]).toEqual({
        name: 'read_file',
        description: 'Read a file',
        parameters: { type: 'object', properties: { path: { type: 'string' } } }
      });
    });

    it('should return empty array for client with no tools', () => {
      expect(toolProxy.getFunctionDeclarations('unknown-client')).toEqual([]);
    });
  });

  describe('executeTool', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should send tool execution request to client', async () => {
      const executePromise = toolProxy.executeTool(clientId, 'read_file', { path: '/test.txt' });
      
      // Check that request was sent
      expect(mockServer.sentMessages).toHaveLength(1);
      const sentMessage = mockServer.sentMessages[0];
      
      expect(sentMessage.clientId).toBe(clientId);
      expect(sentMessage.message.type).toBe('tool_execution_request');
      expect(sentMessage.message.tool).toBe('read_file');
      expect(sentMessage.message.parameters).toEqual({ path: '/test.txt' });

      // Simulate response
      const response: ToolExecutionResponse = {
        id: 'response-1',
        type: 'tool_execution_response',
        timestamp: Date.now(),
        requestId: sentMessage.message.id,
        result: { content: 'file content' }
      };

      toolProxy.handleToolResponse(response);
      
      const result = await executePromise;
      expect(result).toEqual({ content: 'file content' });
    });

    it('should handle tool execution errors', async () => {
      const executePromise = toolProxy.executeTool(clientId, 'read_file', { path: '/test.txt' });
      
      const sentMessage = mockServer.sentMessages[0];
      const response: ToolExecutionResponse = {
        id: 'response-1',
        type: 'tool_execution_response',
        timestamp: Date.now(),
        requestId: sentMessage.message.id,
        error: 'File not found'
      };

      toolProxy.handleToolResponse(response);
      
      await expect(executePromise).rejects.toThrow('File not found');
    });

    it('should timeout if no response received', async () => {
      const executePromise = toolProxy.executeTool(clientId, 'read_file', { path: '/test.txt' });
      
      // Fast-forward past timeout
      vi.advanceTimersByTime(6000);
      
      await expect(executePromise).rejects.toThrow('Tool execution timeout: read_file');
    });

    it('should ignore responses for unknown requests', () => {
      const response: ToolExecutionResponse = {
        id: 'response-1',
        type: 'tool_execution_response',
        timestamp: Date.now(),
        requestId: 'unknown-request',
        result: { content: 'test' }
      };

      // Should not throw
      expect(() => toolProxy.handleToolResponse(response)).not.toThrow();
    });

    it('should clean up pending requests after response', async () => {
      const executePromise = toolProxy.executeTool(clientId, 'read_file', { path: '/test.txt' });
      
      const sentMessage = mockServer.sentMessages[0];
      const requestId = sentMessage.message.id;
      
      // Verify request is pending
      expect((toolProxy as any).pendingRequests.has(requestId)).toBe(true);
      
      const response: ToolExecutionResponse = {
        id: 'response-1',
        type: 'tool_execution_response',
        timestamp: Date.now(),
        requestId,
        result: { content: 'file content' }
      };

      toolProxy.handleToolResponse(response);
      await executePromise;
      
      // Verify request was cleaned up
      expect((toolProxy as any).pendingRequests.has(requestId)).toBe(false);
    });
  });
});