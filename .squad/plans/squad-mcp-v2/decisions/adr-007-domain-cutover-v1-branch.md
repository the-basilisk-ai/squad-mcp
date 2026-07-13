# ADR-007: Domain Cutover — v3 Moves to v1.mcp.meetsquad.ai, the New Server Takes mcp.meetsquad.ai
> Date: 2026-07-13 | Status: Accepted

## Context
v3 serves live traffic at `mcp.meetsquad.ai/mcp` (Claude connectors, Smithery, OpenAI Apps, MCP Registry listing). The new server replaces the entire tool surface against a different backend, so the two cannot share a deployment — but old-product customers may still need v3 while they migrate, and main must be free to evolve into the new server without redeploying legacy code.

## Decision
- Cut a **`v1` branch** from the last v3.0.0 commit on main. v1 prod gets its **own Railway environment** in the `squad-mcp` project with a **dedicated Redis**, deploying from `v1` (branch-based CI/CD, not main) and serving **`v1.mcp.meetsquad.ai/mcp`** with `MCP_URL=https://v1.mcp.meetsquad.ai` (drives baseUrl, OAuth protected-resource metadata, and widget deep links).
- Environment topology after the split: today's `dev`/`uat`/`production` (mirroring the old Squad API) collapses for the new server to **`dev` + `production`** (mirroring the Squad v2 API environments), plus the isolated v1 environment. The `uat` environment and its services retire with v3.
- **`main` becomes the new server**: the existing Railway service continues deploying from main, retains the `mcp.meetsquad.ai` domain, and serves the new server at launch. Pre-launch, main deploys are validated via the Railway-generated preview/staging domain so the production domain never serves a half-built the new server.
- The branch/service split happens **before** any new-server demolition lands on main (Milestone 1, Task 00). The public cutover (announcing the new server on `mcp.meetsquad.ai`, comms, registry version bump) is a Milestone 5 launch task.
- MCP Registry listing `ai.meetsquad/squad` stays pointed at `mcp.meetsquad.ai` and bumps to 4.0.0 at launch; the v1 domain is not separately listed (legacy escape hatch, linked from release notes only).
- `v1` branch policy: security/critical fixes only, no feature work; sunset date decided post-launch based on traffic.

## Alternatives Considered
| Option | Why Rejected |
|---|---|
| In-place replacement, no legacy domain | Strands old-product customers instantly; no rollback path if the new server launch slips after DNS changes |
| New server on a new domain (`mcp2.meetsquad.ai`), v3 keeps the primary | Primary domain + registry listing should carry the current product; legacy gets the qualifier |
| Long-lived new-server feature branch, main stays v3 | Inverts normal flow; CI, PRs, and this plan all target main; branch drift risk for months of work |
| Separate repo for v1 | Overkill for a frozen service; branch + separate Railway service achieves isolation |

## Consequences
Easier: main develops freely; instant rollback (repoint `mcp.meetsquad.ai` at the v1 environment's service); old customers keep working during migration; dedicated Redis means zero shared state between v1 and the new server. Harder: one extra Railway environment to operate until v1 sunsets; OAuth resource metadata differs per domain so each service needs its own `MCP_URL` (already env-driven in v3 `server.ts`); clients connected to `mcp.meetsquad.ai` will see a new tool surface at cutover — requires launch comms, though OAuth sessions themselves remain valid (same PropelAuth issuer).
