# ADR-004: Implicit Tenant Context with Redis-Backed Workspace Selection
> Date: 2026-07-13 | Status: Accepted

## Context
Every Squad v2 operation is workspace-scoped. v3 proved that keeping org/workspace IDs out of tool parameters works well: agents never guess tenant IDs, tool schemas stay small, and cross-tenant mistakes are structurally impossible. v3's weakness was storing the user's workspace selection in in-memory maps — selections vanish on restart and don't survive horizontal scaling.

## Decision
Keep implicit tenancy: no tool takes org/workspace parameters. Selection resolution order: explicit prior `select_workspace` → auto-select when the user has exactly one org and workspace → throw a workspace-selection-required error whose message enumerates available orgs/workspaces with IDs so the model can immediately call `select_workspace`. Move the selection store (and the service-JWT cache) from in-memory maps to Redis (already provisioned for MCP sessions), keyed by userId, with the same 24h TTL.

## Alternatives Considered
| Option | Why Rejected |
|---|---|
| `workspaceId` param on every tool | Leaks IDs into transcripts, bloats every schema, agents pass stale/wrong IDs |
| Workspace bound at OAuth time (scope/claim) | PropelAuth flow doesn't offer per-workspace consent UI; re-auth to switch workspace is hostile |
| Keep in-memory selection | Known v3 defect: lost on deploy/restart, blocks replicas |

## Consequences
Easier: smallest possible tool schemas; safe multi-tenancy by construction; horizontal scaling unblocked. Harder: one more Redis dependency on the hot path (fall back to in-memory with the existing warning when `REDIS_URL` is absent, dev only).
