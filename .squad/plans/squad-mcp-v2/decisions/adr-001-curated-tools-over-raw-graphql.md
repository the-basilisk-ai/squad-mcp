# ADR-001: Curated Job-Oriented Tools, Not a Free-Form GraphQL Tool
> Date: 2026-07-13 | Status: Accepted

## Context
The new backend is GraphQL, so a single `graphql(query)` tool would give agents full expressivity with zero server-side tool maintenance. This was explicitly considered and debated.

## Decision
Ship ~30 curated, job-oriented tools. No free-form GraphQL tool in v4.0. A **read-only** `graphql_query` escape hatch (queries only, depth/complexity limits, schema exposed as an MCP resource) may be added post-launch as a power-user backdoor.

## Alternatives Considered
| Option | Why Rejected |
|---|---|
| Single free-form `graphql` tool | Schema discovery burns client context/turns (large web-app-shaped SDL or introspection loops); invalid-query retry tax; one tool can't carry read/destructive annotations so clients prompt on everything or nothing; scope enforcement becomes AST parsing; no intent-level telemetry; and our best tools (semantic `search`, `ingest_signal` REST, markdown `get_document`, `get_action_context` bundle) don't map to single GraphQL operations anyway |
| Predefined/persisted GraphQL operations exposed 1:1 as tools | Better, but still mirrors the web-app schema rather than agent jobs; loses bundling and response transformation |
| CRUD-per-entity mirror (v3 approach) | 40-tool context tax, no workflow encoding, proven weaknesses documented in research/old-server-inventory.md |

## Consequences
Easier: client safety gating (auto-approve reads), per-intent analytics/evals, prompt authoring, description-level product iteration. Harder: long-tail ad-hoc queries unserved until the escape hatch ships; server code per tool to maintain (mitigated by shared helpers and typed codegen). Precedent: GitHub/Linear/Notion ship curated tools over full APIs; Apollo's GraphQL MCP server defaults to predefined operations.
