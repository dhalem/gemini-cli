#!/usr/bin/env node

/**
 * End-to-end test for Milestone 1.5: Tool Discovery & Local Tool Proxy
 * Tests actual tool execution through the protocol, not just discovery
 */

import { LoopbackProtocolClient } from './packages/core-protocol/dist/index.js';
import { createCoreServer } from './packages/core-server/dist/index.js';
import { LocalToolExecutor } from './packages/cli/dist/src/tools/localToolExecutor.js';
import fs from 'fs';
import path from 'path';

async function testToolExecution() {
  console.log('🧪 Testing End-to-End Tool Execution (Milestone 1.5)...\n');
  
  const testDir = '/tmp/gemini-cli-test';
  const testFile = path.join(testDir, 'test.txt');
  
  try {
    // Setup test directory
    console.log('0. Setting up test environment...');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    console.log('   ✅ Test directory ready');
    
    // Step 1: Create server
    console.log('1. Creating core server...');
    const server = await createCoreServer();
    console.log('   ✅ Server created');
    
    // Step 2: Create loopback client
    console.log('2. Creating loopback client...');
    const client = new LoopbackProtocolClient(server);
    console.log('   ✅ Client created');
    
    // Step 3: Connect
    console.log('3. Connecting client to server...');
    await client.connect();
    console.log('   ✅ Connected');
    
    // Step 4: Setup tool execution
    console.log('4. Setting up tool execution...');
    const toolExecutor = new LocalToolExecutor(testDir);
    client.setupToolExecution(toolExecutor);
    console.log('   ✅ Tool executor ready');
    
    // Step 5: Announce tools
    console.log('5. Announcing available tools...');
    await client.announceTools();
    console.log('   ✅ Tools announced');
    
    // Step 6: Test tool execution directly through the protocol
    console.log('6. Testing direct tool execution...');
    
    // Test 1: Write a file using write_file tool
    console.log('   6a. Testing write_file tool...');
    const writeRequest = {
      id: 'test-write-1',
      type: 'tool_execution_request',
      timestamp: Date.now(),
      tool: 'write_file',
      parameters: {
        file_path: testFile,
        content: 'Hello from tool execution test!\nLine 2\nLine 3'
      }
    };
    
    const writeResponse = await toolExecutor.execute(writeRequest);
    if (writeResponse.error) {
      throw new Error(`Write tool failed: ${writeResponse.error}`);
    }
    console.log('   ✅ write_file executed successfully');
    
    // Verify file was actually created
    if (!fs.existsSync(testFile)) {
      throw new Error('File was not created by write_file tool');
    }
    console.log('   ✅ File verified on filesystem');
    
    // Test 2: Read the file back using read_file tool
    console.log('   6b. Testing read_file tool...');
    const readRequest = {
      id: 'test-read-1',
      type: 'tool_execution_request',
      timestamp: Date.now(),
      tool: 'read_file',
      parameters: {
        absolute_path: testFile
      }
    };
    
    const readResponse = await toolExecutor.execute(readRequest);
    if (readResponse.error) {
      throw new Error(`Read tool failed: ${readResponse.error}`);
    }
    
    const expectedContent = 'Hello from tool execution test!\nLine 2\nLine 3';
    if (!readResponse.result || !readResponse.result.llmContent || !readResponse.result.llmContent.includes(expectedContent)) {
      throw new Error(`Read content mismatch. Expected: ${expectedContent}, Got: ${JSON.stringify(readResponse.result)}`);
    }
    console.log('   ✅ read_file executed successfully');
    console.log('   ✅ Content verification passed');
    
    // Test 3: List directory using list_directory tool
    console.log('   6c. Testing list_directory tool...');
    const lsRequest = {
      id: 'test-ls-1',
      type: 'tool_execution_request',
      timestamp: Date.now(),
      tool: 'list_directory',
      parameters: {
        path: testDir
      }
    };
    
    const lsResponse = await toolExecutor.execute(lsRequest);
    if (lsResponse.error) {
      throw new Error(`LS tool failed: ${lsResponse.error}`);
    }
    
    if (!lsResponse.result.llmContent.includes('test.txt')) {
      throw new Error('test.txt not found in directory listing');
    }
    console.log('   ✅ list_directory executed successfully');
    console.log('   ✅ Directory listing verification passed');
    
    // Test 4: Test tool proxy through server
    console.log('   6d. Testing tool execution through server proxy...');
    const toolProxy = server.getToolProxy();
    
    // Test server can execute tools on client
    const proxyResult = await toolProxy.executeTool('loopback', 'read_file', {
      absolute_path: testFile
    });
    
    if (!proxyResult.llmContent || !proxyResult.llmContent.includes(expectedContent)) {
      throw new Error(`Tool proxy execution failed. Got: ${JSON.stringify(proxyResult)}`);
    }
    console.log('   ✅ Tool proxy execution successful');
    
    // Step 7: Cleanup
    console.log('7. Cleaning up...');
    fs.rmSync(testDir, { recursive: true, force: true });
    await client.disconnect();
    console.log('   ✅ Cleanup complete');
    
    console.log('\n🎉 End-to-End Tool Execution Test PASSED!');
    console.log('   - Protocol communication: ✅');
    console.log('   - Tool discovery: ✅');
    console.log('   - Local tool execution: ✅');
    console.log('   - File I/O tools: ✅');
    console.log('   - Directory tools: ✅');
    console.log('   - Tool proxy pattern: ✅');
    console.log('   - Request/response flow: ✅');
    console.log('\n✨ Milestone 1.5 is COMPLETE!');
    
  } catch (error) {
    console.error('\n❌ End-to-End Test FAILED:');
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    
    // Cleanup on error
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError.message);
    }
    
    process.exit(1);
  }
}

testToolExecution();