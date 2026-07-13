# ADR-003: OAuth 2.1 for Clients; Per-User Minted Service JWT for Backend Calls
> Date: 2026-07-13 | Status: Accepted

## Context
Squad v2 GraphQL requires a PropelAuth user JWT (`validateAccessToken`) and derives tenant context from it plus an `x-workspace-id` header. Org API keys are accepted only by the signal-ingest REST route. MCP clients authenticate via OAuth 2.1; the access token they present is an opaque token validated by introspection, not a JWT the backend accepts.

## Decision
Carry over the v3 auth chain unchanged in shape: PropelAuth as OAuth 2.1 issuer (scopes `read:workspace`, `write:workspace`, `openid`, `email`; code + refresh grants; RFC 9728 protected-resource metadata), introspection on every request, and a per-user **minted service JWT** (PropelAuth `createAccessToken`, 60-min TTL, cached ~55 min) attached to every Squad v2 API call together with `x-workspace-id`. Enforce scope-to-annotation mapping: tools with `readOnlyHint: false` require `write:workspace`.

Risk assessment: **low**. The old Squad API accepted exactly these two credential types (PropelAuth JWTs + org API keys), and the minted service token is a standard PropelAuth access token — the same artifact `validateAccessToken` verifies in the new API. The token-exchange code carries over as-is; Milestone 1 Task 03 keeps a short sanity check (env/issuer config differences) rather than a true spike.

## Alternatives Considered
| Option | Why Rejected |
|---|---|
| Forward the client's OAuth access token to GraphQL | Backend doesn't accept it; couples backend to MCP token format |
| Org API keys as MCP auth | Only reaches ingest today; no user identity for audit/provenance; headless key-scoped reads deferred to a backend decision post-launch |
| Static machine account per org | Breaks per-user audit trail and PropelAuth RBAC |

## Consequences
Easier: reuse of `introspectToken`/`mintToken`/`with-auth` modules; per-user audit trail preserved in `audit_events`. Harder: PropelAuth remains a hard runtime dependency; token-mint failures need their own alert (PRD monitoring section).
