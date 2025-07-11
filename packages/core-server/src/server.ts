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
import { 
  GeminiClient, 
  Config, 
  createContentGeneratorConfig, 
  AuthType,
  ToolRegistry 
} from '@google/gemini-cli-core';

export class CoreServer extends ProtocolServer {
  private messageHandlers: Set<(message: ProtocolMessage, clientId: string) => void> = new Set();
  private geminiClient!: GeminiClient;
  private toolRequestCallback?: (clientId: string, request: ToolExecutionRequest) => Promise<ToolExecutionResponse>;
  
  async start(): Promise<void> {
    // Create a basic Config instance for the protocol server
    const config = new Config({
      sessionId: `protocol-${Date.now()}`,
      targetDir: process.cwd(),
      debugMode: false,
      model: 'gemini-2.0-flash-exp',
      cwd: process.cwd(),
      coreTools: [] // Disable all core tools
    });
    
    // Create empty tool registry to avoid tool dependencies
    const emptyToolRegistry = new ToolRegistry(config);
    // Manually set the tool registry to avoid the full initialization
    (config as any).toolRegistry = emptyToolRegistry;
    
    const contentGeneratorConfig = await createContentGeneratorConfig(
      undefined, 
      AuthType.USE_GEMINI
    );
    
    this.geminiClient = new GeminiClient(config);
    await this.geminiClient.initialize(contentGeneratorConfig);
    console.log('[Protocol] Gemini client initialized');
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
    console.log('[Protocol Server] Handling generate content request:', request.id);
    try {
      const response = await this.geminiClient.generateContent(
        request.contents,
        request.config || {},
        new AbortController().signal
      );
      console.log('[Protocol Server] API response received');
      
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