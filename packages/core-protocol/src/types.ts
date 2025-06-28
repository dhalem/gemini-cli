/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ProtocolMessage {
  id: string;
  type: string;
  timestamp: number;
}

export interface GenerateContentRequest extends ProtocolMessage {
  type: 'generate_content_request';
  contents: any[];
  config?: any;
}

export interface GenerateContentResponse extends ProtocolMessage {
  type: 'generate_content_response';
  requestId: string;
  response: any;
  error?: string;
}

export interface ToolExecutionRequest extends ProtocolMessage {
  type: 'tool_execution_request';
  tool: string;
  parameters: Record<string, any>;
}

export interface ToolExecutionResponse extends ProtocolMessage {
  type: 'tool_execution_response';
  requestId: string;
  result?: any;
  error?: string;
}

export interface StreamingResponse extends ProtocolMessage {
  type: 'streaming_response';
  requestId: string;
  chunk: any;
  isComplete: boolean;
}

/**
 * Tool parameter schema following JSON Schema specification
 */
export interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description?: string;
    enum?: any[];
    items?: any;
    required?: string[];
    [key: string]: any;
  }>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * Definition of a tool that can be executed by the protocol
 */
export interface ToolDefinition {
  /** Unique name of the tool */
  name: string;
  /** Human-readable description of what the tool does */
  description: string;
  /** JSON Schema defining the tool's parameters */
  parameters: ToolParameterSchema;
}

export interface ToolDiscoveryMessage extends ProtocolMessage {
  type: 'tool_discovery';
  tools: ToolDefinition[];
}

export type ProtocolMessageType = 
  | GenerateContentRequest 
  | GenerateContentResponse
  | ToolExecutionRequest 
  | ToolExecutionResponse
  | StreamingResponse
  | ToolDiscoveryMessage;