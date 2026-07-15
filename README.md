# Squad MCP Server

[![smithery badge](https://smithery.ai/badge/squadai/squad)](https://smithery.ai/servers/squadai/squad)

A remote MCP server that brings [Squad](https://meetsquad.ai) — the AI product feedback intelligence platform — directly into your AI workflows. Connect Squad to Claude, ChatGPT, or any MCP-compatible AI assistant to turn raw user feedback into signals, insights, actions, and decision briefs without context switching.

Squad continuously ingests feedback, clusters it into **signals**, distils it into **insights**, and links it to the **actions** and **goals** that move your product forward. The MCP server exposes that same intelligence — read the evidence behind a decision, capture new feedback, and generate decision briefs from your assistant.

## 🚀 Quick Start

### For Users

Connect Squad to your AI assistant in seconds:

**Claude Code:**

```bash
claude mcp add --transport http squad https://mcp.meetsquad.ai/mcp
```

On first use, you'll be prompted to authenticate via OAuth in your browser.

**Other MCP Clients:**

Connect using `https://mcp.meetsquad.ai/mcp` — OAuth configuration is automatically discovered via the server's `.well-known/oauth-protected-resource` metadata (which points clients at PropelAuth as the authorization server).

## 📖 Usage Examples

See **[USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md)** for detailed real-world examples. A few things you can ask:

- **Triage feedback** — "Capture this support ticket in Squad and tell me if it's a known theme."
- **Weekly review** — "Run my weekly product review: what changed and what needs deciding?"
- **Ground the evidence** — "Show me the customer signals behind insight IN-42."
- **Draft a decision brief** — "Generate a decision brief for action AC-12."
- **Search everything** — "Find all feedback related to onboarding friction."
- **Ground a ticket** — "Pull the customer evidence behind AC-7 before I build it."

Squad entities are referenced by short **display IDs** so the assistant can cite its evidence:

| Prefix | Entity          | Prefix | Entity            |
| ------ | --------------- | ------ | ----------------- |
| `SI-`  | Signal          | `GL-`  | Goal              |
| `CL-`  | Cluster         | `RQ-`  | Research question |
| `IN-`  | Insight         | `OP-`  | Decision brief    |
| `AC-`  | Action          | `DC-`  | Document          |

## ✨ Available Tools

The server exposes ~35 tools. Write tools require a token minted with the `write:workspace` scope; read tools only need `read:workspace`.

| Category         | Tools                                                                                                          | Purpose                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **Workspace**    | `list_workspaces`, `select_workspace`, `get_workspace_overview`, `update_workspace`, `list_members`            | Orient in and configure a workspace              |
| **Search**       | `search`, `get_entity`                                                                                          | Semantic search and fetch any entity by ID       |
| **Evidence**     | `list_signals`, `find_similar_signals`, `list_clusters`, `get_cluster`, `list_insights`                        | Explore signals, clusters, and insights          |
| **Actions**      | `list_actions`, `get_action_context`, `update_action`, `update_action_status`                                  | Track and update product work                    |
| **Strategy**     | `list_goals`, `create_goal`, `update_goal`, `list_research_questions`, `create_research_question`, `update_insight`, `dismiss_signal`, `get_activity` | Manage goals, research questions, and activity   |
| **Knowledge**    | `list_documents`, `create_document`, `update_document`                                                          | Store research, references, and notes            |
| **Decision briefs** | `list_one_pagers`, `generate_one_pager`, `update_one_pager_status`                                           | Generate and manage one-page decision briefs     |
| **Ingest**       | `ingest_signal`                                                                                                 | Capture new feedback as a signal (with dedup)    |
| **Integrations** | `list_integrations`                                                                                             | See connected feedback sources                   |

### Prompts

Ready-made workflows exposed as MCP prompts:

- **`triage-feedback`** — check for duplicates, ingest a piece of feedback, and report where it landed.
- **`weekly-product-review`** — what changed, what the evidence says, and what needs deciding.
- **`draft-decision-brief`** — generate a decision brief from an action or insight and walk it to a readable draft.
- **`ground-this-ticket`** — for coding agents: pull the customer evidence behind a piece of work before building it.

### Resources

Pin these so strategy questions need no tool calls:

- **`squad://workspace/context`** — the current workspace's mission and product context.
- **`squad://goals`** — the workspace's strategic goals with importance rankings.

### Tool Capabilities

- ✅ Safety annotations (`readOnlyHint` / `destructiveHint`) on every tool
- ✅ Structured Zod input schemas
- ✅ User- and workspace-isolated data access via OAuth
- ✅ Scope-gated writes (`write:workspace`)

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
│  │  OAuth → introspect + verify token     │  │
│  │  JWT minting → service credentials     │  │
│  │  Redis → sessions + stream state       │  │
│  │  MCP handler → tools / prompts / res.  │  │
│  │  PostHog → tool-call telemetry         │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
       │
       │ Squad API Calls (minted JWT)
       ▼
┌──────────────┐
│  Squad API   │
└──────────────┘
```

The server is built on [`mcp-use`](https://github.com/mcp-use/mcp-use) and talks to the Squad platform API over **GraphQL**. Sessions and stream state are backed by **Redis** so the deployment is horizontally scalable. Backend types are generated from a committed GraphQL schema snapshot (see [GraphQL codegen](#graphql-codegen)).

## 🛠️ Development

This repository contains the source code for the Squad MCP remote server.

### Prerequisites

- Node.js 22+
- Yarn
- Nix (optional, for a reproducible dev environment via `flake.nix`)
- PropelAuth credentials (OAuth 2.1 client + backend API key)
- Redis (optional locally; falls back to in-memory sessions)

### Local Setup

```bash
# Clone repository
git clone https://github.com/the-basilisk-ai/squad-mcp.git
cd squad-mcp

# Install dependencies
yarn install

# Configure environment
cp .env.example .env
# Edit .env with your PropelAuth credentials (and SQUAD_ENV=dev to target the dev platform)

# Start development server with hot reload
yarn dev

# Server available at http://localhost:3232
```

### Environment Variables

| Variable                                                          | Required | Purpose                                                        |
| ----------------------------------------------------------------- | -------- | -------------------------------------------------------------- |
| `PROPELAUTH_CLIENT_ID` / `PROPELAUTH_CLIENT_SECRET`               | ✅       | OAuth 2.1 client credentials for token introspection           |
| `PROPELAUTH_API_KEY`                                              | ✅       | Backend integration key for minting service JWTs               |
| `SQUAD_ENV`                                                       |          | `dev` or `production` (default `production`) — selects auth/API/app URLs |
| `PORT` / `MCP_URL` / `BASE_URI`                                   |          | Server port and externally-advertised base URL                 |
| `REDIS_URL`                                                       |          | Redis connection for deploy-safe sessions (in-memory if unset) |
| `SQUAD_GRAPHQL_URL`                                               |          | Override the Squad GraphQL endpoint (also used by codegen)     |
| `POSTHOG_API_KEY` / `POSTHOG_HOST`                                |          | Enable tool-call telemetry                                     |
| `LOG_LEVEL`                                                       |          | Logger verbosity                                               |

### Available Commands

```bash
yarn dev                # Start dev server with hot reload (mcp-use)
yarn build              # Build the server (mcp-use)
yarn start              # Start the built server
yarn deploy             # Deploy via mcp-use
yarn test               # Run unit tests (vitest)
yarn format             # Lint/format check (biome)
yarn format:fix         # Auto-fix lint/format issues
yarn codegen            # Regenerate GraphQL types from schema.graphql
yarn codegen:check      # Fail if generated GraphQL types are stale
```

### Testing the Server

```bash
# Check health
curl http://localhost:3232/health

# Check OAuth discovery
curl http://localhost:3232/.well-known/oauth-protected-resource

# Test with the built-in inspector
yarn dev   # then open the inspector and connect to http://localhost:3232/mcp
```

### Project Structure

```
squad-mcp/
├── server.ts                   # MCP server entry point (OAuth, Redis, tool/prompt/resource registration)
├── server.json                 # MCP registry metadata (see MCP_REGISTRY.md)
├── schema.graphql              # Committed snapshot of the Squad platform GraphQL schema
├── codegen.ts                  # GraphQL Code Generator config
├── src/
│   ├── tools/                  # Tool implementations, grouped by surface
│   │   ├── registry.ts         # Single registration path (annotations, errors, telemetry)
│   │   ├── workspace.ts        # list/select workspaces, overview, members
│   │   ├── search.ts           # semantic search
│   │   ├── get-entity.ts       # fetch any entity by display ID / UUID
│   │   ├── evidence.ts         # signals, clusters, insights
│   │   ├── actions-read.ts     # list actions, action context
│   │   ├── actions-write.ts    # update actions + status
│   │   ├── strategy-read.ts    # goals, research questions, activity
│   │   ├── strategy-write.ts   # create/update goals, insights, dismiss signals
│   │   ├── research-write.ts   # create research questions
│   │   ├── knowledge.ts        # documents + decision briefs (one-pagers)
│   │   ├── ingest.ts           # ingest new signals
│   │   └── integrations.ts     # list connected sources
│   ├── prompts/                # MCP prompt workflows
│   ├── resources/              # MCP resources (workspace context, goals)
│   ├── gql/                    # Generated GraphQL types (yarn codegen)
│   ├── graphql/                # GraphQL operation documents
│   ├── helpers/                # OAuth, token minting, workspace selection, KV/Redis
│   └── lib/                    # Squad API client, logger, telemetry
├── railway.toml                # Railway deployment config
└── .env.example                # Environment template
```

## 🏭 Production Deployment

This is a hosted service maintained by Squad. Users connect via OAuth — no self-hosting required.

**Architecture notes (for contributors):**

- Deployed on Railway with a `/health` readiness check
- Redis-backed sessions and stream state for horizontal scalability
- Follows the [MCP specification](https://modelcontextprotocol.io/specification) for streamable HTTP transport

## 💬 Support

Need help with the Squad MCP server?

- **Email:** support@meetsquad.ai
- **Documentation:**
  - [Squad MCP Guide](https://docs.meetsquad.ai/guides/squad-mcp) — complete setup and integration guide
  - [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md) — real-world usage examples
- **Issues:** [GitHub Issues](https://github.com/the-basilisk-ai/squad-mcp/issues) — bug reports and feature requests
- **Privacy Policy:** [meetsquad.ai/privacy-policy](https://meetsquad.ai/privacy-policy)
- **Squad Platform:** [meetsquad.ai](https://meetsquad.ai)

## 🤝 Contributing

Contributions welcome! Pre-commit hooks run biome and vitest automatically. Please ensure:

- `yarn format` passes (biome)
- `yarn build` compiles without errors
- `yarn test` passes
- `yarn codegen:check` passes if you touched GraphQL operations
- All tools include safety annotations

## 📄 License

MIT

## 🔗 Links

- [Squad MCP Documentation](https://docs.meetsquad.ai/guides/squad-mcp) — complete setup and integration guide
- [Squad Platform](https://meetsquad.ai)
- [MCP Specification](https://modelcontextprotocol.io)
- [Issue Tracker](https://github.com/the-basilisk-ai/squad-mcp/issues)

## GraphQL codegen

Backend access is typed via GraphQL Code Generator. `schema.graphql` is a
committed snapshot of the Squad platform API schema; `src/gql/` is generated
from it plus the operation documents in `src/graphql/`.

- Refresh the snapshot: copy `packages/graphql/src/schema/generated.graphql`
  from the API repo over `schema.graphql` (or set `SQUAD_GRAPHQL_URL` to
  introspect a live endpoint), then run `yarn codegen`.
- CI runs `yarn codegen:check` and fails when `src/gql/` is stale.
