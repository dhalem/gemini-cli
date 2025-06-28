/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  ProtocolServer,
  ToolExecutionRequest,
  ToolExecutionResponse,
  ToolDiscoveryMessage,
  ToolDefinition
} from '@google/gemini-cli-core-protocol';
import { FunctionDeclaration, Type } from '@google/genai';

export class ToolProxy {
  private pendingRequests = new Map<string, {
    resolve: (result: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  
  private clientTools = new Map<string, ToolDefinition[]>(); // clientId -> tools
  
  constructor(
    private server: ProtocolServer,
    private timeoutMs: number = 30000
  ) {}
  
  async executeTool(
    clientId: string, 
    toolName: string, 
    parameters: Record<string, any>
  ): Promise<any> {
    const request: ToolExecutionRequest = {
      id: this.generateId(),
      type: 'tool_execution_request',
      timestamp: Date.now(),
      tool: toolName,
      parameters
    };
    
    console.log(`[ToolProxy] Executing tool ${toolName} for client ${clientId}`, parameters);
    
    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error(`Tool execution timeout: ${toolName}`));
      }, this.timeoutMs);
      
      // Store request handlers
      this.pendingRequests.set(request.id, {
        resolve,
        reject,
        timeout
      });
      
      // Send request to client
      this.server.sendMessage(clientId, request);
    });
  }
  
  handleToolResponse(response: ToolExecutionResponse): void {
    const pending = this.pendingRequests.get(response.requestId);
    if (!pending) {
      console.warn(`[ToolProxy] Received tool response for unknown request: ${response.requestId}`);
      return;
    }
    
    console.log(`[ToolProxy] Received tool response for request ${response.requestId}`);
    
    // Clean up
    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.requestId);
    
    // Resolve or reject based on response
    if (response.error) {
      pending.reject(new Error(response.error));
    } else {
      pending.resolve(response.result);
    }
  }
  
  handleToolDiscovery(clientId: string, discovery: ToolDiscoveryMessage): void {
    console.log(`[ToolProxy] Client ${clientId} announced ${discovery.tools.length} tools`);
    this.clientTools.set(clientId, discovery.tools);
    
    // Log available tools for debugging
    discovery.tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
  }
  
  getClientTools(clientId: string): ToolDefinition[] {
    return this.clientTools.get(clientId) || [];
  }
  
  hasClientTool(clientId: string, toolName: string): boolean {
    const tools = this.getClientTools(clientId);
    return tools.some(tool => tool.name === toolName);
  }
  
  getClientToolDefinition(clientId: string, toolName: string): ToolDefinition | undefined {
    const tools = this.getClientTools(clientId);
    return tools.find(tool => tool.name === toolName);
  }
  
  // Generate function declarations for Gemini from client tools
  getFunctionDeclarations(clientId: string): FunctionDeclaration[] {
    const tools = this.getClientTools(clientId);
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: Type.OBJECT,
        properties: Object.fromEntries(
          Object.entries(tool.parameters.properties || {}).map(([key, value]) => [
            key,
            {
              type: this.mapTypeToGeminiType(value.type),
              description: value.description
            }
          ])
        ),
        required: tool.parameters.required
      }
    }));
  }
  
  private mapTypeToGeminiType(type: string): Type {
    switch (type) {
      case 'string': return Type.STRING;
      case 'number': return Type.NUMBER;
      case 'boolean': return Type.BOOLEAN;
      case 'array': return Type.ARRAY;
      case 'object': return Type.OBJECT;
      default: return Type.STRING;
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}