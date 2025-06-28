/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  ProtocolMessage, 
  GenerateContentRequest, 
  ToolExecutionRequest,
  ToolExecutionResponse,
  StreamingResponse 
} from './types.js';

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function createGenerateContentRequest(contents: any[], config?: any): GenerateContentRequest {
  return {
    id: generateId(),
    type: 'generate_content_request',
    timestamp: Date.now(),
    contents,
    config
  };
}

export function createToolExecutionRequest(tool: string, parameters: Record<string, any>): ToolExecutionRequest {
  return {
    id: generateId(),
    type: 'tool_execution_request',
    timestamp: Date.now(),
    tool,
    parameters
  };
}

export function createToolExecutionResponse(
  requestId: string, 
  result?: any, 
  error?: string
): ToolExecutionResponse {
  return {
    id: generateId(),
    type: 'tool_execution_response',
    timestamp: Date.now(),
    requestId,
    result,
    error
  };
}

export function createStreamingResponse(
  requestId: string, 
  chunk: any, 
  isComplete: boolean
): StreamingResponse {
  return {
    id: generateId(),
    type: 'streaming_response',
    timestamp: Date.now(),
    requestId,
    chunk,
    isComplete
  };
}

export function validateProtocolMessage(message: any): message is ProtocolMessage {
  return message && 
         typeof message.id === 'string' && 
         typeof message.type === 'string' && 
         typeof message.timestamp === 'number';
}