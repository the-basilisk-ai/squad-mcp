# ADR-005: Polymorphic `get_entity` Keyed on Display IDs
> Date: 2026-07-13 | Status: Accepted

## Context
Squad v2 mints typed display IDs per workspace: `SI-N` (signal), `IN-N` (insight), `AC-N` (action), `GL-N` (goal); one-pagers also have display IDs. These are the identifiers humans and agents naturally exchange ("look at IN-42"). The GraphQL single-entity queries already accept display IDs. v3 shipped six near-identical `get_*` tools.

## Decision
One `get_entity(id, include?)` tool. Routing: UUID → type resolved by lookup; display ID → type resolved by prefix. `include` requests expansions per type (e.g. insights: `evidence` = supporting signals with source links; actions: `insight`, `goals`; documents: `provenance`, `versions`). Unknown prefix → error listing valid prefixes and example IDs. Documents and one-pagers are included via their display/UUID ids; document content always returns as markdown (ADR-006).

`get_action_context` remains a separate tool despite overlapping `get_entity(AC-N, include: everything)`: it is the single most important workflow bundle and deserves its own name, description, and telemetry.

## Alternatives Considered
| Option | Why Rejected |
|---|---|
| Six per-entity `get_*` tools (v3 style) | 6× description tax in every client context for identical semantics |
| `get_entity(type, id)` with explicit type param | Redundant — the prefix already encodes type; two params to get wrong instead of one |
| Fold `get_action_context` into `get_entity` | Buries the flagship workflow in an `include` enum; loses intent-level telemetry |

## Consequences
Easier: agents use IDs exactly as humans write them; tool count drops. Harder: response schema varies by entity type (documented per-type in the tool description; acceptable — agents handle heterogeneous JSON well when shapes are labeled).
