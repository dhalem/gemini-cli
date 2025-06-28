# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- `npm run build` - Build all packages (core and cli)
- `npm run build:all` - Build everything including sandbox
- `npm run clean` - Clean all build artifacts
- `npm run typecheck` - Run TypeScript type checking across all packages
- `npm run lint` - Run ESLint with TypeScript extensions
- `npm run lint:fix` - Auto-fix linting issues
- `npm run format` - Format code with Prettier

### Testing
- `npm run test` - Run all tests across workspaces
- `npm run test:ci` - Run tests with coverage for CI
- `npm run test:e2e` - Run end-to-end tests
- `npm run test:integration:all` - Run all integration tests (none, docker, podman)
- `npm run test:integration:sandbox:none` - Integration tests without sandbox
- `npm run test:mcp` - Run MCP-specific tests with Vitest

### Quality Assurance
- `npm run preflight` - Complete CI pipeline: clean, install, format, lint, build, typecheck, test
- `npm start` - Start the development CLI
- `npm run debug` - Start CLI with Node.js debugger

## Architecture Overview

This is a monorepo with TypeScript packages managed through npm workspaces:

### Core Packages
1. **`packages/cli`** - User-facing terminal interface
   - React-based UI using Ink framework
   - Handles user input, history, themes, and display
   - Entry point: `packages/cli/src/gemini.tsx`
   - Main binary: `dist/index.js` (gemini command)

2. **`packages/core`** - Backend engine
   - API client for Google Gemini API
   - Tool registry and execution system
   - Session and conversation management
   - Core logic in `packages/core/src/core/`

3. **`packages/mcp`** - MCP (Model Context Protocol) integration
   - Private package for MCP server functionality

### Key Directories
- `packages/core/src/tools/` - Individual tool implementations (file system, shell, web, etc.)
- `packages/cli/src/ui/` - React components for terminal UI
- `integration-tests/` - End-to-end testing suite
- `scripts/` - Build and development automation scripts

### Tool System
The CLI extends Gemini's capabilities through tools that interact with:
- File system (read, write, edit, glob, grep)
- Shell commands
- Web fetching and search
- Memory management
- MCP servers
- Git operations

## Development Rules and Protocols

**Important**: This project follows strict development protocols defined in `RULES.md`:

1. **File Editing Protocol**: Always follow "read-write-verify" - read entire file, rewrite completely, verify changes
2. **Incremental Changes**: Make small changes and run `npm run preflight` after each modification
3. **Testing Requirements**: All integration tests must verify real-world functionality without mocks
4. **Planning Protocol**: For multi-step tasks, create/update `PLAN.md` with detailed implementation steps

## Authentication and Configuration

- Supports Google OAuth2 authentication and API keys
- Configuration stored in `packages/cli/src/config/`
- Sandbox execution supports Docker and Podman
- Multiple model support through `packages/core/src/config/models.ts`

## Build System

- Uses esbuild for fast compilation
- TypeScript with strict mode enabled
- Project references for efficient building
- Custom ESLint rules including cross-package import restrictions
- Workspaces allow independent package development

## Key File Patterns

- `*.test.ts` / `*.test.tsx` - Vitest unit tests
- `*.integration.test.ts` - Integration tests
- `eslint.config.js` - Flat ESLint configuration with TypeScript support
- `tsconfig.json` - Root TypeScript configuration with project references