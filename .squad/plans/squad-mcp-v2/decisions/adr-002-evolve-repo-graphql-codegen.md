# ADR-002: Evolve This Repo In Place; Replace OpenAPI Client with GraphQL Codegen
> Date: 2026-07-13 | Status: Accepted (long-term home is an open question)

## Context
v3 lives in this standalone repo with working OAuth wiring, Railway deployment, Redis stores, and the MCP Registry listing `ai.meetsquad/squad`. Its backend client is generated from the old REST API's OpenAPI spec, which no longer exists in the new product. The new API of record is Squad v2 GraphQL plus one REST ingest route.

## Decision
Evolve this repo to v4.0.0. Delete `src/lib/openapi/`, the generator config/scripts, and all OST tools. Add GraphQL Code Generator producing typed operations against the Squad v2 schema (introspected from a dev endpoint or a committed SDL snapshot). The MCP server defines its own `.graphql` operation documents — it does not import `@repo/graphql` from the monorepo.

## Alternatives Considered
| Option | Why Rejected |
|---|---|
| New repo / new registry listing | Loses listing continuity, OAuth client registrations, and deploy plumbing for no gain |
| Move server into the Squad v2 monorepo as an app | Real option (shared types, one CI) but heavier: drags mcp-use/React deps into the monorepo and couples deploy cadence; deferred as an open question in the PRD |
| Hand-written fetch against GraphQL | Silent drift when schema changes; codegen fails the build instead |
| Import `@repo/graphql` generated documents directly | Cross-repo package coupling; those documents are web-app-shaped (loaders, fragments) not MCP-shaped |

## Consequences
Easier: fast start (auth/deploy/registry untouched), schema drift caught at build. Harder: SDL snapshot must be refreshed when the Squad v2 schema changes (add a `codegen:check` CI step); two repos to touch when a tool needs new backend surface (explicitly tracked as Milestone 6).
