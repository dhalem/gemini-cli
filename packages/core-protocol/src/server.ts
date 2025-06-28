/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  ProtocolMessage, 
  ToolExecutionRequest, 
  ToolExecutionResponse 
} from './types.js';

export abstract class ProtocolServer {
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract sendMessage(clientId: string, message: ProtocolMessage): Promise<void>;
  abstract onMessage(handler: (message: ProtocolMessage, clientId: string) => void): void;
  
  // High-level message handling
  async handleMessage(message: ProtocolMessage, clientId?: string): Promise<void> {
    // Override in concrete implementations
  }
  
  // Tool execution requests
  async requestToolExecution(clientId: string, request: ToolExecutionRequest): Promise<ToolExecutionResponse> {
    // Override in concrete implementations
    throw new Error('Tool execution not implemented');
  }
}