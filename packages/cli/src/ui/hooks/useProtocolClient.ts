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

// Global singleton to prevent multiple initialization attempts
let globalInitPromise: Promise<any> | null = null;
let globalProtocolClient: ProtocolClient | null = null;
let globalIsConnected = false;
let globalError: string | null = null;
let globalLogs: string[] = [];

export function useProtocolClient() {
  const [protocolClient] = useState<ProtocolClient | null>(null);
  const [isConnected] = useState(false); // Default to disconnected to avoid showing incorrect status
  const [error] = useState<string | null>(null);
  const [initializationLog] = useState<string[]>([]);

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
    initializationLog,
    generateContent
  };
}