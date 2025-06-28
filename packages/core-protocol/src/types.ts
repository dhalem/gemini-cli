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

export type ProtocolMessageType = 
  | GenerateContentRequest 
  | GenerateContentResponse
  | ToolExecutionRequest 
  | ToolExecutionResponse
  | StreamingResponse;