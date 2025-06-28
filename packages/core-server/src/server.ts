/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  ProtocolServer, 
  ProtocolMessage, 
  GenerateContentRequest,
  GenerateContentResponse,
  ToolExecutionRequest, 
  ToolExecutionResponse 
} from '@google/gemini-cli-core-protocol';
import { ContentGenerator, createContentGenerator, createContentGeneratorConfig, AuthType } from './contentGenerator.js';

export class CoreServer extends ProtocolServer {
  private messageHandlers: Set<(message: ProtocolMessage, clientId: string) => void> = new Set();
  private contentGenerator?: ContentGenerator;
  private toolRequestCallback?: (clientId: string, request: ToolExecutionRequest) => Promise<ToolExecutionResponse>;
  
  async start(): Promise<void> {
    // Initialize content generator with default config
    const config = await createContentGeneratorConfig(
      undefined, 
      AuthType.USE_GEMINI
    );
    this.contentGenerator = await createContentGenerator(config);
  }
  
  async stop(): Promise<void> {
    this.messageHandlers.clear();
  }
  
  async sendMessage(clientId: string, message: ProtocolMessage): Promise<void> {
    // In loopback mode, we send messages back through the message handlers
    this.messageHandlers.forEach(handler => handler(message, clientId));
  }
  
  onMessage(handler: (message: ProtocolMessage, clientId: string) => void): void {
    this.messageHandlers.add(handler);
  }
  
  onToolRequest(callback: (clientId: string, request: ToolExecutionRequest) => Promise<ToolExecutionResponse>): void {
    this.toolRequestCallback = callback;
  }
  
  async handleMessage(message: ProtocolMessage, clientId = 'loopback'): Promise<void> {
    switch (message.type) {
      case 'generate_content_request':
        await this.handleGenerateContent(message as GenerateContentRequest, clientId);
        break;
      case 'tool_execution_response':
        // Handle tool responses (for future streaming support)
        break;
      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }
  
  private async handleGenerateContent(request: GenerateContentRequest, clientId: string): Promise<void> {
    try {
      if (!this.contentGenerator) {
        throw new Error('Content generator not initialized');
      }
      
      // Simple implementation for milestone 1 - just generate content
      const response = await this.contentGenerator.generateContent({
        contents: request.contents,
        ...request.config
      });
      
      const responseMessage: GenerateContentResponse = {
        id: `response-${Date.now()}`,
        type: 'generate_content_response',
        timestamp: Date.now(),
        requestId: request.id,
        response
      };
      
      await this.sendMessage(clientId, responseMessage);
      
    } catch (error) {
      const errorMessage: GenerateContentResponse = {
        id: `error-${Date.now()}`,
        type: 'generate_content_response',
        timestamp: Date.now(),
        requestId: request.id,
        response: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      await this.sendMessage(clientId, errorMessage);
    }
  }
  
  async requestToolExecution(clientId: string, request: ToolExecutionRequest): Promise<ToolExecutionResponse> {
    if (this.toolRequestCallback) {
      return await this.toolRequestCallback(clientId, request);
    }
    
    throw new Error('No tool request handler registered');
  }
}

export async function createCoreServer(): Promise<CoreServer> {
  const server = new CoreServer();
  await server.start();
  return server;
}