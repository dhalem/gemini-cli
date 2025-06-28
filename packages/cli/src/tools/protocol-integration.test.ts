/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LoopbackProtocolClient } from '@google/gemini-cli-core-protocol';
import { createCoreServer } from '@google/gemini-cli-core-server';
import { LocalToolExecutor } from './localToolExecutor.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Protocol Integration Tests', () => {
  let testDir: string;
  let server: any;
  let client: LoopbackProtocolClient;
  let toolExecutor: LocalToolExecutor;

  beforeEach(async () => {
    // Create a temporary directory for tests
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'protocol-integration-test-'));
    
    // Set up protocol components
    server = await createCoreServer(true); // Skip Gemini init
    client = new LoopbackProtocolClient(server);
    toolExecutor = new LocalToolExecutor(testDir);
    
    // Connect and set up
    client.setupToolExecution(toolExecutor);
    await client.connect();
    await client.announceTools();
  });

  afterEach(async () => {
    if (client) {
      await client.disconnect();
    }
    
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Tool Discovery', () => {
    it('should announce tools to server on connect', async () => {
      const toolProxy = server.getToolProxy();
      const clientTools = toolProxy.getClientTools('loopback');
      
      expect(clientTools.length).toBeGreaterThan(0);
      
      const toolNames = clientTools.map((tool: any) => tool.name);
      expect(toolNames).toContain('read_file');
      expect(toolNames).toContain('write_file');
      expect(toolNames).toContain('list_directory');
    });

    it('should provide function declarations for Gemini', async () => {
      const toolProxy = server.getToolProxy();
      const declarations = toolProxy.getFunctionDeclarations('loopback');
      
      expect(declarations.length).toBeGreaterThan(0);
      
      const readFileDecl = declarations.find((decl: any) => decl.name === 'read_file');
      expect(readFileDecl).toBeDefined();
      expect(readFileDecl.description).toBeDefined();
      expect(readFileDecl.parameters).toBeDefined();
    });
  });

  describe('Tool Execution via Protocol', () => {
    it('should execute write_file tool through protocol', async () => {
      const testFile = path.join(testDir, 'protocol-test.txt');
      const content = 'Hello from protocol test!';
      
      const toolProxy = server.getToolProxy();
      const result = await toolProxy.executeTool('loopback', 'write_file', {
        file_path: testFile,
        content
      });
      
      expect(result).toBeDefined();
      expect(fs.existsSync(testFile)).toBe(true);
      expect(fs.readFileSync(testFile, 'utf8')).toBe(content);
    });

    it('should execute read_file tool through protocol', async () => {
      const testFile = path.join(testDir, 'read-protocol-test.txt');
      const content = 'Content to read via protocol';
      
      // Create test file
      fs.writeFileSync(testFile, content);
      
      const toolProxy = server.getToolProxy();
      const result = await toolProxy.executeTool('loopback', 'read_file', {
        absolute_path: testFile
      });
      
      expect(result).toBeDefined();
      expect(result.llmContent).toContain(content);
    });

    it('should execute list_directory tool through protocol', async () => {
      // Create test files
      fs.writeFileSync(path.join(testDir, 'file1.txt'), 'content1');
      fs.writeFileSync(path.join(testDir, 'file2.txt'), 'content2');
      
      const toolProxy = server.getToolProxy();
      const result = await toolProxy.executeTool('loopback', 'list_directory', {
        path: testDir
      });
      
      expect(result).toBeDefined();
      expect(result.entries).toBeDefined();
      expect(Array.isArray(result.entries)).toBe(true);
      
      const fileNames = result.entries.map((entry: any) => entry.name);
      expect(fileNames).toContain('file1.txt');
      expect(fileNames).toContain('file2.txt');
    });

    it('should handle tool execution errors through protocol', async () => {
      const toolProxy = server.getToolProxy();
      
      await expect(
        toolProxy.executeTool('loopback', 'read_file', {
          absolute_path: '/non/existent/file.txt'
        })
      ).rejects.toThrow();
    });

    it('should handle unknown tool requests', async () => {
      const toolProxy = server.getToolProxy();
      
      await expect(
        toolProxy.executeTool('loopback', 'unknown_tool', {})
      ).rejects.toThrow('Unknown tool: unknown_tool');
    });
  });

  describe('End-to-End File Operations', () => {
    it('should perform complete write-read cycle through protocol', async () => {
      const testFile = path.join(testDir, 'e2e-test.txt');
      const originalContent = 'Original content for e2e test';
      const toolProxy = server.getToolProxy();
      
      // Write file
      await toolProxy.executeTool('loopback', 'write_file', {
        file_path: testFile,
        content: originalContent
      });
      
      // Verify file exists
      expect(fs.existsSync(testFile)).toBe(true);
      
      // Read file back
      const readResult = await toolProxy.executeTool('loopback', 'read_file', {
        absolute_path: testFile
      });
      
      expect(readResult.llmContent).toContain(originalContent);
      
      // List directory to verify file is listed
      const listResult = await toolProxy.executeTool('loopback', 'list_directory', {
        path: testDir
      });
      
      const fileNames = listResult.entries.map((entry: any) => entry.name);
      expect(fileNames).toContain('e2e-test.txt');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed tool requests gracefully', async () => {
      const toolProxy = server.getToolProxy();
      
      // Missing required parameters
      await expect(
        toolProxy.executeTool('loopback', 'write_file', {
          // Missing file_path
          content: 'test content'
        })
      ).rejects.toThrow();
    });

    it('should handle invalid file paths', async () => {
      const toolProxy = server.getToolProxy();
      
      await expect(
        toolProxy.executeTool('loopback', 'write_file', {
          file_path: '/invalid/\0/path.txt',
          content: 'test'
        })
      ).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle multiple concurrent tool executions', async () => {
      const toolProxy = server.getToolProxy();
      const promises = [];
      
      // Execute multiple directory listings concurrently
      for (let i = 0; i < 5; i++) {
        promises.push(
          toolProxy.executeTool('loopback', 'list_directory', {
            path: testDir
          })
        );
      }
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.entries).toBeDefined();
        expect(Array.isArray(result.entries)).toBe(true);
      });
    });
  });
});