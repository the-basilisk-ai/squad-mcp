# Technical Overview: Squad v2 MCP Server (package v4.0.0)
> Date: 2026-07-13 | Research areas: 2 (v3 server inventory, Squad v2 capability map)

## Summary

The new server evolves this repo in place: keep the proven shell (mcp-use/server, PropelAuth OAuth 2.1 with per-user minted service JWTs, Redis sessions, Railway, MCP Registry listing) and replace the entire tool surface and backend client. The OpenAPI client and all 40 OST-era tools go; in their place, ~30 job-oriented tools over the Squad v2 GraphQL API plus the REST ingest endpoint, organized around three agent jobs: **feedback in** (`ingest_signal`), **evidence out** (`search`, `get_entity`, `get_action_context`), and **close the loop** (`update_action_status`, links).

Tools are curated jobs, not a CRUD mirror and not raw GraphQL (ADR-001). Where the internal product agents already have a good tool shape (`getActionContextTool`, dedup-before-create documents, research dup-check), the new server ports that shape externally. Five capabilities need new backend surface in the Squad v2 monorepo (semantic search, agent-runs/reports API, signalList, idempotent ingest, artifact linkage); they are isolated in Milestone 6 so Milestones 1–5 ship entirely on existing surface.

## Architecture

```
MCP client (Claude / Cursor / ChatGPT)
  │ OAuth 2.1 (PropelAuth issuer, read:/write:workspace scopes)
  ▼
squad-mcp — new Squad v2 server (this repo, Railway, mcp-use/server + Hono)
  │ per-user minted service JWT (PropelAuth createAccessToken, cached)
  │ + x-workspace-id header (from selection context)
  ├────────► Squad v2 GraphQL  (all reads/writes except ingest)
  └────────► POST /api/v1/signals  (signal ingest)
```

Request flow per tool call: bearer introspection → user context (workspace selection or auto-select) → mint/reuse service JWT → typed GraphQL operation(s) → trim/compose response. Bundles like `get_action_context` compose multiple GraphQL queries server-side — one MCP call, N backend calls.

## Technology Decisions

| Decision | Chosen | Rationale | Alternatives Rejected |
|---|---|---|---|
| Tool model | ~30 curated, job-oriented tools | Context economy, safety annotations, HITL gating, telemetry per intent | Single free-form `graphql` tool (ADR-001); CRUD-per-entity mirror (v3's 40-tool tax) |
| Repo strategy | Evolve this repo, v4.0.0 | Keeps OAuth wiring, Railway, registry listing; monorepo stays MCP-free | New repo (loses listing continuity); app inside Squad v2 monorepo (open question, revisit post-launch) — ADR-002 |
| Legacy coexistence | v3 frozen on `v1` branch → `v1.mcp.meetsquad.ai`; main/the new server takes `mcp.meetsquad.ai` at launch | Main develops freely; instant rollback by repointing the domain; old customers keep working | In-place replacement (no rollback); the new server on a new domain (legacy shouldn't hold the primary) — ADR-007 |
| Backend client | GraphQL codegen (typed documents) replacing OpenAPI client | GraphQL is the new API of record; typed ops catch drift at build time | Hand-written fetch (drift); reusing `@repo/graphql` package directly (cross-repo coupling) — ADR-002 |
| Auth | OAuth 2.1 + minted service JWT (carry over v3) | Proven; GraphQL requires user JWTs; org API keys only reach ingest | API-key-only (read surface unreachable); forwarding user OAuth token (not accepted by backend) — ADR-003 |
| Tenancy | Implicit from auth + `select_workspace`; selection moved to Redis | v3 pattern works; in-memory selection was the one deploy-unsafe piece | Tenant IDs as tool params (leaks IDs, burns context, agents guess wrong) — ADR-004 |
| Entity access | Polymorphic `get_entity` on display IDs with `include` expansions | 1 tool replaces 6; typed prefixes make routing unambiguous | Per-entity `get_*` tools — ADR-005 |
| Response discipline | Cursor pagination everywhere, trimmed lists, markdown documents, deep links | Signal volumes make v3's dump-everything untenable; block JSON is agent-hostile | Full-object lists; BlockNote JSON passthrough — ADR-006 |

## Integration with Existing Systems

- **PropelAuth:** unchanged issuer/scopes/introspection; `mintToken.ts` and `with-auth.ts` retargeted to attach `x-workspace-id`.
- **Squad v2 GraphQL:** single-entity queries already accept display IDs; `commandSearchEntities` + `documentSearch` back search v1; `documentMarkdownExport` backs `get_document`; `activityStream` backs `get_activity`; one-pager generate/retry/cancel mutations back `generate_one_pager`.
- **Ingest REST:** `ingest_signal` posts with the user's minted JWT (same route accepts JWT; API-key path remains for headless later).
- **Observability:** PostHog events per tool call (org/workspace as groups, primitive props, no signal content) per the Squad v2 o11y conventions; existing `exploring-mcp-tool-usage` analysis skills apply.
- **MCP Registry:** in-place version bump of `ai.meetsquad/squad` via MCP_REGISTRY.md process (open question on renaming).

## Key Implementation Patterns

1. **Context bundle**: `get_action_context(actionId)` → parallel GraphQL fetches (action, parent insight, top-N signals w/ source links, linked goals) → one composed markdown-ish payload with display IDs and deep links.
2. **Dedup-or-return**: `create_document` runs `documentSearch`/similarity first; near-match returns the existing doc with `deduplicated: true` instead of creating. Same pattern for `create_research_question`.
3. **Enum-collapsed verbs**: `update_action_status(actionId, status: start|complete|dismiss|snooze, ...)` fans out to the four GraphQL mutations internally.
4. **Async trigger contract**: trigger tools return `{ id, status: "generating", checkWith: "get_entity" }`; never silent fire-and-forget.
5. **List trimming + cursor**: shared `listResponse(items, {cursor, total})` helper enforcing id/displayId/title/status shape and `nextCursor`.
6. **Search contract stability**: `search(query, types?, limit?)` shape fixed now; v1 backend = command/text search, v2 swaps in the semantic endpoint without tool-schema change.

## Risks & Unknowns

| Risk | Impact | Mitigation |
|---|---|---|
| Minted service JWT rejected by `createGraphQLContext` (LOW — old API accepted the same PropelAuth JWTs; exchange carries over) | Would block everything | M1 Task 03 sanity check catches env/issuer config differences; fallback is a small backend auth tweak (cross-repo) |
| No GraphQL `signalList` | `list_signals` P0 degraded | Confirm during M2; if absent, promote to Milestone 6 item and ship signal access via clusters/insight evidence meanwhile |
| Text-only search v1 underwhelms | Weak first impression of flagship tool | Honest tool description ("keyword search; semantic coming"), prioritize M6 search endpoint |
| Display-ID collisions/ambiguity in `get_entity` | Wrong-entity reads | Strict prefix routing; UUIDs always accepted; error lists valid prefixes |
| Tool descriptions drift from behavior (v3 disease) | Agent failure loops | Evals in M5 exercise every tool against a seeded workspace; USAGE examples generated from eval transcripts |
| Response payloads blow client context | Degraded agent performance | Trim helpers + page caps enforced in one place; token-size metric per tool in PostHog |
