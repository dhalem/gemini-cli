/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  ToolDefinition, 
  ToolParameterSchema,
  ToolExecutionRequest, 
  ToolExecutionResponse 
} from '@google/gemini-cli-core-protocol';
import { 
  ToolRegistry,
  LSTool,
  ReadFileTool,
  GrepTool,
  GlobTool,
  EditTool,
  ShellTool,
  WriteFileTool,
  Config
} from '@google/gemini-cli-core';

export class LocalToolExecutor {
  private toolRegistry: ToolRegistry;
  
  constructor(targetDir: string) {
    // Create a minimal config for the tool registry
    const config = new Config({
      sessionId: `tool-executor-${Date.now()}`,
      targetDir: targetDir,
      debugMode: false,
      model: 'gemini-2.0-flash-exp',
      cwd: targetDir
    });
    
    this.toolRegistry = new ToolRegistry(config);
    this.registerCoreTools(targetDir, config);
  }
  
  private registerCoreTools(targetDir: string, config: Config): void {
    // Register core tools for milestone 1.5
    try {
      this.toolRegistry.registerTool(new ReadFileTool(targetDir, config));
      this.toolRegistry.registerTool(new WriteFileTool(config));
      this.toolRegistry.registerTool(new LSTool(targetDir, config));
      this.toolRegistry.registerTool(new GrepTool(targetDir));
      this.toolRegistry.registerTool(new GlobTool(targetDir, config));
      this.toolRegistry.registerTool(new EditTool(config));
      this.toolRegistry.registerTool(new ShellTool(config));
    } catch (error) {
      console.error('[LocalToolExecutor] Error registering tools:', error);
    }
  }
  
  getToolDefinitions(): ToolDefinition[] {
    const tools = this.toolRegistry.getAllTools();
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: this.convertSchemaToToolParameterSchema(tool.schema.parameters)
    }));
  }

  private convertSchemaToToolParameterSchema(schema: any): ToolParameterSchema {
    if (!schema) {
      return { type: 'object', properties: {} };
    }
    
    // Convert from Gemini Schema to our ToolParameterSchema format
    return {
      type: 'object',
      properties: schema.properties || {},
      required: schema.required,
      additionalProperties: schema.additionalProperties
    };
  }
  
  async execute(request: ToolExecutionRequest): Promise<ToolExecutionResponse> {
    try {
      const tool = this.toolRegistry.getTool(request.tool);
      if (!tool) {
        throw new Error(`Unknown tool: ${request.tool}`);
      }
      
      console.log(`[LocalToolExecutor] Executing tool: ${request.tool}`, request.parameters);
      const result = await tool.execute(request.parameters, new AbortController().signal);
      
      return {
        id: this.generateId(),
        type: 'tool_execution_response',
        timestamp: Date.now(),
        requestId: request.id,
        result
      };
    } catch (error) {
      console.error(`[LocalToolExecutor] Tool execution failed:`, error);
      return {
        id: this.generateId(),
        type: 'tool_execution_response',
        timestamp: Date.now(),
        requestId: request.id,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}