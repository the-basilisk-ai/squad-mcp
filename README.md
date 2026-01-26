# Squad MCP Server

A remote MCP server that brings [Squad](https://meetsquad.ai) — the AI-powered product discovery and strategy platform — directly into your AI workflows. Connect Squad to Claude, ChatGPT, or any MCP-compatible AI assistant to research, ideate, and plan products without context switching.

## 🚀 Quick Start

### For Users

Connect Squad to your AI assistant in seconds:

**Claude Code:**

```bash
claude mcp add --transport http squad https://mcp.meetsquad.ai/mcp
```

On first use, you'll be prompted to authenticate via OAuth in your browser.

**Claude Connectors:**

- Coming soon to the Claude MCP directory

**ChatGPT:**

- Coming soon to the ChatGPT plugin store

**Other MCP Clients:**

Connect using `https://mcp.meetsquad.ai/mcp` - OAuth configuration is automatically discovered via the server's `.well-known/oauth-authorization-server` endpoint.

## ✨ Available Tools

The Squad MCP server provides 30+ tools across 6 categories:

| Category          | Tools                                                                                                     | Purpose                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **Opportunities** | `list_opportunities`, `get_opportunity`, `create_opportunity`, `update_opportunity`, `delete_opportunity` | Discover and refine product opportunities  |
| **Solutions**     | `list_solutions`, `get_solution`, `create_solution`, `update_solution`, `generate_solutions`              | Generate and iterate on solution ideas     |
| **Outcomes**      | `list_outcomes`, `get_outcome`, `create_outcome`, `update_outcome`                                        | Define and track desired business outcomes |
| **Knowledge**     | `list_knowledge`, `get_knowledge`, `create_knowledge`, `delete_knowledge`                                 | Store research, references, and insights   |
| **Feedback**      | `list_feedback`, `get_feedback`, `create_feedback`, `delete_feedback`                                     | Manage customer and stakeholder feedback   |
| **Workspace**     | `get_workspace`, `update_workspace`                                                                       | Configure workspace settings               |

### Tool Capabilities

All tools include:

- ✅ Safety annotations (`readOnlyHint` / `destructiveHint`)
- ✅ Structured JSON schemas for inputs/outputs
- ✅ User-isolated data access via OAuth
- ✅ Relationship management between entities

## 🏗️ Architecture

```
┌─────────────┐         OAuth          ┌──────────────┐
│  Claude /   │ ◄────────────────────► │  PropelAuth  │
│  ChatGPT    │    (Authentication)     │   (IdP)      │
└─────────────┘                         └──────────────┘
       │
       │ HTTPS + Bearer Token
       ▼
┌──────────────────────────────────────────────┐
│  Squad MCP Server                            │
│  ┌────────────────────────────────────────┐  │
│  │  OAuth Middleware → Validate Token     │  │
│  │  Session Store (Redis) → Manage State  │  │
│  │  MCP Handler → Execute Tools           │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
       │
       │ Squad API Calls
       ▼
┌──────────────┐
│  Squad API   │
└──────────────┘
```

## 📦 NPM Package

For programmatic access to Squad tools in your Node.js applications:

```bash
npm install @squadai/tools
```

```typescript
import { tools as squadTools } from "@squadai/tools";

// Use with Vercel AI SDK
const result = await generateText({
  model: anthropic("claude-3-5-sonnet-20241022"),
  tools: squadTools({
    jwt: "YOUR_JWT_TOKEN",
    orgId: "org-123",
    workspaceId: "ws-456",
  }),
  prompt: "List my current product opportunities",
});
```

## 🛠️ Development

This repository contains the source code for the Squad MCP remote server.

### Prerequisites

- Node.js 18+
- Yarn
- PropelAuth account (for OAuth2)
- Redis instance (optional for local development)
- Squad API credentials

### Local Setup

**Option 1: Quick Start (Local Node.js)**

```bash
# Clone repository
git clone https://github.com/the-basilisk-ai/squad-mcp.git
cd squad-mcp

# Install dependencies
yarn install

# Configure environment
cp .env.example .env
# Edit .env with your PropelAuth credentials
# Note: Redis is optional - omit REDIS_URL to use in-memory sessions

# Start development server with hot reload
yarn dev

# Server available at http://localhost:3232
```

**Option 2: Docker Compose (Production-like)**

```bash
# Configure environment
cp .env.example .env
# Edit .env with your PropelAuth credentials
# Note: REDIS_URL is automatically set by docker-compose

# Start server + Redis
docker-compose up

# Server available at http://localhost:3232
```

### Available Commands

```bash
yarn build              # Compile TypeScript
yarn dev                # Start dev server with hot reload
yarn start              # Start production server
yarn openapi:squad      # Regenerate API client from OpenAPI spec
yarn test               # Run test suite

# Docker commands
docker-compose up       # Start server + Redis
docker-compose down     # Stop and remove containers
docker-compose logs -f  # View logs
```

### Testing the Server

```bash
# Check health
curl http://localhost:3232/health

# Check OAuth discovery
curl http://localhost:3232/.well-known/oauth-authorization-server

# Test with MCP Inspector
npx @modelcontextprotocol/inspector
# Then connect to http://localhost:3232/mcp
```

### Running Tests

Tests run against the full HTTP server with Redis (via Docker Compose):

```bash
# Setup environment (if not already done)
cp .env.example .env
# Edit .env with your PropelAuth credentials and Squad API key

# Run tests (starts/stops Docker Compose automatically)
yarn test

# Watch mode for development
docker-compose up -d
yarn test:watch
# ... when done:
docker-compose down
```

**Note:** Tests use `SQUAD_API_KEY` from `.env` for authentication (not OAuth).

### Project Structure

```
squad-mcp/
├── src/
│   ├── http-server.ts          # Express server + MCP endpoints
│   ├── middleware/
│   │   └── oauth.ts            # PropelAuth OAuth validation
│   ├── handlers/
│   │   └── mcp.ts              # MCP protocol handler
│   ├── lib/
│   │   ├── session-store.ts    # Redis session management
│   │   └── clients/            # Squad API client
│   └── tools/                  # Tool implementations
│       ├── opportunity.ts
│       ├── solution.ts
│       ├── outcome.ts
│       └── ...
├── railway.toml                # Railway deployment config
└── .env.example                # Environment template
```

## 🏭 Production Deployment

This is a hosted service maintained by Squad. Users connect via OAuth - no self-hosting required.

**Architecture Notes (for contributors):**

- Single-instance deployment on Railway
- Follows [MCP specification](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) for stateful HTTP sessions
- In-memory transport storage (standard per MCP spec)
- Redis for session metadata persistence

## 🤝 Contributing

Contributions welcome! Please ensure:

- TypeScript builds without errors (`yarn build`)
- All tools include safety annotations
- OAuth context properly propagated
- Tests pass (when test suite is implemented)

## 📄 License

MIT

## 🔗 Links

- [Squad Platform](https://meetsquad.ai)
- [MCP Specification](https://modelcontextprotocol.io)
- [Claude Desktop](https://claude.ai/download)
- [Issue Tracker](https://github.com/the-basilisk-ai/squad-mcp/issues)
