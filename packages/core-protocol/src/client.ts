/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  ProtocolMessage, 
  GenerateContentRequest,
  GenerateContentResponse,
  ToolExecutionRequest, 
  ToolExecutionResponse,
  ToolDiscoveryMessage,
  ToolDefinition
} from './types.js';
import { createGenerateContentRequest } from './messages.js';

export interface GenerateContentParameters {
  contents: any[];
  config?: any;
}

export interface LocalToolExecutor {
  getToolDefinitions(): ToolDefinition[];
  execute(request: ToolExecutionRequest): Promise<ToolExecutionResponse>;
}

export abstract class ProtocolClient {
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract sendMessage(message: ProtocolMessage): Promise<void>;
  abstract onMessage(handler: (message: ProtocolMessage) => void): void;
  
  private toolRequestHandler?: (request: ToolExecutionRequest) => Promise<ToolExecutionResponse>;
  private pendingRequests = new Map<string, (response: any) => void>();
  private toolExecutor?: LocalToolExecutor;
  
  protected handleMessage(message: ProtocolMessage): void {
    console.log('[Protocol Client] Handling message:', message?.type, message?.id);
    
    // Handle tool execution requests
    if (message.type === 'tool_execution_request') {
      this.handleToolRequest(message as ToolExecutionRequest);
      return;
    }
    
    // Handle responses to pending requests
    if (message.type === 'generate_content_response') {
      const response = message as GenerateContentResponse;
      const resolver = this.pendingRequests.get(response.requestId);
      if (resolver) {
        if (response.error) {
          resolver({ error: response.error });
        } else {
          resolver(response.response);
        }
        this.pendingRequests.delete(response.requestId);
      }
    }
  }
  
  async generateContent(request: GenerateContentParameters): Promise<any> {
    const message = createGenerateContentRequest(request.contents, request.config);
    console.log('[Protocol Client] Sending request:', message.id);
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(message.id, (response: any) => {
        console.log('[Protocol Client] Received response for:', message.id, response);
        if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
      
      this.sendMessage(message).catch(reject);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(message.id)) {
          this.pendingRequests.delete(message.id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }
  
  async *generateContentStream(request: GenerateContentParameters): AsyncGenerator<any> {
    // For milestone 1, just return the single response
    const response = await this.generateContent(request);
    yield response;
  }
  
  onToolRequest(handler: (request: ToolExecutionRequest) => Promise<ToolExecutionResponse>): void {
    this.toolRequestHandler = handler;
  }
  
  setupToolExecution(toolExecutor: LocalToolExecutor): void {
    this.toolExecutor = toolExecutor;
  }
  
  async announceTools(): Promise<void> {
    if (!this.toolExecutor) {
      throw new Error('Tool executor not set up - call setupToolExecution first');
    }
    
    const toolDefinitions = this.toolExecutor.getToolDefinitions();
    const discovery: ToolDiscoveryMessage = {
      id: this.generateId(),
      type: 'tool_discovery',
      timestamp: Date.now(),
      tools: toolDefinitions
    };
    
    await this.sendMessage(discovery);
    console.log(`[Protocol Client] Announced ${toolDefinitions.length} tools to server`);
  }
  
  private async handleToolRequest(request: ToolExecutionRequest): Promise<void> {
    try {
      let response: ToolExecutionResponse;
      
      if (this.toolExecutor) {
        // Use local tool executor
        response = await this.toolExecutor.execute(request);
      } else if (this.toolRequestHandler) {
        // Use legacy handler
        response = await this.toolRequestHandler(request);
      } else {
        console.error('Received tool request but no tool executor or handler configured');
        response = {
          id: this.generateId(),
          type: 'tool_execution_response',
          timestamp: Date.now(),
          requestId: request.id,
          error: 'No tool executor configured'
        };
      }
      
      await this.sendMessage(response);
    } catch (error) {
      console.error('Error executing tool:', error);
      const errorResponse: ToolExecutionResponse = {
        id: this.generateId(),
        type: 'tool_execution_response',
        timestamp: Date.now(),
        requestId: request.id,
        error: error instanceof Error ? error.message : String(error)
      };
      await this.sendMessage(errorResponse);
    }
  }
  
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}