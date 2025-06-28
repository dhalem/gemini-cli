/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProtocolClient } from './client.js';
import { ProtocolServer } from './server.js';
import { ProtocolMessage } from './types.js';

export class LoopbackProtocolClient extends ProtocolClient {
  private messageHandlers: Set<(message: ProtocolMessage) => void> = new Set();
  private server?: ProtocolServer;
  
  constructor(server: ProtocolServer) {
    super();
    this.server = server;
  }
  
  async connect(): Promise<void> {
    if (this.server) {
      // Setup bidirectional communication
      this.server.onMessage((message) => {
        this.handleMessage(message);
        this.messageHandlers.forEach(handler => handler(message));
      });
    }
  }
  
  async disconnect(): Promise<void> {
    this.messageHandlers.clear();
  }
  
  async sendMessage(message: ProtocolMessage): Promise<void> {
    if (this.server) {
      await this.server.handleMessage(message, 'loopback');
    }
  }
  
  onMessage(handler: (message: ProtocolMessage) => void): void {
    this.messageHandlers.add(handler);
  }
}