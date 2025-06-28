/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  ProtocolClient, 
  LoopbackProtocolClient,
  GenerateContentParameters 
} from '@google/gemini-cli-core-protocol';
import { createCoreServer } from '@google/gemini-cli-core-server';
import { LocalToolExecutor } from '../../tools/localToolExecutor.js';

export function useProtocolClient() {
  const [protocolClient, setProtocolClient] = useState<ProtocolClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initializeProtocol() {
      try {
        console.log('[Protocol] Initializing loopback protocol client...');
        
        // Create core server
        const server = await createCoreServer();
        console.log('[Protocol] Core server created');
        
        // Create loopback client
        const client = new LoopbackProtocolClient(server);
        console.log('[Protocol] Loopback client created');
        
        // Setup tool execution handler
        const toolExecutor = new LocalToolExecutor();
        client.onToolRequest(async (request) => {
          console.log('[Protocol] Executing tool:', request.tool, request.parameters);
          return await toolExecutor.execute(request);
        });
        
        // Connect
        await client.connect();
        console.log('[Protocol] Client connected');
        
        setProtocolClient(client);
        setIsConnected(true);
        setError(null);
        
      } catch (err) {
        console.error('[Protocol] Failed to initialize:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsConnected(false);
      }
    }

    initializeProtocol();
  }, []);

  const generateContent = async (request: GenerateContentParameters) => {
    if (!protocolClient) {
      throw new Error('Protocol client not initialized');
    }
    
    console.log('[Protocol] Generating content...', request);
    const response = await protocolClient.generateContent(request);
    console.log('[Protocol] Content generated:', response);
    
    return response;
  };

  return {
    protocolClient,
    isConnected,
    error,
    generateContent
  };
}