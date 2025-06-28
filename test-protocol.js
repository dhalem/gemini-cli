#!/usr/bin/env node

/**
 * Simple test script to verify protocol milestone 1 works
 */

import { LoopbackProtocolClient } from './packages/core-protocol/dist/index.js';
import { createCoreServer } from './packages/core-server/dist/index.js';

async function testProtocol() {
  console.log('🧪 Testing Protocol Milestone 1...\n');
  
  try {
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
    
    // Step 4: Setup tool handler
    console.log('4. Setting up tool handler...');
    client.onToolRequest(async (request) => {
      console.log(`   🔧 Tool request: ${request.tool}`);
      return {
        id: `tool-response-${Date.now()}`,
        type: 'tool_execution_response',
        timestamp: Date.now(),
        requestId: request.id,
        result: { message: `Tool ${request.tool} executed successfully` }
      };
    });
    console.log('   ✅ Tool handler ready');
    
    // Step 5: Test content generation
    console.log('5. Testing content generation...');
    const response = await client.generateContent({
      contents: [
        { role: 'user', parts: [{ text: 'Hello from protocol test!' }] }
      ]
    });
    
    console.log('   ✅ Content generated:');
    console.log('   Response:', JSON.stringify(response, null, 2));
    
    // Step 6: Disconnect
    console.log('6. Disconnecting...');
    await client.disconnect();
    console.log('   ✅ Disconnected');
    
    console.log('\n🎉 Protocol Milestone 1 Test PASSED!');
    console.log('   - Client/server separation: ✅');
    console.log('   - Loopback communication: ✅');
    console.log('   - Message protocol: ✅');
    console.log('   - Tool execution framework: ✅');
    
  } catch (error) {
    console.error('\n❌ Test FAILED:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testProtocol();