# Squad MCP Server

[![smithery badge](https://smithery.ai/badge/squadai/squad)](https://smithery.ai/servers/squadai/squad)

A remote MCP server that brings [Squad](https://meetsquad.ai) — the AI product feedback intelligence platform — directly into your AI workflows. Connect Squad to Claude, ChatGPT, or any MCP-compatible AI assistant to turn raw user feedback into signals, insights, actions, and briefs without context switching.

Squad continuously ingests feedback, clusters it into **signals**, distils it into **insights**, and links it to the **actions** and **goals** that move your product forward. The MCP server exposes that same intelligence — read the evidence behind a decision, capture new feedback, and generate briefs from your assistant.

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
- **Draft a brief** — "Generate a brief for action AC-12."
- **Search everything** — "Find all feedback related to onboarding friction."
- **Ground a ticket** — "Pull the customer evidence behind AC-7 before I build it."

Squad entities are referenced by short **display IDs** so the assistant can cite its evidence:

| Prefix | Entity          | Prefix | Entity            |
| ------ | --------------- | ------ | ----------------- |
| `SI-`  | Signal          | `GL-`  | Goal              |
| `IN-`  | Insight         | `BR-`  | Brief             |
| `AC-`  | Action          | `DC-`  | Document          |
| `CL-`  | Cluster         |        |                   |

## Tools

The server exposes 30 tools. Write tools require a token minted with the `write:workspace` scope; read tools only need `read:workspace`.

- `list_workspaces` — List every organisation and workspace you can access, with the current selection marked.
- `select_workspace` — Select which organisation and workspace subsequent tools operate on.
- `get_workspace_overview` — One-call orientation: mission and description, top goals, recent signal activity, evidence-chain health, and open work counts.
- `update_workspace` — Update the current workspace's name, description, mission statement or logo.
- `list_members` — People in the current organisation with their user IDs.
- `search` — Keyword search across signals, insights, actions, goals, documents and clusters.
- `get_entity` — Fetch any entity by display ID (`SI-1`, `IN-1`, `AC-1`, `GL-1`, `BR-1`, `DC-1`, `CL-1`) or UUID. Also how you check on async work.
- `list_signals` — Browse raw feedback signals with filters for source, type, sentiment, cluster and date range.
- `find_similar_signals` — Semantically related signals for a given signal — "has anyone else said this?".
- `list_clusters` — Browse signal clusters (recurring themes in feedback) with sizes and labels.
- `get_cluster` — A cluster's label, stats, member signals and linked insights.
- `list_insights` — Browse distilled insights ranked by combined score, with category/score/status filters or scoped to a goal.
- `list_actions` — Ranked actions (what the evidence says to do next) filtered by status, assignee, priority or parent insight.
- `get_action_context` — Everything needed to execute an action in one call: the action, the parent insight, the customer evidence behind it, and the goals it serves.
- `update_action` — Edit an action's priority, effort, category or notes; assign it; or link it to an insight or brief.
- `update_action_status` — Move an action through its lifecycle: start, complete, dismiss or snooze.
- `list_goals` — Strategic goals ordered by importance.
- `create_goal` — Create a strategic goal.
- `update_goal` — Update a goal's title, description or importance.
- `update_insight` — Curate an insight: set category or status, and link/unlink the goal it supports.
- `dismiss_signal` — Permanently remove a signal from the workspace (noise, spam, or mis-ingested content).
- `get_activity` — The workspace change feed (humans and Squad agents), newest first.
- `list_documents` — Browse workspace knowledge documents (and briefs) with their paths and tags.
- `create_document` — Create a knowledge document from markdown (research summaries, meeting notes, analyses).
- `update_document` — Replace a document's markdown body and/or title, and manage tags.
- `list_briefs` — Briefs with their status (building/draft/in_review/finalised/failed) and recommendation.
- `generate_brief` — Kick off AI generation of a brief from an action or insight.
- `update_brief_status` — Move a brief through its review lifecycle: draft, in_review, or finalised.
- `ingest_signal` — Pipe user feedback into the evidence chain (1–50 items, deduplicated server-side).
- `list_integrations` — Connected feedback sources for this workspace and their sync health.

### Prompts

Ready-made workflows exposed as MCP prompts:

- **`triage-feedback`** — check for duplicates, ingest a piece of feedback, and report where it landed.
- **`weekly-product-review`** — what changed, what the evidence says, and what needs deciding.
- **`draft-decision-brief`** — generate a brief from an action or insight and walk it to a readable draft.
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
│  │  Redis → workspace selection + tokens  │  │
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

The server is built on [`mcp-use`](https://github.com/mcp-use/mcp-use) v2 and talks to the Squad platform API over **GraphQL**. Each request is served statelessly: the MCP layer holds no session, and every call re-introspects its own bearer token. **Redis** stores the durable per-user state (workspace selection and minted-token cache), so any instance can serve any request. Backend types are generated from a committed GraphQL schema snapshot (see [GraphQL codegen](#graphql-codegen)).

## 🛠️ Development

This repository contains the source code for the Squad MCP remote server.

### Prerequisites

- Node.js 22+
- pnpm
- Nix (optional, for a reproducible dev environment via `flake.nix`)
- PropelAuth credentials (OAuth 2.1 client + backend API key)
- Redis (optional locally; workspace selection falls back to in-memory)

### Local Setup

```bash
# Clone repository
git clone https://github.com/the-basilisk-ai/squad-mcp.git
cd squad-mcp

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your PropelAuth credentials (and SQUAD_ENV=dev to target the dev platform)

# Start development server with hot reload
pnpm dev

# Server available at http://localhost:3232
```

### Environment Variables

| Variable                                                          | Required | Purpose                                                        |
| ----------------------------------------------------------------- | -------- | -------------------------------------------------------------- |
| `PROPELAUTH_CLIENT_ID` / `PROPELAUTH_CLIENT_SECRET`               | ✅       | OAuth 2.1 client credentials for token introspection           |
| `PROPELAUTH_API_KEY`                                              | ✅       | Backend integration key for minting service JWTs               |
| `SQUAD_ENV`                                                       |          | `dev` or `production` (default `production`) — selects auth/API/app URLs |
| `PORT` / `MCP_URL` / `BASE_URI`                                   |          | Server port and externally-advertised base URL                 |
| `REDIS_URL`                                                       |          | Redis connection for deploy-safe workspace selection and token cache (in-memory if unset) |
| `SQUAD_GRAPHQL_URL`                                               |          | Override the Squad GraphQL endpoint (also used by codegen)     |
| `POSTHOG_API_KEY` / `POSTHOG_HOST`                                |          | Enable tool-call telemetry                                     |
| `LOG_LEVEL`                                                       |          | Logger verbosity                                               |

### Available Commands

```bash
pnpm dev                # Start dev server with hot reload (mcp-use)
pnpm build              # Build the server (mcp-use)
pnpm start              # Start the built server
pnpm deploy             # Deploy via mcp-use
pnpm test               # Run unit tests (vitest)
pnpm format             # Lint/format check (biome)
pnpm format:fix         # Auto-fix lint/format issues
pnpm codegen            # Regenerate GraphQL types from schema.graphql
pnpm codegen:check      # Fail if generated GraphQL types are stale
```

### Testing the Server

```bash
# Check health
curl http://localhost:3232/health

# Check OAuth discovery
curl http://localhost:3232/.well-known/oauth-protected-resource

# Test with the built-in inspector
pnpm dev   # then open the inspector and connect to http://localhost:3232/mcp
```

### Project Structure

```
squad-mcp/
├── server.ts                   # MCP server entry point (OAuth, tool/prompt/resource registration)
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
│   │   ├── strategy-read.ts    # goals, activity
│   │   ├── strategy-write.ts   # create/update goals, insights, dismiss signals
│   │   ├── knowledge.ts        # documents + briefs
│   │   ├── ingest.ts           # ingest new signals
│   │   └── integrations.ts     # list connected sources
│   ├── prompts/                # MCP prompt workflows
│   ├── resources/              # MCP resources (workspace context, goals)
│   ├── gql/                    # Generated GraphQL types (pnpm codegen)
│   ├── graphql/                # GraphQL operation documents
│   ├── helpers/                # OAuth provider, token minting, workspace selection, KV/Redis
│   └── lib/                    # Squad API client, logger, telemetry
├── railway.toml                # Railway deployment config
└── .env.example                # Environment template
```

## 🏭 Production Deployment

This is a hosted service maintained by Squad. Users connect via OAuth — no self-hosting required.

**Architecture notes (for contributors):**

- Deployed on Railway with a `/health` readiness check
- Stateless request handling, with Redis holding the per-user workspace selection and token cache, so instances scale horizontally
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

- `pnpm format` passes (biome)
- `pnpm build` compiles without errors
- `pnpm test` passes
- `pnpm codegen:check` passes if you touched GraphQL operations
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
  introspect a live endpoint), then run `pnpm codegen`.
- CI runs `pnpm codegen:check` and fails when `src/gql/` is stale.
