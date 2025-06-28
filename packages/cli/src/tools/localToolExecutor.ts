/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  ToolExecutionRequest, 
  ToolExecutionResponse, 
  createToolExecutionResponse 
} from '@google/gemini-cli-core-protocol';

export class LocalToolExecutor {
  async execute(request: ToolExecutionRequest): Promise<ToolExecutionResponse> {
    try {
      // For milestone 1, we'll implement a simple echo tool
      if (request.tool === 'echo') {
        return createToolExecutionResponse(
          request.id,
          { message: request.parameters.message || 'Hello from local tool!' }
        );
      }
      
      // For now, just return a placeholder response for unknown tools
      return createToolExecutionResponse(
        request.id,
        { message: `Tool ${request.tool} executed with parameters: ${JSON.stringify(request.parameters)}` }
      );
      
    } catch (error) {
      return createToolExecutionResponse(
        request.id,
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }
}