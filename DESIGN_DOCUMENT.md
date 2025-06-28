# Gemini CLI Decoupling Design Document

## Executive Summary

This document outlines the decoupling of the Gemini CLI user interface from the agent logic (LLM interaction) to enable running the UI locally while moving the agent processing to a server. This architectural change will support multi-user scenarios, server-side resource management, and future language migration flexibility.

## Current Architecture

The Gemini CLI currently operates as a monolithic application with three main packages:

```
packages/cli/     - React-based terminal UI using Ink framework
packages/core/    - Backend logic: LLM API calls, tool orchestration, session management  
packages/mcp/     - MCP (Model Context Protocol) integration
```

**Current Data Flow:**
```
User Input → CLI (React/Ink) → Core (Agent Logic) → Gemini API
                            ↓
                        Local Tools (file system, shell, etc.)
```

## Target Architecture

**Final Target:**
```
Local Machine:                    Remote Server:
┌─────────────────┐              ┌──────────────────┐
│ CLI (React/Ink) │◄────────────►│ Agent Logic      │
│ Local Tools     │   Protocol   │ LLM Interaction  │
└─────────────────┘              └──────────────────┘
```

**Protocol Features:**
- Bidirectional communication (WebSocket-based)
- Tool execution requests from server, execution on client
- Streaming LLM responses
- Session management and authentication

# Milestone 1: In-Process Protocol Foundation

**Goal:** Create protocol layer with loopback communication in same process

## 1.1 New Package Structure

### Create `packages/core-protocol/`
```
packages/core-protocol/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── types.ts           # Shared protocol types
│   ├── messages.ts        # Protocol message definitions
│   ├── client.ts          # Protocol client base class
│   ├── server.ts          # Protocol server base class
│   └── loopback.ts        # In-process loopback implementation
```

**Key Types:**
```typescript
// packages/core-protocol/src/types.ts
export interface ProtocolMessage {
  id: string;
  type: string;
  timestamp: number;
}

export interface GenerateContentRequest extends ProtocolMessage {
  type: 'generate_content_request';
  prompt: string;
  history: ConversationTurn[];
  config: GenerationConfig;
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
  chunk: GenerateContentResponse;
  isComplete: boolean;
}
```

## 1.2 Protocol Client Implementation

### `packages/core-protocol/src/client.ts`
```typescript
export abstract class ProtocolClient {
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract sendMessage(message: ProtocolMessage): Promise<void>;
  abstract onMessage(handler: (message: ProtocolMessage) => void): void;
  
  // High-level API matching current core interface
  async generateContent(request: GenerateContentParameters): Promise<GenerateContentResponse>;
  async generateContentStream(request: GenerateContentParameters): Promise<AsyncGenerator<GenerateContentResponse>>;
  
  // Tool execution callback registration
  onToolRequest(handler: (request: ToolExecutionRequest) => Promise<ToolExecutionResponse>): void;
}
```

### `packages/core-protocol/src/loopback.ts`
```typescript
export class LoopbackProtocolClient extends ProtocolClient {
  private messageHandlers: Set<(message: ProtocolMessage) => void> = new Set();
  private toolRequestHandler?: (request: ToolExecutionRequest) => Promise<ToolExecutionResponse>;
  
  constructor(private server: ProtocolServer) {}
  
  async connect(): Promise<void> {
    this.server.onMessage((message) => {
      this.messageHandlers.forEach(handler => handler(message));
    });
  }
  
  async sendMessage(message: ProtocolMessage): Promise<void> {
    await this.server.handleMessage(message);
  }
  
  // Implementation of generateContent, generateContentStream, etc.
}
```

## 1.3 Protocol Server Implementation

### `packages/core-protocol/src/server.ts`
```typescript
export abstract class ProtocolServer {
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract sendMessage(clientId: string, message: ProtocolMessage): Promise<void>;
  abstract onMessage(handler: (message: ProtocolMessage, clientId: string) => void): void;
  
  // High-level message handling
  async handleMessage(message: ProtocolMessage, clientId?: string): Promise<void>;
  
  // Tool execution requests
  async requestToolExecution(clientId: string, request: ToolExecutionRequest): Promise<ToolExecutionResponse>;
}
```

## 1.4 Modify CLI Package

### Update `packages/cli/src/gemini.tsx`
```typescript
// Before:
import { ContentGenerator } from '@google/gemini-cli-core';

// After:
import { ProtocolClient, LoopbackProtocolClient } from '@google/gemini-cli-core-protocol';
import { createCoreServer } from '@google/gemini-cli-core-server';

export function GeminiCli() {
  const [protocolClient, setProtocolClient] = useState<ProtocolClient>();
  
  useEffect(() => {
    async function initializeProtocol() {
      // Milestone 1: In-process server
      const server = await createCoreServer();
      const client = new LoopbackProtocolClient(server);
      await client.connect();
      setProtocolClient(client);
    }
    initializeProtocol();
  }, []);
  
  // Rest of component uses protocolClient instead of core
}
```

### Update `packages/cli/src/ui/hooks/useGeminiStream.ts`
```typescript
// Replace core.generateContentStream calls
export function useGeminiStream(protocolClient: ProtocolClient) {
  const generateContent = useCallback(async (request: GenerateContentParameters) => {
    const stream = protocolClient.generateContentStream(request);
    
    for await (const chunk of stream) {
      // Handle streaming response
      yield chunk;
    }
  }, [protocolClient]);
  
  return { generateContent };
}
```

### Create `packages/cli/src/tools/localToolExecutor.ts`
```typescript
export class LocalToolExecutor {
  private toolRegistry: ToolRegistry;
  
  constructor() {
    this.toolRegistry = new ToolRegistry();
    // Register all existing tools
    this.toolRegistry.register(new ReadFileTool());
    this.toolRegistry.register(new WriteFileTool());
    // ... etc
  }
  
  async execute(request: ToolExecutionRequest): Promise<ToolExecutionResponse> {
    try {
      const tool = this.toolRegistry.get(request.tool);
      const result = await tool.execute(request.parameters);
      
      return {
        id: generateId(),
        type: 'tool_execution_response',
        timestamp: Date.now(),
        requestId: request.id,
        result
      };
    } catch (error) {
      return {
        id: generateId(),
        type: 'tool_execution_response',
        timestamp: Date.now(),
        requestId: request.id,
        error: error.message
      };
    }
  }
}
```

## 1.5 Create Core Server Package

### Create `packages/core-server/`
```
packages/core-server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── server.ts          # Main server implementation
│   ├── session/
│   │   ├── manager.ts     # Session management
│   │   └── types.ts       # Session-related types
│   ├── core/              # Copied from packages/core/src/core/
│   │   ├── geminiChat.ts  # Modified for protocol
│   │   ├── contentGenerator.ts
│   │   ├── prompts.ts
│   │   └── turn.ts
│   └── protocol/
│       ├── handler.ts     # Protocol message handling
│       └── toolProxy.ts   # Tool execution proxy
```

### `packages/core-server/src/server.ts`
```typescript
import { ProtocolServer } from '@google/gemini-cli-core-protocol';
import { SessionManager } from './session/manager.js';
import { ProtocolHandler } from './protocol/handler.js';

export class CoreServer extends ProtocolServer {
  private sessionManager = new SessionManager();
  private protocolHandler = new ProtocolHandler(this.sessionManager);
  
  async start(): Promise<void> {
    // In milestone 1, this is a no-op since we're in-process
  }
  
  async handleMessage(message: ProtocolMessage, clientId = 'loopback'): Promise<void> {
    await this.protocolHandler.handleMessage(message, clientId);
  }
  
  async requestToolExecution(clientId: string, request: ToolExecutionRequest): Promise<ToolExecutionResponse> {
    return this.protocolHandler.requestToolExecution(clientId, request);
  }
}

export async function createCoreServer(): Promise<CoreServer> {
  const server = new CoreServer();
  await server.start();
  return server;
}
```

### `packages/core-server/src/protocol/handler.ts`
```typescript
export class ProtocolHandler {
  constructor(private sessionManager: SessionManager) {}
  
  async handleMessage(message: ProtocolMessage, clientId: string): Promise<void> {
    switch (message.type) {
      case 'generate_content_request':
        await this.handleGenerateContent(message as GenerateContentRequest, clientId);
        break;
      case 'tool_execution_response':
        await this.handleToolResponse(message as ToolExecutionResponse, clientId);
        break;
      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }
  
  private async handleGenerateContent(request: GenerateContentRequest, clientId: string): Promise<void> {
    const session = this.sessionManager.getSession(clientId);
    
    // Modified version of existing geminiChat logic
    const geminiChat = session.getGeminiChat();
    
    for await (const chunk of geminiChat.generateContentStream(request)) {
      // Check if chunk requests tool execution
      if (chunk.candidates?.[0]?.content?.parts?.some(part => part.functionCall)) {
        // Extract tool call and request execution from client
        const toolRequest = this.extractToolRequest(chunk);
        const toolResponse = await this.requestToolExecution(clientId, toolRequest);
        
        // Continue generation with tool result
        // ... continue logic
      } else {
        // Send chunk to client
        await this.sendToClient(clientId, {
          id: generateId(),
          type: 'streaming_response',
          timestamp: Date.now(),
          chunk,
          isComplete: false
        });
      }
    }
  }
}
```

## 1.6 Testing Strategy

### Unit Tests
- `packages/core-protocol/src/__tests__/`
  - `loopback.test.ts` - Test loopback communication
  - `client.test.ts` - Test protocol client interface
  - `server.test.ts` - Test protocol server interface

### Integration Tests
- `integration-tests/protocol-milestone1.test.js`
```javascript
import { test, expect } from 'vitest';
import { LoopbackProtocolClient } from '@google/gemini-cli-core-protocol';
import { createCoreServer } from '@google/gemini-cli-core-server';

test('milestone 1: in-process protocol communication', async () => {
  const server = await createCoreServer();
  const client = new LoopbackProtocolClient(server);
  await client.connect();
  
  // Test basic generate content request
  const response = await client.generateContent({
    contents: [{ role: 'user', parts: [{ text: 'Hello, world!' }] }]
  });
  
  expect(response.candidates).toBeDefined();
});

test('milestone 1: tool execution through protocol', async () => {
  const server = await createCoreServer();
  const client = new LoopbackProtocolClient(server);
  
  // Setup tool handler
  client.onToolRequest(async (request) => {
    if (request.tool === 'read_file') {
      return {
        id: generateId(),
        type: 'tool_execution_response',
        timestamp: Date.now(),
        requestId: request.id,
        result: { content: 'file content' }
      };
    }
    throw new Error(`Unknown tool: ${request.tool}`);
  });
  
  await client.connect();
  
  const response = await client.generateContent({
    contents: [{ role: 'user', parts: [{ text: 'Read the file test.txt' }] }]
  });
  
  // Verify tool was called and response includes file content
  expect(response.candidates[0].content.parts[0].text).toContain('file content');
});
```

## 1.7 Documentation Updates

### Update `docs/architecture.md`
Add new section:
```markdown
## Protocol Architecture (Milestone 1)

The Gemini CLI now supports a protocol-based architecture that separates the UI from the agent logic:

### Protocol Layer
- **Purpose**: Enables communication between CLI frontend and agent backend
- **Implementation**: Loopback protocol for in-process communication
- **Messages**: Structured JSON messages for content generation and tool execution

### Modified Data Flow
```
User Input → CLI → Protocol Client → Protocol Server → Agent Logic → Gemini API
                ↓                                      ↓
            Local Tools ←─── Tool Execution Request ───┘
```

### Benefits
- Cleaner separation of concerns
- Foundation for future distributed deployment
- Easier testing of individual components
```

### Create `docs/protocol.md`
```markdown
# Gemini CLI Protocol Documentation

## Overview
The Gemini CLI protocol enables communication between the user interface and agent logic components.

## Message Types

### GenerateContentRequest
Requests content generation from the agent.

### ToolExecutionRequest  
Requests execution of a tool on the client side.

### StreamingResponse
Streams generated content back to the client.

## Implementation Details
[Detailed protocol specification]
```

# Milestone 2: Separate Process Architecture

**Goal:** Split into separate CLI and server processes on same machine

## 2.1 WebSocket Protocol Implementation

### Create `packages/core-protocol/src/websocket.ts`
```typescript
export class WebSocketProtocolClient extends ProtocolClient {
  private ws?: WebSocket;
  private messageHandlers: Set<(message: ProtocolMessage) => void> = new Set();
  private pendingRequests: Map<string, (response: any) => void> = new Map();
  
  constructor(private serverUrl: string) {
    super();
  }
  
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.serverUrl);
      
      this.ws.onopen = () => resolve();
      this.ws.onerror = (error) => reject(error);
      
      this.ws.onmessage = (event) => {
        const message: ProtocolMessage = JSON.parse(event.data);
        
        // Handle responses to pending requests
        if (message.type.endsWith('_response')) {
          const requestId = (message as any).requestId;
          const resolver = this.pendingRequests.get(requestId);
          if (resolver) {
            resolver(message);
            this.pendingRequests.delete(requestId);
            return;
          }
        }
        
        // Handle other messages
        this.messageHandlers.forEach(handler => handler(message));
      };
    });
  }
  
  async sendMessage(message: ProtocolMessage): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    
    this.ws.send(JSON.stringify(message));
  }
  
  async sendRequest<T>(request: ProtocolMessage): Promise<T> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(request.id, resolve);
      this.sendMessage(request).catch(reject);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(request.id)) {
          this.pendingRequests.delete(request.id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }
}
```

### Create `packages/core-protocol/src/websocketServer.ts`
```typescript
import { WebSocketServer } from 'ws';

export class WebSocketProtocolServer extends ProtocolServer {
  private wss?: WebSocketServer;
  private clients: Map<string, WebSocket> = new Map();
  private messageHandlers: Set<(message: ProtocolMessage, clientId: string) => void> = new Set();
  
  constructor(private port: number) {
    super();
  }
  
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.wss = new WebSocketServer({ port: this.port });
      
      this.wss.on('connection', (ws) => {
        const clientId = generateId();
        this.clients.set(clientId, ws);
        
        ws.on('message', (data) => {
          try {
            const message: ProtocolMessage = JSON.parse(data.toString());
            this.messageHandlers.forEach(handler => handler(message, clientId));
          } catch (error) {
            console.error('Failed to parse message:', error);
          }
        });
        
        ws.on('close', () => {
          this.clients.delete(clientId);
        });
      });
      
      this.wss.on('listening', () => {
        console.log(`Protocol server listening on port ${this.port}`);
        resolve();
      });
    });
  }
  
  async sendMessage(clientId: string, message: ProtocolMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || client.readyState !== WebSocket.OPEN) {
      throw new Error(`Client ${clientId} not connected`);
    }
    
    client.send(JSON.stringify(message));
  }
}
```

## 2.2 Separate Server Process

### Create `packages/core-server/src/standalone.ts`
```typescript
#!/usr/bin/env node

import { WebSocketProtocolServer } from '@google/gemini-cli-core-protocol';
import { ProtocolHandler } from './protocol/handler.js';
import { SessionManager } from './session/manager.js';

async function startServer() {
  const port = parseInt(process.env.GEMINI_SERVER_PORT || '8080');
  
  const server = new WebSocketProtocolServer(port);
  const sessionManager = new SessionManager();
  const protocolHandler = new ProtocolHandler(sessionManager);
  
  // Setup message handling
  server.onMessage(async (message, clientId) => {
    await protocolHandler.handleMessage(message, clientId);
  });
  
  // Setup tool execution proxy
  protocolHandler.onToolRequest(async (clientId, request) => {
    return server.requestToolExecution(clientId, request);
  });
  
  await server.start();
  
  process.on('SIGINT', async () => {
    console.log('Shutting down server...');
    await server.stop();
    process.exit(0);
  });
}

startServer().catch(console.error);
```

### Update `packages/core-server/package.json`
```json
{
  "name": "@google/gemini-cli-core-server",
  "version": "0.1.1",
  "bin": {
    "gemini-server": "dist/standalone.js"
  },
  "scripts": {
    "start:server": "node dist/standalone.js"
  }
}
```

## 2.3 Update CLI for Remote Connection

### Update `packages/cli/src/config/config.ts`
```typescript
export interface ServerConfig {
  mode: 'embedded' | 'local' | 'remote';
  host?: string;
  port?: number;
  authentication?: {
    token?: string;
    method?: 'none' | 'token' | 'oauth';
  };
}

export function getServerConfig(): ServerConfig {
  const mode = process.env.GEMINI_SERVER_MODE || 'embedded';
  
  switch (mode) {
    case 'local':
      return {
        mode: 'local',
        host: 'localhost',
        port: parseInt(process.env.GEMINI_SERVER_PORT || '8080')
      };
    case 'remote':
      return {
        mode: 'remote',
        host: process.env.GEMINI_SERVER_HOST || 'localhost',
        port: parseInt(process.env.GEMINI_SERVER_PORT || '8080'),
        authentication: {
          token: process.env.GEMINI_SERVER_TOKEN,
          method: 'token'
        }
      };
    default:
      return { mode: 'embedded' };
  }
}
```

### Update `packages/cli/src/gemini.tsx`
```typescript
export function GeminiCli() {
  const [protocolClient, setProtocolClient] = useState<ProtocolClient>();
  
  useEffect(() => {
    async function initializeProtocol() {
      const config = getServerConfig();
      
      let client: ProtocolClient;
      
      switch (config.mode) {
        case 'embedded':
          // Milestone 1: In-process server
          const server = await createCoreServer();
          client = new LoopbackProtocolClient(server);
          break;
          
        case 'local':
        case 'remote':
          // Milestone 2: WebSocket client
          const url = `ws://${config.host}:${config.port}`;
          client = new WebSocketProtocolClient(url);
          break;
          
        default:
          throw new Error(`Unknown server mode: ${config.mode}`);
      }
      
      // Setup tool execution handler
      const toolExecutor = new LocalToolExecutor();
      client.onToolRequest(async (request) => {
        return await toolExecutor.execute(request);
      });
      
      await client.connect();
      setProtocolClient(client);
    }
    
    initializeProtocol();
  }, []);
  
  // ... rest of component
}
```

## 2.4 Process Management Scripts

### Create `scripts/start-dev-split.js`
```javascript
#!/usr/bin/env node

/**
 * Development script to start CLI and server in separate processes
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

async function startDevSplit() {
  console.log('Starting Gemini CLI in split-process mode...');
  
  // Start server process
  const serverProcess = spawn('npm', ['run', 'start:server'], {
    cwd: join(rootDir, 'packages/core-server'),
    stdio: ['inherit', 'inherit', 'inherit'],
    env: { ...process.env, GEMINI_SERVER_PORT: '8080' }
  });
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Start CLI process
  const cliProcess = spawn('npm', ['start'], {
    cwd: join(rootDir, 'packages/cli'),
    stdio: ['inherit', 'inherit', 'inherit'],
    env: { 
      ...process.env, 
      GEMINI_SERVER_MODE: 'local',
      GEMINI_SERVER_PORT: '8080'
    }
  });
  
  // Handle shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down processes...');
    serverProcess.kill('SIGINT');
    cliProcess.kill('SIGINT');
    process.exit(0);
  });
  
  // Handle process exits
  serverProcess.on('exit', (code) => {
    console.log(`Server process exited with code ${code}`);
    cliProcess.kill('SIGINT');
  });
  
  cliProcess.on('exit', (code) => {
    console.log(`CLI process exited with code ${code}`);
    serverProcess.kill('SIGINT');
  });
}

startDevSplit().catch(console.error);
```

### Update root `package.json`
```json
{
  "scripts": {
    "start:dev:split": "node scripts/start-dev-split.js",
    "start:server": "npm run start:server --workspace packages/core-server",
    "start:cli:local": "GEMINI_SERVER_MODE=local npm start --workspace packages/cli"
  }
}
```

## 2.5 Testing Strategy

### Integration Tests
```javascript
// integration-tests/protocol-milestone2.test.js
import { test, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { WebSocketProtocolClient } from '@google/gemini-cli-core-protocol';

let serverProcess;

beforeAll(async () => {
  // Start server process
  serverProcess = spawn('npm', ['run', 'start:server'], {
    cwd: 'packages/core-server',
    env: { ...process.env, GEMINI_SERVER_PORT: '8081' }
  });
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 3000));
});

afterAll(async () => {
  if (serverProcess) {
    serverProcess.kill('SIGINT');
  }
});

test('milestone 2: separate process communication', async () => {
  const client = new WebSocketProtocolClient('ws://localhost:8081');
  await client.connect();
  
  const response = await client.generateContent({
    contents: [{ role: 'user', parts: [{ text: 'Hello from separate process!' }] }]
  });
  
  expect(response.candidates).toBeDefined();
  
  await client.disconnect();
});

test('milestone 2: tool execution across processes', async () => {
  const client = new WebSocketProtocolClient('ws://localhost:8081');
  
  // Mock file system for testing
  client.onToolRequest(async (request) => {
    if (request.tool === 'read_file' && request.parameters.path === 'test.txt') {
      return {
        id: generateId(),
        type: 'tool_execution_response',
        timestamp: Date.now(),
        requestId: request.id,
        result: { content: 'cross-process file content' }
      };
    }
    throw new Error(`Unknown tool: ${request.tool}`);
  });
  
  await client.connect();
  
  const response = await client.generateContent({
    contents: [{ role: 'user', parts: [{ text: 'Read test.txt' }] }]
  });
  
  expect(response.candidates[0].content.parts[0].text).toContain('cross-process file content');
  
  await client.disconnect();
});
```

## 2.6 Documentation Updates

### Update `docs/cli/configuration.md`
```markdown
## Server Configuration

### Server Modes

#### Embedded Mode (Default)
```bash
# Uses in-process protocol
GEMINI_SERVER_MODE=embedded gemini
```

#### Local Mode
```bash
# Connects to local server process
GEMINI_SERVER_MODE=local GEMINI_SERVER_PORT=8080 gemini
```

#### Remote Mode
```bash
# Connects to remote server
GEMINI_SERVER_MODE=remote GEMINI_SERVER_HOST=server.example.com GEMINI_SERVER_PORT=8080 gemini
```

### Starting Server Separately
```bash
# Start server process
npm run start:server

# In another terminal, start CLI
GEMINI_SERVER_MODE=local gemini
```
```

# Milestone 3: Remote Server Support

**Goal:** Enable CLI to connect to servers on different machines with authentication

## 3.1 Authentication Layer

### Create `packages/core-protocol/src/auth.ts`
```typescript
export interface AuthProvider {
  authenticate(): Promise<AuthToken>;
  refreshToken(token: AuthToken): Promise<AuthToken>;
  validateToken(token: AuthToken): Promise<boolean>;
}

export interface AuthToken {
  token: string;
  expiresAt: number;
  refreshToken?: string;
}

export class TokenAuthProvider implements AuthProvider {
  constructor(private staticToken: string) {}
  
  async authenticate(): Promise<AuthToken> {
    return {
      token: this.staticToken,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    };
  }
  
  async refreshToken(token: AuthToken): Promise<AuthToken> {
    // For static tokens, just return the same token
    return token;
  }
  
  async validateToken(token: AuthToken): Promise<boolean> {
    return token.token === this.staticToken && token.expiresAt > Date.now();
  }
}

export class OAuthAuthProvider implements AuthProvider {
  constructor(
    private clientId: string,
    private clientSecret: string,
    private authUrl: string
  ) {}
  
  async authenticate(): Promise<AuthToken> {
    // Implementation for OAuth flow
    // This would typically involve opening a browser for user consent
    throw new Error('OAuth authentication not yet implemented');
  }
  
  async refreshToken(token: AuthToken): Promise<AuthToken> {
    // Implementation for OAuth token refresh
    throw new Error('OAuth token refresh not yet implemented');
  }
  
  async validateToken(token: AuthToken): Promise<boolean> {
    // Implementation for OAuth token validation
    throw new Error('OAuth token validation not yet implemented');
  }
}
```

### Update `packages/core-protocol/src/websocket.ts`
```typescript
export class WebSocketProtocolClient extends ProtocolClient {
  private authProvider?: AuthProvider;
  private currentToken?: AuthToken;
  
  constructor(
    private serverUrl: string,
    authProvider?: AuthProvider
  ) {
    super();
    this.authProvider = authProvider;
  }
  
  async connect(): Promise<void> {
    // Authenticate if auth provider is configured
    if (this.authProvider) {
      this.currentToken = await this.authProvider.authenticate();
    }
    
    return new Promise((resolve, reject) => {
      const url = this.currentToken 
        ? `${this.serverUrl}?auth=${encodeURIComponent(this.currentToken.token)}`
        : this.serverUrl;
        
      this.ws = new WebSocket(url);
      
      // ... rest of connection logic
    });
  }
  
  private async ensureAuthenticated(): Promise<void> {
    if (!this.authProvider || !this.currentToken) return;
    
    // Check if token needs refresh
    if (this.currentToken.expiresAt - Date.now() < 5 * 60 * 1000) { // 5 minutes
      this.currentToken = await this.authProvider.refreshToken(this.currentToken);
    }
  }
  
  async sendMessage(message: ProtocolMessage): Promise<void> {
    await this.ensureAuthenticated();
    
    // Add auth info to message if available
    if (this.currentToken) {
      (message as any).auth = this.currentToken.token;
    }
    
    return super.sendMessage(message);
  }
}
```

## 3.2 Server Authentication

### Update `packages/core-server/src/auth/middleware.ts`
```typescript
export interface AuthMiddleware {
  authenticate(token: string): Promise<{ userId: string; permissions: string[] }>;
}

export class TokenAuthMiddleware implements AuthMiddleware {
  constructor(private validTokens: Map<string, { userId: string; permissions: string[] }>) {}
  
  async authenticate(token: string): Promise<{ userId: string; permissions: string[] }> {
    const user = this.validTokens.get(token);
    if (!user) {
      throw new Error('Invalid authentication token');
    }
    return user;
  }
}

export class ConfigBasedAuthMiddleware implements AuthMiddleware {
  private validTokens = new Map<string, { userId: string; permissions: string[] }>();
  
  constructor() {
    // Load tokens from environment or config file
    const authConfig = process.env.GEMINI_AUTH_CONFIG;
    if (authConfig) {
      const config = JSON.parse(authConfig);
      for (const [token, user] of Object.entries(config.tokens)) {
        this.validTokens.set(token, user as any);
      }
    }
  }
  
  async authenticate(token: string): Promise<{ userId: string; permissions: string[] }> {
    const user = this.validTokens.get(token);
    if (!user) {
      throw new Error('Invalid authentication token');
    }
    return user;
  }
}
```

### Update `packages/core-server/src/standalone.ts`
```typescript
import { ConfigBasedAuthMiddleware } from './auth/middleware.js';

async function startServer() {
  const port = parseInt(process.env.GEMINI_SERVER_PORT || '8080');
  const authEnabled = process.env.GEMINI_AUTH_ENABLED === 'true';
  
  const server = new WebSocketProtocolServer(port);
  const sessionManager = new SessionManager();
  const protocolHandler = new ProtocolHandler(sessionManager);
  
  // Setup authentication if enabled
  let authMiddleware: AuthMiddleware | undefined;
  if (authEnabled) {
    authMiddleware = new ConfigBasedAuthMiddleware();
    console.log('Authentication enabled');
  }
  
  // Setup connection handling with auth
  server.onConnection(async (clientId, authToken) => {
    if (authMiddleware && authToken) {
      try {
        const user = await authMiddleware.authenticate(authToken);
        sessionManager.setUserForClient(clientId, user);
        console.log(`Authenticated user ${user.userId} for client ${clientId}`);
      } catch (error) {
        console.error(`Authentication failed for client ${clientId}:`, error.message);
        server.disconnectClient(clientId);
        return;
      }
    } else if (authMiddleware) {
      console.error(`No auth token provided for client ${clientId}`);
      server.disconnectClient(clientId);
      return;
    }
  });
  
  // ... rest of setup
}
```

## 3.3 TLS/SSL Support

### Update `packages/core-protocol/src/websocketServer.ts`
```typescript
import https from 'https';
import fs from 'fs';

export interface TLSConfig {
  key: string;    // Path to private key file
  cert: string;   // Path to certificate file
  ca?: string;    // Path to CA certificate file
}

export class WebSocketProtocolServer extends ProtocolServer {
  constructor(
    private port: number,
    private tlsConfig?: TLSConfig
  ) {
    super();
  }
  
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      let server;
      
      if (this.tlsConfig) {
        // HTTPS server with TLS
        const httpsServer = https.createServer({
          key: fs.readFileSync(this.tlsConfig.key),
          cert: fs.readFileSync(this.tlsConfig.cert),
          ca: this.tlsConfig.ca ? fs.readFileSync(this.tlsConfig.ca) : undefined
        });
        
        this.wss = new WebSocketServer({ server: httpsServer });
        server = httpsServer;
      } else {
        // HTTP server
        this.wss = new WebSocketServer({ port: this.port });
        server = this.wss;
      }
      
      // ... rest of setup logic
      
      if (this.tlsConfig) {
        server.listen(this.port, () => {
          console.log(`Secure protocol server listening on port ${this.port}`);
          resolve();
        });
      } else {
        this.wss.on('listening', () => {
          console.log(`Protocol server listening on port ${this.port}`);
          resolve();
        });
      }
    });
  }
}
```

### Update client for secure connections
```typescript
export class WebSocketProtocolClient extends ProtocolClient {
  constructor(
    private serverUrl: string,
    private authProvider?: AuthProvider,
    private tlsConfig?: { rejectUnauthorized?: boolean }
  ) {
    super();
  }
  
  async connect(): Promise<void> {
    // ... authentication logic
    
    return new Promise((resolve, reject) => {
      const url = this.currentToken 
        ? `${this.serverUrl}?auth=${encodeURIComponent(this.currentToken.token)}`
        : this.serverUrl;
      
      const wsOptions = this.tlsConfig ? {
        rejectUnauthorized: this.tlsConfig.rejectUnauthorized ?? true
      } : undefined;
      
      this.ws = new WebSocket(url, wsOptions);
      
      // ... rest of connection logic
    });
  }
}
```

## 3.4 Configuration Management

### Create `packages/cli/src/config/serverProfiles.ts`
```typescript
export interface ServerProfile {
  name: string;
  host: string;
  port: number;
  secure: boolean;
  authentication: {
    method: 'none' | 'token' | 'oauth';
    token?: string;
    oauth?: {
      clientId: string;
      authUrl: string;
    };
  };
  tlsConfig?: {
    rejectUnauthorized: boolean;
    ca?: string;
  };
}

export class ServerProfileManager {
  private profiles: Map<string, ServerProfile> = new Map();
  private configPath: string;
  
  constructor(configPath?: string) {
    this.configPath = configPath || path.join(os.homedir(), '.gemini', 'servers.json');
    this.loadProfiles();
  }
  
  private loadProfiles(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        for (const profile of data.profiles) {
          this.profiles.set(profile.name, profile);
        }
      }
    } catch (error) {
      console.warn('Failed to load server profiles:', error.message);
    }
  }
  
  saveProfiles(): void {
    const data = {
      profiles: Array.from(this.profiles.values())
    };
    
    fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
    fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2));
  }
  
  addProfile(profile: ServerProfile): void {
    this.profiles.set(profile.name, profile);
    this.saveProfiles();
  }
  
  getProfile(name: string): ServerProfile | undefined {
    return this.profiles.get(name);
  }
  
  listProfiles(): ServerProfile[] {
    return Array.from(this.profiles.values());
  }
  
  removeProfile(name: string): boolean {
    const deleted = this.profiles.delete(name);
    if (deleted) {
      this.saveProfiles();
    }
    return deleted;
  }
}
```

### Add CLI commands for server management
```typescript
// packages/cli/src/ui/hooks/useServerCommand.ts
export function useServerCommand() {
  const profileManager = new ServerProfileManager();
  
  const handleServerCommand = useCallback(async (command: string, args: string[]) => {
    switch (command) {
      case 'list':
        const profiles = profileManager.listProfiles();
        console.log('Available server profiles:');
        profiles.forEach(profile => {
          console.log(`  ${profile.name}: ${profile.secure ? 'wss' : 'ws'}://${profile.host}:${profile.port}`);
        });
        break;
        
      case 'add':
        if (args.length < 3) {
          console.log('Usage: /server add <name> <host> <port> [--secure] [--token=<token>]');
          return;
        }
        
        const [name, host, portStr] = args;
        const port = parseInt(portStr);
        const secure = args.includes('--secure');
        const tokenArg = args.find(arg => arg.startsWith('--token='));
        const token = tokenArg ? tokenArg.split('=')[1] : undefined;
        
        const profile: ServerProfile = {
          name,
          host,
          port,
          secure,
          authentication: {
            method: token ? 'token' : 'none',
            token
          }
        };
        
        profileManager.addProfile(profile);
        console.log(`Added server profile: ${name}`);
        break;
        
      case 'connect':
        if (args.length < 1) {
          console.log('Usage: /server connect <profile-name>');
          return;
        }
        
        const profileName = args[0];
        const targetProfile = profileManager.getProfile(profileName);
        if (!targetProfile) {
          console.log(`Server profile '${profileName}' not found`);
          return;
        }
        
        // Trigger reconnection to new server
        await connectToServer(targetProfile);
        console.log(`Connected to server: ${profileName}`);
        break;
        
      default:
        console.log('Available server commands: list, add, connect');
    }
  }, [profileManager]);
  
  return { handleServerCommand };
}
```

## 3.5 Deployment Configuration

### Create `deploy/docker/Dockerfile.server`
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/core-server/package*.json ./packages/core-server/
COPY packages/core-protocol/package*.json ./packages/core-protocol/

# Install dependencies
RUN npm ci --only=production --workspaces

# Copy source code
COPY packages/core-server/dist ./packages/core-server/dist
COPY packages/core-protocol/dist ./packages/core-protocol/dist

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start server
CMD ["npm", "run", "start:server", "--workspace", "packages/core-server"]
```

### Create `deploy/docker/docker-compose.yml`
```yaml
version: '3.8'

services:
  gemini-server:
    build:
      context: ../../
      dockerfile: deploy/docker/Dockerfile.server
    ports:
      - "8080:8080"
    environment:
      - GEMINI_SERVER_PORT=8080
      - GEMINI_AUTH_ENABLED=true
      - GEMINI_AUTH_CONFIG=${GEMINI_AUTH_CONFIG}
      - GOOGLE_CLOUD_PROJECT=${GOOGLE_CLOUD_PROJECT}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    volumes:
      - ./certs:/app/certs:ro
      - ./config:/app/config:ro
    restart: unless-stopped
    
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - gemini-server
    restart: unless-stopped
```

### Create `deploy/nginx.conf`
```nginx
events {
    worker_connections 1024;
}

http {
    upstream gemini_server {
        server gemini-server:8080;
    }
    
    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name _;
        return 301 https://$host$request_uri;
    }
    
    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name _;
        
        ssl_certificate /etc/nginx/certs/server.crt;
        ssl_certificate_key /etc/nginx/certs/server.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        
        # WebSocket proxy
        location / {
            proxy_pass http://gemini_server;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # WebSocket timeout settings
            proxy_read_timeout 86400;
            proxy_send_timeout 86400;
        }
        
        # Health check endpoint
        location /health {
            proxy_pass http://gemini_server/health;
        }
    }
}
```

## 3.6 Testing Strategy

### Load Testing
```javascript
// integration-tests/load-test.js
import { test, expect } from 'vitest';
import { WebSocketProtocolClient } from '@google/gemini-cli-core-protocol';

test('milestone 3: concurrent client connections', async () => {
  const clientCount = 10;
  const clients = [];
  
  // Create multiple concurrent connections
  for (let i = 0; i < clientCount; i++) {
    const client = new WebSocketProtocolClient('wss://localhost:8443');
    clients.push(client);
  }
  
  // Connect all clients
  await Promise.all(clients.map(client => client.connect()));
  
  // Send concurrent requests
  const promises = clients.map(async (client, index) => {
    return client.generateContent({
      contents: [{ role: 'user', parts: [{ text: `Hello from client ${index}` }] }]
    });
  });
  
  const responses = await Promise.all(promises);
  
  // Verify all responses
  expect(responses).toHaveLength(clientCount);
  responses.forEach(response => {
    expect(response.candidates).toBeDefined();
  });
  
  // Disconnect all clients
  await Promise.all(clients.map(client => client.disconnect()));
});
```

### Security Testing
```javascript
// integration-tests/security-test.js
test('milestone 3: authentication required', async () => {
  const client = new WebSocketProtocolClient('wss://localhost:8443');
  
  // Attempt to connect without authentication
  await expect(client.connect()).rejects.toThrow('Authentication required');
});

test('milestone 3: invalid token rejected', async () => {
  const client = new WebSocketProtocolClient(
    'wss://localhost:8443',
    new TokenAuthProvider('invalid-token')
  );
  
  await expect(client.connect()).rejects.toThrow('Invalid authentication token');
});

test('milestone 3: valid token accepted', async () => {
  const client = new WebSocketProtocolClient(
    'wss://localhost:8443',
    new TokenAuthProvider(process.env.VALID_TEST_TOKEN)
  );
  
  await expect(client.connect()).resolves.not.toThrow();
  
  const response = await client.generateContent({
    contents: [{ role: 'user', parts: [{ text: 'Authenticated request' }] }]
  });
  
  expect(response.candidates).toBeDefined();
  
  await client.disconnect();
});
```

## 3.7 Documentation Updates

### Create `docs/deployment.md`
```markdown
# Gemini CLI Server Deployment

## Docker Deployment

### Building the Server Image
```bash
cd deploy/docker
docker-compose build
```

### Configuration
Create a `.env` file:
```bash
GEMINI_API_KEY=your_api_key_here
GOOGLE_CLOUD_PROJECT=your_project_id
GEMINI_AUTH_CONFIG={"tokens":{"your-secret-token":{"userId":"user1","permissions":["read","write"]}}}
```

### SSL Certificates
Place your SSL certificates in `deploy/docker/certs/`:
- `server.crt` - SSL certificate
- `server.key` - Private key

### Starting the Server
```bash
docker-compose up -d
```

## Client Configuration

### Connecting to Remote Server
```bash
# Add server profile
gemini
/server add production your-server.com 443 --secure --token=your-secret-token

# Connect to server
/server connect production
```

### Environment Variables
```bash
export GEMINI_SERVER_MODE=remote
export GEMINI_SERVER_HOST=your-server.com
export GEMINI_SERVER_PORT=443
export GEMINI_SERVER_TOKEN=your-secret-token
export GEMINI_SERVER_SECURE=true
```

## Security Considerations

### Authentication
- Use strong, randomly generated tokens
- Rotate tokens regularly
- Consider implementing OAuth2 for production use

### Network Security
- Always use TLS/SSL in production
- Configure firewall rules to limit access
- Consider VPN access for sensitive environments

### Monitoring
- Monitor server logs for authentication failures
- Set up alerts for unusual connection patterns
- Implement rate limiting to prevent abuse
```

### Update `docs/troubleshooting.md`
```markdown
## Server Connection Issues

### Connection Refused
- Verify server is running: `curl -k https://your-server.com/health`
- Check firewall rules
- Verify port is correct

### Authentication Failures
- Verify token is correct
- Check token hasn't expired
- Ensure server has correct auth configuration

### TLS/SSL Issues
- Verify certificate is valid: `openssl s_client -connect your-server.com:443`
- Check certificate chain
- Ensure client trusts the CA

### Performance Issues
- Monitor server resources (CPU, memory)
- Check network latency: `ping your-server.com`
- Consider scaling server horizontally
```

# Milestone 4: Testing and Documentation

**Goal:** Comprehensive testing suite and complete documentation

## 4.1 Comprehensive Test Suite

### Unit Tests for Protocol Layer
```javascript
// packages/core-protocol/src/__tests__/messages.test.ts
import { describe, test, expect } from 'vitest';
import { validateProtocolMessage, createGenerateContentRequest } from '../messages.js';

describe('Protocol Messages', () => {
  test('validates generate content request', () => {
    const message = createGenerateContentRequest({
      prompt: 'Hello, world!',
      history: [],
      config: {}
    });
    
    expect(validateProtocolMessage(message)).toBe(true);
    expect(message.type).toBe('generate_content_request');
    expect(message.id).toBeDefined();
    expect(message.timestamp).toBeGreaterThan(0);
  });
  
  test('rejects invalid message format', () => {
    const invalidMessage = { type: 'invalid' };
    expect(validateProtocolMessage(invalidMessage)).toBe(false);
  });
});
```

### Integration Tests for Tool Execution
```javascript
// integration-tests/tools-protocol.test.js
import { test, expect } from 'vitest';
import { LoopbackProtocolClient } from '@google/gemini-cli-core-protocol';
import { createCoreServer } from '@google/gemini-cli-core-server';
import { LocalToolExecutor } from '@google/gemini-cli/tools';
import fs from 'fs/promises';
import path from 'path';

test('file tools work through protocol', async () => {
  const testDir = './test-workspace';
  await fs.mkdir(testDir, { recursive: true });
  
  try {
    const server = await createCoreServer();
    const client = new LoopbackProtocolClient(server);
    const toolExecutor = new LocalToolExecutor(testDir);
    
    client.onToolRequest(async (request) => {
      return await toolExecutor.execute(request);
    });
    
    await client.connect();
    
    // Test write file
    const writeResponse = await client.generateContent({
      contents: [{ 
        role: 'user', 
        parts: [{ text: 'Write "Hello Protocol" to a file called test.txt' }] 
      }]
    });
    
    // Verify file was created
    const fileContent = await fs.readFile(path.join(testDir, 'test.txt'), 'utf8');
    expect(fileContent.trim()).toBe('Hello Protocol');
    
    // Test read file
    const readResponse = await client.generateContent({
      contents: [{ 
        role: 'user', 
        parts: [{ text: 'Read the contents of test.txt' }] 
      }]
    });
    
    expect(readResponse.candidates[0].content.parts[0].text).toContain('Hello Protocol');
    
  } finally {
    await fs.rm(testDir, { recursive: true, force: true });
  }
});

test('shell tools work through protocol', async () => {
  const server = await createCoreServer();
  const client = new LoopbackProtocolClient(server);
  const toolExecutor = new LocalToolExecutor();
  
  client.onToolRequest(async (request) => {
    return await toolExecutor.execute(request);
  });
  
  await client.connect();
  
  const response = await client.generateContent({
    contents: [{ 
      role: 'user', 
      parts: [{ text: 'Run the command "echo Hello Shell Protocol"' }] 
    }]
  });
  
  expect(response.candidates[0].content.parts[0].text).toContain('Hello Shell Protocol');
});
```

### End-to-End Tests
```javascript
// integration-tests/e2e-protocol.test.js
import { test, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { WebSocketProtocolClient, TokenAuthProvider } from '@google/gemini-cli-core-protocol';
import { LocalToolExecutor } from '@google/gemini-cli/tools';

let serverProcess;
const TEST_TOKEN = 'test-token-12345';

beforeAll(async () => {
  // Start server with test configuration
  serverProcess = spawn('npm', ['run', 'start:server'], {
    cwd: 'packages/core-server',
    env: { 
      ...process.env,
      GEMINI_SERVER_PORT: '8082',
      GEMINI_AUTH_ENABLED: 'true',
      GEMINI_AUTH_CONFIG: JSON.stringify({
        tokens: {
          [TEST_TOKEN]: { userId: 'test-user', permissions: ['read', 'write'] }
        }
      })
    }
  });
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 5000));
});

afterAll(async () => {
  if (serverProcess) {
    serverProcess.kill('SIGINT');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
});

test('full workflow: connect, authenticate, generate content, execute tools', async () => {
  const authProvider = new TokenAuthProvider(TEST_TOKEN);
  const client = new WebSocketProtocolClient('ws://localhost:8082', authProvider);
  const toolExecutor = new LocalToolExecutor();
  
  // Setup tool handling
  client.onToolRequest(async (request) => {
    console.log(`Executing tool: ${request.tool}`, request.parameters);
    return await toolExecutor.execute(request);
  });
  
  // Connect and authenticate
  await client.connect();
  
  // Test simple generation
  const simpleResponse = await client.generateContent({
    contents: [{ role: 'user', parts: [{ text: 'Say hello' }] }]
  });
  
  expect(simpleResponse.candidates).toBeDefined();
  expect(simpleResponse.candidates[0].content.parts[0].text).toBeTruthy();
  
  // Test streaming
  const streamingGenerator = client.generateContentStream({
    contents: [{ role: 'user', parts: [{ text: 'Count from 1 to 5' }] }]
  });
  
  const chunks = [];
  for await (const chunk of streamingGenerator) {
    chunks.push(chunk);
  }
  
  expect(chunks.length).toBeGreaterThan(0);
  
  // Test tool execution
  const toolResponse = await client.generateContent({
    contents: [{ 
      role: 'user', 
      parts: [{ text: 'Create a file called e2e-test.txt with the content "E2E Test Success"' }] 
    }]
  });
  
  // Verify tool was executed (the response should mention file creation)
  expect(toolResponse.candidates[0].content.parts[0].text).toMatch(/file|created|written/i);
  
  await client.disconnect();
});

test('authentication failure handling', async () => {
  const invalidAuthProvider = new TokenAuthProvider('invalid-token');
  const client = new WebSocketProtocolClient('ws://localhost:8082', invalidAuthProvider);
  
  await expect(client.connect()).rejects.toThrow(/auth/i);
});

test('connection recovery after server restart', async () => {
  const authProvider = new TokenAuthProvider(TEST_TOKEN);
  const client = new WebSocketProtocolClient('ws://localhost:8082', authProvider);
  
  await client.connect();
  
  // Test initial connection
  const response1 = await client.generateContent({
    contents: [{ role: 'user', parts: [{ text: 'First request' }] }]
  });
  expect(response1.candidates).toBeDefined();
  
  // Simulate server restart (kill and restart)
  serverProcess.kill('SIGTERM');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  serverProcess = spawn('npm', ['run', 'start:server'], {
    cwd: 'packages/core-server',
    env: { 
      ...process.env,
      GEMINI_SERVER_PORT: '8082',
      GEMINI_AUTH_ENABLED: 'true',
      GEMINI_AUTH_CONFIG: JSON.stringify({
        tokens: {
          [TEST_TOKEN]: { userId: 'test-user', permissions: ['read', 'write'] }
        }
      })
    }
  });
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Test reconnection (client should handle this automatically)
  await client.reconnect();
  
  const response2 = await client.generateContent({
    contents: [{ role: 'user', parts: [{ text: 'Second request after restart' }] }]
  });
  expect(response2.candidates).toBeDefined();
  
  await client.disconnect();
});
```

### Performance Tests
```javascript
// integration-tests/performance.test.js
import { test, expect } from 'vitest';

test('protocol overhead measurement', async () => {
  // Test direct core vs protocol overhead
  const iterations = 100;
  
  // Measure direct core performance
  const directTimes = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    // Direct core call (would need to set up)
    const end = performance.now();
    directTimes.push(end - start);
  }
  
  // Measure protocol performance
  const protocolTimes = [];
  const client = new LoopbackProtocolClient(server);
  await client.connect();
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await client.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Performance test' }] }]
    });
    const end = performance.now();
    protocolTimes.push(end - start);
  }
  
  const directAvg = directTimes.reduce((a, b) => a + b) / directTimes.length;
  const protocolAvg = protocolTimes.reduce((a, b) => a + b) / protocolTimes.length;
  
  console.log(`Direct average: ${directAvg}ms`);
  console.log(`Protocol average: ${protocolAvg}ms`);
  console.log(`Overhead: ${((protocolAvg - directAvg) / directAvg * 100).toFixed(2)}%`);
  
  // Protocol overhead should be reasonable (< 50%)
  expect(protocolAvg / directAvg).toBeLessThan(1.5);
});

test('concurrent request handling', async () => {
  const client = new WebSocketProtocolClient('ws://localhost:8082');
  await client.connect();
  
  const concurrentRequests = 20;
  const promises = [];
  
  const start = performance.now();
  
  for (let i = 0; i < concurrentRequests; i++) {
    promises.push(
      client.generateContent({
        contents: [{ role: 'user', parts: [{ text: `Concurrent request ${i}` }] }]
      })
    );
  }
  
  const responses = await Promise.all(promises);
  const end = performance.now();
  
  expect(responses).toHaveLength(concurrentRequests);
  responses.forEach(response => {
    expect(response.candidates).toBeDefined();
  });
  
  console.log(`${concurrentRequests} concurrent requests completed in ${end - start}ms`);
  console.log(`Average per request: ${(end - start) / concurrentRequests}ms`);
  
  await client.disconnect();
});
```

## 4.2 Documentation Suite

### Create `docs/protocol/`

#### `docs/protocol/overview.md`
```markdown
# Gemini CLI Protocol

## Introduction
The Gemini CLI protocol enables communication between the user interface and the agent logic, supporting both local and remote deployments.

## Architecture
```
┌─────────────────┐              ┌──────────────────┐
│ CLI Client      │◄────────────►│ Core Server      │
│ - UI            │   Protocol   │ - Agent Logic    │
│ - Tool Executor │   Messages   │ - LLM Interface  │
└─────────────────┘              └──────────────────┘
```

## Protocol Features
- Bidirectional WebSocket communication
- Authentication and authorization
- Tool execution proxying
- Streaming responses
- Session management
- Error handling and recovery

## Deployment Modes
1. **Embedded**: UI and server in same process (development)
2. **Local**: Separate processes on same machine
3. **Remote**: Client and server on different machines
```

#### `docs/protocol/messages.md`
```markdown
# Protocol Message Reference

## Message Structure
All protocol messages follow this base structure:
```json
{
  "id": "unique-message-id",
  "type": "message_type",
  "timestamp": 1234567890,
  "data": { ... }
}
```

## Client → Server Messages

### GenerateContentRequest
Requests content generation from the LLM.
```json
{
  "id": "req-001",
  "type": "generate_content_request",
  "timestamp": 1234567890,
  "contents": [...],
  "config": {...}
}
```

### ToolExecutionResponse
Provides the result of a tool execution.
```json
{
  "id": "resp-001", 
  "type": "tool_execution_response",
  "timestamp": 1234567890,
  "requestId": "tool-req-001",
  "result": {...},
  "error": null
}
```

## Server → Client Messages

### StreamingResponse
Streams generated content to the client.
```json
{
  "id": "stream-001",
  "type": "streaming_response", 
  "timestamp": 1234567890,
  "chunk": {...},
  "isComplete": false
}
```

### ToolExecutionRequest
Requests execution of a tool on the client.
```json
{
  "id": "tool-req-001",
  "type": "tool_execution_request",
  "timestamp": 1234567890,
  "tool": "read_file",
  "parameters": {...}
}
```

## Error Messages
```json
{
  "id": "error-001",
  "type": "error",
  "timestamp": 1234567890,
  "code": "AUTHENTICATION_FAILED",
  "message": "Invalid authentication token",
  "details": {...}
}
```
```

#### `docs/protocol/authentication.md`
```markdown
# Authentication

## Authentication Methods

### Token Authentication
Simple token-based authentication for development and testing.

```bash
# Environment variable
export GEMINI_SERVER_TOKEN=your-secret-token

# CLI command
/server add myserver localhost 8080 --token=your-secret-token
```

### OAuth2 (Future)
OAuth2 authentication for production environments.

## Token Management
- Tokens should be long, random strings
- Rotate tokens regularly
- Store tokens securely
- Use environment variables or secure config files

## Server Configuration
```json
{
  "authentication": {
    "enabled": true,
    "method": "token",
    "tokens": {
      "user-token-1": {
        "userId": "user1",
        "permissions": ["read", "write"]
      }
    }
  }
}
```
```

### Create `docs/development/`

#### `docs/development/contributing-protocol.md`
```markdown
# Contributing to Protocol Development

## Development Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Build packages: `npm run build`
4. Run tests: `npm test`

## Protocol Development Workflow

### Adding New Message Types
1. Define message type in `packages/core-protocol/src/types.ts`
2. Add validation in `packages/core-protocol/src/messages.ts`
3. Update client handling in `packages/core-protocol/src/client.ts`
4. Update server handling in `packages/core-server/src/protocol/handler.ts`
5. Add tests for the new message type
6. Update documentation

### Testing Protocol Changes
```bash
# Unit tests
npm run test --workspace packages/core-protocol

# Integration tests  
npm run test:integration

# End-to-end tests
npm run test:e2e
```

### Protocol Compatibility
- Maintain backward compatibility when possible
- Use versioning for breaking changes
- Document migration paths for major changes
```

#### `docs/development/debugging.md`
```markdown
# Debugging the Protocol

## Enabling Debug Logging
```bash
# Client side
export DEBUG=gemini:protocol:client

# Server side  
export DEBUG=gemini:protocol:server

# All protocol logging
export DEBUG=gemini:protocol:*
```

## Common Issues

### Connection Issues
1. Check server is running: `curl http://localhost:8080/health`
2. Verify port and host configuration
3. Check firewall settings
4. Review server logs for errors

### Authentication Problems
1. Verify token is correct
2. Check token hasn't expired
3. Ensure server auth configuration is correct
4. Review authentication logs

### Tool Execution Failures
1. Check tool is available on client
2. Verify tool parameters are correct
3. Check file permissions for file system tools
4. Review tool execution logs

## Debug Tools
- WebSocket debugging with browser dev tools
- Protocol message logging
- Performance profiling with Node.js profiler
- Memory usage monitoring
```

### Update Main Documentation

#### Update `docs/index.md`
```markdown
# Gemini CLI Documentation

## Getting Started
- [Quick Start](./quickstart.md)
- [Installation](./installation.md)
- [Configuration](./cli/configuration.md)

## Architecture
- [Overview](./architecture.md)
- [Protocol Architecture](./protocol/overview.md)
- [Tool System](./tools/index.md)

## CLI Usage
- [Commands](./cli/commands.md)
- [Themes](./cli/themes.md)
- [Authentication](./cli/authentication.md)

## Protocol Documentation
- [Protocol Overview](./protocol/overview.md)
- [Message Reference](./protocol/messages.md)
- [Authentication](./protocol/authentication.md)

## Deployment
- [Local Development](./development/setup.md)
- [Server Deployment](./deployment.md)
- [Docker Setup](./deployment-docker.md)

## Development
- [Contributing](./development/contributing.md)
- [Protocol Development](./development/contributing-protocol.md)
- [Debugging](./development/debugging.md)
- [Testing](./development/testing.md)
```

#### Create `docs/migration.md`
```markdown
# Migration Guide

## Migrating from Monolithic to Protocol Architecture

### For End Users
The protocol architecture is backward compatible. Existing CLI usage continues to work unchanged.

### For Developers

#### Code Changes Required
1. Replace direct core imports with protocol client
2. Update tool handling to use protocol messages
3. Configure server connection settings

#### Example Migration
```typescript
// Before (Milestone 0)
import { ContentGenerator } from '@google/gemini-cli-core';

const core = new ContentGenerator();
const response = await core.generateContent(request);

// After (Milestone 1+)
import { ProtocolClient } from '@google/gemini-cli-core-protocol';

const client = new ProtocolClient();
await client.connect();
const response = await client.generateContent(request);
```

### Configuration Changes
- Add server configuration to settings
- Configure authentication if using remote server
- Update environment variables for server mode

### Troubleshooting Migration
- Check server connectivity
- Verify authentication configuration
- Review protocol message logs
- Test tool execution functionality
```

## 4.3 Quality Assurance

### Code Quality Checks
```json
// .github/workflows/protocol-ci.yml
name: Protocol CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Build packages
      run: npm run build
      
    - name: Run unit tests
      run: npm run test
      
    - name: Run integration tests
      run: npm run test:integration
      
    - name: Run E2E tests
      run: npm run test:e2e
      
    - name: Check code coverage
      run: npm run test:coverage
      
    - name: Lint code
      run: npm run lint
      
    - name: Type check
      run: npm run typecheck
      
    - name: Security audit
      run: npm audit
```

### Performance Benchmarks
```javascript
// scripts/benchmark-protocol.js
import { performance } from 'perf_hooks';

async function benchmarkProtocol() {
  const results = {
    loopback: await benchmarkLoopback(),
    websocket: await benchmarkWebSocket(),
    concurrent: await benchmarkConcurrent()
  };
  
  console.log('Protocol Performance Benchmark Results:');
  console.table(results);
  
  // Fail if performance degrades significantly
  if (results.websocket.avgLatency > results.loopback.avgLatency * 2) {
    throw new Error('WebSocket protocol performance regression detected');
  }
}

benchmarkProtocol().catch(console.error);
```

### Security Audit
```javascript
// scripts/security-audit.js
import { execSync } from 'child_process';

function runSecurityAudit() {
  console.log('Running security audit...');
  
  // NPM audit
  execSync('npm audit --audit-level moderate', { stdio: 'inherit' });
  
  // Check for hardcoded secrets
  execSync('git secrets --scan', { stdio: 'inherit' });
  
  // Dependency vulnerability scan
  execSync('npm audit --json > audit-report.json');
  
  console.log('Security audit completed');
}

runSecurityAudit();
```

## Summary

This design document provides a comprehensive roadmap for decoupling the Gemini CLI UI from the agent logic through a protocol-based architecture. The implementation is broken down into manageable milestones:

1. **Milestone 1**: In-process protocol foundation with loopback communication
2. **Milestone 2**: Separate process architecture with WebSocket communication  
3. **Milestone 3**: Remote server support with authentication and TLS
4. **Milestone 4**: Comprehensive testing and documentation

Each milestone builds upon the previous one, allowing for incremental development and validation. The final architecture provides flexibility for deployment scenarios while maintaining backward compatibility and a rich development experience.

The protocol design ensures that tool execution remains local to the client machine, preserving security and file system access while enabling the agent logic to run remotely for scalability and resource management benefits.