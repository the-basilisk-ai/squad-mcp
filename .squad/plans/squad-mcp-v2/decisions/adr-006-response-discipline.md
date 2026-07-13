# ADR-006: Response Discipline — Cursor Pagination, Trimmed Lists, Markdown Documents, Enum-Collapsed Verbs
> Date: 2026-07-13 | Status: Accepted

## Context
v3 returned full tables with no pagination (tolerable at OST-era volumes) and one tool per CRUD verb (40 tools). Squad v2 workspaces accumulate thousands of signals, documents are stored as BlockNote block JSON, and MCP responses land directly in a client model's context window — response size is a correctness concern, not a nicety.

## Decision
Four rules, enforced by shared helpers so they cannot be skipped per-tool:
1. **Cursor pagination on every list** — `limit` (default ≤ 25, max 100) + opaque `cursor`; responses carry `nextCursor` and `total` where cheap.
2. **Trimmed list shape** — lists return `displayId`, `title`, `status`/`type`, key counts, deep link; never full bodies. Descriptions say "use get_entity for detail".
3. **Markdown as the document interchange format** — `get_document` uses `documentMarkdownExport`; `create_document`/`update_document` accept markdown and convert server-side. Block JSON never crosses the MCP boundary.
4. **Enum-collapsed verbs** — status transitions are one tool with a status enum (`update_action_status`: start/complete/dismiss/snooze), not four tools. Same principle wherever verbs share an object.

Plus the async-trigger contract: generation/research triggers return `{ id, status, checkWith }` for polling via `get_entity` — never fire-and-forget.

## Alternatives Considered
| Option | Why Rejected |
|---|---|
| Offset pagination | Unstable under live inserts (signals stream in continuously) |
| Full objects in lists "for fewer round trips" | Blows client context; v3's trimming was the single most-praised convention |
| Block JSON passthrough for documents | Agent-hostile; every client would reimplement rendering |
| Per-verb tools for discoverability | Description tax outweighs it; the enum is self-documenting in one schema |

## Consequences
Easier: predictable token cost per call; response-size telemetry meaningful per tool. Harder: markdown↔blocks conversion fidelity must be tested (round-trip tests in Milestone 4); cursor implementation needs stable sort keys per list.
