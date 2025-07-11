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
  ToolExecutionResponse 
} from './types.js';
import { createGenerateContentRequest } from './messages.js';

export interface GenerateContentParameters {
  contents: any[];
  config?: any;
}

export abstract class ProtocolClient {
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract sendMessage(message: ProtocolMessage): Promise<void>;
  abstract onMessage(handler: (message: ProtocolMessage) => void): void;
  
  private toolRequestHandler?: (request: ToolExecutionRequest) => Promise<ToolExecutionResponse>;
  private pendingRequests = new Map<string, (response: any) => void>();
  
  protected handleMessage(message: ProtocolMessage): void {
    console.log('[Protocol Client] Handling message:', message?.type, message?.id);
    
    // Handle tool execution requests
    if (message.type === 'tool_execution_request' && this.toolRequestHandler) {
      const request = message as ToolExecutionRequest;
      this.toolRequestHandler(request)
        .then(response => this.sendMessage(response))
        .catch(error => console.error('Tool execution failed:', error));
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
}