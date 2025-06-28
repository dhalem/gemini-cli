/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalToolExecutor } from './localToolExecutor.js';
import { ToolExecutionRequest } from '@google/gemini-cli-core-protocol';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('LocalToolExecutor', () => {
  let executor: LocalToolExecutor;
  let testDir: string;

  beforeEach(() => {
    // Create a temporary directory for tests
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tool-executor-test-'));
    executor = new LocalToolExecutor(testDir);
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should create executor with valid target directory', () => {
      expect(executor).toBeDefined();
    });

    it('should register all core tools', () => {
      const toolDefinitions = executor.getToolDefinitions();
      
      const expectedTools = [
        'read_file', 'write_file', 'list_directory', 
        'search_file_content', 'glob', 'replace', 'run_shell_command'
      ];
      
      const toolNames = toolDefinitions.map(tool => tool.name);
      expectedTools.forEach(toolName => {
        expect(toolNames).toContain(toolName);
      });
    });
  });

  describe('getToolDefinitions', () => {
    it('should return array of tool definitions', () => {
      const definitions = executor.getToolDefinitions();
      
      expect(Array.isArray(definitions)).toBe(true);
      expect(definitions.length).toBeGreaterThan(0);
      
      definitions.forEach(def => {
        expect(def).toHaveProperty('name');
        expect(def).toHaveProperty('description');
        expect(def).toHaveProperty('parameters');
        expect(typeof def.name).toBe('string');
        expect(typeof def.description).toBe('string');
      });
    });

    it('should include read_file tool with correct schema', () => {
      const definitions = executor.getToolDefinitions();
      const readFileTool = definitions.find(tool => tool.name === 'read_file');
      
      expect(readFileTool).toBeDefined();
      expect(readFileTool?.parameters).toBeDefined();
      expect(readFileTool?.parameters.properties).toBeDefined();
      expect(readFileTool?.parameters.properties).toHaveProperty('absolute_path');
    });
  });

  describe('execute', () => {
    it('should successfully execute write_file tool', async () => {
      const testFile = path.join(testDir, 'test.txt');
      const request: ToolExecutionRequest = {
        id: 'test-1',
        type: 'tool_execution_request',
        timestamp: Date.now(),
        tool: 'write_file',
        parameters: {
          file_path: testFile,
          content: 'Hello, World!'
        }
      };

      const response = await executor.execute(request);

      expect(response.type).toBe('tool_execution_response');
      expect(response.requestId).toBe(request.id);
      expect(response.error).toBeUndefined();
      expect(fs.existsSync(testFile)).toBe(true);
      expect(fs.readFileSync(testFile, 'utf8')).toBe('Hello, World!');
    });

    it('should successfully execute read_file tool', async () => {
      const testFile = path.join(testDir, 'read-test.txt');
      const content = 'Test file content';
      fs.writeFileSync(testFile, content);

      const request: ToolExecutionRequest = {
        id: 'test-2',
        type: 'tool_execution_request',
        timestamp: Date.now(),
        tool: 'read_file',
        parameters: {
          absolute_path: testFile
        }
      };

      const response = await executor.execute(request);

      expect(response.type).toBe('tool_execution_response');
      expect(response.requestId).toBe(request.id);
      expect(response.error).toBeUndefined();
      expect(response.result).toHaveProperty('llmContent');
      expect(response.result.llmContent).toContain(content);
    });

    it('should execute list_directory tool', async () => {
      // Create some test files
      fs.writeFileSync(path.join(testDir, 'file1.txt'), 'content1');
      fs.writeFileSync(path.join(testDir, 'file2.txt'), 'content2');

      const request: ToolExecutionRequest = {
        id: 'test-3',
        type: 'tool_execution_request',
        timestamp: Date.now(),
        tool: 'list_directory',
        parameters: {
          path: testDir
        }
      };

      const response = await executor.execute(request);

      expect(response.type).toBe('tool_execution_response');
      expect(response.requestId).toBe(request.id);
      expect(response.error).toBeUndefined();
      expect(response.result).toHaveProperty('llmContent');
      expect(typeof response.result.llmContent).toBe('string');
      
      // Check that the file names appear in the formatted output
      expect(response.result.llmContent).toContain('file1.txt');
      expect(response.result.llmContent).toContain('file2.txt');
    });

    it('should return error for unknown tool', async () => {
      const request: ToolExecutionRequest = {
        id: 'test-4',
        type: 'tool_execution_request',
        timestamp: Date.now(),
        tool: 'unknown_tool',
        parameters: {}
      };

      const response = await executor.execute(request);

      expect(response.type).toBe('tool_execution_response');
      expect(response.requestId).toBe(request.id);
      expect(response.error).toBeDefined();
      expect(response.error).toContain('Unknown tool: unknown_tool');
    });

    it('should handle tool execution errors gracefully', async () => {
      const request: ToolExecutionRequest = {
        id: 'test-5',
        type: 'tool_execution_request',
        timestamp: Date.now(),
        tool: 'read_file',
        parameters: {
          absolute_path: '/non/existent/file.txt'
        }
      };

      const response = await executor.execute(request);

      expect(response.type).toBe('tool_execution_response');
      expect(response.requestId).toBe(request.id);
      // The response should either have an error or a result indicating failure
      expect(response.error || response.result?.llmContent?.includes('Error') || response.result?.llmContent?.includes('not found')).toBeTruthy();
    });

    it('should generate unique response IDs', async () => {
      const request1: ToolExecutionRequest = {
        id: 'test-6a',
        type: 'tool_execution_request',
        timestamp: Date.now(),
        tool: 'list_directory',
        parameters: { path: testDir }
      };

      const request2: ToolExecutionRequest = {
        id: 'test-6b',
        type: 'tool_execution_request',
        timestamp: Date.now(),
        tool: 'list_directory',
        parameters: { path: testDir }
      };

      const response1 = await executor.execute(request1);
      const response2 = await executor.execute(request2);

      expect(response1.id).not.toBe(response2.id);
      expect(response1.requestId).toBe(request1.id);
      expect(response2.requestId).toBe(request2.id);
    });
  });

  describe('error handling', () => {
    it('should handle invalid parameters gracefully', async () => {
      const request: ToolExecutionRequest = {
        id: 'test-7',
        type: 'tool_execution_request',
        timestamp: Date.now(),
        tool: 'write_file',
        parameters: {
          // Missing required file_path parameter
          content: 'test content'
        }
      };

      const response = await executor.execute(request);

      expect(response.type).toBe('tool_execution_response');
      // The response should either have an error or indicate failure in the result
      expect(response.error || response.result?.llmContent?.includes('Error') || response.result?.llmContent?.includes('Invalid')).toBeTruthy();
    });
  });
});