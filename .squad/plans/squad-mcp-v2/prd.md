# PRD: Squad v2 MCP Server (package v4.0.0)
> File: prd.md | Status: Draft — pending confirmation | Date: 2026-07-13

## Change History
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-07-13 | Initial draft, formatted from API-surface review |

## Problem Statement

The existing MCP server (`ai.meetsquad/squad`, v3.0.0, this repo) exposes the **old** Squad product: an Opportunity Solution Tree model (opportunities, solutions, outcomes, knowledge, feedback) via a generated OpenAPI client against `api.meetsquad.ai`. The new product (Squad v2) has a fundamentally different entity model — an evidence chain (**signals → clusters → insights → actions**), knowledge documents with versioning/provenance, decision briefs (one-pagers), goals + research questions, and autonomous agents. None of it is reachable through the current MCP server; every tool targets entities that no longer exist in the new product.

Cost of not solving: AI agents (Claude, Cursor, ChatGPT, support bots) cannot read from or write into Squad v2 at all. The three highest-value external-agent jobs are impossible today:
1. **Feedback in** — an agent that notices user feedback anywhere (support thread, GitHub issue, sales call summary) cannot pipe it into the evidence chain.
2. **Evidence out** — a coding or PM agent cannot ask "what are users telling us about X?" and get citable evidence.
3. **Close the loop** — an agent that ships work cannot mark the action done or link the artifact.

Evidence: the old server is listed on the MCP Registry and had working OAuth-based distribution (Claude connectors, Smithery, OpenAI Apps), so the channel exists; the product behind it moved.

## Goals

### Primary Goal
An external agent can complete the core loop unaided: pick up an action (`AC-N`), retrieve its full decision context (parent insight + supporting signals with citations + related goals) in **one tool call**, and write status back. Measured by a scripted end-to-end eval passing against a seeded workspace.

### Secondary Goals
- Feedback ingested via MCP lands in the signal pipeline identically to the in-app ingest path (same dedup, clustering, provenance).
- Tool surface stays ≤ ~30 tools with full MCP safety annotations, so clients can auto-approve reads and gate writes.
- Median "orientation cost" (calls needed before an agent does useful work in a fresh session) ≤ 2 tool calls (`get_workspace_overview`, then the task-specific call).
- MCP tool-call success rate (non-error responses) observable per tool via PostHog (`exploring-mcp-tool-usage` skill exists on the analytics side).

### Non-Goals
1. Rebuilding the old OST tool surface (opportunities/solutions) — those entities are gone.
2. Exposing raw GraphQL as a general-purpose tool in v4.0 (see ADR-001; a read-only escape hatch is a later phase).
3. Chat/conversation tools — Squad v2 chat is an in-app surface; external agents bring their own loop.
4. UI widgets (strategy tree / roadmap views) at launch — revisit after core tools ship (new analogs would be briefing/evidence-chain views).
5. Org/member administration, notifications management, gamification (Orbit/moons).

## User Personas & Scenarios

### Primary User
AI agents operated by Squad v2 customers (PMs and product engineers): Claude/ChatGPT sessions with the Squad connector, coding agents (Claude Code, Cursor), and headless automations. Technical level: the *human* may be non-technical; the tool surface must be self-describing enough for the agent to succeed without docs.

### Current Workflow
PM copies feedback into Squad v2 manually or relies on Slack/Notion integrations. Coding agents build features with no access to customer evidence. Status updates are manual in the web app.

### Future Workflow
1. Any agent session with the connector calls `get_workspace_overview` and is oriented.
2. Support/sales agents call `ingest_signal` the moment feedback appears anywhere.
3. A coding agent told "implement AC-12" calls `get_action_context`, builds with the customer evidence in front of it, links the PR, and calls `update_action_status(complete)`.
4. A PM's assistant runs the `weekly-product-review` prompt: overview → activity since last week → open actions → drafts a brief.

### User Stories
- As a support automation, when a customer describes a pain point, I want to `ingest_signal` with source metadata so the evidence chain captures it without human relay.
- As a coding agent, when I'm assigned an action, I want one call that returns the action, its insight, and the top supporting signals with quotes, so I build the right thing and can cite why.
- As a PM's assistant, when asked "what do users say about onboarding?", I want semantic `search` across signals/insights/documents so I answer with citations, not vibes.
- As any agent, when I join a session, I want workspace context resolved from my auth (with a `select_workspace` escape hatch) so I never guess tenant IDs.

## Functional Requirements

### Orientation & tenancy
- **P0** Tenant context resolved from auth; no org/workspace IDs in tool params; `list_workspaces` + `select_workspace` when ambiguous (carried over from v3).
- **P0** `get_workspace_overview`: mission/description, top goals, signal activity summary, chain health, open-action and pending-brief counts in one call.
- **P1** `update_workspace` (name, description, mission).

### Search & retrieval
- **P0** `get_entity`: polymorphic fetch by display ID (`SI-N`/`IN-N`/`AC-N`/`GL-N`) or UUID, with `include` expansions (evidence, goals, actions, provenance).
- **P0** `search` across signals, insights, documents, goals, actions, clusters with type filters. v1 may be text/command search; the tool contract must not change when semantic search lands (backend gap).
- **P1** `get_activity`: paginated audit stream filtered by entity type, actor type (human/agent), time window.

### Signals (feedback in)
- **P0** `ingest_signal`: single + batch, content + source + optional URL/author/timestamp; returns created-vs-deduplicated per item once backend supports it (P0 tool, P1 dedup response).
- **P0** `list_signals` (source, date range, cluster, dismissed filters; paginated).
- **P1** `find_similar_signals` (semantic; blocked on backend gap).
- **P1** `dismiss_signal` (noise tombstone; destructive-annotated).

### Clusters & insights
- **P0** `list_clusters`, `get_cluster` (with trimmed member signals + linked insights).
- **P0** `list_insights` (goal, score, date filters).
- **P1** `update_insight` (title/description edits; goal link/unlink). External insight *creation* is out of scope (bypasses the evidence pipeline).

### Actions
- **P0** `list_actions` (status, assignee, insight filters; ranked order).
- **P0** `get_action_context`: action + parent insight + top supporting signals with citation links + related goals (port of the internal agent bundle).
- **P0** `update_action_status`: enum `start | complete | dismiss | snooze` (+ snooze-until, dismiss reason).
- **P1** `update_action`: notes, assignment, entity links.

### Goals & research
- **P0** `list_goals` (importance, insight counts).
- **P1** `create_goal`, `update_goal`.
- **P1** `list_research_questions` (sufficiency filter), `create_research_question` (with duplicate check).
- **P2** `trigger_research` (async Inngest kickoff; returns run reference).

### Knowledge & decision briefs
- **P1** `list_documents` (directory browse, paginated), `get_document` (**markdown**, never block JSON).
- **P1** `create_document` (dedup-or-return-existing built in), `update_document` (versioned, markdown in).
- **P1** `list_one_pagers` (status/type/source filters), `generate_one_pager` (from action or insight; async).

### Prompts & resources
- **P1** MCP prompts: `triage-feedback`, `weekly-product-review`, `draft-decision-brief`, `ground-this-ticket`.
- **P1** MCP resources: `squad://workspace/context`, `squad://goals`.

### Squad-agent observability (phase 3, cross-repo)
- **P2** `list_agent_runs`, `get_report` — requires new backend read API.

### Error states (requirements, not afterthoughts)
- **P0** Workspace-selection-required error returns the org/workspace list so the model can self-recover (v3 pattern).
- **P0** All errors return actionable text (`isError: true`), never stack traces; 402 → credits message; 401/403 → reconnect message.
- **P0** Async triggers (`generate_one_pager`, `trigger_research`) return an ID pollable via `get_entity`; never fire-and-forget silently.

## Non-Functional Requirements
- **Performance:** reads p95 < 2s; `get_action_context` bundle p95 < 4s (composes multiple backend calls); list responses trimmed (id/displayId/title/status) with cursor pagination, default page ≤ 25.
- **Security:** OAuth 2.1 via PropelAuth (authorization_code + refresh); scopes `read:workspace`/`write:workspace` enforced per tool annotation; short-lived minted service JWT per user for backend calls; no tokens or tenant IDs ever in tool outputs.
- **Reliability:** stateless across restarts except workspace selection (Redis-backed when `REDIS_URL` set); tool errors never crash the session.
- **Scalability:** single Railway service as today; Redis session/stream stores before any horizontal scaling.

## Technical Constraints & Assumptions
- New backend is the Squad v2 monorepo: GraphQL (Pothos/Yoga, PropelAuth JWT + `x-workspace-id` header) + REST ingest (`POST /api/v1/signals`, org API key or JWT). **GraphQL does not accept org API keys today** — the minted-JWT pattern from v3 is assumed to carry over.
- Semantic cross-entity search, agent-run/report reads, signal-list filters, and idempotent ingest responses need **new backend surface** (tracked as Milestone 6, cross-repo in the Squad v2 monorepo — see technical-overview.md "Backend gaps").
- This repo keeps mcp-use/server, PropelAuth OAuth wiring, Railway deploy, and MCP Registry listing; the generated OpenAPI client and all OST tools are removed.
- Assumption at risk: display-ID prefixes (`SI-`, `IN-`, `AC-`, `GL-`) are stable and unambiguous per workspace — `get_entity` routing depends on it.

## UX Notes
The "UI" is tool names, descriptions, and response shapes:
- Verb-first snake_case names; descriptions state *when to use* and *what comes back*, ≤ 3 sentences.
- Every list response includes display IDs and a `nextCursor`; every entity response includes a deep link (`{appUrl}/{org}/{workspace}/...`).
- Empty results return a friendly message plus a suggested next tool (e.g. empty search → "try `list_clusters` to browse themes").
- Writes echo the resulting entity summary so the agent can confirm to its human.

## Infrastructure & Deployment
- **Deployment architecture:** this repo, Railway (`squad-mcp` project). During transition (ADR-007): frozen v3 deploys from a **`v1` branch** into a dedicated Railway environment (own service + own Redis) at `v1.mcp.meetsquad.ai/mcp`; main becomes the new (Squad v2) server with **`dev` + `production`** environments (matching Squad v2 API envs; today's `uat` retires with v3) and takes over **`mcp.meetsquad.ai/mcp`** at launch, validating pre-launch in the dev environment. Storybook service retired with the widgets unless revived later.
- **Service topology:** MCP server → Squad v2 GraphQL over HTTPS (minted JWT + `x-workspace-id`); → REST ingest for signals; no direct DB access.
- **Data storage:** none owned; Redis (existing) for MCP sessions/streams and workspace selection.
- **External dependencies:** PropelAuth (OAuth + token mint), Squad v2 API, MCP Registry.
- **Scaling:** vertical first; Redis-backed sessions are the precondition for replicas.
- **Platform:** Railway, env-switched by `SQUAD_ENV` (dev/staging/production) as today.

## Monitoring & Observability

### Metrics
- Per-tool: call count, error rate, p95 latency, response token size (PostHog `mcp` domain events; org/workspace as groups per o11y conventions).
- Funnel: sessions → orientation call → first substantive call → first write (measures whether the surface is learnable).
- Ingest: signals created via MCP vs other sources.

### Alerts
- Any tool error rate > 10% over 15 min; OAuth token-mint failures; backend 5xx spike from the MCP service.

### Logging
- Structured per tool call: tool, userId, orgId/workspaceId, duration, error class (never payload content — signal bodies are customer data).

## Out of Scope
1. Old OST entities and tools — product moved on.
2. Free-form GraphQL tool — rejected for v4.0 (ADR-001); read-only escape hatch reconsidered post-launch.
3. Widgets/OpenAI Apps views — after core tools prove out.
4. Org API-key auth for the full read surface — OAuth first; key-scoped headless reads are a later backend decision.
5. Notifications, org admin, gamification tools.

## Open Questions
| Question | Options | Owner | Must resolve by |
|---|---|---|---|
| Where does the new server live long-term? | Evolve this repo (ADR-002 default) / move into Squad v2 monorepo as an app | Steven | Before Milestone 1 |
| ~~GraphQL access for the minted service JWT~~ **Resolved:** old API accepted the same PropelAuth JWTs; exchange carries over. M1 Task 03 keeps a config sanity check. | — | Steven | Closed 2026-07-13 |
| Semantic search exposure | New GraphQL field / internal REST endpoint | Backend | Before Milestone 2 hardening (search v2) |
| v1 branch sunset criteria | Traffic threshold / fixed date | Steven | Post-launch |
| Insight creation by external agents | Never / allowed with mandatory cited signal IDs | Product | Post-launch |

## Phasing

### MVP Slice
Milestones 1–3: auth + orientation + the full read/write core loop (search v1, `get_entity`, signals in, evidence out, actions round-trip, goals). An agent can do all three headline jobs, with text search standing in for semantic.

### Phase 2
Milestone 4 (knowledge + briefs) and Milestone 5 (prompts, resources, evals, and the public cutover: the new server takes `mcp.meetsquad.ai`, registry listing bumps to 4.0.0, v3 remains at `v1.mcp.meetsquad.ai`).

### Phase 3
Milestone 6 backend gaps in the Squad v2 repo (semantic search, agent-runs/reports API, idempotent ingest, external-work linkage), then the MCP-side upgrades they unlock (`search` v2, `find_similar_signals`, `list_agent_runs`, `get_report`, PR-linkage on `update_action`).
