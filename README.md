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

## 📖 Usage Examples

See **[USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md)** for detailed real-world examples including:

- **Discover opportunities** - "What opportunities are in my workspace?"
- **Explore solutions** - "Show me solutions for [opportunity] with pros/cons"
- **Strategic alignment** - "How do my solutions map to business goals?" (OST view)
- **Generate ideas** - "Generate solution ideas for [opportunity]"
- **Search everything** - "Find all content related to compliance"
- **Create opportunities** - "Create a new opportunity for [customer pain point]"

Each example shows the actual user prompt, which tools get called behind the scenes, and the expected output based on real Squad data.

## ✨ Available Tools

The Squad MCP server provides 30+ tools across 9 categories:

| Category          | Tools                                                                                                                                             | Purpose                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **Opportunities** | `list_opportunities`, `get_opportunity`, `create_opportunity`, `update_opportunity`, `delete_opportunity`, `generate_solutions`, `manage_opportunity_relationships` | Discover and refine product opportunities |
| **Solutions**     | `list_solutions`, `get_solution`, `create_solution`, `update_solution`, `delete_solution`, `manage_solution_relationships`, `prioritise_solutions` | Generate and iterate on solution ideas       |
| **Goals**         | `list_goals`, `get_goal`, `create_goal`, `update_goal`, `delete_goal`, `manage_goal_relationships`                                                | Define and track business objectives         |
| **Knowledge**     | `list_knowledge`, `get_knowledge`, `create_knowledge`, `delete_knowledge`                                                                         | Store research, references, and insights     |
| **Feedback**      | `list_feedback`, `get_feedback`, `create_feedback`, `delete_feedback`                                                                             | Manage customer and stakeholder feedback     |
| **Insights**      | `list_insights`, `get_insight`, `create_insight`, `delete_insight`                                                                                | Track customer insights and feature requests |
| **Workspace**     | `list_workspaces`, `select_workspace`, `get_workspace`, `update_workspace`                                                                        | Configure workspace settings                 |
| **Search**        | `similarity_search`                                                                                                                               | Semantic search across all entities          |
| **Views**         | `view_strategy_context`, `view_roadmap`                                                                                                           | Rich visual strategy and roadmap widgets     |

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
│  │  Session Store → Manage State          │  │
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
- Squad API credentials

### Local Setup

```bash
# Clone repository
git clone https://github.com/the-basilisk-ai/squad-mcp.git
cd squad-mcp

# Install dependencies
yarn install

# Configure environment
cp .env.example .env
# Edit .env with your PropelAuth credentials

# Start development server with hot reload
yarn dev

# Server available at http://localhost:3232
```

### Available Commands

```bash
yarn build              # Compile TypeScript
yarn dev                # Start dev server with hot reload
yarn start              # Start production server
yarn openapi:squad      # Regenerate API client from OpenAPI spec
yarn storybook          # Run Storybook for widget development
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

### Project Structure

```
squad-mcp/
├── index.ts                    # MCP server entry point with OAuth
├── server.json                 # MCP registry metadata
├── src/
│   ├── client.ts               # MCP client export
│   ├── helpers/
│   │   ├── config.ts           # Environment configuration
│   │   └── getUser.ts          # OAuth context + workspace selection
│   ├── lib/
│   │   ├── logger.ts           # Structured logging
│   │   └── clients/
│   │       ├── squad.ts        # Squad API client factory
│   │       └── middleware/     # Bearer token middleware
│   └── tools/                  # Tool implementations
│       ├── opportunity.ts
│       ├── solution.ts
│       ├── goal.ts
│       ├── knowledge.ts
│       ├── feedback.ts
│       ├── insight.ts
│       ├── workspace.ts
│       ├── search.ts
│       ├── views.ts
│       └── helpers.ts
├── resources/                  # React widget components
│   ├── view-strategy-context/
│   └── view-roadmap/
├── railway.toml                # Railway deployment config
└── .env.example                # Environment template
```

## 🏭 Production Deployment

This is a hosted service maintained by Squad. Users connect via OAuth - no self-hosting required.

**Architecture Notes (for contributors):**

- Single-instance deployment on Railway
- Follows [MCP specification](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) for stateful HTTP sessions
- In-memory transport storage (standard per MCP spec)

## 💬 Support

Need help with the Squad MCP server?

- **Email:** support@meetsquad.ai
- **Documentation:**
  - [Squad MCP Guide](https://docs.meetsquad.ai/guides/squad-mcp) - Complete setup and integration guide
  - [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md) - Real-world usage examples
- **Issues:** [GitHub Issues](https://github.com/the-basilisk-ai/squad-mcp/issues) - Bug reports and feature requests
- **Privacy Policy:** [meetsquad.ai/privacy-policy](https://meetsquad.ai/privacy-policy)
- **Squad Platform:** [meetsquad.ai](https://meetsquad.ai) - Learn about Opportunity Solution Trees

## 🤝 Contributing

Contributions welcome! Please ensure:

- TypeScript builds without errors (`yarn build`)
- All tools include safety annotations
- OAuth context properly propagated
- Server starts and responds to health checks

## 📄 License

MIT

## 🔗 Links

- [Squad MCP Documentation](https://docs.meetsquad.ai/guides/squad-mcp) - Complete setup and integration guide
- [Squad Platform](https://meetsquad.ai)
- [MCP Specification](https://modelcontextprotocol.io)
- [Claude Desktop](https://claude.ai/download)
- [Issue Tracker](https://github.com/the-basilisk-ai/squad-mcp/issues)
